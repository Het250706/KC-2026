-- ============================================================================
-- Player Self-Registration System - Database Schema
-- ============================================================================

-- Ensure the players table matches the automated registration requirements
-- Warning: This will recreation the table. If you have data, consider ALTER TABLE instead.
DROP TABLE IF EXISTS players CASCADE;

CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    photo_url TEXT,
    batting_style TEXT CHECK (batting_style IN ('RIGHT_HANDED', 'LEFT_HANDED')),
    bowling_style TEXT CHECK (bowling_style IN ('RIGHT_ARM', 'LEFT_ARM')),
    auction_status TEXT DEFAULT 'pending' CHECK (auction_status IN ('pending', 'active', 'sold', 'unsold')),
    sold_price INTEGER DEFAULT NULL,
    sold_to_team_id UUID REFERENCES teams(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT first_name_not_empty CHECK (LENGTH(TRIM(first_name)) > 0),
    CONSTRAINT last_name_not_empty CHECK (LENGTH(TRIM(last_name)) > 0),
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Performance Indexes
CREATE INDEX idx_players_email ON players(email);
CREATE INDEX idx_players_auction_status ON players(auction_status);
CREATE INDEX idx_players_created_at ON players(created_at DESC);

-- Enable Realtime for the players table
-- Check if publication exists first, or just try to add
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE players;
    END IF;
END $$;

-- Row Level Security (RLS)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- 1. Public/Captain Read Access
CREATE POLICY "Anyone can view players" ON players
    FOR SELECT USING (true);

-- 2. Admin Full Access
CREATE POLICY "Admins can manage players" ON players
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM admins)
    );

-- 3. Automation Script Insert access (if not using service_role)
-- If the Google Apps Script uses the service_role key, it bypasses RLS.
-- This policy is a fallback for restricted API keys.
CREATE POLICY "Automation can insert players" ON players
    FOR INSERT WITH CHECK (true); -- In production, restrict by IP or specific header if possible

-- ============================================================================
-- AUCTION STATE SYNC
-- ============================================================================

-- Ensure auction_state matches the expected structure for integration
-- Some schemas used INTEGER id = 1, others used UUID. 
-- We'll standardize on the one used in the Admin Panel.
-- Looking at src/app/admin/page.tsx, it uses .single() which implies one row.

-- If using the initial schema:
-- CREATE TABLE auction_state (
--     id INTEGER PRIMARY KEY DEFAULT 1,
--     status TEXT DEFAULT 'idle',
--     current_player_id UUID REFERENCES players(id),
--     ...
-- );

-- Ensure the starting auction update works
CREATE OR REPLACE FUNCTION start_player_auction(p_player_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE auction_state SET
        status = 'active',
        current_player_id = p_player_id,
        current_highest_bid = (SELECT base_price FROM players WHERE id = p_player_id),
        timer_remaining = 30,
        last_update = NOW()
    WHERE id = 1 OR id = '00000000-0000-0000-0000-000000000001'::uuid;
    
    UPDATE players SET auction_status = 'active' WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql;
