import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function POST(request: Request) {
    try {
        const { player_id } = await request.json();

        if (!player_id) {
            return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
        }

        // Use the atomic V3 sell function for Keshav Cup 3.0
        // This handles player status, team budget deduction, and auction state reset in one transaction.
        const { data, error } = await supabaseAdmin.rpc('sell_player_v3');

        if (error) throw error;
        if (data && !data.success) {
            return NextResponse.json({ error: data.error }, { status: 400 });
        }

        // Force status to IDLE after a successful sell so the dashboard shows "NEXT PLAYER"
        // sell_player_v3 clears current_player_id but leaves status as BIDDING
        await supabaseAdmin.from('auction_state').update({
            status: 'IDLE',
            bidding_status: 'IDLE',
            last_updated_at: new Date().toISOString()
        }).eq('id', 1);

        return NextResponse.json({ success: true, message: 'Player sold successfully' });
    } catch (error: any) {
        console.error('Assign API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
