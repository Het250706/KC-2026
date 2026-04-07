-- MASTER SETUP SCRIPT FOR IPL AUCTION
-- This script creates EVERYTHING from scratch.
-- Run this in your Supabase SQL Editor.

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Teams Table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    remaining_budget BIGINT DEFAULT 5000,
    total_budget BIGINT DEFAULT 5000,
    max_players INTEGER DEFAULT 9,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Create Players Table
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL,
    category TEXT,
    batting_style TEXT,
    bowling_style TEXT,
    base_price BIGINT NOT NULL,
    photo_url TEXT,
    auction_status TEXT DEFAULT 'pending' CHECK (auction_status IN ('pending', 'active', 'sold', 'unsold')),
    sold_price BIGINT,
    team_id UUID REFERENCES teams(id), -- Links to teams
    sold_team TEXT, -- Legacy column for compatibility
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Create Auction State Table
CREATE TABLE IF NOT EXISTS auction_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    status TEXT DEFAULT 'idle',
    current_player_id UUID REFERENCES players(id),
    timer_remaining INTEGER DEFAULT 30,
    current_highest_bid BIGINT DEFAULT 0,
    last_bid_team_id UUID REFERENCES teams(id),
    bid_increment BIGINT DEFAULT 1000000
);

-- 5. Create Bids Table (for history)
CREATE TABLE IF NOT EXISTS bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id),
    team_id UUID REFERENCES teams(id),
    amount BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. Seed Teams
INSERT INTO teams (name, remaining_budget, total_budget, max_players)
VALUES 
    ('SHAURYAM', 5000, 5000, 9),
    ('DIVYAM', 5000, 5000, 9),
    ('SATYAM', 5000, 5000, 9),
    ('DASHATVAM', 5000, 5000, 9),
    ('DHAIRYAM', 5000, 5000, 9),
    ('GYANAM', 5000, 5000, 9),
    ('AISHWARYAM', 5000, 5000, 9),
    ('ASTIKAYAM', 5000, 5000, 9)
ON CONFLICT (name) DO NOTHING;

-- 7. Initialize Auction State
INSERT INTO auction_state (id, status) 
VALUES (1, 'idle') 
ON CONFLICT (id) DO NOTHING;

-- 8. Enable Realtime safely
DO $$ 
BEGIN 
    -- Create publication if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Add tables to publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE teams;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE players;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE auction_state;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE bids;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;
