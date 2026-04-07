import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const { error: teamError } = await supabaseAdmin
            .from('teams')
            .update({ remaining_budget: 5000 })
            .neq('id', '00000000-0000-0000-0000-000000000000');

        const { error: playerError } = await supabaseAdmin
            .from('players')
            .update({ base_price: 100 })
            .neq('id', '00000000-0000-0000-0000-000000000000');

        const { error: stateError } = await supabaseAdmin
            .from('auction_state')
            .update({ current_bid: 0, bidding_status: 'IDLE' })
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (teamError || playerError || stateError) throw (teamError || playerError || stateError);
        return NextResponse.json({ success: true, message: 'Teams, Players, and State reset to 100/3000 rules.' });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
