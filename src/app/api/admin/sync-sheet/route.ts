import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    console.log('--- SYNC SHEET CALLED ---');
    try {
        const sheetId = process.env.GOOGLE_SHEET_ID || '1pfeRG8b7dbrt3cuVErSRpnwrmwMOH8AgsQla_NPTs_E';
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;

        console.log('Fetching from URL:', url);
        const response = await fetch(url, { cache: 'no-store' });
        const text = await response.text();
        
        const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
        if (!match) return NextResponse.json({ error: 'Invalid response format' }, { status: 500 });

        const jsonStr = match[1];
        const data = JSON.parse(jsonStr);
        const rows = data.table.rows;

        if (!rows || rows.length === 0) return NextResponse.json({ message: 'No rows found', count: 0 });

        let totalRows = rows.length;
        let syncedCount = 0;
        let updatedCount = 0;
        let poolExistsCount = 0;
        let invalidDataCount = 0;
        let skippedDetails: any[] = [];

        let index = -1;
        for (const row of rows) {
            index++;
            const c = row.c;
            if (!c || c.length < 5) {
                invalidDataCount++;
                skippedDetails.push({ row: index + 1, reason: 'Invalid or empty row' });
                continue;
            }

            const getValue = (i: number) => {
                if (!c[i]) return '';
                return c[i].f || c[i].v || '';
            };

            // NEW USER MAPPING FROM GOOGLE SHEET:
            // 1: યુવક સભા, 2: Full Name, 3: Mobile, 4: Address, 5: કાર્યકર, 
            // 6: Birth Date, 7: Occupation, 8: Photo URL, 9: કેશવ કપ, 10: Cricket Skill,
            // 11: T-shirt Size, 12: T-shirt number
            
            const yuvaSabha = String(getValue(1)).trim();
            const fullName = String(getValue(2)).trim();
            const mobile = String(getValue(3)).trim();
            const address = String(getValue(4)).trim();
            const areaContact = String(getValue(5)).trim();
            const birthDate = String(getValue(6)).trim();
            const occupation = String(getValue(7)).trim();
            const photoUrl = String(getValue(8));
            const participation = String(getValue(9));
            const skill = String(getValue(10));
            const tshirtSize = String(getValue(11));
            const tshirtNumber = String(getValue(12));

            if (!fullName) {
                invalidDataCount++;
                skippedDetails.push({ row: index + 1, reason: 'Missing Full Name' });
                continue;
            }
            if (fullName === 'Full Name' || fullName === 'Name' || fullName === 'NAME') {
                invalidDataCount++;
                skippedDetails.push({ row: index + 1, reason: 'Header row detected' });
                continue;
            }

            // Age Calculation
            let age = 20;
            if (birthDate) {
                if (birthDate.startsWith('Date(')) {
                    const matchAge = birthDate.match(/Date\((\d+),/);
                    if (matchAge) age = 2026 - parseInt(matchAge[1]);
                } else {
                    // Try to parse YYYY-MM-DD
                    const yearMatch = birthDate.match(/^(\d{4})/);
                    if (yearMatch) age = 2026 - parseInt(yearMatch[1]);
                }
            }

            // NEW ROBUST GOOGLE DRIVE CONVERSION
            let finalPhoto = photoUrl;
            if (photoUrl.includes('drive.google.com') || photoUrl.includes('googleusercontent.com')) {
                const fileIdMatch = photoUrl.match(/[-\w]{25,}/);
                if (fileIdMatch) {
                    finalPhoto = `https://drive.google.com/uc?export=view&id=${fileIdMatch[0]}`;
                }
            }

            // Check if already in Player Pool (players table) - Match by Full Name
            const namePartsSync = fullName.split(' ');
            const fNameSync = namePartsSync[0];
            const lNameSync = namePartsSync.slice(1).join(' ') || 'Player';

            const { data: inPoolArr } = await supabaseAdmin
                .from('players')
                .select('id')
                .eq('first_name', fNameSync)
                .eq('last_name', lNameSync)
                .limit(1);

            if (inPoolArr && inPoolArr.length > 0) {
                // REPAIR LOGIC: Even if in pool, update their category/role to match current sheet
                const existingPoolPlayer = inPoolArr[0];
                await supabaseAdmin
                    .from('players')
                    .update({ 
                        category: occupation || 'Unassigned',
                        role: skill || 'All-rounder',
                        cricket_skill: skill || 'All-rounder'
                    })
                    .eq('id', existingPoolPlayer.id);

                poolExistsCount++;
                skippedDetails.push({ row: index + 1, name: fullName, reason: 'Already in Pool (Data Updated)' });
                continue;
            }

            // Check if already in Registration Control (registrations table) - Match by Full Name
            const { data: existingArr } = await supabaseAdmin
                .from('registrations')
                .select('id')
                .eq('name', fullName)
                .limit(1);

            const existingReg = (existingArr && existingArr.length > 0) ? existingArr[0] : null;

            // Calculate a sequential timestamp based on sheet order (starting from a fixed base)
            // This ensures we can sort by created_at in the UI to match the sheet order
            const baseDate = new Date('2026-01-01T00:00:00Z');
            baseDate.setSeconds(baseDate.getSeconds() + index);
            const sheetSequenceDate = baseDate.toISOString();

            const regData = {
                name: fullName,
                mobile: mobile,
                age: age,
                role: skill || 'All-rounder',
                city: participation || 'No', // Following existing convention for participation
                photo: finalPhoto,
                base_price: 20000000, // Default 0.20 Cr
                yuva_sabha: yuvaSabha,
                address: address,
                area_contact: areaContact,
                birth_date: (birthDate && birthDate.trim() !== '') ? birthDate : null,
                occupation: occupation,
                slot: occupation, // Added slot to ensure category is preserved
                tshirt_size: tshirtSize,
                tshirt_number: tshirtNumber,
                created_at: sheetSequenceDate // OVERWRITE timestamp to preserve sheet order
            };

            if (existingReg) {
                // Update Existing
                const { error: updateError } = await supabaseAdmin
                    .from('registrations')
                    .update(regData)
                    .eq('id', existingReg.id);
                
                if (!updateError) {
                    updatedCount++;
                } else {
                    console.error(`Update error for ${fullName}:`, updateError);
                }
            } else {
                // Insert New
                const { error: insertError } = await supabaseAdmin
                    .from('registrations')
                    .insert([regData]);
                
                if (!insertError) {
                    syncedCount++;
                } else {
                    console.error(`Insert error for ${fullName}:`, insertError);
                    skippedDetails.push({ row: index + 1, name: fullName, reason: 'DB Insert Error: ' + insertError.message });
                }
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Sync complete. New: ${syncedCount}, Updated: ${updatedCount}, Already in Pool: ${poolExistsCount}, Total Rows: ${totalRows}, Invalid/Skipped: ${invalidDataCount}`,
            synced: syncedCount,
            updated: updatedCount,
            inPool: poolExistsCount,
            totalRows,
            invalid: invalidDataCount,
            skippedDetails
        });

    } catch (err: any) {
        console.error('Sync error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
