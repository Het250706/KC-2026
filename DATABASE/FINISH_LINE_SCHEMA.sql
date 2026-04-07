-- ============================================================================
-- KESHAV CUP - FINAL STABLE PRODUCTION SCHEMA
-- Matches USER REQUEST exactly and incorporates real-time features
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TEAMS TABLE
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_name TEXT NOT NULL UNIQUE,
    captain_name TEXT,
    captain_email TEXT UNIQUE,
    purse_remaining BIGINT DEFAULT 1000000000, -- 100 Cr
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. PLAYERS TABLE
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT,
    category TEXT,
    batting_style TEXT,
    bowling_style TEXT,
    base_price BIGINT NOT NULL,
    current_bid BIGINT DEFAULT 0,
    sold_price BIGINT,
    sold_team TEXT,
    auction_status TEXT DEFAULT 'pending' CHECK (auction_status IN ('pending', 'active', 'sold', 'unsold')),
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. BIDS TABLE
CREATE TABLE IF NOT EXISTS bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    bid_amount BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. AUCTION STATE (Singleton for managing live auction)
CREATE TABLE IF NOT EXISTS auction_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'active', 'paused', 'finished')),
    current_player_id UUID REFERENCES players(id),
    timer_duration INTEGER DEFAULT 30,
    timer_remaining INTEGER DEFAULT 30,
    bid_increment BIGINT DEFAULT 1000000, -- 10 Lakh
    last_bid_team_id UUID REFERENCES teams(id),
    current_highest_bid BIGINT DEFAULT 0,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT singleton_check CHECK (id = 1)
);

-- Initialize auction state
INSERT INTO auction_state (id, status) VALUES (1, 'idle') ON CONFLICT (id) DO NOTHING;

-- 6. REALTIME ENABLEMENT
-- Note: Run these individually if they fail in a transaction
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE auction_state;
ALTER PUBLICATION supabase_realtime ADD TABLE bids;

-- 7. ROW LEVEL SECURITY (RLS)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Select policies (Public read)
CREATE POLICY "Allow public read teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Allow public read players" ON players FOR SELECT USING (true);
CREATE POLICY "Allow public read auction_state" ON auction_state FOR SELECT USING (true);
CREATE POLICY "Allow public read bids" ON bids FOR SELECT USING (true);

-- Authenticated/Admin policies
-- Simple policy: if authenticated, allow all. In production, check for specific roles.
CREATE POLICY "Allow all for authenticated" ON teams FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON players FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON auction_state FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON bids FOR ALL TO authenticated USING (true);

-- 8. DATABASE FUNCTIONS FOR ATOMIC OPERATIONS
CREATE OR REPLACE FUNCTION place_bid_secure(
    p_player_id UUID,
    p_team_id UUID,
    p_amount BIGINT
) RETURNS JSON AS $$
DECLARE
    v_current_highest BIGINT;
    v_team_purse BIGINT;
BEGIN
    -- Get current highest bid from auction_state
    SELECT current_highest_bid INTO v_current_highest
    FROM auction_state
    WHERE id = 1;
    
    -- Get team purse
    SELECT purse_remaining INTO v_team_purse
    FROM teams WHERE id = p_team_id;
    
    -- Validate bid is higher
    IF p_amount <= v_current_highest THEN
        RETURN json_build_object('success', false, 'error', 'Bid too low');
    END IF;
    
    -- Validate team has purse
    IF v_team_purse < p_amount THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient purse');
    END IF;
    
    -- Update auction state
    UPDATE auction_state SET
        current_highest_bid = p_amount,
        last_bid_team_id = p_team_id,
        timer_remaining = 30, -- Reset timer on bid
        last_update = NOW()
    WHERE id = 1;

    -- Update player current bid
    UPDATE players SET current_bid = p_amount WHERE id = p_player_id;
    
    -- Record in bids table
    INSERT INTO bids (player_id, team_id, bid_amount)
    VALUES (p_player_id, p_team_id, p_amount);
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION sell_player_atomic(
    p_player_id UUID,
    p_team_id UUID,
    p_price BIGINT
) RETURNS JSON AS $$
DECLARE
    v_team_purse BIGINT;
    v_team_name TEXT;
BEGIN
    -- Get team details
    SELECT purse_remaining, team_name INTO v_team_purse, v_team_name
    FROM teams WHERE id = p_team_id;
    
    -- Validate
    IF v_team_purse < p_price THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient purse');
    END IF;
    
    -- Update player
    UPDATE players SET
        sold_price = p_price,
        sold_team = v_team_name,
        auction_status = 'sold'
    WHERE id = p_player_id;
    
    -- Update team budget
    UPDATE teams SET
        purse_remaining = purse_remaining - p_price
    WHERE id = p_team_id;
    
    -- Reset auction state
    UPDATE auction_state SET
        status = 'idle',
        current_player_id = NULL,
        current_highest_bid = 0,
        last_bid_team_id = NULL
    WHERE id = 1;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
