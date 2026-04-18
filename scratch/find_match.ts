import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findMatch() {
    const { data: teams } = await supabase.from('teams').select('id, name');
    const aTeam = teams?.find(t => t.name.includes('ASTIKAYAM'));
    const dTeam = teams?.find(t => t.name.includes('DHAIYAM'));

    console.log('ASTIKAYAM ID:', aTeam?.id);
    console.log('DHAIYAM ID:', dTeam?.id);

    if (aTeam && dTeam) {
        const { data: matches } = await supabase.from('matches')
            .select('*')
            .or(`team1_id.eq.${aTeam.id},team2_id.eq.${aTeam.id}`)
            .order('created_at', { ascending: false });
        
        console.log('Matches:', JSON.stringify(matches, null, 2));

        if (matches && matches.length > 0) {
            const matchId = matches[0].id;
            const { data: innings } = await supabase.from('innings')
                .select('*')
                .eq('match_id', matchId);
            console.log('Innings:', JSON.stringify(innings, null, 2));
        }
    }
}

findMatch();
