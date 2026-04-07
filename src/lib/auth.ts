import { supabase } from './supabase';

export async function loginTeam(teamName: string, password: string) {
    // In demo mode, we verify the specific password requested
    if (password !== '987654321') {
        return { error: { message: 'Incorrect password for this team' } };
    }

    const email = `${teamName.toLowerCase().replace(/\s/g, '')}@auction.com`;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    return { data, error };
}

export async function signUpTeam(teamName: string, password: string, ownerName: string) {
    const email = `${teamName.toLowerCase().replace(/\s/g, '')}@auction.com`;

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                team_name: teamName,
                owner_name: ownerName,
                role: 'team'
            }
        }
    });

    if (!error && data.user) {
        // Create team profile
        await supabase.from('teams').insert({
            id: data.user.id,
            name: teamName,
            owner_name: ownerName,
            remaining_budget: 1000000000 // 100 Cr
        });
    }

    return { data, error };
}

export async function loginAdmin(email: string, password: string) {
    // Enforcement of requested admin password
    if (password !== 'baps@1234') {
        return { error: { message: 'Unauthorized. Incorrect admin password.' } };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    // Check if the user is in the 'admins' table
    if (data?.user) {
        const { data: admin } = await supabase
            .from('admins')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (!admin) {
            await supabase.auth.signOut();
            return { error: { message: 'Access Denied. You are not registered as an administrator.' } };
        }
    }

    return { data, error };
}
