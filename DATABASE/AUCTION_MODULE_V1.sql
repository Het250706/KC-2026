-- KESHAV CUP - COMPLETE LIVE AUCTION SYSTEM SETUP
-- This script ensures all tables, functions, and real-time settings are correct.

-- 1. Ensure PLAYERS table is correct with all requested fields
ALTER TABLE players ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS cricket_skill TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS was_present_kc3 TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS base_price BIGINT DEFAULT 10000;
ALTER TABLE players ADD COLUMN IF NOT EXISTS auction_status TEXT DEFAULT 'pending' CHECK (auction_status IN ('pending', 'active', 'sold', 'unsold'));
ALTER TABLE players ADD COLUMN IF NOT EXISTS sold_price BIGINT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS sold_team_id UUID;

-- 2. Ensure TEAMS table is correct
ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_name TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS purse_remaining BIGINT DEFAULT 100000000; -- 10 Crore default
ALTER TABLE teams ADD COLUMN IF NOT EXISTS captain_email TEXT;

-- 3. Create AUCTION_STATE table (Singleton)
CREATE TABLE IF NOT EXISTS auction_state (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    current_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'IDLE' CHECK (status IN ('IDLE', 'BIDDING', 'SOLD', 'UNSOLD')),
    bidding_status TEXT NOT NULL DEFAULT 'IDLE' CHECK (bidding_status IN ('IDLE', 'BIDDING OPEN', 'GOING ONCE', 'GOING TWICE', 'SOLD')),
    current_highest_bid BIGINT NOT NULL DEFAULT 0,
    highest_bid_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial state if not exists
INSERT INTO auction_state (id, status, bidding_status) 
VALUES (1, 'IDLE', 'IDLE')
ON CONFLICT (id) DO NOTHING;

-- 4. Create BIDS table for history
CREATE TABLE IF NOT EXISTS bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Atomic Transaction: Place Bid
-- This function handles the increment, purse check, and state update safely.
CREATE OR REPLACE FUNCTION place_bid_v2(
    p_team_id UUID,
    p_increment BIGINT
) RETURNS JSONB AS $$
DECLARE
    v_current_player_id UUID;
    v_current_bid BIGINT;
    v_new_bid BIGINT;
    v_team_purse BIGINT;
    v_team_name TEXT;
    v_auction_status TEXT;
BEGIN
    -- 1. Get current auction state with row lock
    SELECT current_player_id, current_highest_bid, status 
    INTO v_current_player_id, v_current_bid, v_auction_status
    FROM auction_state WHERE id = 1 FOR UPDATE;

    -- 2. Validation: Is auction active?
    IF v_auction_status != 'BIDDING' OR v_current_player_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No active bidding for any player');
    END IF;

    -- 3. Calculate new bid
    -- If it's the first bid for this player, start from base_price or increment from current
    IF v_current_bid = 0 THEN
        -- Get base price of current player
        SELECT base_price INTO v_current_bid FROM players WHERE id = v_current_player_id;
        v_new_bid := v_current_bid;
    ELSE
        v_new_bid := v_current_bid + p_increment;
    END IF;

    -- 4. Check Team Purse
    SELECT purse_remaining, team_name INTO v_team_purse, v_team_name
    FROM teams WHERE id = p_team_id;

    IF v_team_purse < v_new_bid THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient purse for ' || v_team_name);
    END IF;

    -- 5. Insert Bid Record
    INSERT INTO bids (player_id, team_id, amount)
    VALUES (v_current_player_id, p_team_id, v_new_bid);

    -- 6. Update Auction State
    UPDATE auction_state SET
        current_highest_bid = v_new_bid,
        highest_bid_team_id = p_team_id,
        bidding_status = 'BIDDING OPEN',
        last_updated_at = NOW()
    WHERE id = 1;

    RETURN jsonb_build_object('success', true, 'new_bid', v_new_bid, 'team_name', v_team_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Atomic Transaction: Sell Player
CREATE OR REPLACE FUNCTION sell_player_v2() 
RETURNS JSONB AS $$
DECLARE
    v_player_id UUID;
    v_team_id UUID;
    v_final_bid BIGINT;
BEGIN
    -- 1. Get state
    SELECT current_player_id, highest_bid_team_id, current_highest_bid
    INTO v_player_id, v_team_id, v_final_bid
    FROM auction_state WHERE id = 1;

    IF v_player_id IS NULL OR v_team_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No winner to sell to');
    END IF;

    -- 2. Update Player
    UPDATE players SET
        auction_status = 'sold',
        sold_price = v_final_bid,
        sold_team_id = v_team_id
    WHERE id = v_player_id;

    -- 3. Deduct from Team Purse
    UPDATE teams SET
        purse_remaining = purse_remaining - v_final_bid
    WHERE id = v_team_id;

    -- 4. Update Auction State
    UPDATE auction_state SET
        status = 'SOLD',
        bidding_status = 'SOLD',
        last_updated_at = NOW()
    WHERE id = 1;

    RETURN jsonb_build_object('success', true, 'player_id', v_player_id, 'team_id', v_team_id, 'price', v_final_bid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE auction_state;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE bids;

-- 8. RLS Policies
ALTER TABLE auction_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view auction state" ON auction_state;
CREATE POLICY "Anyone can view auction state" ON auction_state FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view bids" ON bids;
CREATE POLICY "Anyone can view bids" ON bids FOR SELECT USING (true);

-- Note: Admin functions are bypassing RLS via SECURITY DEFINER
