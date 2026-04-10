import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    console.log('--- [PUSH-PLAYER] API CALLED ---');
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('--- [PUSH-PLAYER] ERROR: Missing Supabase environment variables');
            return NextResponse.json({ success: false, error: 'Server configuration error: Missing Supabase keys' }, { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        let body;
        try {
            body = await req.json();
        } catch (e) {
            console.error('--- [PUSH-PLAYER] ERROR: Invalid JSON body');
            return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
        }

        const { player } = body;

        if (!player || !player.id) {
            console.error('--- [PUSH-PLAYER] ERROR: No player ID provided');
            return NextResponse.json({ success: false, error: 'No player data provided' }, { status: 400 });
        }

        console.log(`--- [PUSH-PLAYER] Processing: ${player.name || 'Unknown'} (${player.id})`);

        // Split name into first and last name
        const nameParts = (player.name || 'Unknown Player').trim().split(/\s+/);
        const firstName = nameParts[0] || 'Unknown';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Player';

        // Check if player already exists in the "players" table by name
        const { data: existingPlayer, error: fetchError } = await supabaseAdmin
            .from('players')
            .select('id')
            .eq('first_name', firstName)
            .eq('last_name', lastName)
            .maybeSingle();

        if (fetchError) {
            console.error('--- [PUSH-PLAYER] DB Check Error:', fetchError);
            return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
        }

        // Fix photo URL if it's a Google Drive link
        let finalPhoto = player.photo || player.photo_url || '';
        if (finalPhoto && finalPhoto.includes('drive.google.com')) {
            const fileIdMatch = finalPhoto.match(/[-\w]{25,}/);
            if (fileIdMatch) {
                finalPhoto = `https://lh3.googleusercontent.com/d/${fileIdMatch[0]}`;
            }
        }

        const playerData = {
            first_name: firstName,
            last_name: lastName,
            cricket_skill: player.role || 'All-rounder',
            role: player.role || 'All-rounder',
            category: player.slot || player.occupation || 'Unassigned',
            base_price: player.base_price || 100,
            photo_url: finalPhoto,
            was_present_kc3: player.city || player.was_present_kc3 || 'No'
        };

        let result;

        if (existingPlayer) {
            console.log(`--- [PUSH-PLAYER] Updating existing player: ${firstName} ${lastName}`);
            result = await supabaseAdmin
                .from('players')
                .update(playerData)
                .eq('id', existingPlayer.id)
                .select();
        } else {
            console.log(`--- [PUSH-PLAYER] Inserting new player: ${firstName} ${lastName}`);
            result = await supabaseAdmin
                .from('players')
                .insert([{
                    ...playerData,
                    auction_status: 'pending'
                }])
                .select();
        }

        if (result.error) {
            console.error('--- [PUSH-PLAYER] DB Sync Error:', result.error);
            return NextResponse.json({ success: false, error: result.error.message }, { status: 500 });
        }

        // Mark as pushed in "registrations" table
        const { error: updateError } = await supabaseAdmin
            .from('registrations')
            .update({ is_pushed: true })
            .eq('id', player.id);

        if (updateError) {
            console.warn('--- [PUSH-PLAYER] WARNING: Player pushed but failed to update status in registrations:', updateError);
        }

        console.log('--- [PUSH-PLAYER] Success');
        return NextResponse.json({
            success: true,
            message: 'Player moved to pool successfully',
            data: result.data?.[0] || null
        });

    } catch (err: any) {
        console.error('--- [PUSH-PLAYER] FATAL ERROR:', err);
        return NextResponse.json({ 
            success: false,
            error: err.message || 'Internal Server Error'
        }, { status: 500 });
    }
}
