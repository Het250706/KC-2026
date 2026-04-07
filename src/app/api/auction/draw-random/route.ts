import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function POST() {
    try {
        // 1. Fetch all pending players
        const { data: pendingPlayers, error: fetchError } = await supabaseAdmin
            .from('players')
            .select('id, first_name, last_name, category, base_price')
            .eq('auction_status', 'pending');

        if (fetchError) throw fetchError;

        if (!pendingPlayers || pendingPlayers.length === 0) {
            return NextResponse.json({ error: 'No pending players left in the pool.' }, { status: 404 });
        }

        // 2. Select a random player
        const randomIndex = Math.floor(Math.random() * pendingPlayers.length);
        const randomPlayer = pendingPlayers[randomIndex];

        // 3. Reset currently active player(s) just in case
        await supabaseAdmin
            .from('players')
            .update({ auction_status: 'pending' })
            .eq('auction_status', 'active');

        // 4. Set the new player to active
        const { error: activeError } = await supabaseAdmin
            .from('players')
            .update({ auction_status: 'active' })
            .eq('id', randomPlayer.id);

        if (activeError) throw activeError;

        // 5. Update auction_state for real-time components
        const { error: stateError } = await supabaseAdmin
            .from('auction_state')
            .update({
                status: 'BIDDING',
                bidding_status: 'BIDDING OPEN',
                current_player_id: randomPlayer.id,
                current_highest_bid: 0,
                highest_bid_team_id: null,
                last_updated_at: new Date().toISOString()
            })
            .eq('id', 1);

        if (stateError) throw stateError;

        return NextResponse.json({
            success: true,
            player: randomPlayer,
            message: `Selected ${randomPlayer.first_name} ${randomPlayer.last_name} for auction.`
        });

    } catch (err: any) {
        console.error('Draw Random Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
