-- BUDGET SYNC: AUTOMATICALLY RECALCULATE REMAINING PURSE
-- Run this in your Supabase SQL Editor if team balances look incorrect.

-- 1. Reset everyone to 5000 first
UPDATE public.teams SET remaining_budget = 5000;

-- 2. Deduct prices of all players already sold to each team
-- This handles both 'team_id' and 'sold_team_id' for maximum compatibility
UPDATE public.teams t
SET remaining_budget = 5000 - COALESCE((
    SELECT SUM(sold_price) 
    FROM public.players p 
    WHERE (p.team_id = t.id OR p.sold_team_id = t.id) 
    AND p.auction_status = 'sold'
), 0);

-- 3. Verify the final result
SELECT name, remaining_budget FROM public.teams ORDER BY remaining_budget DESC;
