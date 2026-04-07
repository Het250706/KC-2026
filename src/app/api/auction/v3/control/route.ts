import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const { action, player_id, bidding_status } = await request.json();

        if (action === 'start') {
            // Reset state and set player
            await supabaseAdmin.from('auction_state').update({
                status: 'BIDDING',
                bidding_status: 'BIDDING OPEN',
                current_player_id: player_id,
                current_highest_bid: 0,
                highest_bid_team_id: null,
                last_updated_at: new Date().toISOString()
            }).eq('id', 1);

            await supabaseAdmin.from('players').update({ auction_status: 'active' }).eq('id', player_id);
            return NextResponse.json({ success: true });
        }

        if (action === 'status_update') {
            await supabaseAdmin.from('auction_state').update({
                bidding_status: bidding_status,
                last_updated_at: new Date().toISOString()
            }).eq('id', 1);
            return NextResponse.json({ success: true });
        }

        if (action === 'reset') {
            await supabaseAdmin.from('auction_state').update({
                status: 'IDLE',
                bidding_status: 'IDLE',
                current_player_id: null,
                current_highest_bid: 0,
                highest_bid_team_id: null,
                last_updated_at: new Date().toISOString()
            }).eq('id', 1);
            return NextResponse.json({ success: true });
        }

        if (action === 'unsold') {
            await supabaseAdmin.from('players').update({ auction_status: 'unsold' }).eq('id', player_id);
            await supabaseAdmin.from('auction_state').update({
                status: 'UNSOLD',
                bidding_status: 'IDLE',
                last_updated_at: new Date().toISOString()
            }).eq('id', 1);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
