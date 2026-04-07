-- FIX SUPABASE SCHEMA FOR WAS_PRESENT_KC3
-- RUN THIS IN YOUR SUPABASE SQL EDITOR (https://supabase.com/dashboard/project/_/sql/new)

-- 1. Ensure the players table has all required columns with correct types
ALTER TABLE IF EXISTS players 
ADD COLUMN IF NOT EXISTS cricket_skill text,
ADD COLUMN IF NOT EXISTS was_present_kc3 text,
ADD COLUMN IF NOT EXISTS photo_url text,
ADD COLUMN IF NOT EXISTS base_price integer DEFAULT 20000000,
ADD COLUMN IF NOT EXISTS category text DEFAULT 'Silver',
ADD COLUMN IF NOT EXISTS role text DEFAULT 'All-rounder',
ADD COLUMN IF NOT EXISTS auction_status text DEFAULT 'pending';

-- 2. Ensure first_name and last_name exist (requested text type)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='first_name') THEN
        ALTER TABLE players ADD COLUMN first_name text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='last_name') THEN
        ALTER TABLE players ADD COLUMN last_name text;
    END IF;
END $$;

-- 3. REFRESH SCHEMA CACHE
-- PostgREST (Supabase API) needs a notification to reload its field cache.
NOTIFY pgrst, 'reload schema';

-- 4. FINAL STATUS CHECK
-- Run this to verify your table structure:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'players';
