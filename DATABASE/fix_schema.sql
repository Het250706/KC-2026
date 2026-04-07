-- ROBUST SCHEMA FIX SCRIPT
-- Run this in your Supabase SQL Editor to ensure all columns exist!

-- 1. Ensure columns exist (using ALTER TABLE to handle existing tables)
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

    -- Add role if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='role') THEN
        ALTER TABLE players ADD COLUMN role TEXT;
    END IF;

    -- Add base_price if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='base_price') THEN
        ALTER TABLE players ADD COLUMN base_price BIGINT DEFAULT 0;
    END IF;

    -- Add photo_url if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='photo_url') THEN
        ALTER TABLE players ADD COLUMN photo_url TEXT;
    END IF;

    -- Add auction_status if missing (The critical fix)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='auction_status') THEN
        ALTER TABLE players ADD COLUMN auction_status TEXT DEFAULT 'pending';
    END IF;

    -- Add sold_price if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='sold_price') THEN
        ALTER TABLE players ADD COLUMN sold_price BIGINT;
    END IF;

    -- Add sold_team if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='sold_team') THEN
        ALTER TABLE players ADD COLUMN sold_team TEXT;
    END IF;
END $$;

-- 2. Refresh the schema cache
-- Note: Supabase UI normally refreshes cache after SQL runs.
-- Ensuring Realtime is on for the table
ALTER PUBLICATION supabase_realtime ADD TABLE players;
-- It might already be in publication, so we ignore errors if it is
EXCEPTION WHEN OTHERS THEN NULL;
