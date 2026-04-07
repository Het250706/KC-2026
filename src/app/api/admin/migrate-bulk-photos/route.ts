
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { migrateDriveImageToSupabase } from '@/lib/drive-to-supabase';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // 1. Fetch all players
        const { data: players, error: fetchError } = await supabaseAdmin
            .from('players')
            .select('id, first_name, last_name, photo_url');

        if (fetchError) throw fetchError;

        if (!players || players.length === 0) {
            return NextResponse.json({ success: true, message: 'No players found to migrate.' });
        }

        console.log(`Starting bulk migration for ${players.length} players...`);

        const results = [];
        let migratedCount = 0;
        let skippedCount = 0;

        for (const player of players) {
            const currentUrl = player.photo_url || '';
            
            // Skip if already migrated to Supabase or empty
            if (!currentUrl || currentUrl.includes('.supabase.co')) {
                skippedCount++;
                continue;
            }

            // Only migrate Google links
            if (currentUrl.includes('google')) {
                // User requested format: player-id.jpg
                const filename = `${player.id}.jpg`;
                const newUrl = await migrateDriveImageToSupabase(currentUrl, filename);

                if (newUrl && newUrl !== currentUrl) {
                    // Update database
                    const { error: updateError } = await supabaseAdmin
                        .from('players')
                        .update({ photo_url: newUrl })
                        .eq('id', player.id);

                    if (updateError) {
                        console.error(`Failed to update DB for player ${player.id}:`, updateError);
                        results.push({ id: player.id, status: 'error', message: updateError.message });
                    } else {
                        migratedCount++;
                        results.push({ id: player.id, status: 'migrated', url: newUrl });
                    }
                } else {
                    results.push({ id: player.id, status: 'failed', message: 'Migration utility returned original URL' });
                }
            } else {
                skippedCount++;
            }
        }

        return NextResponse.json({
            success: true,
            migrated: migratedCount,
            skipped: skippedCount,
            results
        });

    } catch (error: any) {
        console.error('Bulk Migration Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
