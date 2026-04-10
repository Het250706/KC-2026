import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    console.log('--- BULK PUSH PLAYERS API CALLED ---');
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('Missing Supabase environment variables');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // 1. Fetch all unpushed registrations
        const { data: unpushed, error: fetchErr } = await supabaseAdmin
            .from('registrations')
            .select('*')
            .eq('is_pushed', false);

        if (fetchErr) throw fetchErr;
        if (!unpushed || unpushed.length === 0) {
            return NextResponse.json({ success: true, message: 'No players to push.', pushedCount: 0 });
        }

        console.log(`Pushing ${unpushed.length} players to pool...`);

        const pushedIds: string[] = [];
        let successCount = 0;

        for (const player of unpushed) {
            try {
                // Split name
                const nameParts = player.name?.split(' ') || ['Unknown', 'Player'];
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ') || 'Player';

                // Check existing
                const { data: existingPlayer } = await supabaseAdmin
                    .from('players')
                    .select('id')
                    .eq('first_name', firstName)
                    .eq('last_name', lastName)
                    .maybeSingle();

                let finalPhoto = player.photo || player.photo_url || '';
                if (finalPhoto.includes('drive.google.com')) {
                    const fileIdMatch = finalPhoto.match(/[-\w]{25,}/);
                    if (fileIdMatch) finalPhoto = `https://lh3.googleusercontent.com/d/${fileIdMatch[0]}`;
                }

                const playerData = {
                    first_name: firstName,
                    last_name: lastName,
                    cricket_skill: player.role || 'All-rounder',
                    role: player.role || 'All-rounder',
                    category: player.slot || player.occupation || 'Unassigned',
                    batting_style: 'Right Handed', // Default to sensible value, was incorrectly using age
                    base_price: player.base_price || 100,
                    photo_url: finalPhoto,
                    was_present_kc3: player.city || player.was_present_kc3 || 'No'
                };

                if (existingPlayer) {
                    await supabaseAdmin.from('players').update(playerData).eq('id', existingPlayer.id);
                } else {
                    await supabaseAdmin.from('players').insert([{ ...playerData, auction_status: 'pending' }]);
                }

                pushedIds.push(player.id);
                successCount++;
            } catch (pErr) {
                console.error(`Failed to push player ${player.name}:`, pErr);
            }
        }

        // Update is_pushed status in registrations
        if (pushedIds.length > 0) {
            await supabaseAdmin
                .from('registrations')
                .update({ is_pushed: true })
                .in('id', pushedIds);
        }

        return NextResponse.json({
            success: true,
            message: `Successfully pushed ${successCount} players to the pool!`,
            pushedCount: successCount
        });

    } catch (err: any) {
        console.error('Bulk Push Fatal Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
