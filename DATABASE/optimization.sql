-- KESHAV CUP - DATABASE OPTIMIZATION FOR LONG-TERM SCALABILITY
-- This script ensures the system remains fast and error-free as thousands of matches are added.

-- 1. Performance Indexes for Match Events (The largest table)
CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_match_events_innings_id ON match_events(innings_id);
CREATE INDEX IF NOT EXISTS idx_match_events_batsman_id ON match_events(batsman_id);
CREATE INDEX IF NOT EXISTS idx_match_events_bowler_id ON match_events(bowler_id);

-- 2. Performance Indexes for Match Statistics
CREATE INDEX IF NOT EXISTS idx_player_match_stats_match_id ON player_match_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_player_id ON player_match_stats(player_id);

-- 3. Ensure integrity of Team Scores
CREATE INDEX IF NOT EXISTS idx_team_scores_match_id ON team_scores(match_id);

-- 4. Robust Tournament Stats View (Materialized view is an option for later, 
-- but for now we optimize the join order)
CREATE OR REPLACE VIEW tournament_player_stats AS
SELECT 
    p.id as player_id,
    p.first_name,
    p.last_name,
    p.photo_url,
    p.role,
    t.name as team_name,
    COALESCE(SUM(ms.runs_scored), 0) as total_runs,
    COALESCE(SUM(ms.wickets_taken), 0) as total_wickets,
    COALESCE(SUM(ms.runs_scored + ms.wickets_taken), 0) as pot_score
FROM players p
LEFT JOIN teams t ON p.team_id = t.id
LEFT JOIN player_match_stats ms ON p.id = ms.player_id
LEFT JOIN matches m ON ms.match_id = m.id AND m.status = 'completed'
GROUP BY p.id, p.first_name, p.last_name, p.photo_url, p.role, t.name;

-- 5. Foreign Key Cleanup
-- Ensure that deleting a match also deletes its events and stats automatically
-- (This prevents orphaning data which causes errors)
ALTER TABLE match_events 
    DROP CONSTRAINT IF EXISTS match_events_match_id_fkey,
    ADD CONSTRAINT match_events_match_id_fkey 
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE;

ALTER TABLE player_match_stats
    DROP CONSTRAINT IF EXISTS player_match_stats_match_id_fkey,
    ADD CONSTRAINT player_match_stats_match_id_fkey
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE;
