-- SUPABASE SCHEMA FIX: ADD KC3 COLUMNS
-- Run this in your Supabase SQL Editor (https://app.supabase.com)

-- 1. Ensure all required columns exist in the players table
DO $$ 
BEGIN 
    -- Add first_name if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='first_name') THEN
        ALTER TABLE players ADD COLUMN first_name TEXT;
    END IF;

    -- Add last_name if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='last_name') THEN
        ALTER TABLE players ADD COLUMN last_name TEXT;
    END IF;

    -- Add cricket_skill if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='cricket_skill') THEN
        ALTER TABLE players ADD COLUMN cricket_skill TEXT;
    END IF;

    -- Add was_present_kc3 if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='was_present_kc3') THEN
        ALTER TABLE players ADD COLUMN was_present_kc3 TEXT;
    END IF;

    -- Add photo_url if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='photo_url') THEN
        ALTER TABLE players ADD COLUMN photo_url TEXT;
    END IF;

    -- Add base_price if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='base_price') THEN
        ALTER TABLE players ADD COLUMN base_price BIGINT DEFAULT 0;
    END IF;

    -- Add category if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='category') THEN
        ALTER TABLE players ADD COLUMN category TEXT;
    END IF;

    -- Add role if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='role') THEN
        ALTER TABLE players ADD COLUMN role TEXT;
    END IF;

    -- Add auction_status if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='auction_status') THEN
        ALTER TABLE players ADD COLUMN auction_status TEXT DEFAULT 'pending';
    END IF;

END $$;

-- 2. Grant necessary permissions (if not already set)
GRANT ALL ON TABLE players TO postgres;
GRANT ALL ON TABLE players TO service_role;
GRANT ALL ON TABLE players TO authenticated;
GRANT ALL ON TABLE players TO anon;

-- 3. Refresh the schema cache
-- Supabase handles this automatically when you run SQL in the dashboard.
-- If using a custom PostgREST setup, you would run:
-- NOTIFY pgrst, 'reload schema';

COMMENT ON COLUMN players.was_present_kc3 IS 'Indicates if the player was present in Keshav Cup 3 (2025)';
COMMENT ON COLUMN players.cricket_skill IS 'Specific cricket ability reported in Google Form';
