-- SECURE & FAST Bidding Function
-- This runs as a single transaction on the server, preventing race conditions.

CREATE OR REPLACE FUNCTION place_bid_secure(
    p_team_id UUID
) 
RETURNS JSONB AS $$
DECLARE
    v_current_highest BIGINT;
    v_budget BIGINT;
    v_new_bid BIGINT;
    v_stages BIGINT[] := ARRAY[5,10,15,20,25,50,75,100,125,175,225,275,325,425,525,625,750,875,1000,1250,1500,1750,2000,2375,2750,3125,3500,3875,4375,5000];
    v_current_idx INTEGER;
    v_squad_count INTEGER;
BEGIN
    -- 1. Lock state record
    SELECT * INTO v_current_highest FROM auction_state WHERE id = 1 FOR UPDATE;

    -- 2. Calculate New Bid
    IF v_current_highest = 0 THEN
        v_new_bid := 5;
    ELSE
        SELECT i INTO v_current_idx FROM unnest(v_stages) WITH ORDINALITY AS t(val, i) WHERE val = v_current_highest LIMIT 1;
        IF v_current_idx IS NULL OR v_current_idx >= 30 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Max bid reached');
        END IF;
        v_new_bid := v_stages[v_current_idx + 1];
    END IF;

    -- 3. Check Team
    SELECT remaining_budget INTO v_budget FROM teams WHERE id = p_team_id;
    SELECT count(*) INTO v_squad_count FROM players WHERE team_id = p_team_id AND auction_status = 'sold';

    IF v_squad_count >= 9 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Squad limit (9) reached');
    END IF;

    IF v_budget < v_new_bid THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient Pushp Points');
    END IF;

    -- 4. Atomic Update
    INSERT INTO bids (player_id, team_id, amount)
    SELECT current_player_id, p_team_id, v_new_bid FROM auction_state WHERE id = 1;

    UPDATE auction_state
    SET current_highest_bid = v_new_bid,
        highest_bid_team_id = p_team_id,
        bidding_status = 'BIDDING OPEN'
    WHERE id = 1;

    RETURN jsonb_build_object('success', true, 'amount', v_new_bid);
END;
$$ LANGUAGE plpgsql;
$$ LANGUAGE plpgsql;
