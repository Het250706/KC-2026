import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const { draftOrderIds } = await request.json();

        if (!draftOrderIds || !Array.isArray(draftOrderIds)) {
            return NextResponse.json({ success: false, error: 'Invalid draftOrderIds' }, { status: 400 });
        }

        // 1. Delete existing draft order
        const { error: delError } = await supabaseAdmin
            .from('draft_order')
            .delete()
            .neq('team_id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (delError) throw delError;

        // 2. Insert new draft order
        const insertions = draftOrderIds.map((teamId, idx) => ({
            team_id: teamId,
            position: idx
        }));

        const { error: insError } = await supabaseAdmin
            .from('draft_order')
            .insert(insertions);

        if (insError) throw insError;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[API/DRAFT/SAVE-ORDER] Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
