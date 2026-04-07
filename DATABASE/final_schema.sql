-- FINAL PRODUCTION SCHEMA FOR IPL AUCTION
-- Run this in your Supabase SQL Editor to fix "auction_status" error

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop existing players table if you want a clean slate (WARNING: Deletes data)
-- DROP TABLE IF EXISTS players;

-- 3. Create Players Table with exact requested columns
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    cricket_skill TEXT,
    was_present_kc3 TEXT,
    role TEXT NOT NULL,
    category TEXT,
    batting_style TEXT,
    bowling_style TEXT,
    base_price BIGINT NOT NULL,
    photo_url TEXT,
    auction_status TEXT DEFAULT 'pending' CHECK (auction_status IN ('pending', 'active', 'sold', 'unsold')),
    sold_price BIGINT,
    sold_team TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Create Teams Table (Required for Dashboard)
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    purse_remaining BIGINT DEFAULT 1000000000,
    max_players INTEGER DEFAULT 15,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE players;

-- 6. RLS Policies
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Access" ON players FOR SELECT USING (true);
CREATE POLICY "Service Role Full Access" ON players FOR ALL USING (true);
