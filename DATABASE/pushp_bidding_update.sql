-- PUSHP BASED BIDDING LOGIC - KC3 (30 STAGES)
-- This script updates the bidding logic to follow the 30-step Pushp Points progression.

-- 1. Update Team Purses to 5000 Pushp
UPDATE teams SET remaining_budget = 5000;
ALTER TABLE teams ALTER COLUMN remaining_budget SET DEFAULT 5000;

-- 2. Update Place Bid Function
CREATE OR REPLACE FUNCTION place_bid_v3(
    p_team_id UUID,
    p_increment BIGINT -- IGNORED
) RETURNS JSONB AS $$
DECLARE
    v_state_record RECORD;
    v_player_record RECORD;
    v_team_record RECORD;
    v_new_bid BIGINT;
    v_bidding_stages BIGINT[] := ARRAY[
        5, 10, 15, 20, 25, 50, 75, 100, 125, 175,
        225, 275, 325, 425, 525, 625, 750, 875, 1000, 1150,
        1300, 1450, 1600, 1800, 2000, 2500, 3125, 3750, 4375, 5000
    ];
    v_current_index INTEGER;
    v_squad_count INTEGER;
BEGIN
    -- 1. Lock state record
    SELECT * INTO v_state_record FROM auction_state WHERE id = 1 FOR UPDATE;

    -- 2. Validate state
    IF v_state_record.status != 'BIDDING' OR v_state_record.current_player_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No active bidding session.');
    END IF;

    -- 3. Get Player Info
    SELECT * INTO v_player_record FROM players WHERE id = v_state_record.current_player_id;

    -- 4. Calculate New Bid based on 30-step progression
    IF v_state_record.current_highest_bid = 0 THEN
        v_new_bid := 5;
    ELSE
        v_current_index := 0;
        FOR i IN 1..array_length(v_bidding_stages, 1) LOOP
            IF v_bidding_stages[i] >= v_state_record.current_highest_bid THEN
                v_current_index := i;
                EXIT;
            END IF;
        END LOOP;

        IF v_current_index >= array_length(v_bidding_stages, 1) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Max bid reached (5000 Pushp).');
        END IF;

        v_new_bid := v_bidding_stages[v_current_index + 1];
    END IF;

    -- 5. Validate Team Purse & Squad Size
    SELECT * INTO v_team_record FROM teams WHERE id = p_team_id;
    
    -- Check Squad Size (Max 9)
    SELECT count(*) INTO v_squad_count FROM players WHERE team_id = p_team_id AND auction_status = 'sold';
    IF v_squad_count >= 9 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Squad Full (9/9)');
    END IF;

    IF v_team_record.remaining_budget < v_new_bid THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient Pushp Points');
    END IF;
    
    -- 7. Insert Bid
    INSERT INTO bids (player_id, team_id, amount)
    VALUES (v_player_record.id, p_team_id, v_new_bid);

    -- 8. Update State
    UPDATE auction_state SET
        current_highest_bid = v_new_bid,
        highest_bid_team_id = p_team_id,
        bidding_status = 'BIDDING OPEN',
        last_updated_at = NOW()
    WHERE id = 1;

    RETURN jsonb_build_object('success', true, 'new_bid', v_new_bid, 'team_name', v_team_record.name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. SELL PLAYER FUNCTION
CREATE OR REPLACE FUNCTION sell_player_v3() RETURNS JSONB AS $$
DECLARE
    v_state RECORD;
BEGIN
    SELECT * INTO v_state FROM auction_state LIMIT 1;
    IF v_state.current_player_id IS NULL OR v_state.highest_bid_team_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No active player or no bids.');
    END IF;

    -- Update player
    UPDATE players SET 
        auction_status = 'sold',
        team_id = v_state.highest_bid_team_id,
        sold_price = v_state.current_highest_bid,
        updated_at = NOW()
    WHERE id = v_state.current_player_id;

    -- Deduct budget
    UPDATE teams SET 
        remaining_budget = remaining_budget - v_state.current_highest_bid
    WHERE id = v_state.highest_bid_team_id;

    -- Clear state
    UPDATE auction_state SET 
        status = 'SOLD',
        current_player_id = NULL,
        highest_bid_team_id = NULL,
        current_highest_bid = 0,
        bidding_status = 'SOLD',
        last_updated_at = NOW()
    WHERE id = 1;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
