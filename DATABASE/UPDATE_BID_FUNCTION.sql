-- Update the bidding function to use the new 100-increment rule
CREATE OR REPLACE FUNCTION place_bid_v3(p_team_id uuid, p_increment int DEFAULT 0)
RETURNS json AS $$
DECLARE
    v_current_player_id uuid;
    v_current_highest_bid int;
    v_highest_bid_team_id uuid;
    v_team_budget int;
    v_next_bid int;
BEGIN
    -- Get current state
    SELECT current_player_id, current_highest_bid, highest_bid_team_id 
    INTO v_current_player_id, v_current_highest_bid, v_highest_bid_team_id 
    FROM auction_state LIMIT 1;

    IF v_current_player_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'No active player');
    END IF;

    -- Calculate next bid (ALWAYS +100 as per new rules)
    IF v_current_highest_bid IS NULL OR v_current_highest_bid = 0 THEN
        -- If no bid yet, start at base_price (which we set to 100) or just 100
        SELECT base_price INTO v_next_bid FROM players WHERE id = v_current_player_id;
        IF v_next_bid IS NULL OR v_next_bid = 0 THEN
            v_next_bid := 100;
        END IF;
    ELSE
        v_next_bid := v_current_highest_bid + 100;
    END IF;

    -- Check if next bid exceeds purse limit constant 3000
    IF v_next_bid > 3000 THEN
        RETURN json_build_object('success', false, 'error', 'Bid exceeds 3000 limit');
    END IF;

    -- Check team budget
    SELECT remaining_budget INTO v_team_budget FROM teams WHERE id = p_team_id;
    IF v_team_budget < v_next_bid THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient team budget');
    END IF;

    -- Update auction state
    UPDATE auction_state 
    SET current_highest_bid = v_next_bid,
        highest_bid_team_id = p_team_id,
        status = 'BIDDING', -- Ensure status is bidding
        last_bid_time = now();

    RETURN json_build_object('success', true, 'new_bid', v_next_bid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
