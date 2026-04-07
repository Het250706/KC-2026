import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const maxDuration = 60; // Increase timeout to 60s

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, player } = body;

        console.log('API Request:', { action, playerName: player?.first_name });

        if (action === 'create') {
            if (!player) {
                return NextResponse.json({ error: 'Player data is missing' }, { status: 400 });
            }

            // Cleanup player object to match DB schema (Enterprise version)
            const dbPlayer = {
                first_name: player.first_name || '',
                last_name: player.last_name || '',
                photo_url: player.photo_url || '',
                batting_style: player.batting_style || 'RIGHT_HANDED',
                bowling_style: player.bowling_style || 'RIGHT_ARM',
                base_price: player.base_price || 50000000,
                auction_status: 'pending'
            };

            const { data, error } = await supabaseAdmin.from('players').insert([dbPlayer]).select();

            if (error) {
                console.error('Supabase Insert Error:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, data });
        }

        if (action === 'update') {
            const { id, ...updates } = player;
            const { data, error } = await supabaseAdmin.from('players').update(updates).eq('id', id).select();
            if (error) throw error;
            return NextResponse.json({ success: true, data });
        }

        if (action === 'delete') {
            const { id } = player;

            // Clear FK references in innings table before deleting
            await supabaseAdmin.from('innings')
                .update({ striker_id: null })
                .eq('striker_id', id);
            await supabaseAdmin.from('innings')
                .update({ bowler_id: null })
                .eq('bowler_id', id);

            // Clear FK references in other related tables
            await supabaseAdmin.from('match_events')
                .update({ batsman_id: null })
                .eq('batsman_id', id);
            await supabaseAdmin.from('match_events')
                .update({ bowler_id: null })
                .eq('bowler_id', id);
            await supabaseAdmin.from('player_match_stats')
                .delete()
                .eq('player_id', id);
            await supabaseAdmin.from('match_players')
                .delete()
                .eq('player_id', id);
            await supabaseAdmin.from('bids')
                .delete()
                .eq('player_id', id);

            const { error } = await supabaseAdmin.from('players').delete().eq('id', id);
            if (error) throw error;
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Player Management Global Error:', error);
        return NextResponse.json({
            error: error.message || 'Internal Server Error',
            details: error.stack
        }, { status: 500 });
    }
}
