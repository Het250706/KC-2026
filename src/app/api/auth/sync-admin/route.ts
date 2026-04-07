import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

const ALLOWED_ADMINS = [
    'admin@keshav.com',
    'het@keshav.com'
];

export async function POST(req: Request) {
    try {
        const { password } = await req.json();

        // Verification check to prevent unauthorized sync
        // Using the requested password itself as the verification for simplicity
        if (password !== 'bapspetladyuva') {
            return NextResponse.json({ error: 'Incorrect verification password' }, { status: 401 });
        }

        console.log('Starting Admin Account Sync...');
        const results = [];

        for (const email of ALLOWED_ADMINS) {
            console.log(`Processing admin: ${email}`);

            // 1. Try to create user
            const { data, error } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { role: 'ADMIN' }
            });

            if (error) {
                if (error.message.toLowerCase().includes('already registered') || error.status === 422) {
                    console.log(`User ${email} exists, updating password...`);

                    // 2. If exists, find ID and update password
                    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
                    const existingUser = usersData?.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

                    if (existingUser) {
                        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
                            password,
                            email_confirm: true,
                            user_metadata: { role: 'ADMIN' }
                        });

                        if (updateError) {
                            results.push({ email, status: 'error', message: updateError.message });
                            continue;
                        }

                        // 3. Ensure role in user_roles table
                        await supabaseAdmin.from('user_roles').upsert({
                            user_id: existingUser.id,
                            role: 'admin'
                        }, { onConflict: 'user_id' });

                        results.push({ email, status: 'updated' });
                    }
                } else {
                    results.push({ email, status: 'error', message: error.message });
                }
            } else if (data.user) {
                // 3. For new user, insert role
                await supabaseAdmin.from('user_roles').insert({
                    user_id: data.user.id,
                    role: 'admin'
                });
                results.push({ email, status: 'created' });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${results.length} admin accounts.`,
            details: results
        });

    } catch (err: any) {
        console.error('Sync Admin API Error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
