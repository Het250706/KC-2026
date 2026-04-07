-- KESHAV CUP - ENTERPRISE LIVESCORE TOURNAMENT SCHEMA
-- Upgrades existing simple matches to a full tournament system

-- 1. DROP EXISTING IF NEEDED (Carefully)
-- DROP TABLE IF EXISTS match_events;
-- DROP TABLE IF EXISTS player_match_stats;
-- DROP TABLE IF EXISTS match_players;
-- DROP TABLE IF EXISTS innings;
-- DROP TABLE IF EXISTS matches;

-- 2. MATCHES TABLE
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_name TEXT NOT NULL, -- Match 1, Match 2, Semi Final, Final
    match_type TEXT CHECK (match_type IN ('League Match', 'Semi Final', 'Final')),
    team_a_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    team_b_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    venue TEXT DEFAULT 'Main Ground',
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed')),
    max_overs INTEGER DEFAULT 8, -- New column for configurable overs
    toss_winner_id UUID REFERENCES teams(id),
    toss_decision TEXT CHECK (toss_decision IN ('Batting', 'Bowling')),
    batting_first_id UUID REFERENCES teams(id),
    winner_team_id UUID REFERENCES teams(id),
    current_innings INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. INNINGS TABLE (For scoreboard summary)
CREATE TABLE IF NOT EXISTS innings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    innings_number INTEGER NOT NULL, -- 1 or 2
    batting_team_id UUID REFERENCES teams(id),
    bowling_team_id UUID REFERENCES teams(id),
    runs INTEGER DEFAULT 0,
    wickets INTEGER DEFAULT 0,
    overs NUMERIC DEFAULT 0.0,
    striker_id UUID REFERENCES players(id),
    bowler_id UUID REFERENCES players(id),
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(match_id, innings_number)
);

-- 4. MATCH_PLAYERS TABLE (Playing XI selection)
CREATE TABLE IF NOT EXISTS match_players (
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    PRIMARY KEY (match_id, player_id)
);

-- 5. MATCH_EVENTS TABLE (Ball by ball for auditing & stats)
CREATE TABLE IF NOT EXISTS match_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    innings_number INTEGER NOT NULL,
    over_number INTEGER NOT NULL,
    ball_number INTEGER NOT NULL,
    striker_id UUID REFERENCES players(id),
    non_striker_id UUID REFERENCES players(id),
    bowler_id UUID REFERENCES players(id),
    runs_off_bat INTEGER DEFAULT 0,
    extras INTEGER DEFAULT 0,
    extra_type TEXT, -- wide, nb, etc.
    is_wicket BOOLEAN DEFAULT false,
    wicket_type TEXT,
    dismissed_player_id UUID REFERENCES players(id),
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- 6. PLAYER_MATCH_STATS (Cached stats for rapid display)
CREATE TABLE IF NOT EXISTS player_match_stats (
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id),
    runs_scored INTEGER DEFAULT 0,
    balls_faced INTEGER DEFAULT 0,
    fours INTEGER DEFAULT 0,
    sixes INTEGER DEFAULT 0,
    wickets_taken INTEGER DEFAULT 0,
    runs_conceded INTEGER DEFAULT 0,
    overs_bowled NUMERIC DEFAULT 0.0,
    batting_order INTEGER,
    bowling_order INTEGER,
    PRIMARY KEY (match_id, player_id)
);

-- 7. ENABLE REALTIME SAFELY (DOES NOT ERROR IF ALREADY ENABLED)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'matches'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE matches;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'innings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE innings;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'match_events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE match_events;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'player_match_stats'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE player_match_stats;
    END IF;
END $$;

-- 8. RLS POLICIES
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE innings ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_match_stats ENABLE ROW LEVEL SECURITY;

-- Clean existing policies for idempotency
DROP POLICY IF EXISTS "Matches Read" ON matches;
DROP POLICY IF EXISTS "Innings Read" ON innings;
DROP POLICY IF EXISTS "Match Players Read" ON match_players;
DROP POLICY IF EXISTS "Match Events Read" ON match_events;
DROP POLICY IF EXISTS "Stats Read" ON player_match_stats;
DROP POLICY IF EXISTS "Matches All" ON matches;
DROP POLICY IF EXISTS "Innings All" ON innings;
DROP POLICY IF EXISTS "Match Players All" ON match_players;
DROP POLICY IF EXISTS "Match Events All" ON match_events;
DROP POLICY IF EXISTS "Stats All" ON player_match_stats;
DROP POLICY IF EXISTS "Allow insert for players" ON players; -- Added to resolve user conflict

CREATE POLICY "Matches Read" ON matches FOR SELECT USING (true);
CREATE POLICY "Innings Read" ON innings FOR SELECT USING (true);
CREATE POLICY "Match Players Read" ON match_players FOR SELECT USING (true);
CREATE POLICY "Match Events Read" ON match_events FOR SELECT USING (true);
CREATE POLICY "Stats Read" ON player_match_stats FOR SELECT USING (true);

-- Admin Access
CREATE POLICY "Matches All" ON matches FOR ALL USING (true);
CREATE POLICY "Innings All" ON innings FOR ALL USING (true);
CREATE POLICY "Match Players All" ON match_players FOR ALL USING (true);
CREATE POLICY "Match Events All" ON match_events FOR ALL USING (true);
CREATE POLICY "Stats All" ON player_match_stats FOR ALL USING (true);

-- 9. TOURNAMENT STATS VIEW (Calculating Best Batsman/Bowler)
CREATE OR REPLACE VIEW tournament_player_stats AS
SELECT 
    p.id as player_id,
    p.first_name,
    p.last_name,
    p.photo_url,
    p.role,
    COALESCE(SUM(ms.runs_scored), 0) as total_runs,
    COALESCE(SUM(ms.wickets_taken), 0) as total_wickets,
    COALESCE(SUM(ms.runs_scored) + (SUM(ms.wickets_taken) * 20), 0) as pot_score -- Simple calculation for POT
FROM players p
LEFT JOIN player_match_stats ms ON p.id = ms.player_id
GROUP BY p.id, p.first_name, p.last_name, p.photo_url, p.role;
