import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
    try {
        const { data: state, error: stateError } = await supabaseAdmin
            .from('draft_state')
            .select(`
                *,
                teams (
                    id, 
                    name, 
                    logo_url
                )
            `)
            .maybeSingle();

        if (stateError) {
            return NextResponse.json({ success: false, error: stateError.message }, { status: 500 });
        }

        if (!state) {
            return NextResponse.json({ 
                success: true, 
                state: { 
                    current_slot: 1, 
                    current_turn: 0, 
                    current_team_id: null, 
                    is_reveal_open: false 
                } 
            });
        }

        return NextResponse.json({ success: true, state });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
