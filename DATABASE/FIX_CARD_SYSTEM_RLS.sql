-- SIMPLER & MORE PERMISSIVE RLS FIX
-- USE THIS IF PREVIOUS SCRIPT FAILED

-- 1. DISABLE RLS TEMPORARILY TO ENSURE IT'S NOT THE CAUSE
ALTER TABLE card_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE slot_players DISABLE ROW LEVEL SECURITY;
ALTER TABLE card_auction_turns DISABLE ROW LEVEL SECURITY;
ALTER TABLE card_auction_state DISABLE ROW LEVEL SECURITY;

-- 2. RE-ENABLE AND APPLY BROAD PERMISSIONS
ALTER TABLE card_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_auction_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_auction_state ENABLE ROW LEVEL SECURITY;

-- BROAD PERMISSION POLICIES (AUTHENTICATED ONLY)
DROP POLICY IF EXISTS "allow_all_authenticated" ON card_slots;
CREATE POLICY "allow_all_authenticated" ON card_slots FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_authenticated" ON slot_players;
CREATE POLICY "allow_all_authenticated" ON slot_players FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_authenticated" ON card_auction_turns;
CREATE POLICY "allow_all_authenticated" ON card_auction_turns FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_authenticated" ON card_auction_state;
CREATE POLICY "allow_all_authenticated" ON card_auction_state FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- PUBLIC READ ACCESS (TO SEE LIVE UPDATES WITHOUT LOGIN IF NEEDED)
DROP POLICY IF EXISTS "allow_public_read" ON card_slots;
CREATE POLICY "allow_public_read" ON card_slots FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "allow_public_read" ON slot_players;
CREATE POLICY "allow_public_read" ON slot_players FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "allow_public_read" ON card_auction_turns;
CREATE POLICY "allow_public_read" ON card_auction_turns FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "allow_public_read" ON card_auction_state;
CREATE POLICY "allow_public_read" ON card_auction_state FOR SELECT TO anon USING (true);

-- Ensure Realtime is on
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'card_slots') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE card_slots;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'slot_players') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE slot_players;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'card_auction_turns') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE card_auction_turns;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'card_auction_state') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE card_auction_state;
  END IF;
END $$;
