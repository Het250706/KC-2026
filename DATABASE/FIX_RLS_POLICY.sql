-- FIX SUPABASE RLS ERROR FOR PLAYERS TABLE
-- RUN THIS IN YOUR SUPABASE SQL EDITOR (https://supabase.com/dashboard/project/_/sql/new)

-- 1. Enable RLS on the players table (if not already enabled)
ALTER TABLE IF EXISTS players ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing insertion policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Allow player insert" ON players;
DROP POLICY IF EXISTS "Anyone can insert players" ON players;
DROP POLICY IF EXISTS "Automation can insert players" ON players;

-- 3. Create a clean policy that allows anyone (including anonymous web users) to insert players
-- This is necessary because the Registration Control panel uses the public anon key.
CREATE POLICY "Allow player insert"
ON players
FOR INSERT
TO public
WITH CHECK (true);

-- 4. Ensure SELECT access is also public so the admin panel can see the pushed players
DROP POLICY IF EXISTS "Allow public read access" ON players;
CREATE POLICY "Allow public read access"
ON players
FOR SELECT
TO public
USING (true);

-- 5. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

-- Verification Tip:
-- After running this, try pushing a player again from the Registration Control panel.
