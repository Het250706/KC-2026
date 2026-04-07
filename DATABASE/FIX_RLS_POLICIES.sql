-- ============================================================================
-- FIX_RLS_POLICIES.sql
-- Run this in Supabase SQL Editor to ensure all RLS policies are correct.
-- This is a safety measure — current evidence shows RLS is NOT blocking queries.
-- ============================================================================

-- PLAYERS TABLE
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players Public Select" ON players;
CREATE POLICY "Players Public Select" ON players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Players All" ON players;
CREATE POLICY "Players All" ON players FOR ALL USING (true) WITH CHECK (true);

-- AUCTION STATE TABLE
ALTER TABLE auction_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auction State All" ON auction_state;
CREATE POLICY "Auction State All" ON auction_state FOR ALL USING (true) WITH CHECK (true);

-- TEAMS TABLE
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teams All" ON teams;
CREATE POLICY "Teams All" ON teams FOR ALL USING (true) WITH CHECK (true);

-- BIDS TABLE
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bids All" ON bids;
CREATE POLICY "Bids All" ON bids FOR ALL USING (true) WITH CHECK (true);

-- MATCHES TABLE
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Matches All" ON matches;
CREATE POLICY "Matches All" ON matches FOR ALL USING (true) WITH CHECK (true);

-- INNINGS TABLE
ALTER TABLE innings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Innings All" ON innings;
CREATE POLICY "Innings All" ON innings FOR ALL USING (true) WITH CHECK (true);

-- MATCH EVENTS TABLE
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Match Events All" ON match_events;
CREATE POLICY "Match Events All" ON match_events FOR ALL USING (true) WITH CHECK (true);

-- USER ROLES TABLE
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User Roles All" ON user_roles;
CREATE POLICY "User Roles All" ON user_roles FOR ALL USING (true) WITH CHECK (true);

-- PLAYER MATCH STATS TABLE (if exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_match_stats') THEN
    ALTER TABLE player_match_stats ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "Player Match Stats All" ON player_match_stats';
    EXECUTE 'CREATE POLICY "Player Match Stats All" ON player_match_stats FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- MATCH PLAYERS TABLE (if exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'match_players') THEN
    ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "Match Players All" ON match_players';
    EXECUTE 'CREATE POLICY "Match Players All" ON match_players FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ============================================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'players') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE players;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'auction_state') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE auction_state;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'teams') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE teams;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bids') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bids;
  END IF;
END $$;

SELECT 'All RLS policies and realtime subscriptions applied successfully!' AS result;
