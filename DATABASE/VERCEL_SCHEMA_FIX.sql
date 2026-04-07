-- MASTER FIX FOR VERCEL DEPLOYMENT
-- This script ensures the Supabase database matches the expectations of the code.
-- It adds missing columns and handles naming mismatches.

-- 1. FIX MATCHES TABLE
DO $$ 
BEGIN 
    -- Add match_name if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='match_name') THEN
        ALTER TABLE matches ADD COLUMN match_name TEXT DEFAULT 'Match';
    END IF;

    -- Add match_type if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='match_type') THEN
        ALTER TABLE matches ADD COLUMN match_type TEXT CHECK (match_type IN ('League Match', 'Semi Final', 'Final')) DEFAULT 'League Match';
    END IF;

    -- Add venue if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='venue') THEN
        ALTER TABLE matches ADD COLUMN venue TEXT DEFAULT 'Main Ground';
    END IF;

    -- Add max_overs if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='max_overs') THEN
        ALTER TABLE matches ADD COLUMN max_overs INTEGER DEFAULT 8;
    END IF;

    -- Ensure team1_id and team2_id exist (Aliasing if necessary)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='team1_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='team_a_id') THEN
             ALTER TABLE matches RENAME COLUMN team_a_id TO team1_id;
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='team2_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='team_b_id') THEN
             ALTER TABLE matches RENAME COLUMN team_b_id TO team2_id;
        END IF;
    END IF;
END $$;

-- 2. FIX MATCH_EVENTS TABLE
DO $$ 
BEGIN 
    -- Add innings_number if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='match_events' AND column_name='innings_number') THEN
        ALTER TABLE match_events ADD COLUMN innings_number INTEGER;
    END IF;

    -- Handle striker_id vs batsman_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='match_events' AND column_name='striker_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='match_events' AND column_name='batsman_id') THEN
             -- Instead of renaming, we add striker_id as a generated column or just a regular column
             ALTER TABLE match_events ADD COLUMN striker_id UUID REFERENCES players(id);
             UPDATE match_events SET striker_id = batsman_id;
        ELSE
             ALTER TABLE match_events ADD COLUMN striker_id UUID REFERENCES players(id);
        END IF;
    END IF;

    -- Ensure batsman_id exists (some code uses it)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='match_events' AND column_name='batsman_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='match_events' AND column_name='striker_id') THEN
             ALTER TABLE match_events ADD COLUMN batsman_id UUID REFERENCES players(id);
             UPDATE match_events SET batsman_id = striker_id;
        END IF;
    END IF;

    -- Add dismissed_player_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='match_events' AND column_name='dismissed_player_id') THEN
        ALTER TABLE match_events ADD COLUMN dismissed_player_id UUID REFERENCES players(id);
    END IF;
END $$;

-- 3. FIX PLAYER_MATCH_STATS TABLE
DO $$ 
BEGIN 
    -- Ensure both 'runs' and 'runs_scored' exist for compatibility
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_match_stats' AND column_name='runs_scored') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_match_stats' AND column_name='runs') THEN
             ALTER TABLE player_match_stats ADD COLUMN runs_scored INTEGER;
             UPDATE player_match_stats SET runs_scored = runs;
        ELSE
             ALTER TABLE player_match_stats ADD COLUMN runs_scored INTEGER DEFAULT 0;
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_match_stats' AND column_name='wickets_taken') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_match_stats' AND column_name='wickets') THEN
             ALTER TABLE player_match_stats ADD COLUMN wickets_taken INTEGER;
             UPDATE player_match_stats SET wickets_taken = wickets;
        ELSE
             ALTER TABLE player_match_stats ADD COLUMN wickets_taken INTEGER DEFAULT 0;
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_match_stats' AND column_name='runs_conceded') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_match_stats' AND column_name='runs_given') THEN
             ALTER TABLE player_match_stats ADD COLUMN runs_conceded INTEGER;
             UPDATE player_match_stats SET runs_conceded = runs_given;
        ELSE
             ALTER TABLE player_match_stats ADD COLUMN runs_conceded INTEGER DEFAULT 0;
        END IF;
    END IF;
END $$;

-- 4. REFRESH VIEWS
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

-- 5. REFRESH EVERYTHING
COMMENT ON TABLE matches IS 'Last Updated for Vercel compatibility';
COMMENT ON TABLE match_events IS 'Last Updated for Vercel compatibility';
COMMENT ON TABLE player_match_stats IS 'Last Updated for Vercel compatibility';

-- Final notice to PostgREST
-- NOTIFY pgrst, 'reload schema';
