
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Migrates a Google Drive image to Supabase Storage
 * @param url The Google Drive URL
 * @param playerName For generating a filename
 * @returns The Supabase Storage public URL or the original URL if migration fails
 */
export async function migrateDriveImageToSupabase(url: string, playerName: string): Promise<string> {
    if (!url || !url.includes('google')) {
        return url;
    }

    try {
        let driveId = '';

        // 1. Extract Drive ID
        if (url.includes('id=')) {
            driveId = url.split('id=')[1].split('&')[0];
        } else if (url.includes('/d/')) {
            const parts = url.split('/d/');
            if (parts.length > 1) {
                driveId = parts[1].split('/')[0].split('?')[0].split('=')[0];
            }
        } else if (url.includes('open?id=')) {
            driveId = url.split('open?id=')[1].split('&')[0];
        }

        if (!driveId) return url;

        // 2. Download from Google Drive with robustness for virus scan warning
        const downloadUrl = `https://docs.google.com/uc?export=download&id=${driveId}`;
        let response = await fetch(downloadUrl);
        
        // If Google Drive returns an "Are you sure?" virus scan page (HTML)
        // we need to extract the confirmation token and try again
        let content = await response.text();
        if (content.includes('confirm=') || (response.headers.get('content-type') || '').includes('text/html')) {
            const match = content.match(/confirm=([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
                const confirmedUrl = `${downloadUrl}&confirm=${match[1]}`;
                response = await fetch(confirmedUrl);
            } else if (content.includes('<!DOCTYPE html') || content.includes('<html')) {
                console.error(`Failed to download ${playerName}: Google Drive returned a permission or warning page.`);
                return url;
            }
        } else {
            // Re-fetch as array buffer since we already consumed the text
            response = await fetch(downloadUrl);
        }

        if (!response.ok) {
            console.error('Failed to download from Drive:', response.statusText);
            return url;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        
        // Final filename should be player-id.jpg
        const finalFileName = playerName.toLowerCase().endsWith('.jpg') || playerName.toLowerCase().endsWith('.png') 
            ? playerName 
            : `${playerName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.jpg`;
        
        const filePath = finalFileName;

        // 4. Upload to Supabase Storage
        const { error: uploadError } = await supabaseAdmin.storage
            .from('player-photos')
            .upload(filePath, buffer, {
                contentType: contentType,
                upsert: true
            });

        if (uploadError) {
            console.error('Supabase upload error:', uploadError);
            return url;
        }

        // 5. Get Public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('player-photos')
            .getPublicUrl(filePath);

        console.log(`Successfully migrated ${playerName}'s photo to Supabase: ${publicUrl}`);
        return publicUrl;

    } catch (err) {
        console.error('Migration error:', err);
        return url;
    }
}
