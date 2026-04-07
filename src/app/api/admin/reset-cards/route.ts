import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function POST(request: Request) {
    try {
        console.log('Resetting Card System...');

        // 1. Reset all players to pending/unassigned for the card system
        const { error: playersError } = await supabaseAdmin
            .from('players')
            .update({ 
                slot_status: 'unassigned'
            })
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Always true UUID for update all

        if (playersError) throw playersError;

        // 2. Clear all Card Flip specific data
        // We delete in order due to foreign keys
        await supabaseAdmin.from('slot_players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabaseAdmin.from('card_auction_turns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabaseAdmin.from('card_slots').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        // 3. Reset the Auction State to default
        await supabaseAdmin
            .from('card_auction_state')
            .update({ 
                current_slot_id: null, 
                current_turn: 1, 
                is_active: false 
            })
            .eq('id', 1);

        console.log('Card system reset successfully!');
        return NextResponse.json({ success: true, message: 'Card system reset successfully!' });

    } catch (error: any) {
        console.error('Card System Reset Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
