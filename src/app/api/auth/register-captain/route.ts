import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function POST(req: Request) {
    try {
        let { email, password, teamName } = await req.json();
        email = email?.trim();

        if (!email || !password || !teamName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
        }

        console.log(`Registering/Repairing captain: ${email} for team: ${teamName}`);

        // Create user with email_confirm: true using Admin client
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                role: 'CAPTAIN',
                team_name: teamName
            }
        });

        if (error) {
            const errorMsg = error.message.toLowerCase();
            console.log('Registration Error:', error.message, 'Status:', error.status);

            const isAlreadyRegistered =
                errorMsg.includes('already registered') ||
                errorMsg.includes('email already exists') ||
                error.status === 422 ||
                error.status === 400 && errorMsg.includes('user already registered');

            if (isAlreadyRegistered) {
                console.log(`User ${email} already registered. Attempting repair...`);

                // Fetch all users to find the ID
                const { data: userData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
                    page: 1,
                    perPage: 1000
                });

                if (listError) {
                    console.error('List users error:', listError);
                    throw listError;
                }

                const existingUser = userData?.users?.find((u: any) =>
                    u.email?.toLowerCase() === email.toLowerCase()
                );

                if (existingUser) {
                    console.log(`Found existing user ID: ${existingUser.id}. Updating password and metadata...`);
                    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
                        password: password,
                        email_confirm: true,
                        user_metadata: { role: 'CAPTAIN', team_name: teamName }
                    });

                    if (authUpdateError) {
                        console.error('Auth Update Error:', authUpdateError);
                        return NextResponse.json({ error: `Failed to update credentials: ${authUpdateError.message}` }, { status: 500 });
                    }

                    // Update user_roles table
                    const { error: dbError } = await supabaseAdmin
                        .from('user_roles')
                        .upsert({ user_id: existingUser.id, role: 'captain' }, { onConflict: 'user_id' });

                    if (dbError) {
                        console.error('Database Error (user_roles upsert):', dbError.message);
                        return NextResponse.json({ error: `Database role update failed: ${dbError.message}` }, { status: 500 });
                    }

                    console.log(`Successfully repaired user ${email} with role: captain`);
                    return NextResponse.json({
                        success: true,
                        message: 'User updated and role assigned',
                        role: 'captain'
                    });
                } else {
                    console.error(`User ${email} exists according to Auth, but not found in listUsers.`);
                    return NextResponse.json({ error: 'User exists but could not be located in the system for update' }, { status: 404 });
                }
            }
            return NextResponse.json({ error: error.message }, { status: error.status || 500 });
        }

        // For new user
        if (data.user) {
            const { error: dbError } = await supabaseAdmin
                .from('user_roles')
                .insert({ user_id: data.user.id, role: 'captain' });

            if (dbError) {
                console.error('Database Error (user_roles insert):', dbError.message);
                // Even if DB fails, the user was created in Auth
                return NextResponse.json({ error: `User created but role assignment failed: ${dbError.message}` }, { status: 500 });
            }
            console.log(`Successfully created new user ${email} with role: captain`);
        }

        return NextResponse.json({ success: true, user: data.user, role: 'captain' });
    } catch (err: any) {
        console.error('API INTERNAL ERROR:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
