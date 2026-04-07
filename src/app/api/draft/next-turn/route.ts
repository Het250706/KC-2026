import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST() {
    try {
        const { data: state, error: stateError } = await supabaseAdmin
            .from('draft_state')
            .select('*')
            .single();

        if (stateError || !state) {
            return NextResponse.json({ error: 'No draft state found' }, { status: 404 });
        }

        // 2. Identify the slot's ID to find the correct turn order
        const { data: currentSlot } = await supabaseAdmin
            .from('card_slots')
            .select('id')
            .eq('slot_number', state.current_slot)
            .maybeSingle();

        let order = [];
        if (currentSlot) {
            // Check for slot-specific turns first
            const { data: specificTurns } = await supabaseAdmin
                .from('card_auction_turns')
                .select('team_id')
                .eq('slot_id', currentSlot.id)
                .order('turn_order', { ascending: true });
            
            if (specificTurns && specificTurns.length > 0) {
                order = specificTurns;
            }
        }

        // Fallback: If no specific turns, use global draft order
        if (order.length === 0) {
            const { data: globalOrder } = await supabaseAdmin
                .from('draft_order')
                .select('team_id')
                .order('position', { ascending: true });
            
            if (globalOrder) order = globalOrder;
        }

        if (order.length === 0) {
            return NextResponse.json({ error: 'Draft order not configured.' }, { status: 400 });
        }

        // Cycle through the teams list based on position index
        const nextTurnIdx = (state.current_turn + 1) % order.length;
        const nextTeam = order[nextTurnIdx];

        const { error: updateError } = await supabaseAdmin
            .from('draft_state')
            .update({
                current_turn: nextTurnIdx,
                current_team_id: nextTeam.team_id,
                is_reveal_open: false,
                last_update: new Date().toISOString()
            })
            .eq('id', state.id);

        if (updateError) {
            return NextResponse.json({ error: 'Failed to update turn state' }, { status: 500 });
        }

        return NextResponse.json({ success: true, nextTeamId: nextTeam.team_id, currentTurn: nextTurnIdx });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
