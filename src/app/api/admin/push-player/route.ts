import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    console.log('--- PUSH PLAYER API CALLED ---');
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('Missing Supabase environment variables');
            return NextResponse.json({ error: 'Server configuration error: Missing Supabase keys' }, { status: 500 });
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
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const { player } = body;

        if (!player || !player.id) {
            return NextResponse.json({ error: 'No player data provided' }, { status: 400 });
        }

        console.log(`Processing push for player: ${player.name} (${player.id})`);

        // Split name into first and last name
        const nameParts = player.name?.split(' ') || ['Unknown', 'Player'];
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || 'Player';

        // Check if player already exists in the "players" table by name
        const { data: existingPlayer, error: fetchError } = await supabaseAdmin
            .from('players')
            .select('id')
            .eq('first_name', firstName)
            .eq('last_name', lastName)
            .maybeSingle();

        if (fetchError) {
            console.error('Error checking existing player:', fetchError);
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        // Fix photo URL if it's a Google Drive link
        let finalPhoto = player.photo || player.photo_url || '';
        if (finalPhoto.includes('drive.google.com')) {
            const fileIdMatch = finalPhoto.match(/[-\w]{25,}/);
            if (fileIdMatch) {
                finalPhoto = `https://lh3.googleusercontent.com/d/${fileIdMatch[0]}`;
            }
        }

        let insertError;
        let insertedData;

        const playerData = {
            first_name: firstName,
            last_name: lastName,
            cricket_skill: player.role || 'All-rounder',
            role: player.role || 'All-rounder',
            category: player.slot || player.occupation || 'Unassigned',
            batting_style: player.age?.toString() || '20',
            base_price: 100,
            photo_url: finalPhoto,
            was_present_kc3: player.city || player.was_present_kc3 || 'No'
        };

        if (existingPlayer) {
            console.log(`Updating existing player record for ${firstName} ${lastName}`);
            const { data, error } = await supabaseAdmin
                .from('players')
                .update(playerData)
                .eq('id', existingPlayer.id)
                .select();
            
            insertError = error;
            insertedData = data;
        } else {
            console.log(`Inserting new player record for ${firstName} ${lastName}`);
            const { data, error } = await supabaseAdmin
                .from('players')
                .insert([{
                    ...playerData,
                    auction_status: 'pending'
                }])
                .select();
            
            insertError = error;
            insertedData = data;
        }

        if (insertError) {
            console.error('Push to Player Pool Error:', insertError);
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        // Mark as pushed in "registrations" table
        const { error: updateError } = await supabaseAdmin
            .from('registrations')
            .update({ is_pushed: true })
            .eq('id', player.id);

        if (updateError) {
            console.warn('Player pushed but failed to update status in registrations:', updateError);
        }

        console.log('Successfully pushed player to pool');
        return NextResponse.json({
            success: true,
            message: 'Player moved to pool successfully',
            data: insertedData && insertedData.length > 0 ? insertedData[0] : null
        });

    } catch (err: any) {
        console.error('API Push Player Fatal Error:', err);
        return NextResponse.json({ 
            error: err.message || 'Internal Server Error',
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }, { status: 500 });
    }
}

