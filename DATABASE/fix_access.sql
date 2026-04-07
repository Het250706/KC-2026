-- CRITICAL SECURITY & ACCESS FIX
-- Run this in your Supabase SQL Editor to allow the application to see data!

-- 1. Enable RLS on all tables
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Read players" ON players;
DROP POLICY IF EXISTS "Public Read teams" ON teams;
DROP POLICY IF EXISTS "Public Read auction_state" ON auction_state;
DROP POLICY IF EXISTS "Public Read bids" ON bids;

-- 3. Create NEW simple "Read for All" policies
CREATE POLICY "Public Read players" ON players FOR SELECT USING (true);
CREATE POLICY "Public Read teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public Read auction_state" ON auction_state FOR SELECT USING (true);
CREATE POLICY "Public Read bids" ON bids FOR SELECT USING (true);

-- 4. Bypass RLS for Service Role (Admin client already does this, but being explicit)
-- Note: Service role always has access, no need for explicit policies for it.

-- 5. Refresh Realtime (Ensuring it's fully active)
DO $$ 
BEGIN 
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE players;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE teams;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE auction_state;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE bids;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;
