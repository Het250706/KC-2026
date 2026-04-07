import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const { email, password, team_name, owner_name } = await request.json();

        // 1. Create User in Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { team_name, owner_name, role: 'team' }
        });

        if (authError) throw authError;

        // 2. Create entry in Teams table
        const { error: teamError } = await supabaseAdmin.from('teams').insert({
            id: authData.user.id,
            name: team_name,
            owner_name: owner_name,
            total_budget: 5000,
            remaining_budget: 5000
        });

        if (teamError) throw teamError;

        return NextResponse.json({ success: true, userId: authData.user.id });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
