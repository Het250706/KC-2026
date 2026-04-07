import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        // The body will contain the formData + the final photo URL
        const { 
            yuva_sabha, 
            name, 
            mobile, 
            address, 
            area_contact, 
            birth_date, 
            occupation, 
            occupation_other,
            photo, 
            prev_participation, 
            skill,
            tshirt_size,
            tshirt_number
        } = body;

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '1pfeRG8b7dbrt3cuVErSRpnwrmwMOH8AgsQla_NPTs_E';
        const range = 'Sheet1!A:M';

        // 1. Simple empty check - if range A1 is null or empty
        const checkRows = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Sheet1!A1:A1',
        });

        if (!checkRows.data.values || checkRows.data.values.length === 0) {
            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: 'Sheet1!A1',
                valueInputOption: 'RAW',
                requestBody: {
                    values: [[
                        'Timestamp', 'યુવક સભા', 'Full Name', 'Mobile', 
                        'Address', 'કાર્યકર', 'Birth Date', 'Occupation', 
                        'Photo URL', 'કેશવ કપ', 'Cricket Skill', 'T-Shirt Size', 'T-Shirt Number'
                    ]],
                },
            });
        }

        // 2. Prepare row values
        const finalOccupation = occupation === 'Other:' ? occupation_other : occupation;
        
        const row = [
            new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            yuva_sabha,
            name,
            "'" + mobile, // Ensure mobile stays as string in sheet
            address,
            area_contact,
            birth_date,
            finalOccupation,
            photo,
            prev_participation,
            skill,
            tshirt_size,
            tshirt_number
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            requestBody: {
                values: [row],
            },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Google Sheets Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
