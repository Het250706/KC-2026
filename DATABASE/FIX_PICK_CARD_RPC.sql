-- ATOMIC RPC FOR PICKING A CARD (ROBUST VERSION WITH SOLD TEAM ID)
-- THIS ENSURES PLAYERS SHOW UP IN TEAM SQUADS AUTOMATICALLY
DROP FUNCTION IF EXISTS public.pick_card(uuid, integer, uuid);
DROP FUNCTION IF EXISTS public.pick_card(integer, uuid);

CREATE OR REPLACE FUNCTION public.pick_card(
    p_slot_id UUID,
    p_card_position INT,
    p_team_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_current_player_id UUID;
    v_current_turn INT;
    v_slot_status TEXT;
    v_turn_team_id UUID;
    v_is_already_picked BOOLEAN;
BEGIN
    -- 1. Check if slot exists and get status
    SELECT status INTO v_slot_status FROM card_slots WHERE id = p_slot_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Slot not found');
    END IF;
    
    IF v_slot_status != 'active' THEN
        RETURN json_build_object('success', false, 'error', 'Slot is not active');
    END IF;

    -- 2. Check current turn & state
    SELECT current_turn INTO v_current_turn FROM card_auction_state WHERE id = 1;
    
    -- 3. Verify it is this team's turn
    SELECT team_id INTO v_turn_team_id 
    FROM card_auction_turns 
    WHERE slot_id = p_slot_id AND turn_order = v_current_turn;

    -- If p_team_id is provided, verify it. Admin override if p_team_id is null.
    IF p_team_id IS NOT NULL AND v_turn_team_id != p_team_id THEN
        RETURN json_build_object('success', false, 'error', 'It is not your turn');
    END IF;

    -- 4. Check if card is already picked and get current player
    SELECT is_picked, player_id INTO v_is_already_picked, v_current_player_id 
    FROM slot_players 
    WHERE slot_id = p_slot_id AND card_position = p_card_position;

    IF v_is_already_picked THEN
        RETURN json_build_object('success', false, 'error', 'Card already picked');
    END IF;

    -- 5. PERFORM THE REVEAL & ASSIGNMENT
    -- Update slot_players
    UPDATE slot_players 
    SET is_picked = true, 
        picked_by_team_id = v_turn_team_id,
        picked_at = NOW() 
    WHERE slot_id = p_slot_id AND card_position = p_card_position;

    -- Update players table (assign to team and set status)
    -- We set BOTH team_id and sold_team_id for compatibility
    UPDATE players 
    SET team_id = v_turn_team_id,
        sold_team_id = v_turn_team_id,
        auction_status = 'sold',
        slot_status = 'sold',
        sold_price = 0  -- Set price to 0 since no bidding involved
    WHERE id = v_current_player_id;

    -- 6. PROGRESS TO NEXT TURN
    UPDATE card_auction_state 
    SET current_turn = v_current_turn + 1 
    WHERE id = 1;

    -- 7. CHECK IF SLOT IS COMPLETED
    IF NOT EXISTS (SELECT 1 FROM slot_players WHERE slot_id = p_slot_id AND is_picked = false) THEN
        UPDATE card_slots SET status = 'completed' WHERE id = p_slot_id;
        UPDATE card_auction_state SET is_active = false WHERE id = 1;
    END IF;

    RETURN json_build_object('success', true, 'player_id', v_current_player_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
