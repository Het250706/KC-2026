import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const adminEmails = ['admin@keshav.com', 'het@keshav.com'];
    const newPassword = 'petladkeshavcup';
    const results: any[] = [];

    try {
        // 1. Fetch all users
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError) throw listError;

        for (const email of adminEmails) {
            const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
            
            if (user) {
                // 2. Update existing user password
                const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
                    password: newPassword
                });
                
                // 3. Ensure they have the admin role in user_roles table
                const { error: roleError } = await supabaseAdmin
                    .from('user_roles')
                    .upsert({ 
                        user_id: user.id, 
                        role: 'admin' 
                    }, { onConflict: 'user_id' });

                results.push({ 
                    email, 
                    status: 'Updated', 
                    passwordReset: !updateError, 
                    roleAssigned: !roleError,
                    details: updateError?.message || roleError?.message || 'Success'
                });
            } else {
                // 4. Create user if not exists
                const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                    email,
                    password: newPassword,
                    email_confirm: true
                });

                if (newUser?.user) {
                    await supabaseAdmin
                        .from('user_roles')
                        .upsert({ 
                            user_id: newUser.user.id, 
                            role: 'admin' 
                        }, { onConflict: 'user_id' });
                }

                results.push({ 
                    email, 
                    status: 'Created New', 
                    success: !createError, 
                    details: createError?.message || 'Success'
                });
            }
        }

        return NextResponse.json({ 
            message: "Admin Access Synchronized", 
            results,
            instruction: "You can now login with the new password. Please DELETE this API file after use for security." 
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
