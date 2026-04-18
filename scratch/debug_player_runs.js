const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkPlayerStats() {
    // 1. Find player
    const { data: players, error: pErr } = await supabase.from('players')
        .select('id, first_name, last_name')
        .ilike('first_name', '%Het%');
    
    if (pErr) {
        console.error('Error finding player:', pErr);
        return;
    }

    const player = players.find(p => p.first_name.includes('Het') && p.last_name.includes('Patel'));
    if (!player) {
        console.log('Player not found in:', players);
        return;
    }

    console.log(`Checking stats for: ${player.first_name} ${player.last_name} (ID: ${player.id})`);

    // 2. Check Match Stats
    const { data: stats, error: sErr } = await supabase.from('player_match_stats')
        .select('*, matches(match_name, status)')
        .eq('player_id', player.id);
    
    if (sErr) {
        console.error('Error finding stats:', sErr);
        return;
    }

    console.log('Match-by-match stats:');
    stats.forEach(s => {
        console.log(`- Match: ${s.matches?.match_name} (${s.matches?.status}) | Runs: ${s.runs} | Wickets: ${s.wickets}`);
    });

    const totalRuns = stats.reduce((sum, s) => sum + (s.runs || 0), 0);
    console.log(`Total Calculated Runs: ${totalRuns}`);

    // 3. Check official view
    const { data: viewData, error: vErr } = await supabase.from('tournament_player_stats')
        .select('*')
        .eq('player_id', player.id)
        .maybeSingle();
    
    if (vErr) {
        console.error('Error finding view stats:', vErr);
    } else {
        console.log('Tournament View Data:', viewData);
    }
}

checkPlayerStats();
