import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const playerId = searchParams.get('id');

        if (!playerId) {
            return NextResponse.json({ success: false, error: 'Player ID is required' }, { status: 400 });
        }

        // 1. Handle relations: Clear from auction_state if active
        await supabaseAdmin
            .from('auction_state')
            .update({ current_player_id: null, status: 'idle' })
            .eq('current_player_id', playerId);

        // 2. Delete related bids
        await supabaseAdmin
            .from('bids')
            .delete()
            .eq('player_id', playerId);

        // 3. Delete from slot_players (CardFlip System)
        await supabaseAdmin
            .from('slot_players')
            .delete()
            .eq('player_id', playerId);
        
        // 4. Clear references in match_events (if any, although cascading might handle some)
        await supabaseAdmin
            .from('match_events')
            .update({ striker_id: null })
            .eq('striker_id', playerId);
        
        await supabaseAdmin
            .from('match_events')
            .update({ bowler_id: null })
            .eq('bowler_id', playerId);
        
        await supabaseAdmin
            .from('match_events')
            .update({ non_striker_id: null })
            .eq('non_striker_id', playerId);
        
        await supabaseAdmin
            .from('match_events')
            .update({ dismissed_player_id: null })
            .eq('dismissed_player_id', playerId);

        // 3. Get player info for return-trip and budget refund
        const { data: player } = await supabaseAdmin
            .from('players')
            .select('*')
            .eq('id', playerId)
            .single();

        if (player) {
                // Fix photo URL for return trip
                let restorePhoto = player.photo_url || '';
                if (restorePhoto.includes('drive.google.com')) {
                    const fileIdMatch = restorePhoto.match(/[-\w]{25,}/);
                    if (fileIdMatch) {
                        restorePhoto = `https://drive.google.com/uc?export=view&id=${fileIdMatch[0]}`;
                    }
                }

                // Restore to registrations table: Update status if exists, otherwise Insert
                const mobile = player.category || '';
                const { data: existingReg } = await supabaseAdmin
                    .from('registrations')
                    .select('id')
                    .eq('mobile', mobile)
                    .maybeSingle();

                let restoreError;
                if (existingReg) {
                    const { error } = await supabaseAdmin
                        .from('registrations')
                        .update({ is_pushed: false })
                        .eq('id', existingReg.id);
                    restoreError = error;
                } else {
                    const { error } = await supabaseAdmin
                        .from('registrations')
                        .insert([{
                            name: `${player.first_name} ${player.last_name}`,
                            role: player.role || 'All-rounder',
                            base_price: player.base_price,
                            mobile: mobile,
                            age: Number(player.batting_style) || 20,
                            city: player.was_present_kc3 || 'No',
                            photo: restorePhoto,
                            is_pushed: false
                        }]);
                    restoreError = error;
                }
            
            if (restoreError) {
                console.error('Failed to restore/update registration:', restoreError);
            } else {
                console.log(`Successfully restored ${player.first_name} to registrations`);
            }
        }

        // 4. Refund budget if sold
        if (player && player.auction_status === 'sold' && player.team_id && player.sold_price) {
            const { data: team } = await supabaseAdmin
                .from('teams')
                .select('remaining_budget')
                .eq('id', player.team_id)
                .single();
            
            if (team) {
                const currentRemaining = Number(team.remaining_budget) || 0;
                const soldPrice = Number(player.sold_price) || 0;
                
                await supabaseAdmin
                    .from('teams')
                    .update({ remaining_budget: currentRemaining + soldPrice })
                    .eq('id', player.team_id);
                
                console.log(`Refunded ${soldPrice} to team ${player.team_id}`);
            }
        }

        // 5. Delete from database
        const { error: dbError } = await supabaseAdmin
            .from('players')
            .delete()
            .eq('id', playerId);

        if (dbError) throw dbError;

        // 6. Optional: Delete photo from storage if it exists
        if (player?.photo_url) {
            try {
                const fileName = player.photo_url.split('/').pop();
                if (fileName) {
                    await supabaseAdmin.storage
                        .from('players')
                        .remove([fileName]);
                }
            } catch (storageErr) {
                console.error('Failed to delete player photo:', storageErr);
            }
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Delete Player Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
