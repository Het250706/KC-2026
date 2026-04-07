-- CRITICAL REPAIR: PUSHP BIDDING & FINALIZATION (V3)
-- Run this in your Supabase SQL Editor to fix the "Function not found" and "Failed to assign" errors.

-- 1. FIX SCHEMA INCONSISTENCIES
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS team_id UUID;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS sold_team_id UUID;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS sold_team TEXT;

ALTER TABLE public.auction_state ADD COLUMN IF NOT EXISTS highest_bid_team_name TEXT;

-- 2. DROP EXISTING FUNCTIONS TO AVOID CONFLICTS
DROP FUNCTION IF EXISTS public.place_bid_v3(UUID);
DROP FUNCTION IF EXISTS public.place_bid_v3(UUID, BIGINT);
DROP FUNCTION IF EXISTS public.sell_player_v3();

-- 3. CREATE CONSOLIDATED BIDDING FUNCTION
CREATE OR REPLACE FUNCTION public.place_bid_v3(
    p_team_id UUID,
    p_increment BIGINT DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
    v_state_record RECORD;
    v_team_record RECORD;
    v_new_bid BIGINT;
    v_bidding_stages BIGINT[] := ARRAY[
        5, 10, 15, 20, 25, 50, 75, 100, 125, 175,
        225, 275, 325, 425, 525, 625, 750, 875, 1000, 1150,
        1300, 1450, 1600, 1800, 2000, 2500, 3125, 3750, 4375, 5000
    ];
    v_current_index INTEGER;
    v_squad_count INTEGER;
BEGIN
    -- 1. Lock state record
    SELECT * INTO v_state_record FROM public.auction_state WHERE id = 1 FOR UPDATE;

    -- 2. Validate state
    IF v_state_record.status != 'BIDDING' AND v_state_record.status != 'active' THEN
         RETURN jsonb_build_object('success', false, 'error', 'No active bidding session.');
    END IF;

    IF v_state_record.current_player_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No active player.');
    END IF;

    -- 3. Calculate New Bid
    IF v_state_record.current_highest_bid = 0 THEN
        v_new_bid := 5;
    ELSE
        v_current_index := 0;
        FOR i IN 1..array_length(v_bidding_stages, 1) LOOP
            IF v_bidding_stages[i] >= v_state_record.current_highest_bid THEN
                v_current_index := i;
                EXIT;
            END IF;
        END LOOP;

        IF v_current_index >= array_length(v_bidding_stages, 1) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Maximum bid reached (5000 P).');
        END IF;

        v_new_bid := v_bidding_stages[v_current_index + 1];
    END IF;

    -- 4. Validate Team Purse
    SELECT * INTO v_team_record FROM public.teams WHERE id = p_team_id;
    IF v_team_record.remaining_budget < v_new_bid THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient Pushp Points.');
    END IF;

    -- 5. Validate Squad Size
    SELECT count(*) INTO v_squad_count FROM public.players 
    WHERE (team_id = p_team_id OR sold_team_id = p_team_id) AND auction_status = 'sold';
    
    IF v_squad_count >= 9 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Squad limit reached (9/9).');
    END IF;

    -- 6. Insert Bid History
    INSERT INTO public.bids (player_id, team_id, amount)
    VALUES (v_state_record.current_player_id, p_team_id, v_new_bid);

    -- 7. Update Global State
    UPDATE public.auction_state SET
        current_highest_bid = v_new_bid,
        highest_bid_team_id = p_team_id,
        highest_bid_team_name = v_team_record.name, -- Update name if column exists
        bidding_status = 'BIDDING OPEN',
        last_updated_at = NOW()
    WHERE id = 1;

    RETURN jsonb_build_object(
        'success', true, 
        'new_bid', v_new_bid, 
        'team_name', v_team_record.name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. CREATE SALE FUNCTION
CREATE OR REPLACE FUNCTION public.sell_player_v3() RETURNS JSONB AS $$
DECLARE
    v_state RECORD;
BEGIN
    SELECT * INTO v_state FROM public.auction_state WHERE id = 1 FOR UPDATE;
    IF v_state.current_player_id IS NULL OR v_state.highest_bid_team_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No winner to sell to.');
    END IF;

    -- Update player (Handling both potential column names)
    UPDATE public.players SET 
        auction_status = 'sold',
        team_id = v_state.highest_bid_team_id,
        sold_team_id = v_state.highest_bid_team_id,
        sold_team = (SELECT name FROM public.teams WHERE id = v_state.highest_bid_team_id),
        sold_price = v_state.current_highest_bid,
        updated_at = NOW()
    WHERE id = v_state.current_player_id;

    -- Deduct budget from team
    UPDATE public.teams SET 
        remaining_budget = remaining_budget - v_state.current_highest_bid
    WHERE id = v_state.highest_bid_team_id;

    -- Reset state to idle
    UPDATE public.auction_state SET 
        status = 'SOLD',
        current_player_id = NULL,
        highest_bid_team_id = NULL,
        current_highest_bid = 0,
        bidding_status = 'SOLD',
        last_updated_at = NOW()
    WHERE id = 1;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.place_bid_v3(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_bid_v3(UUID, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.sell_player_v3() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sell_player_v3() TO service_role;

-- 6. REFRESH CACHE
NOTIFY pgrst, 'reload schema';
