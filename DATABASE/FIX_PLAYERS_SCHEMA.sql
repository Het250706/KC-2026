-- FINAL SCHEMA HARMONIZATION & ROSTER FIX
-- This script ensures the players table has the correct columns and populates exactly 8 players per team.

-- 1. Ensure columns exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='team_id') THEN
        ALTER TABLE players ADD COLUMN team_id UUID REFERENCES teams(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='sold_team') THEN
        ALTER TABLE players ADD COLUMN sold_team TEXT;
    END IF;
END $$;

-- 2. CLEANUP: Remove any players starting with 'Player' to avoid duplicates before inserting fresh rosters
DELETE FROM players WHERE first_name = 'Player';

-- 3. TEST DATA INSERT (8 Players for AISHWARYAM)
INSERT INTO players (first_name, last_name, role, team_id, auction_status, base_price, sold_price, sold_team)
SELECT 
    'Player', 
    'A' || gs.i, 
    'All-rounder', 
    (SELECT id FROM teams WHERE name = 'AISHWARYAM' LIMIT 1), 
    'sold',
    20000000,
    20000000,
    'AISHWARYAM'
FROM generate_series(1, 8) AS gs(i)
WHERE (SELECT id FROM teams WHERE name = 'AISHWARYAM') IS NOT NULL;

-- 4. TEST DATA INSERT (8 Players for DHAIRYAM)
INSERT INTO players (first_name, last_name, role, team_id, auction_status, base_price, sold_price, sold_team)
SELECT 
    'Player', 
    'B' || gs.i, 
    'All-rounder', 
    (SELECT id FROM teams WHERE name = 'DHAIRYAM' LIMIT 1), 
    'sold',
    20000000,
    20000000,
    'DHAIRYAM'
FROM generate_series(1, 8) AS gs(i)
WHERE (SELECT id FROM teams WHERE name = 'DHAIRYAM') IS NOT NULL;

-- 5. Final sync for any other players
UPDATE players SET sold_team = (SELECT name FROM teams WHERE teams.id = players.team_id) WHERE team_id IS NOT NULL AND sold_team IS NULL;
