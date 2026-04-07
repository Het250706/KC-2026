import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const { slotNumber } = await request.json();

        if (slotNumber === undefined) {
             return NextResponse.json({ success: false, error: 'Missing slotNumber' }, { status: 400 });
        }

        // 0. Find the CardSlot ID for this number
        const { data: currentSlot } = await supabaseAdmin
            .from('card_slots')
            .select('id')
            .eq('slot_number', slotNumber)
            .maybeSingle();

        let firstTeam_id = null;
        let finalOrder = [];

        if (currentSlot) {
            // Priority: Check card_auction_turns for this specific slot
            const { data: specificTurns } = await supabaseAdmin
                .from('card_auction_turns')
                .select('team_id')
                .eq('slot_id', currentSlot.id)
                .order('turn_order', { ascending: true });

            if (specificTurns && specificTurns.length > 0) {
                finalOrder = specificTurns;
                firstTeam_id = specificTurns[0].team_id;
            }
        }

        // Fallback: If no specific turns, use global draft_order
        if (!firstTeam_id) {
            const { data: globalOrder } = await supabaseAdmin
                .from('draft_order')
                .select('team_id')
                .order('position', { ascending: true });

            if (globalOrder && globalOrder.length > 0) {
                finalOrder = globalOrder;
                firstTeam_id = globalOrder[0].team_id;
            }
        }

        if (!firstTeam_id) {
            return NextResponse.json({ success: false, error: 'Draft order not set. Configure team picking sequence in admin.' }, { status: 400 });
        }

        const { data: state } = await supabaseAdmin
            .from('draft_state')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (state) {
            await supabaseAdmin
                .from('draft_state')
                .update({
                    current_slot: slotNumber,
                    current_turn: 0,
                    current_team_id: firstTeam_id,
                    is_reveal_open: false,
                    last_update: new Date().toISOString()
                })
                .eq('id', state.id);
        } else {
            await supabaseAdmin
                .from('draft_state')
                .insert({
                    current_slot: slotNumber,
                    current_turn: 0,
                    current_team_id: firstTeam_id,
                    is_reveal_open: false
                });
        }

        return NextResponse.json({ success: true, slotNumber });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
