-- FINAL AUCTION SETUP (100 Start / 100 Gap / 6000 points)
-- Run this ONCE in Supabase SQL Editor to finalize all rules

-- 1. CLEAN UP PREVIOUS MISTAKES (Prevents "Already exists" errors)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'draft_order') THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE draft_order';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'draft_state') THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE draft_state';
    END IF;
END $$;

-- 2. UPDATE TABLE DEFAULTS
ALTER TABLE teams ALTER COLUMN remaining_budget SET DEFAULT 6000;
ALTER TABLE players ALTER COLUMN base_price SET DEFAULT 100;

-- 3. RESET CURRENT DATA TO THE NEW RULES
UPDATE teams SET remaining_budget = 6000 WHERE id IS NOT NULL;
UPDATE players SET base_price = 100 WHERE id IS NOT NULL;
UPDATE auction_state SET bidding_status = 'IDLE', current_highest_bid = 0, highest_bid_team_id = NULL WHERE id IS NOT NULL;

-- 4. NEW BIDDING FUNCTION (100 Increment Rule)
-- First, drop old variants to prevent collision
DROP FUNCTION IF EXISTS place_bid_v3(uuid, bigint);
DROP FUNCTION IF EXISTS place_bid_v3(uuid, integer);

CREATE OR REPLACE FUNCTION place_bid_v3(p_team_id uuid, p_increment int DEFAULT 0)
RETURNS json AS $$
DECLARE
    v_current_player_id uuid;
    v_current_highest_bid int;
    v_team_budget int;
    v_next_bid int;
BEGIN
    -- Get current state
    SELECT current_player_id, current_highest_bid 
    INTO v_current_player_id, v_current_highest_bid
    FROM auction_state LIMIT 1;

    IF v_current_player_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'No active player');
    END IF;

    -- Calculate next bid (ALWAYS +100)
    IF v_current_highest_bid IS NULL OR v_current_highest_bid = 0 THEN
        SELECT base_price INTO v_next_bid FROM players WHERE id = v_current_player_id;
        IF v_next_bid IS NULL OR v_next_bid = 0 THEN v_next_bid := 100; END IF;
    ELSE
        v_next_bid := v_current_highest_bid + 100;
    END IF;

    -- Safety Check (Total 6000)
    IF v_next_bid > 6000 THEN
        RETURN json_build_object('success', false, 'error', 'Bid exceeds 6000 limit');
    END IF;

    -- Team Budget Check
    SELECT remaining_budget INTO v_team_budget FROM teams WHERE id = p_team_id;
    IF v_team_budget < v_next_bid THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient budget');
    END IF;

    -- Update state
    UPDATE auction_state 
    SET current_highest_bid = v_next_bid,
        highest_bid_team_id = p_team_id,
        status = 'BIDDING'
    WHERE id IS NOT NULL;

    RETURN json_build_object('success', true, 'new_bid', v_next_bid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
