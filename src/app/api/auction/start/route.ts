import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function POST(request: Request) {
    try {
        const { player_id } = await request.json();

        if (!player_id) {
            return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
        }

        // 1. Reset any currently active player to pending
        await supabaseAdmin
            .from('players')
            .update({ auction_status: 'pending' })
            .eq('auction_status', 'active');

        // 2. Set new player to active
        const { data, error } = await supabaseAdmin
            .from('players')
            .update({ auction_status: 'active' })
            .eq('id', player_id)
            .select()
            .single();

        if (error) throw error;

        // 3. Update auction_state table for real-time sync with legacy components
        await supabaseAdmin
            .from('auction_state')
            .update({
                status: 'BIDDING',
                bidding_status: 'BIDDING OPEN',
                current_player_id: player_id,
                current_highest_bid: 0,
                highest_bid_team_id: null,
                last_updated_at: new Date().toISOString()
            })
            .eq('id', 1);

        return NextResponse.json({ success: true, player: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
