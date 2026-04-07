import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function POST(request: Request) {
    try {
        const { players } = await request.json();

        if (!Array.isArray(players) || players.length === 0) {
            return NextResponse.json({ error: 'No players provided' }, { status: 400 });
        }

        const formattedPlayers = players.map(p => ({
            first_name: p.first_name || 'New',
            last_name: p.last_name || 'Player',
            role: p.role || 'Batsman',
            category: p.category || 'Silver',
            batting_style: p.batting_style || 'RIGHT_HANDED',
            bowling_style: p.bowling_style || 'RIGHT_ARM',
            base_price: p.base_price || 20000000,
            photo_url: p.photo_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + Math.random(),
            auction_status: 'pending'
        }));

        const { data, error } = await supabaseAdmin
            .from('players')
            .insert(formattedPlayers)
            .select();

        if (error) throw error;

        return NextResponse.json({ success: true, count: data.length });

    } catch (err: any) {
        console.error('Bulk Upload Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
