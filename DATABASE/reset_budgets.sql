-- EMERGENCY RESET: FIX FRANCHISE BUDGETS TO 5000 PUSHP
-- Run this in your Supabase SQL Editor to reset all teams.

-- 1. Reset all teams to default Keshav Cup 3.0 values
UPDATE public.teams 
SET 
  total_budget = 5000,
  remaining_budget = 5000,
  max_players = 9;

-- 2. Clear any active bids to avoid state mismatch (Optional but recommended)
-- DELETE FROM public.bids;

-- 3. Reset auction state to 0 current bid
UPDATE public.auction_state
SET 
  current_highest_bid = 0,
  highest_bid_team_id = NULL,
  status = 'IDLE',
  bidding_status = 'IDLE'
WHERE id = 1;

-- 4. Notify the app to refresh cache
NOTIFY pgrst, 'reload schema';
