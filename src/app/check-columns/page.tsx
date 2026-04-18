'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function SQLGenerator() {
    const [sql, setSql] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const generateSQL = async () => {
        setLoading(true);
        // 1. Find Match 6
        const { data: matches } = await supabase.from('matches').select('id, match_name').ilike('match_name', '%6%');
        const match6Id = matches?.[0]?.id;

        // 2. Find Het
        const { data: players } = await supabase.from('players').select('id, first_name').ilike('first_name', '%Het%');
        const hetId = players?.[0]?.id;

        if (match6Id && hetId) {
            const query = `
-- FIX HET SHITALBHAI PATEL RUNS FOR MATCH 6
INSERT INTO player_match_stats (match_id, player_id, runs, runs_scored, balls, balls_faced, fours, sixes)
VALUES ('${match6Id}', '${hetId}', 20, 20, 6, 6, 2, 2)
ON CONFLICT (match_id, player_id) 
DO UPDATE SET 
    runs = 20, 
    runs_scored = 20, 
    balls = 6, 
    balls_faced = 6, 
    fours = 2, 
    sixes = 2;

-- VERIFY UPDATE
SELECT * FROM player_match_stats WHERE match_id = '${match6Id}' AND player_id = '${hetId}';
            `;
            setSql(query);
        } else {
            setSql('Error: Match 6 or Het not found. Check names in DB.');
        }
        setLoading(false);
    };

    return (
        <div style={{ padding: '40px', background: '#000', color: '#fff', minHeight: '100vh', fontFamily: 'monospace' }}>
            <h1 style={{ color: 'gold' }}>SQL QUERY GENERATOR</h1>
            <button onClick={generateSQL} style={{ padding: '20px', background: 'gold', border: 'none', fontWeight: 900, cursor: 'pointer' }}>GENERATE SQL FOR SUPABASE</button>
            <div style={{ marginTop: '20px' }}>
                <h3>Copy this code into Supabase SQL Editor:</h3>
                <textarea 
                    value={sql} 
                    readOnly 
                    style={{ width: '100%', height: '300px', background: '#111', color: '#00ff80', padding: '20px', border: '2px solid #333', fontSize: '1rem' }}
                />
            </div>
        </div>
    );
}
