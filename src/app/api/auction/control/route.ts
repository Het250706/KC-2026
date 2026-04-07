import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, duration, player_id, timer_remaining } = body;

        if (action === 'start') {
            const { data: player } = await supabaseAdmin.from('players').select('base_price').eq('id', player_id).single();
            const startPrice = player?.base_price || 50000000;

            await supabaseAdmin.from('players').update({
                auction_status: 'active'
            }).eq('id', player_id);

            await supabaseAdmin.from('auction_state').update({
                status: 'BIDDING',
                bidding_status: 'BIDDING OPEN',
                current_player_id: player_id,
                current_highest_bid: startPrice,
                highest_bid_team_id: null,
                last_updated_at: new Date().toISOString()
            }).eq('id', 1);
        }
        else if (action === 'pause') {
            await supabaseAdmin.from('auction_state').update({ status: 'IDLE' }).eq('id', 1);
        }
        else if (action === 'resume') {
            await supabaseAdmin.from('auction_state').update({ status: 'BIDDING' }).eq('id', 1);
        }
        else if (action === 'tick') {
            // Timer column removed in V3, ignoring tick
        }
        else if (action === 'reset') {
            await supabaseAdmin.from('auction_state').update({
                status: 'IDLE',
                bidding_status: 'IDLE',
                current_player_id: null,
                current_highest_bid: 0,
                highest_bid_team_id: null,
                last_updated_at: new Date().toISOString()
            }).eq('id', 1);
        }
        else if (action === 'unsold') {
            const { player_id } = body;
            await supabaseAdmin.from('players').update({
                auction_status: 'unsold'
            }).eq('id', player_id);

            await supabaseAdmin.from('auction_state').update({
                status: 'UNSOLD',
                bidding_status: 'IDLE',
                current_player_id: player_id,
                current_highest_bid: 0,
                highest_bid_team_id: null,
                last_updated_at: new Date().toISOString()
            }).eq('id', 1);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
