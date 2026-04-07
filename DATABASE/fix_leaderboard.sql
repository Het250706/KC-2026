-- LEADERBOARD VIEW FIX
-- Ensures the leaderboard correctly sums up player stats regardless of schema naming differences.

CREATE OR REPLACE VIEW tournament_player_stats AS
SELECT 
    p.id as player_id,
    p.first_name,
    p.last_name,
    p.photo_url,
    p.role,
    -- Handle both 'runs' (v2) and 'runs_scored' (upgrade) schema column names
    COALESCE(SUM(CASE WHEN ms.runs IS NOT NULL THEN ms.runs ELSE ms.runs_scored END), 0) as total_runs,
    COALESCE(SUM(CASE WHEN ms.wickets IS NOT NULL THEN ms.wickets ELSE ms.wickets_taken END), 0) as total_wickets,
    -- Calculate POT score (Runs + Wickets * 20)
    (
        COALESCE(SUM(CASE WHEN ms.runs IS NOT NULL THEN ms.runs ELSE ms.runs_scored END), 0) + 
        (COALESCE(SUM(CASE WHEN ms.wickets IS NOT NULL THEN ms.wickets ELSE ms.wickets_taken END), 0) * 20)
    ) as pot_score
FROM players p
LEFT JOIN player_match_stats ms ON p.id = ms.player_id
GROUP BY p.id, p.first_name, p.last_name, p.photo_url, p.role;
