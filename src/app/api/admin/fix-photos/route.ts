import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        let playersFixed = 0;
        let registrationsFixed = 0;

        // 1. Fetch rows from players table
        const { data: players, error: playersError } = await supabaseAdmin
            .from('players')
            .select('id, photo_url')
            .ilike('photo_url', '%drive.google.com/uc%');

        if (playersError) throw playersError;

        if (players && players.length > 0) {
            for (const player of players) {
                const match = player.photo_url?.match(/[-\w]{25,}/);
                if (match) {
                    const newUrl = `https://lh3.googleusercontent.com/d/${match[0]}`;
                    const { error: updateError } = await supabaseAdmin
                        .from('players')
                        .update({ photo_url: newUrl })
                        .eq('id', player.id);
                    if (!updateError) playersFixed++;
                }
            }
        }

        // 2. Fetch rows from registrations table
        const { data: registrations, error: registrationsError } = await supabaseAdmin
            .from('registrations')
            .select('id, photo')
            .ilike('photo', '%drive.google.com/uc%');

        if (registrationsError) throw registrationsError;

        if (registrations && registrations.length > 0) {
            for (const reg of registrations) {
                const match = reg.photo?.match(/[-\w]{25,}/);
                if (match) {
                    const newUrl = `https://lh3.googleusercontent.com/d/${match[0]}`;
                    const { error: updateError } = await supabaseAdmin
                        .from('registrations')
                        .update({ photo: newUrl })
                        .eq('id', reg.id);
                    if (!updateError) registrationsFixed++;
                }
            }
        }

        return NextResponse.json({
            success: true,
            players_fixed: playersFixed,
            registrations_fixed: registrationsFixed
        });

    } catch (error: any) {
        console.error('Migration Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
