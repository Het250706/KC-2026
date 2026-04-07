import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function DELETE(request: Request) {
    try {
        // 1. Reset auction state
        await supabaseAdmin
            .from('auction_state')
            .update({ 
                current_player_id: null, 
                status: 'IDLE', 
                current_highest_bid: 0, 
                highest_bid_team_id: null 
            })
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy condition to update all rows

        // 2. Delete all records from bids
        await supabaseAdmin
            .from('bids')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        // 3. Clear all slot_players (Card System)
        await supabaseAdmin
            .from('slot_players')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        // 3. Reset all registrations to not pushed
        await supabaseAdmin
            .from('registrations')
            .update({ is_pushed: false })
            .neq('id', '00000000-0000-0000-0000-000000000000');

        // 4. Reset team budgets to default (5000 as per reset-budgets logic)
        await supabaseAdmin
            .from('teams')
            .update({ remaining_budget: 5000 })
            .neq('id', '00000000-0000-0000-0000-000000000000');

        // 5. Delete all records from players
        const { error: dbError } = await supabaseAdmin
            .from('players')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (dbError) throw dbError;

        return NextResponse.json({ success: true, message: 'All players returned to registrations and pool emptied.' });

    } catch (error: any) {
        console.error('Bulk Delete All Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
