import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    console.log('--- SYNC PLAYERS CALLED ---');
    try {
        const sheetId = process.env.GOOGLE_SHEET_ID || '1ZHD222skktQspk97xv-s5T2uUa09t7SOIGmxtaICUHA';
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;

        const response = await fetch(url, { cache: 'no-store' });
        const text = await response.text();
        
        const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
        if (!match) return NextResponse.json({ error: 'Invalid response format' }, { status: 500 });

        const jsonStr = match[1];
        const data = JSON.parse(jsonStr);
        const rows = data.table.rows;

        if (!rows || rows.length === 0) return NextResponse.json({ message: 'No rows found', count: 0 });

        let syncedCount = 0;
        let updatedCount = 0;

        for (const row of rows) {
            const c = row.c;
            if (!c || c.length < 5) continue;

            const getValue = (i: number) => {
                if (!c[i]) return '';
                return c[i].f || c[i].v || '';
            };

            // MAPPING (Based on user request)
            // 2: Full Name, 3: Mobile (Unique Key), 6: Photo, 7: Participation, 8: Skill, 9: Birth Date
            const fullName = String(getValue(2)).trim();
            const mobile = String(getValue(3)).trim();
            const photoUrl = String(getValue(6));
            const participation = String(getValue(7));
            const skill = String(getValue(8));
            const birthStr = String(getValue(9));

            if (!fullName || fullName === 'Full Name:' || !mobile) continue;

            // 1. Convert Google Drive photo link using Regex
            let finalPhoto = photoUrl;
            if (photoUrl.includes('drive.google.com') || photoUrl.includes('googleusercontent.com')) {
                const fileIdMatch = photoUrl.match(/[-\w]{25,}/);
                if (fileIdMatch) {
                    finalPhoto = `https://lh3.googleusercontent.com/d/${fileIdMatch[0]}`;
                }
            }

            // 2. CHECK & SYNC - DUAL TABLE UPSERT (REGISTRATIONS + PLAYERS)
            
            // --- REGISTRATIONS TABLE (FOR CONTROL VIEW) ---
            const { data: existingReg } = await supabaseAdmin
                .from('registrations')
                .select('id, is_pushed')
                .or(`mobile.eq."${mobile}",name.eq."${fullName}"`)
                .maybeSingle();

            // Check if player already exists in the POOL (players table)
            const firstName = fullName.split(' ')[0] || '';
            const lastName = fullName.split(' ').slice(1).join(' ') || '';
            const { data: inPool } = await supabaseAdmin
                .from('players')
                .select('id')
                .or(`category.eq."${mobile}",and(first_name.eq."${firstName}",last_name.eq."${lastName}")`)
                .maybeSingle();

            const regData = {
                name: fullName,
                mobile: mobile,
                age: 20,
                role: skill || 'All-rounder',
                city: participation || 'No',
                photo: finalPhoto,
                base_price: 20000000,
                is_pushed: !!inPool // If they are in the pool table, mark them as pushed in registrations
            };

            if (existingReg) {
                await supabaseAdmin.from('registrations').update(regData).eq('id', existingReg.id);
                updatedCount++;
            } else {
                await supabaseAdmin.from('registrations').insert([regData]);
                syncedCount++;
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Sync complete. New: ${syncedCount}, Updated: ${updatedCount}`,
            synced: syncedCount,
            updated: updatedCount
        });

    } catch (err: any) {
        console.error('Sync error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
