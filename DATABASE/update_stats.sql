-- Replace player_match_stats table with a View that automatically calculates stats from match_events!
-- This fixes the issue where the leaderboard wasn't updating automatically.

DROP TABLE IF EXISTS player_match_stats CASCADE;

CREATE OR REPLACE VIEW player_match_stats AS
SELECT 
    events.match_id,
    p.id AS player_id,
    p.team_id AS team_id,
    
    -- Batting Stats
    COALESCE(SUM(CASE WHEN events.striker_id = p.id AND (events.extra_type IS NULL OR events.extra_type = 'nb') THEN events.runs_off_bat ELSE 0 END), 0) AS runs_scored,
    COALESCE(SUM(CASE WHEN events.striker_id = p.id AND (events.extra_type IS NULL OR events.extra_type != 'wide') THEN 1 ELSE 0 END), 0) AS balls_faced,
    COALESCE(SUM(CASE WHEN events.striker_id = p.id AND events.runs_off_bat = 4 THEN 1 ELSE 0 END), 0) AS fours,
    COALESCE(SUM(CASE WHEN events.striker_id = p.id AND events.runs_off_bat = 6 THEN 1 ELSE 0 END), 0) AS sixes,
    
    -- Bowling Stats
    COALESCE(SUM(CASE WHEN events.bowler_id = p.id AND events.is_wicket = true THEN 1 ELSE 0 END), 0) AS wickets_taken,
    COALESCE(SUM(CASE WHEN events.bowler_id = p.id THEN events.runs_off_bat + COALESCE(events.extras, 0) ELSE 0 END), 0) AS runs_conceded,
    
    -- Calculate overs technically correctly (number of valid balls / 6)
    ROUND(
      COALESCE(SUM(CASE WHEN events.bowler_id = p.id AND (events.extra_type IS NULL OR (events.extra_type != 'wide' AND events.extra_type != 'nb')) THEN 1 ELSE 0 END), 0) / 6.0,
      1
    ) AS overs_bowled

FROM players p
LEFT JOIN match_events events ON (p.id = events.striker_id OR p.id = events.bowler_id)
GROUP BY events.match_id, p.id, p.team_id;

-- Ensure tournament_player_stats view is re-created to use the new view!
DROP VIEW IF EXISTS tournament_player_stats;

CREATE OR REPLACE VIEW tournament_player_stats AS
SELECT 
    p.id as player_id,
    p.first_name,
    p.last_name,
    p.photo_url,
    p.role,
    COALESCE(SUM(ms.runs_scored), 0) as total_runs,
    COALESCE(SUM(ms.wickets_taken), 0) as total_wickets,
    COALESCE(SUM(ms.runs_scored) + (SUM(ms.wickets_taken) * 20), 0) as pot_score
FROM players p
LEFT JOIN player_match_stats ms ON p.id = ms.player_id
GROUP BY p.id, p.first_name, p.last_name, p.photo_url, p.role;
