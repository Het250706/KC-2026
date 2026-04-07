-- ============================================================================
-- KESHAV CUP - Enterprise Cricket Auction Platform
-- Database Schema with ACID Compliance and Row-Level Security
-- ============================================================================

-- Drop existing tables if rebuilding
DROP TABLE IF EXISTS bids CASCADE;
DROP TABLE IF EXISTS squad CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS auction_state CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS admins CASCADE;

-- ============================================================================
-- 1. ADMINS TABLE
-- ============================================================================
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'ADMIN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Index for fast email lookup
CREATE INDEX idx_admins_email ON admins(email);

-- ============================================================================
-- 2. TEAMS TABLE
-- ============================================================================
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name TEXT UNIQUE NOT NULL,
    captain_email TEXT UNIQUE NOT NULL,
    purse_remaining INTEGER NOT NULL DEFAULT 100000000, -- 10 Crore in paise
    players_bought_count INTEGER NOT NULL DEFAULT 0,
    max_players_allowed INTEGER NOT NULL DEFAULT 8,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT team_name_not_empty CHECK (LENGTH(TRIM(team_name)) > 0),
    CONSTRAINT captain_email_format CHECK (captain_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT purse_non_negative CHECK (purse_remaining >= 0),
    CONSTRAINT players_count_valid CHECK (players_bought_count >= 0 AND players_bought_count <= max_players_allowed)
);

-- Indexes for performance
CREATE INDEX idx_teams_captain_email ON teams(captain_email);
CREATE INDEX idx_teams_team_name ON teams(team_name);

-- ============================================================================
-- 3. PLAYERS TABLE
-- ============================================================================
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    batting_style TEXT NOT NULL,
    bowling_style TEXT NOT NULL,
    base_price INTEGER NOT NULL,
    sold_price INTEGER,
    sold_to_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    auction_status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT first_name_not_empty CHECK (LENGTH(TRIM(first_name)) > 0),
    CONSTRAINT last_name_not_empty CHECK (LENGTH(TRIM(last_name)) > 0),
    CONSTRAINT batting_style_valid CHECK (batting_style IN ('RIGHT_HANDED', 'LEFT_HANDED')),
    CONSTRAINT bowling_style_valid CHECK (bowling_style IN ('RIGHT_ARM', 'LEFT_ARM', 'NONE')),
    CONSTRAINT base_price_positive CHECK (base_price > 0),
    CONSTRAINT sold_price_valid CHECK (sold_price IS NULL OR sold_price >= base_price),
    CONSTRAINT auction_status_valid CHECK (auction_status IN ('pending', 'active', 'sold', 'unsold'))
);

-- Indexes for fast queries
CREATE INDEX idx_players_auction_status ON players(auction_status);
CREATE INDEX idx_players_sold_to_team ON players(sold_to_team_id);
CREATE INDEX idx_players_created_at ON players(created_at DESC);

-- ============================================================================
-- 4. AUCTION STATE TABLE (Singleton Pattern)
-- ============================================================================
CREATE TABLE auction_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    current_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    auction_status TEXT NOT NULL DEFAULT 'idle',
    current_highest_bid INTEGER NOT NULL DEFAULT 0,
    current_highest_bid_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    timer_remaining INTEGER NOT NULL DEFAULT 30,
    bid_increment INTEGER NOT NULL DEFAULT 1000000, -- 10 Lakh increment
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT auction_status_valid CHECK (auction_status IN ('idle', 'active', 'paused', 'sold')),
    CONSTRAINT current_highest_bid_non_negative CHECK (current_highest_bid >= 0),
    CONSTRAINT timer_valid CHECK (timer_remaining >= 0 AND timer_remaining <= 60),
    CONSTRAINT singleton_constraint CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- Ensure only one auction state exists
CREATE UNIQUE INDEX idx_auction_state_singleton ON auction_state(id);

-- Insert initial auction state
INSERT INTO auction_state (id, auction_status) 
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'idle')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. BIDS TABLE
-- ============================================================================
CREATE TABLE bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    bid_amount INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT bid_amount_positive CHECK (bid_amount > 0)
);

-- Indexes for bid history queries
CREATE INDEX idx_bids_player_id ON bids(player_id);
CREATE INDEX idx_bids_team_id ON bids(team_id);
CREATE INDEX idx_bids_created_at ON bids(created_at DESC);
CREATE INDEX idx_bids_player_created ON bids(player_id, created_at DESC);

-- ============================================================================
-- 6. SQUAD TABLE
-- ============================================================================
CREATE TABLE squad (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    purchase_price INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT purchase_price_positive CHECK (purchase_price > 0),
    CONSTRAINT unique_player_per_team UNIQUE (team_id, player_id)
);

-- Indexes for squad queries
CREATE INDEX idx_squad_team_id ON squad(team_id);
CREATE INDEX idx_squad_player_id ON squad(player_id);

-- ============================================================================
-- 7. ROW-LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE squad ENABLE ROW LEVEL SECURITY;

-- ADMINS TABLE POLICIES
CREATE POLICY "Admins can view all admin records" ON admins
    FOR SELECT USING (auth.uid() IN (SELECT id FROM admins));

CREATE POLICY "Admins can insert admin records" ON admins
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM admins));

-- TEAMS TABLE POLICIES
CREATE POLICY "Everyone can view teams" ON teams
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage teams" ON teams
    FOR ALL USING (auth.uid() IN (SELECT id FROM admins));

-- PLAYERS TABLE POLICIES
CREATE POLICY "Everyone can view players" ON players
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage players" ON players
    FOR ALL USING (auth.uid() IN (SELECT id FROM admins));

-- AUCTION STATE POLICIES
CREATE POLICY "Everyone can view auction state" ON auction_state
    FOR SELECT USING (true);

CREATE POLICY "Admins can update auction state" ON auction_state
    FOR UPDATE USING (auth.uid() IN (SELECT id FROM admins));

-- BIDS TABLE POLICIES
CREATE POLICY "Everyone can view bids" ON bids
    FOR SELECT USING (true);

CREATE POLICY "Captains can insert bids" ON bids
    FOR INSERT WITH CHECK (
        auth.uid() IN (SELECT id FROM teams WHERE id = team_id)
    );

-- SQUAD TABLE POLICIES
CREATE POLICY "Everyone can view squad" ON squad
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage squad" ON squad
    FOR ALL USING (auth.uid() IN (SELECT id FROM admins));

-- ============================================================================
-- 8. DATABASE FUNCTIONS FOR ATOMIC OPERATIONS
-- ============================================================================

-- Function to sell player (atomic transaction)
CREATE OR REPLACE FUNCTION sell_player(
    p_player_id UUID,
    p_team_id UUID,
    p_price INTEGER
) RETURNS JSON AS $$
DECLARE
    v_team_purse INTEGER;
    v_team_count INTEGER;
    v_max_players INTEGER;
BEGIN
    -- Get team details
    SELECT purse_remaining, players_bought_count, max_players_allowed
    INTO v_team_purse, v_team_count, v_max_players
    FROM teams WHERE id = p_team_id;
    
    -- Validate team has enough purse
    IF v_team_purse < p_price THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient purse');
    END IF;
    
    -- Validate team has slots
    IF v_team_count >= v_max_players THEN
        RETURN json_build_object('success', false, 'error', 'Team full');
    END IF;
    
    -- Update player
    UPDATE players SET
        sold_price = p_price,
        sold_to_team_id = p_team_id,
        auction_status = 'sold'
    WHERE id = p_player_id;
    
    -- Update team
    UPDATE teams SET
        purse_remaining = purse_remaining - p_price,
        players_bought_count = players_bought_count + 1
    WHERE id = p_team_id;
    
    -- Add to squad
    INSERT INTO squad (team_id, player_id, purchase_price)
    VALUES (p_team_id, p_player_id, p_price);
    
    -- Reset auction state
    UPDATE auction_state SET
        current_player_id = NULL,
        auction_status = 'idle',
        current_highest_bid = 0,
        current_highest_bid_team_id = NULL,
        timer_remaining = 30,
        last_updated_at = NOW()
    WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to place bid (with validation)
CREATE OR REPLACE FUNCTION place_bid(
    p_player_id UUID,
    p_team_id UUID,
    p_bid_amount INTEGER
) RETURNS JSON AS $$
DECLARE
    v_current_highest INTEGER;
    v_team_purse INTEGER;
BEGIN
    -- Get current highest bid
    SELECT current_highest_bid INTO v_current_highest
    FROM auction_state
    WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;
    
    -- Get team purse
    SELECT purse_remaining INTO v_team_purse
    FROM teams WHERE id = p_team_id;
    
    -- Validate bid is higher
    IF p_bid_amount <= v_current_highest THEN
        RETURN json_build_object('success', false, 'error', 'Bid too low');
    END IF;
    
    -- Validate team has purse
    IF v_team_purse < p_bid_amount THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient purse');
    END IF;
    
    -- Insert bid
    INSERT INTO bids (player_id, team_id, bid_amount)
    VALUES (p_player_id, p_team_id, p_bid_amount);
    
    -- Update auction state
    UPDATE auction_state SET
        current_highest_bid = p_bid_amount,
        current_highest_bid_team_id = p_team_id,
        timer_remaining = 30,
        last_updated_at = NOW()
    WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 9. SEED DATA
-- ============================================================================

-- Insert default admin
INSERT INTO admins (email, role) 
VALUES ('admin@keshav.com', 'ADMIN')
ON CONFLICT (email) DO NOTHING;

-- Insert sample teams
INSERT INTO teams (team_name, captain_email, purse_remaining, max_players_allowed) VALUES
('SHAURYAM', 'shauryam@keshav.com', 100000000, 8),
('DIVYAM', 'divyam@keshav.com', 100000000, 8),
('SATYAM', 'satyam@keshav.com', 100000000, 8),
('DASHATVAM', 'dashatvam@keshav.com', 100000000, 8),
('DHAIRYAM', 'dhairyam@keshav.com', 100000000, 8),
('GYANAM', 'gyanam@keshav.com', 100000000, 8),
('AISHWARYAM', 'aishwaryam@keshav.com', 100000000, 8),
('ASTIKAYAM', 'astikayam@keshav.com', 100000000, 8)
ON CONFLICT (team_name) DO NOTHING;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
