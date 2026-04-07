import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function POST() {
    try {
        console.log('--- RESETTING ALL TEAM PURSES ---');

        // 1. Get all teams to find their total_budget
        const { data: teams, error: teamsError } = await supabaseAdmin
            .from('teams')
            .select('id, name, total_budget');
        
        if (teamsError) throw teamsError;

        // 2. Reset each team's remaining_budget
        const results = [];
        for (const team of teams) {
            const { error: updateError } = await supabaseAdmin
                .from('teams')
                .update({ remaining_budget: team.total_budget })
                .eq('id', team.id);
            
            if (updateError) {
                console.error(`Failed to reset purse for ${team.name}:`, updateError);
                results.push({ team: team.name, success: false });
            } else {
                results.push({ team: team.name, success: true });
            }
        }

        console.log('--- ALL PURSES RESET COMPLETED ---');
        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error('Reset Purses Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
