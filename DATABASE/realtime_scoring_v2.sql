-- REAL-TIME CRICKET SCORING SYSTEM v2
-- This script sets up the database for Cricbuzz-style real-time updates.

-- 1. MATCHES TABLE
DROP TABLE IF EXISTS matches CASCADE;
CREATE TABLE matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team1_id uuid REFERENCES teams(id) ON DELETE CASCADE,
    team2_id uuid REFERENCES teams(id) ON DELETE CASCADE,
    match_name text DEFAULT 'League Match',
    match_date timestamp with time zone DEFAULT now(),
    status text DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed')),
    current_innings integer DEFAULT 1,
    toss_winner_id uuid REFERENCES teams(id) ON DELETE SET NULL,
    toss_decision text,
    batting_first_id uuid REFERENCES teams(id) ON DELETE SET NULL,
    winner_team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
    result_message text,
    created_at timestamp with time zone DEFAULT now()
);

-- 1.1 INNINGS TABLE
DROP TABLE IF EXISTS innings CASCADE;
CREATE TABLE innings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
    innings_number integer NOT NULL,
    batting_team_id uuid REFERENCES teams(id),
    bowling_team_id uuid REFERENCES teams(id),
    runs integer DEFAULT 0,
    wickets integer DEFAULT 0,
    overs decimal DEFAULT 0.0,
    striker_id uuid REFERENCES players(id),
    bowler_id uuid REFERENCES players(id),
    is_completed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- 1.2 MATCH_PLAYERS (Squad) TABLE
DROP TABLE IF EXISTS match_players CASCADE;
CREATE TABLE match_players (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
    team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
    player_id uuid REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE(match_id, player_id)
);

-- 2. MATCH_EVENTS TABLE (Ball-by-ball events)
DROP TABLE IF EXISTS match_events CASCADE;
CREATE TABLE match_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
    innings_id uuid REFERENCES innings(id) ON DELETE CASCADE,
    over_number integer NOT NULL,
    ball_number integer NOT NULL,
    batsman_id uuid REFERENCES players(id) ON DELETE CASCADE,
    bowler_id uuid REFERENCES players(id) ON DELETE CASCADE,
    runs integer DEFAULT 0,
    is_wicket boolean DEFAULT false,
    event_type text CHECK (event_type IN ('run', 'four', 'six', 'wicket', 'wide', 'no_ball')),
    created_at timestamp with time zone DEFAULT now()
);

-- 0. CLEANUP OLD VIEWS THAT RELY ON STATS
DROP VIEW IF EXISTS tournament_leaderboard CASCADE;
DROP VIEW IF EXISTS tournament_player_stats CASCADE;

-- 3. PLAYER_MATCH_STATS TABLE
DROP TABLE IF EXISTS player_match_stats CASCADE;
DROP VIEW IF EXISTS player_match_stats CASCADE;
CREATE TABLE player_match_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
    player_id uuid REFERENCES players(id) ON DELETE CASCADE,
    runs integer DEFAULT 0,
    balls integer DEFAULT 0,
    fours integer DEFAULT 0,
    sixes integer DEFAULT 0,
    wickets integer DEFAULT 0,
    overs decimal DEFAULT 0.0,
    runs_given integer DEFAULT 0,
    UNIQUE(match_id, player_id)
);

-- 4. TEAM_SCORES TABLE
DROP TABLE IF EXISTS team_scores CASCADE;
DROP VIEW IF EXISTS team_scores CASCADE;
CREATE TABLE team_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
    team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
    runs integer DEFAULT 0,
    wickets integer DEFAULT 0,
    overs decimal DEFAULT 0.0,
    UNIQUE(match_id, team_id)
);

-- 5. ENABLE REALTIME SAFELY
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

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'team_scores'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE team_scores;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'innings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE innings;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'match_players'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE match_players;
    END IF;
END $$;

-- 6. INDEXES
CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_player_id ON player_match_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_team_scores_team_id ON team_scores(team_id);

-- 7. AUTOMATIC UPDATE TRIGGER
-- This function will update team_scores and player_match_stats whenever a match_event is recorded.

CREATE OR REPLACE FUNCTION update_cricket_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_team_id uuid;
    v_total_balls integer;
    v_full_overs integer;
    v_rem_balls integer;
    v_new_overs decimal;
BEGIN
    -- Get the team_id of the batsman
    SELECT p.team_id INTO v_team_id FROM players p WHERE p.id = NEW.batsman_id;

    -- 1. Initialize stats rows if they don't exist
    INSERT INTO team_scores (match_id, team_id)
    VALUES (NEW.match_id, v_team_id)
    ON CONFLICT (match_id, team_id) DO NOTHING;

    INSERT INTO player_match_stats (match_id, player_id)
    VALUES (NEW.match_id, NEW.batsman_id)
    ON CONFLICT (match_id, player_id) DO NOTHING;

    INSERT INTO player_match_stats (match_id, player_id)
    VALUES (NEW.match_id, NEW.bowler_id)
    ON CONFLICT (match_id, player_id) DO NOTHING;

    -- 2. Update Batting Stats
    UPDATE player_match_stats
    SET 
        runs = runs + NEW.runs,
        balls = balls + (CASE WHEN NEW.event_type NOT IN ('wide') THEN 1 ELSE 0 END),
        fours = fours + (CASE WHEN NEW.event_type = 'four' THEN 1 ELSE 0 END),
        sixes = sixes + (CASE WHEN NEW.event_type = 'six' THEN 1 ELSE 0 END)
    WHERE match_id = NEW.match_id AND player_id = NEW.batsman_id;

    -- 3. Update Bowling Stats
    SELECT 
        COUNT(*) FILTER (WHERE event_type NOT IN ('wide', 'no_ball'))
    INTO v_total_balls
    FROM match_events
    WHERE innings_id = NEW.innings_id AND bowler_id = NEW.bowler_id;
    
    v_full_overs := v_total_balls / 6;
    v_rem_balls := v_total_balls % 6;
    v_new_overs := v_full_overs + (v_rem_balls / 10.0);

    UPDATE player_match_stats
    SET 
        wickets = wickets + (CASE WHEN NEW.is_wicket THEN 1 ELSE 0 END),
        runs_given = runs_given + NEW.runs + (CASE WHEN NEW.event_type IN ('wide', 'no_ball') THEN 1 ELSE 0 END),
        overs = v_new_overs
    WHERE match_id = NEW.match_id AND player_id = NEW.bowler_id;

    -- 4. Update Innings & Team Score
    SELECT 
        COUNT(*) FILTER (WHERE event_type NOT IN ('wide', 'no_ball'))
    INTO v_total_balls
    FROM match_events
    WHERE innings_id = NEW.innings_id;

    v_full_overs := v_total_balls / 6;
    v_rem_balls := v_total_balls % 6;
    v_new_overs := v_full_overs + (v_rem_balls / 10.0);

    -- Update current innings table
    UPDATE innings
    SET 
        runs = runs + NEW.runs + (CASE WHEN NEW.event_type IN ('wide', 'no_ball') THEN 1 ELSE 0 END),
        wickets = wickets + (CASE WHEN NEW.is_wicket THEN 1 ELSE 0 END),
        overs = v_new_overs
    WHERE id = NEW.innings_id;

    -- Update overall team score for the match
    UPDATE team_scores
    SET 
        runs = runs + NEW.runs + (CASE WHEN NEW.event_type IN ('wide', 'no_ball') THEN 1 ELSE 0 END),
        wickets = wickets + (CASE WHEN NEW.is_wicket THEN 1 ELSE 0 END),
        overs = v_new_overs
    WHERE match_id = NEW.match_id AND team_id = v_team_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_cricket_stats ON match_events;
CREATE TRIGGER trg_update_cricket_stats
AFTER INSERT ON match_events
FOR EACH ROW
EXECUTE FUNCTION update_cricket_stats();

-- 8. Tournament Leaderboard View
CREATE OR REPLACE VIEW tournament_leaderboard AS
SELECT 
    p.id as player_id,
    p.first_name || ' ' || p.last_name as player_name,
    p.role,
    SUM(pms.runs) as total_runs,
    SUM(pms.wickets) as total_wickets,
    (SUM(pms.runs) + (SUM(pms.wickets) * 20)) as pot_score
FROM players p
LEFT JOIN player_match_stats pms ON p.id = pms.player_id
GROUP BY p.id, p.first_name, p.last_name, p.role;

-- 9. RLS POLICIES (Enabling public access for demo/testing)
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE innings ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;

-- Allow everything for everyone for now (Simplifies setup for testing)
DROP POLICY IF EXISTS "Public Read" ON matches;
DROP POLICY IF EXISTS "Public Insert" ON matches;
DROP POLICY IF EXISTS "Public Update" ON matches;
DROP POLICY IF EXISTS "Public Delete" ON matches;

CREATE POLICY "Public Read" ON matches FOR SELECT USING (true);
CREATE POLICY "Public Insert" ON matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update" ON matches FOR UPDATE USING (true);
CREATE POLICY "Public Delete" ON matches FOR DELETE USING (true);

DROP POLICY IF EXISTS "Events All" ON match_events;
CREATE POLICY "Events All" ON match_events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Stats All" ON player_match_stats;
CREATE POLICY "Stats All" ON player_match_stats FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Scores All" ON team_scores;
CREATE POLICY "Scores All" ON team_scores FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Innings All" ON innings;
CREATE POLICY "Innings All" ON innings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "MatchPlayers All" ON match_players;
CREATE POLICY "MatchPlayers All" ON match_players FOR ALL USING (true) WITH CHECK (true);
