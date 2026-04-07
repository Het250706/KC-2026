-- CLEAN PRODUCTION SCHEMA FOR CRICKET AUCTION
-- Run this in your Supabase SQL Editor

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TEAMS TABLE
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    purse_remaining NUMERIC DEFAULT 5000,
    remaining_budget NUMERIC DEFAULT 5000, -- Alias for compatibility
    max_players INTEGER DEFAULT 9,
    owner_name TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. PLAYERS TABLE
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    name TEXT, -- Full name cache
    role TEXT CHECK (role IN ('batsman', 'bowler', 'allrounder', 'wicketkeeper', 'Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper')),
    batting_style TEXT,
    bowling_style TEXT,
    base_price NUMERIC NOT NULL,
    image_url TEXT,
    photo_url TEXT, -- Alias for compatibility
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'sold', 'unsold')),
    auction_status TEXT DEFAULT 'pending', -- Alias for compatibility
    team_id UUID REFERENCES teams(id),
    sold_price NUMERIC,
    category TEXT,
    city TEXT,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. BIDS TABLE
CREATE TABLE IF NOT EXISTS bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. AUCTION STATE (Singleton Control)
CREATE TABLE IF NOT EXISTS auction_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'active', 'paused', 'finished')),
    current_player_id UUID REFERENCES players(id),
    timer_duration INTEGER DEFAULT 30,
    timer_remaining INTEGER DEFAULT 30,
    bid_increment NUMERIC DEFAULT 1000000, -- 10 Lakh
    last_bid_team_id UUID REFERENCES teams(id),
    current_highest_bid NUMERIC DEFAULT 0,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Initialize state
INSERT INTO auction_state (id, status) VALUES (1, 'idle') ON CONFLICT (id) DO NOTHING;

-- 6. REALTIME ENABLEMENT
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE auction_state;
ALTER PUBLICATION supabase_realtime ADD TABLE bids;

-- 7. POLICIES (Development Mode - Allow AUth Users)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON teams FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON players FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON auction_state FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON bids FOR SELECT USING (true);

-- API operations usually use Service Role, but we can allow all for rapid dev if needed
CREATE POLICY "Allow authenticated full access" ON teams FOR ALL USING (true);
CREATE POLICY "Allow authenticated full access" ON players FOR ALL USING (true);
CREATE POLICY "Allow authenticated full access" ON auction_state FOR ALL USING (true);
CREATE POLICY "Allow authenticated full access" ON bids FOR ALL USING (true);
