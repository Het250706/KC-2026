import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function POST() {
    try {
        console.log('--- BUDGET AUDIT INITIATED ---');

        // 1. Get all teams
        const { data: teams, error: teamsError } = await supabaseAdmin
            .from('teams')
            .select('id, name, total_budget');
        
        if (teamsError) throw teamsError;

        // 2. Get all sold players
        const { data: soldPlayers, error: playersError } = await supabaseAdmin
            .from('players')
            .select('team_id, sold_price')
            .eq('auction_status', 'sold');
        
        if (playersError) throw playersError;

        // 3. Re-calculate budget for each team
        const results = [];
        for (const team of teams) {
            const teamSpent = soldPlayers
                .filter((p: any) => p.team_id === team.id)
                .reduce((sum: number, p: any) => sum + (Number(p.sold_price) || 0), 0);
            
            const expectedRemaining = (Number(team.total_budget) || 0) - teamSpent;
            
            // Update team remaining_budget
            const { error: updateError } = await supabaseAdmin
                .from('teams')
                .update({ remaining_budget: expectedRemaining })
                .eq('id', team.id);
            
            if (updateError) {
                console.error(`Failed to update budget for ${team.name}:`, updateError);
                results.push({ team: team.name, success: false });
            } else {
                results.push({ team: team.name, success: true, spent: teamSpent, remaining: expectedRemaining });
            }
        }

        console.log('--- BUDGET AUDIT COMPLETED ---');
        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error('Audit Budgets Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
