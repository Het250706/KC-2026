import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
        }

        console.log(`API attempting login for: ${email}`);

        // Sign in using the admin client (service role)
        // This might bypass "Email logins are disabled" for the client-side API
        const { data, error } = await supabaseAdmin.auth.signInWithPassword({
            email: email.trim(),
            password,
        });

        if (error) {
            console.error('Admin Auth Login Error:', error.message);
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        return NextResponse.json({
            success: true,
            session: data.session,
            user: data.user
        });
    } catch (err: any) {
        console.error('Login API Error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
