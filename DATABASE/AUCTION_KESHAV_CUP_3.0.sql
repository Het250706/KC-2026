-- KESHAV CUP 3.0 - REPAIRED AUCTION SYSTEM MIGRATION
-- This script fixes the "column does not exist" error by ensuring a clean state for the auction controller.

-- ==========================================
-- 1. PREPARE PLAYERS TABLE
-- ==========================================
ALTER TABLE players ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS cricket_skill TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS was_present_kc3 TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS base_price BIGINT DEFAULT 10000;
ALTER TABLE players ADD COLUMN IF NOT EXISTS auction_status TEXT DEFAULT 'pending';
ALTER TABLE players ADD COLUMN IF NOT EXISTS sold_price BIGINT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS sold_team_id UUID;

-- Clear any conflicting constraints if they exist (optional but safer)
DO $$ 
BEGIN 
    ALTER TABLE players DROP CONSTRAINT IF EXISTS auction_status_check;
    ALTER TABLE players ADD CONSTRAINT auction_status_check CHECK (auction_status IN ('pending', 'active', 'sold', 'unsold'));
EXCEPTION WHEN OTHERS THEN 
    NULL; 
END $$;

-- ==========================================
-- 2. PREPARE TEAMS TABLE
-- ==========================================
-- Standard columns for Keshav Cup 3.0
ALTER TABLE teams ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS remaining_budget BIGINT DEFAULT 5000;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS captain_email TEXT;

-- ==========================================
-- 3. RESET AUCTION STATE (CLEAN SLATE)
-- ==========================================
-- We drop and recreate this table to ensure the schema matches our app perfectly.
DROP TABLE IF EXISTS auction_state CASCADE;

CREATE TABLE auction_state (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    current_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'IDLE' CHECK (status IN ('IDLE', 'BIDDING', 'SOLD', 'UNSOLD')),
    bidding_status TEXT NOT NULL DEFAULT 'IDLE' CHECK (bidding_status IN ('IDLE', 'BIDDING OPEN', 'GOING ONCE', 'GOING TWICE', 'SOLD')),
    current_highest_bid BIGINT NOT NULL DEFAULT 0,
    highest_bid_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert the singleton record
INSERT INTO auction_state (id, status, bidding_status) VALUES (1, 'IDLE', 'IDLE');

-- ==========================================
-- 4. RESET BIDS TABLE (CLEAN SLATE)
-- ==========================================
DROP TABLE IF EXISTS bids CASCADE;

CREATE TABLE bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 5. AUCTION LOGIC FUNCTIONS
-- ==========================================

-- FUNCTION: Place Bid (Atomic)
CREATE OR REPLACE FUNCTION place_bid_v3(
    p_team_id UUID,
    p_increment BIGINT
) RETURNS JSONB AS $$
DECLARE
    v_state_record RECORD;
    v_player_record RECORD;
    v_team_record RECORD;
    v_new_bid BIGINT;
BEGIN
    -- 1. Lock state record for writing
    SELECT * INTO v_state_record FROM auction_state WHERE id = 1 FOR UPDATE;

    -- 2. Validate state
    IF v_state_record.status != 'BIDDING' OR v_state_record.current_player_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No active bidding session.');
    END IF;

    -- 3. Calculate New Bid (Staged)
    DECLARE
        stages BIGINT[] := ARRAY[5,10,15,20,25,50,75,100,125,175,225,275,325,425,525,625,750,875,1000,1250,1500,1750,2000,2375,2750,3125,3500,3875,4375,5000];
        current_idx INTEGER;
    BEGIN
        IF v_state_record.current_highest_bid = 0 THEN
            v_new_bid := 5;
        ELSE
            SELECT i INTO current_idx FROM unnest(stages) WITH ORDINALITY AS t(val, i) WHERE val = v_state_record.current_highest_bid LIMIT 1;
            IF current_idx IS NULL OR current_idx >= 30 THEN
                RETURN jsonb_build_object('success', false, 'error', 'Maximum bid reached.');
            END IF;
            v_new_bid := stages[current_idx + 1];
        END IF;
    END;

    -- 4. Validate Team Purse & Squad
    SELECT * INTO v_team_record FROM teams WHERE id = p_team_id;
    IF v_team_record.remaining_budget < v_new_bid THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient Pushp Points.');
    END IF;

    -- 5. Insert Bid
    INSERT INTO bids (player_id, team_id, amount)
    VALUES (v_state_record.current_player_id, p_team_id, v_new_bid);

    -- 6. Update State
    UPDATE auction_state SET
        current_highest_bid = v_new_bid,
        highest_bid_team_id = p_team_id,
        bidding_status = 'BIDDING OPEN',
        last_updated_at = NOW()
    WHERE id = 1;

    RETURN jsonb_build_object('success', true, 'new_bid', v_new_bid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCTION: Mark Player Sold
CREATE OR REPLACE FUNCTION sell_player_v3() 
RETURNS JSONB AS $$
DECLARE
    v_state_record RECORD;
BEGIN
    SELECT * INTO v_state_record FROM auction_state WHERE id = 1 FOR UPDATE;

    IF v_state_record.current_player_id IS NULL OR v_state_record.highest_bid_team_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No winner to sell to.');
    END IF;

    -- Update Player
    UPDATE players SET
        auction_status = 'sold',
        sold_price = v_state_record.current_highest_bid,
        sold_team_id = v_state_record.highest_bid_team_id
    WHERE id = v_state_record.current_player_id;

    -- Deduct from Team
    UPDATE teams SET
        remaining_budget = remaining_budget - v_state_record.current_highest_bid
    WHERE id = v_state_record.highest_bid_team_id;

    -- Update State to SOLD
    UPDATE auction_state SET
        status = 'SOLD',
        bidding_status = 'SOLD',
        last_updated_at = NOW()
    WHERE id = 1;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 6. ENABLE REALTIME
-- ==========================================
-- Ensure realtime is active for our specific tables
DO $$ 
BEGIN 
    -- Try to add tables to publication, ignore if already exists
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE auction_state;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE bids;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE teams;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE players;
    EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
