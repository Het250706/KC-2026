-- Final Auction Rules (100 Difference & 3000 Points)
-- Apply this in Supabase SQL Editor to reset database to the new rules

-- 1. Reset all team budgets to 3000
UPDATE teams SET remaining_budget = 3000;

-- 2. Reset all player prices to 100
UPDATE players SET base_price = 100;

-- 3. Reset auction state to IDLE
UPDATE auction_state SET current_bid = 0, bidding_status = 'IDLE', current_highest_bid = 0;

-- 4. Set NEW default values for future additions
ALTER TABLE teams ALTER COLUMN remaining_budget SET DEFAULT 3000;
ALTER TABLE players ALTER COLUMN base_price SET DEFAULT 100;

-- Optional: Clean up old draft tables if you want
-- DROP TABLE IF EXISTS draft_state;
-- DROP TABLE IF EXISTS draft_order;
