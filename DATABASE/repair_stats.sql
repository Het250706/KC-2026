-- 1. CLEANUP OLD VIEWS AND TABLES
DROP VIEW IF EXISTS tournament_player_stats CASCADE;
DROP VIEW IF EXISTS tournament_leaderboard CASCADE;

-- Drop all possible old versions of the trigger and function to avoid conflicts
DROP TRIGGER IF EXISTS trg_update_cricket_stats ON match_events;
DROP TRIGGER IF EXISTS trg_update_cricket_stats_v2 ON match_events;
DROP TRIGGER IF EXISTS trg_update_cricket_stats_v3 ON match_events;
DROP FUNCTION IF EXISTS update_cricket_stats() CASCADE;
DROP FUNCTION IF EXISTS update_cricket_stats_v2() CASCADE;
DROP FUNCTION IF EXISTS update_cricket_stats_v3() CASCADE;

DO $$
BEGIN
    DROP VIEW IF EXISTS player_match_stats CASCADE;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DROP TABLE IF EXISTS player_match_stats CASCADE;

-- 2. CREATE CONSOLIDATED PLAYER_MATCH_STATS TABLE
-- We use a table + trigger for maximum performance and reliability.
CREATE TABLE player_match_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
    player_id uuid REFERENCES players(id) ON DELETE CASCADE,
    runs_scored integer DEFAULT 0,
    balls_faced integer DEFAULT 0,
    fours integer DEFAULT 0,
    sixes integer DEFAULT 0,
    wickets_taken integer DEFAULT 0,
    overs_bowled decimal DEFAULT 0.0,
    runs_conceded integer DEFAULT 0,
    UNIQUE(match_id, player_id)
);

-- 3. CREATE TOURNAMENT_PLAYER_STATS VIEW
-- This is what the Dashboard and Scoreboard use.
-- Includes ALL players and their team names.
CREATE OR REPLACE VIEW tournament_player_stats AS
SELECT 
    p.id as player_id,
    p.first_name,
    p.last_name,
    p.photo_url,
    p.role,
    t.name as team_name,
    COALESCE(SUM(ms.runs_scored) FILTER (WHERE m.status = 'completed'), 0) as total_runs,
    COALESCE(SUM(ms.wickets_taken) FILTER (WHERE m.status = 'completed'), 0) as total_wickets,
    COALESCE(SUM(ms.runs_scored + (ms.wickets_taken * 20)) FILTER (WHERE m.status = 'completed'), 0) as pot_score
FROM players p
LEFT JOIN teams t ON p.team_id = t.id
LEFT JOIN player_match_stats ms ON p.id = ms.player_id
LEFT JOIN matches m ON ms.match_id = m.id
GROUP BY p.id, p.first_name, p.last_name, p.photo_url, p.role, t.name;

-- 4. ATOMIC STATS UPDATE FUNCTION (Real-time)
CREATE OR REPLACE FUNCTION update_cricket_stats_v3()
RETURNS TRIGGER AS $$
DECLARE
    v_total_balls integer;
    v_full_overs integer;
    v_rem_balls integer;
    v_new_overs decimal;
BEGIN
    -- 1. Initialize stats rows if they don't exist
    INSERT INTO player_match_stats (match_id, player_id)
    VALUES (NEW.match_id, NEW.batsman_id)
    ON CONFLICT (match_id, player_id) DO NOTHING;

    INSERT INTO player_match_stats (match_id, player_id)
    VALUES (NEW.match_id, NEW.bowler_id)
    ON CONFLICT (match_id, player_id) DO NOTHING;

    -- 2. Update Batting Stats
    UPDATE player_match_stats
    SET 
        runs_scored = runs_scored + NEW.runs,
        balls_faced = balls_faced + (CASE WHEN NEW.event_type NOT IN ('wide') THEN 1 ELSE 0 END),
        fours = fours + (CASE WHEN NEW.event_type = 'four' THEN 1 ELSE 0 END),
        sixes = sixes + (CASE WHEN NEW.event_type = 'six' THEN 1 ELSE 0 END)
    WHERE match_id = NEW.match_id AND player_id = NEW.batsman_id;

    -- 3. Update Bowling Stats (Calculate overs from events to avoid decimal math errors)
    SELECT COUNT(*) INTO v_total_balls
    FROM match_events
    WHERE match_id = NEW.match_id AND bowler_id = NEW.bowler_id AND event_type NOT IN ('wide', 'no_ball');
    
    v_full_overs := v_total_balls / 6;
    v_rem_balls := v_total_balls % 6;
    v_new_overs := v_full_overs + (v_rem_balls / 10.0);

    UPDATE player_match_stats
    SET 
        wickets_taken = wickets_taken + (CASE WHEN NEW.is_wicket THEN 1 ELSE 0 END),
        runs_conceded = runs_conceded + NEW.runs + (CASE WHEN NEW.event_type IN ('wide', 'no_ball') THEN 1 ELSE 0 END),
        overs_bowled = v_new_overs
    WHERE match_id = NEW.match_id AND player_id = NEW.bowler_id;

    -- 4. Update Innings & Team Score
    SELECT COUNT(*) INTO v_total_balls
    FROM match_events
    WHERE innings_id = NEW.innings_id AND event_type NOT IN ('wide', 'no_ball');

    v_full_overs := v_total_balls / 6;
    v_rem_balls := v_total_balls % 6;
    v_new_overs := v_full_overs + (v_rem_balls / 10.0);

    UPDATE innings
    SET 
        runs = runs + NEW.runs + (CASE WHEN NEW.event_type IN ('wide', 'no_ball') THEN 1 ELSE 0 END),
        wickets = wickets + (CASE WHEN NEW.is_wicket THEN 1 ELSE 0 END),
        overs = v_new_overs
    WHERE id = NEW.innings_id;

    UPDATE team_scores
    SET 
        runs = runs + NEW.runs + (CASE WHEN NEW.event_type IN ('wide', 'no_ball') THEN 1 ELSE 0 END),
        wickets = wickets + (CASE WHEN NEW.is_wicket THEN 1 ELSE 0 END),
        overs = v_new_overs
    WHERE match_id = NEW.match_id AND team_id = (SELECT batting_team_id FROM innings WHERE id = NEW.innings_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. ATTACH TRIGGER
DROP TRIGGER IF EXISTS trg_update_cricket_stats_v3 ON match_events;
CREATE TRIGGER trg_update_cricket_stats_v3
AFTER INSERT ON match_events
FOR EACH ROW
EXECUTE FUNCTION update_cricket_stats_v3();

-- 6. RECOVERY: POPULATE STATS FROM EXISTING MATCH EVENTS
-- This ensures that matches already played are counted.
INSERT INTO player_match_stats (match_id, player_id, runs_scored, balls_faced, fours, sixes, wickets_taken, runs_conceded)
SELECT 
    match_id,
    batsman_id as player_id,
    SUM(runs) as runs_scored,
    COUNT(*) FILTER (WHERE event_type != 'wide') as balls_faced,
    COUNT(*) FILTER (WHERE event_type = 'four') as fours,
    COUNT(*) FILTER (WHERE event_type = 'six') as sixes,
    0 as wickets_taken,
    0 as runs_conceded
FROM match_events
GROUP BY match_id, batsman_id
ON CONFLICT (match_id, player_id) DO UPDATE SET
    runs_scored = EXCLUDED.runs_scored,
    balls_faced = EXCLUDED.balls_faced,
    fours = EXCLUDED.fours,
    sixes = EXCLUDED.sixes;

INSERT INTO player_match_stats (match_id, player_id, wickets_taken, runs_conceded)
SELECT 
    match_id,
    bowler_id as player_id,
    COUNT(*) FILTER (WHERE is_wicket = true) as wickets_taken,
    SUM(runs + (CASE WHEN event_type IN ('wide', 'no_ball') THEN 1 ELSE 0 END)) as runs_conceded
FROM match_events
GROUP BY match_id, bowler_id
ON CONFLICT (match_id, player_id) DO UPDATE SET
    wickets_taken = EXCLUDED.wickets_taken,
    runs_conceded = EXCLUDED.runs_conceded;

-- Update overs_bowled for all bowlers
UPDATE player_match_stats pms
SET overs_bowled = (
    SELECT (COUNT(*) / 6) + ((COUNT(*) % 6) / 10.0)
    FROM match_events me
    WHERE me.match_id = pms.match_id AND me.bowler_id = pms.player_id AND me.event_type NOT IN ('wide', 'no_ball')
)
WHERE player_id IN (SELECT bowler_id FROM match_events);

-- 7. ENABLE REALTIME AND RLS
ALTER TABLE player_match_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Stats" ON player_match_stats;
CREATE POLICY "Public Read Stats" ON player_match_stats FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Stats" ON player_match_stats;
CREATE POLICY "Admin All Stats" ON player_match_stats FOR ALL USING (true) WITH CHECK (true);

-- 8. UPDATED UNDO LAST BALL LOGIC (Standardized)
CREATE OR REPLACE FUNCTION undo_last_ball(p_match_id UUID, p_innings_id UUID)
RETURNS JSON AS $$
DECLARE
    v_last_event RECORD;
    v_total_balls INTEGER;
    v_full_overs INTEGER;
    v_rem_balls INTEGER;
    v_new_overs DECIMAL;
    v_batsman_team_id UUID;
    v_is_legal_ball BOOLEAN;
    v_runs_off_bat INTEGER;
    v_runs_to_revert INTEGER;
    v_wickets_to_revert INTEGER;
    v_batsman_id UUID;
BEGIN
    SELECT * INTO v_last_event FROM match_events WHERE match_id = p_match_id AND innings_id = p_innings_id ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'No events to undo.'); END IF;

    v_batsman_id := v_last_event.batsman_id;
    v_runs_off_bat := v_last_event.runs;
    v_is_legal_ball := (v_last_event.event_type NOT IN ('wide', 'no_ball'));
    v_runs_to_revert := v_runs_off_bat + (CASE WHEN (v_last_event.event_type IN ('wide', 'no_ball')) THEN 1 ELSE 0 END);
    v_wickets_to_revert := (CASE WHEN v_last_event.is_wicket THEN 1 ELSE 0 END);
    SELECT team_id INTO v_batsman_team_id FROM players WHERE id = v_batsman_id;

    -- REVERSE PLAYER STATS
    UPDATE player_match_stats SET 
        runs_scored = runs_scored - v_runs_off_bat,
        balls_faced = balls_faced - (CASE WHEN v_is_legal_ball THEN 1 ELSE 0 END),
        fours = fours - (CASE WHEN v_last_event.event_type = 'four' THEN 1 ELSE 0 END),
        sixes = sixes - (CASE WHEN v_last_event.event_type = 'six' THEN 1 ELSE 0 END)
    WHERE match_id = p_match_id AND player_id = v_batsman_id;

    -- REVERSE BOWLER STATS
    UPDATE player_match_stats SET 
        wickets_taken = wickets_taken - v_wickets_to_revert,
        runs_conceded = runs_conceded - v_runs_to_revert
    WHERE match_id = p_match_id AND player_id = v_last_event.bowler_id;

    -- DELETE THE EVENT
    DELETE FROM match_events WHERE id = v_last_event.id;

    -- RECALCULATE BOWLER OVERS
    SELECT COUNT(*) INTO v_total_balls FROM match_events WHERE match_id = p_match_id AND bowler_id = v_last_event.bowler_id AND event_type NOT IN ('wide', 'no_ball');
    v_full_overs := v_total_balls / 6;
    v_rem_balls := v_total_balls % 6;
    v_new_overs := v_full_overs + (v_rem_balls / 10.0);
    UPDATE player_match_stats SET overs_bowled = v_new_overs WHERE match_id = p_match_id AND player_id = v_last_event.bowler_id;

    -- RECALCULATE INNINGS & TEAM OVERS
    SELECT COUNT(*) INTO v_total_balls FROM match_events WHERE innings_id = p_innings_id AND event_type NOT IN ('wide', 'no_ball');
    v_full_overs := v_total_balls / 6;
    v_rem_balls := v_total_balls % 6;
    v_new_overs := v_full_overs + (v_rem_balls / 10.0);

    UPDATE innings SET runs = runs - v_runs_to_revert, wickets = wickets - v_wickets_to_revert, overs = v_new_overs, striker_id = v_batsman_id, bowler_id = v_last_event.bowler_id WHERE id = p_innings_id;
    UPDATE team_scores SET runs = runs - v_runs_to_revert, wickets = wickets - v_wickets_to_revert, overs = v_new_overs WHERE match_id = p_match_id AND team_id = v_batsman_team_id;

    RETURN json_build_object('success', true, 'message', 'Undone', 'restored_striker', v_batsman_id, 'restored_bowler', v_last_event.bowler_id);
END;
$$ LANGUAGE plpgsql;

-- 9. FINAL REALTIME SETUP
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'player_match_stats'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE player_match_stats;
    END IF;
END $$;
