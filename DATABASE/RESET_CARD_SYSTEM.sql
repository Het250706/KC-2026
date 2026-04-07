-- FULL RESET SCRIPT FOR KESHAV CUP CARD SYSTEM
-- WARNING: This will clear all card slots and reset player auction status!

-- 1. Reset all players to pending/unassigned
UPDATE players 
SET team_id = NULL,
    sold_team_id = NULL,
    auction_status = 'pending',
    slot_status = 'unassigned',
    sold_price = 0;

-- 2. Clear all Card Flip specific data
TRUNCATE TABLE slot_players CASCADE;
TRUNCATE TABLE card_auction_turns CASCADE;
TRUNCATE TABLE card_slots CASCADE;

-- 3. Reset the Auction State to default
DELETE FROM card_auction_state;
INSERT INTO card_auction_state (id, current_slot_id, current_turn, is_active)
VALUES (1, NULL, 1, false);

-- 4. Optionally clear old bidding data if needed (if you want a truly blank slate)
-- TRUNCATE TABLE bids CASCADE;
-- UPDATE teams SET remaining_budget = 5000;
