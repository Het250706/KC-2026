import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const { team_id, player_id, amount } = await request.json();

        // Use the high-performance RPC function for Keshav Cup 3.0
        const { data: result, error: rpcError } = await supabaseAdmin.rpc('place_bid_v3', {
            p_team_id: team_id,
            p_increment: amount >= 100000 ? amount : 100000 // Ensure we treat 'amount' as increment if it's small, or use increment logic
        });

        if (rpcError) throw rpcError;
        if (result && !result.success) throw new Error(result.error);

        return NextResponse.json({ success: true, ...result });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
