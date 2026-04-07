
-- ADD COLUMNS FOR GOOGLE FORM INTEGRATION
ALTER TABLE players ADD COLUMN IF NOT EXISTS cricket_skill TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS was_present_kc3 TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS player_photo_url TEXT; -- Backup for photo

-- Update existing column names if needed or just use extra columns
