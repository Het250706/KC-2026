-- CARD FLIP AUCTION SYSTEM SETUP
-- DO NOT MODIFY EXISTING BIDDING TABLES

-- 1. ADAPT PLAYERS TABLE
ALTER TABLE IF EXISTS players 
ADD COLUMN IF NOT EXISTS slot_status TEXT DEFAULT 'unassigned' CHECK (slot_status IN ('unassigned', 'in_slot', 'sold'));

-- 2. SLOTS TABLE
CREATE TABLE IF NOT EXISTS card_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_number SERIAL UNIQUE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SLOT PLAYERS (CARDS)
CREATE TABLE IF NOT EXISTS slot_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID REFERENCES card_slots(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id),
    card_position INT CHECK (card_position BETWEEN 1 AND 8),
    is_picked BOOLEAN DEFAULT FALSE,
    picked_by_team_id UUID REFERENCES teams(id),
    picked_at TIMESTAMPTZ,
    UNIQUE(slot_id, card_position),
    UNIQUE(slot_id, player_id)
);

-- 4. AUCTION TURNS
CREATE TABLE IF NOT EXISTS card_auction_turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID REFERENCES card_slots(id) ON DELETE CASCADE,
    turn_order INT,
    team_id UUID REFERENCES teams(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CARD AUCTION STATE (SINGLE ROW)
CREATE TABLE IF NOT EXISTS card_auction_state (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    current_slot_id UUID REFERENCES card_slots(id),
    current_turn INT DEFAULT 1,
    is_active BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INITIALIZE STATE
INSERT INTO card_auction_state (id, is_active) VALUES (1, false) ON CONFLICT (id) DO NOTHING;

-- ENABLE REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE card_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE slot_players;
ALTER PUBLICATION supabase_realtime ADD TABLE card_auction_turns;
ALTER PUBLICATION supabase_realtime ADD TABLE card_auction_state;

-- 6. RPC: pick_card(p_slot_id, p_card_position, p_team_id)
CREATE OR REPLACE FUNCTION pick_card(
    p_slot_id UUID,
    p_card_position INT,
    p_team_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_auction_active BOOLEAN;
    v_current_turn INT;
    v_turn_team_id UUID;
    v_player_id UUID;
    v_slot_player_id UUID;
    v_total_cards INT;
    v_picked_cards INT;
BEGIN
    -- 1. Check Auction Active
    SELECT is_active, current_turn INTO v_auction_active, v_current_turn 
    FROM card_auction_state WHERE id = 1;
    
    IF NOT v_auction_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'Auction is not active');
    END IF;

    -- 2. Validate Turn Order
    SELECT team_id INTO v_turn_team_id 
    FROM card_auction_turns 
    WHERE slot_id = p_slot_id AND turn_order = v_current_turn;

    IF v_turn_team_id != p_team_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'It is not your turn');
    END IF;

    -- 3. Check Card Existence and Status
    SELECT id, player_id INTO v_slot_player_id, v_player_id 
    FROM slot_players 
    WHERE slot_id = p_slot_id AND card_position = p_card_position AND is_picked = FALSE;

    IF v_slot_player_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Card already picked or does not exist');
    END IF;

    -- 4. Execute Pick
    UPDATE slot_players 
    SET is_picked = TRUE, picked_by_team_id = p_team_id, picked_at = NOW()
    WHERE id = v_slot_player_id;

    -- 5. Assign Player to Team
    UPDATE players 
    SET team_id = p_team_id, auction_status = 'sold', slot_status = 'sold'
    WHERE id = v_player_id;

    -- 6. Increment Turn
    -- Count total cards in slot
    SELECT COUNT(*) INTO v_total_cards FROM slot_players WHERE slot_id = p_slot_id;
    SELECT COUNT(*) INTO v_picked_cards FROM slot_players WHERE slot_id = p_slot_id AND is_picked = TRUE;

    IF v_picked_cards >= v_total_cards THEN
        -- Slot Completed
        UPDATE card_slots SET status = 'completed' WHERE id = p_slot_id;
        UPDATE card_auction_state SET is_active = FALSE, updated_at = NOW() WHERE id = 1;
    ELSE
        -- Next Turn
        UPDATE card_auction_state SET current_turn = v_current_turn + 1, updated_at = NOW() WHERE id = 1;
    END IF;

    RETURN jsonb_build_object('success', true, 'player_id', v_player_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
