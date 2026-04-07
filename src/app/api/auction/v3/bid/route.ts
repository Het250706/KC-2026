import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const { team_id, increment = 0 } = await request.json();

        const { data, error } = await supabaseAdmin.rpc('place_bid_v3', {
            p_team_id: team_id,
            p_increment: increment
        });

        if (error) throw error;
        if (data && !data.success) {
            return NextResponse.json({ error: data.error }, { status: 400 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
