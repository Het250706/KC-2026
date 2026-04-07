import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/admin';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
    console.log('--- ADD PLAYER API CALLED ---');
    try {
        const formData = await request.formData();

        const firstName = formData.get('first_name') as string;
        const lastName = formData.get('last_name') as string;
        const role = formData.get('role') as string;
        const category = formData.get('category') as string || 'Silver';
        const battingStyle = formData.get('batting_style') as string;
        const bowlingStyle = formData.get('bowling_style') as string;
        const basePrice = parseInt(formData.get('base_price') as string);
        const imageFile = formData.get('image') as File;

        if (!firstName || !lastName || !imageFile) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Ensure Storage Bucket exists
        try {
            const { data: buckets } = await supabaseAdmin.storage.listBuckets();
            if (!buckets?.some((b: any) => b.name === 'players')) {
                await supabaseAdmin.storage.createBucket('players', { public: true });
            }
        } catch (e: any) { console.error('Bucket check failed', e); }

        // 2. Upload Image
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabaseAdmin.storage
            .from('players')
            .upload(fileName, imageFile, { contentType: imageFile.type });

        if (uploadError) throw new Error('Image upload failed: ' + uploadError.message);

        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('players')
            .getPublicUrl(fileName);

        // 3. Insert into Database - STRICTLY following requested schema
        const { data: playerData, error: dbError } = await supabaseAdmin
            .from('players')
            .insert([{
                first_name: firstName,
                last_name: lastName,
                role: role,
                category: category,
                batting_style: battingStyle,
                bowling_style: bowlingStyle,
                base_price: basePrice,
                photo_url: publicUrl,
                auction_status: 'pending' // This is the column that was missing
            }])
            .select()
            .single();

        if (dbError) {
            console.error('Database Insert Error:', dbError);
            return NextResponse.json({
                success: false,
                error: `Database error: ${dbError.message}. Make sure you have run the final_schema.sql in Supabase SQL Editor.`
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, player: playerData });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
