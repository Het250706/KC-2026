import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const { playerId } = await request.json();

        if (!playerId) {
            return NextResponse.json({ success: false, error: 'Missing playerId' }, { status: 400 });
        }

        // 1. Get current draft state
        const { data: state, error: stateError } = await supabaseAdmin
            .from('draft_state')
            .select('*')
            .single();

        if (stateError || !state) {
            return NextResponse.json({ success: false, error: 'Draft state not found' }, { status: 500 });
        }

        // 2. Assign player to the current team
        const { data: player, error: playerError } = await supabaseAdmin
            .from('players')
            .update({
                team_id: state.current_team_id,
                auction_status: 'sold',
                sold_price: 0, // Since it's a draft
                sold_team: state.current_team_id, // For backward compatibility if needed
                is_selected: true,
                draft_order_pick: state.current_turn + (state.current_slot - 1) * 8 // Roughly
            })
            .eq('id', playerId)
            .select()
            .single();

        if (playerError) {
            console.error('Player assignment error:', playerError);
            return NextResponse.json({ success: false, error: 'Failed to assign player' }, { status: 500 });
        }

        // 3. Mark reveal as open
        await supabaseAdmin
            .from('draft_state')
            .update({ is_reveal_open: true, last_update: new Date().toISOString() })
            .eq('id', state.id);

        return NextResponse.json({ success: true, player });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
