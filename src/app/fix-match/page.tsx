'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function FailsafeFixPage() {
    const [status, setStatus] = useState<string>('Click button to analyze & fix...');
    const [debugInfo, setDebugInfo] = useState<any>(null);

    const runFix = async () => {
        try {
            setStatus('🚀 Analyzing Match 6 Data...');

            const { data: players } = await supabase.from('players').select('id, first_name, last_name, team_id');
            const het = players?.find(p => (p.first_name + ' ' + p.last_name).toLowerCase().includes('shital'));
            const sagar = players?.find(p => (p.first_name + ' ' + p.last_name).toLowerCase().includes('sagar'));

            const { data: matches } = await supabase.from('matches').select('*').ilike('match_name', '%6%');
            const match6 = matches?.find(m => m.match_name.includes('6'));
            if (!match6 || !het) throw new Error('Match or Player not found.');

            // Find correct team ID from Sagar (who is visible)
            const correctTeamId = sagar ? sagar.team_id : het.team_id;

            // 1. Check Schema
            const { data: firstStat } = await supabase.from('player_match_stats').select('*').limit(1);
            const keys = firstStat && firstStat.length > 0 ? Object.keys(firstStat[0]) : [];
            const wKey = keys.includes('wickets_taken') ? 'wickets_taken' : 'wickets';
            const rKey = keys.includes('runs_conceded') ? 'runs_conceded' : 'runs_given';
            const oKey = keys.includes('overs_bowled') ? 'overs_bowled' : 'overs';

            setStatus('Applying fix to database...');

            const updateData: any = {
                match_id: match6.id,
                player_id: het.id
            };
            updateData[wKey] = 5;
            updateData[rKey] = 15;
            updateData[oKey] = 2.0;

            // Delete any existing record to avoid conflict, then insert clean
            await supabase.from('player_match_stats').delete().eq('match_id', match6.id).eq('player_id', het.id);
            const { error: insError } = await supabase.from('player_match_stats').insert(updateData);
            
            if (insError) throw new Error(`Insert failed: ${insError.message}`);

            // Verification
            const { data: verify } = await supabase.from('player_match_stats').select('*').eq('match_id', match6.id).eq('player_id', het.id).single();

            setDebugInfo({
                message: 'FIX APPLIED SUCCESSFULLY',
                player_found: `${het.first_name} ${het.last_name}`,
                column_used: wKey,
                verified_record: verify,
                target_team_id: correctTeamId
            });

            setStatus('✅ DATA RECOVERED! Het Shitalbhai Patel now has 5 wickets. Check scoreboard.');
        } catch (err: any) {
            setStatus(`❌ ERROR: ${err.message}`);
            setDebugInfo({ error: err });
        }
    };

    return (
        <div style={{ padding: '40px', background: '#000', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
            <h1 style={{ color: 'gold' }}>Match 6 Failsafe Recovery</h1>
            <p style={{ background: '#222', padding: '20px', borderRadius: '10px', fontSize: '1.2rem' }}>{status}</p>
            <button onClick={runFix} style={{ background: 'gold', padding: '15px 30px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', border: 'none' }}>RUN FINAL RECOVERY</button>
            {debugInfo && <pre style={{ background: '#111', padding: '20px', marginTop: '20px', fontSize: '0.8rem', overflow: 'auto' }}>{JSON.stringify(debugInfo, null, 2)}</pre>}
        </div>
    );
}
