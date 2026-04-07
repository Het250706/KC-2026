-- UNDO LAST BALL STORED PROCEDURE (FIXED VERSION)
-- Reverses the last event for a given innings and restores all stats accurately.
-- This version removes references to 'runs_off_bat' which was causing errors in the v2 schema.

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
    -- 1. Find the last event for the specified innings
    SELECT * INTO v_last_event
    FROM match_events
    WHERE match_id = p_match_id AND innings_id = p_innings_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- If no event found, return early
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'No balls available to undo in this innings.');
    END IF;

    -- 2. Extract IDs using the v2 schema columns (as used in recordBall)
    -- Using record "v_last_event" access only for columns we know exist in v2 schema
    v_batsman_id := v_last_event.batsman_id;
    v_runs_off_bat := v_last_event.runs;

    -- 3. Determine if the ball was legal
    -- In v2 schema, ilegal balls are 'wide' and 'no_ball' in the event_type column
    v_is_legal_ball := (v_last_event.event_type NOT IN ('wide', 'no_ball'));
    
    -- 4. Calculate total runs to revert
    -- Match recordBall logic: runs = bat runs. Innings adds 1 for wide/no_ball.
    v_runs_to_revert := v_runs_off_bat + (
        CASE 
            WHEN (v_last_event.event_type IN ('wide', 'no_ball')) THEN 1 
            ELSE 0 
        END
    );
    v_wickets_to_revert := (CASE WHEN v_last_event.is_wicket THEN 1 ELSE 0 END);

    -- 5. Get batsman's team ID
    SELECT team_id INTO v_batsman_team_id FROM players WHERE id = v_batsman_id;

    -- 6. REVERSE PLAYER STATS (BATSMAN)
    UPDATE player_match_stats
    SET 
        runs = runs - v_runs_off_bat,
        balls = balls - (CASE WHEN v_is_legal_ball THEN 1 ELSE 0 END),
        fours = fours - (CASE WHEN v_last_event.event_type = 'four' THEN 1 ELSE 0 END),
        sixes = sixes - (CASE WHEN v_last_event.event_type = 'six' THEN 1 ELSE 0 END)
    WHERE match_id = p_match_id AND player_id = v_batsman_id;

    -- 7. DELETE THE EVENT
    DELETE FROM match_events WHERE id = v_last_event.id;

    -- 8. RECALCULATE BOWLER OVERS & REVERSE BOWLER STATS
    SELECT 
        COUNT(*) FILTER (WHERE event_type NOT IN ('wide', 'no_ball'))
    INTO v_total_balls
    FROM match_events
    WHERE innings_id = p_innings_id AND bowler_id = v_last_event.bowler_id;
    
    v_full_overs := v_total_balls / 6;
    v_rem_balls := v_total_balls % 6;
    v_new_overs := v_full_overs + (v_rem_balls / 10.0);

    UPDATE player_match_stats
    SET 
        wickets = wickets - v_wickets_to_revert,
        runs_given = runs_given - v_runs_to_revert,
        overs = v_new_overs
    WHERE match_id = p_match_id AND player_id = v_last_event.bowler_id;

    -- 9. RECALCULATE INNINGS OVERS & REVERSE INNINGS STATS
    SELECT 
        COUNT(*) FILTER (WHERE event_type NOT IN ('wide', 'no_ball'))
    INTO v_total_balls
    FROM match_events
    WHERE innings_id = p_innings_id;

    v_full_overs := v_total_balls / 6;
    v_rem_balls := v_total_balls % 6;
    v_new_overs := v_full_overs + (v_rem_balls / 10.0);

    UPDATE innings
    SET 
        runs = runs - v_runs_to_revert,
        wickets = wickets - v_wickets_to_revert,
        overs = v_new_overs,
        striker_id = v_batsman_id, -- Restore original striker
        bowler_id = v_last_event.bowler_id -- Restore original bowler
    WHERE id = p_innings_id;

    -- 10. REVERSE TEAM SCORE
    UPDATE team_scores
    SET 
        runs = runs - v_runs_to_revert,
        wickets = wickets - v_wickets_to_revert,
        overs = v_new_overs
    WHERE match_id = p_match_id AND team_id = v_batsman_team_id;

    RETURN json_build_object(
        'success', true, 
        'message', 'Last ball undone successfully', 
        'restored_striker', v_batsman_id,
        'restored_bowler', v_last_event.bowler_id,
        'was_wicket', v_last_event.is_wicket
    );
END;
$$ LANGUAGE plpgsql;
