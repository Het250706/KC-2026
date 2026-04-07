-- Cricket Auction Database Schema

-- Teams Table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    owner_name TEXT NOT NULL,
    logo_url TEXT,
    total_budget NUMERIC DEFAULT 5000,
    remaining_budget NUMERIC DEFAULT 5000,
    max_players INTEGER DEFAULT 9,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Admin Table (linked to auth.users)
CREATE TABLE admins (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Players Table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    cricket_skill TEXT,
    was_present_kc3 TEXT,
    role TEXT,
    category TEXT,
    base_price NUMERIC NOT NULL,
    photo_url TEXT,
    auction_status TEXT DEFAULT 'pending',
    sold_price NUMERIC,
    sold_team TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Auction State Table (Single row tracker)
CREATE TABLE auction_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'active', 'paused', 'finished')),
    current_player_id UUID REFERENCES players(id),
    timer_duration INTEGER DEFAULT 30,
    timer_remaining INTEGER DEFAULT 30,
    bid_increment NUMERIC DEFAULT 1000000, -- 10 Lakh increment
    last_bid_team_id UUID REFERENCES teams(id),
    current_highest_bid NUMERIC,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Bids History Table
CREATE TABLE bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert initial auction state
INSERT INTO auction_state (id, status) VALUES (1, 'idle') ON CONFLICT (id) DO NOTHING;

-- Enable Realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE auction_state;
ALTER PUBLICATION supabase_realtime ADD TABLE bids;

-- RLS Policies (Simplistic for now, should be more secure in production)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON teams FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON players FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON auction_state FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON bids FOR SELECT USING (true);

-- Admin only write access (Placeholder for admin check)
-- In a real app, you'd check auth.jwt() -> 'role' or similar
CREATE POLICY "Allow admin full access" ON teams FOR ALL USING (true);
CREATE POLICY "Allow admin full access" ON players FOR ALL USING (true);
CREATE POLICY "Allow admin full access" ON auction_state FOR ALL USING (true);
CREATE POLICY "Allow admin full access" ON bids FOR ALL USING (true);
