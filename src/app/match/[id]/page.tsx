'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Activity, Trophy, Swords, Target, ChevronLeft } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import MatchScorecard from '@/components/MatchScorecard';

export default function MatchDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [match, setMatch] = useState<any>(null);
    const [innings, setInnings] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'team1' | 'team2'>('team1');

    useEffect(() => {
        if (id) {
            fetchMatchData();

            const matchChannel = supabase.channel(`public_match_${id}`)
                .on('postgres_changes', { event: '*', table: 'match_events', schema: 'public', filter: `match_id=eq.${id}` }, async () => {
                    const { data: ev } = await supabase.from('match_events').select('*, striker:players!striker_id(*), bowler:players!bowler_id(*), dismissed:players!dismissed_player_id(*)').eq('match_id', id).order('created_at', { ascending: true });
                    if (ev) setEvents(ev);
                })
                .on('postgres_changes', { event: '*', table: 'innings', schema: 'public', filter: `match_id=eq.${id}` }, async () => {
                    const { data: inn } = await supabase.from('innings').select('*').eq('match_id', id).order('innings_number', { ascending: true });
                    if (inn) setInnings(inn);
                })
                .subscribe();

            return () => { supabase.removeChannel(matchChannel); };
        }
    }, [id]);

    const fetchMatchData = async () => {
        setLoading(true);
        const { data: m } = await supabase.from('matches').select('*, team1:teams!team1_id(*), team2:teams!team2_id(*)').eq('id', id).single();
        if (m) {
            setMatch(m);
        }
        setLoading(false);
    };

    if (loading) return (
        <main style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity className="rotate" size={40} color="var(--primary)" />
        </main>
    );

    if (!match) return (
        <main style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
            <div style={{ padding: '100px', textAlign: 'center' }}>
                <h1 style={{ fontWeight: 950 }}>MATCH NOT FOUND</h1>
                <button onClick={() => router.push('/live-score')} className="btn-secondary" style={{ marginTop: '20px' }}>BACK TO LIST</button>
            </div>
        </main>
    );

    return (
        <main style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
            <div className="container-responsive" style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
                
                {/* Header Actions */}
                <button 
                    onClick={() => router.back()} 
                    style={{ marginBottom: '30px', background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700 }}
                >
                    <ChevronLeft size={18} /> BACK
                </button>

                {/* Match Summary Header */}
                <div className="glass" style={{ padding: '40px', borderRadius: '35px', marginBottom: '30px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--primary)', fontWeight: 900, marginBottom: '10px', fontSize: '0.8rem', letterSpacing: '2px' }}>{match.match_name.toUpperCase()}</div>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', fontWeight: 950, marginBottom: '20px' }}>
                        {match.team1?.name} <span style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: '0 10px' }}>VS</span> {match.team2?.name}
                    </h1>
                    
                    {match.status === 'completed' && match.winner_team_id && (
                        <div style={{ padding: '15px 30px', background: 'rgba(0, 255, 128, 0.1)', border: '1px solid #00ff80', borderRadius: '50px', display: 'inline-flex', alignItems: 'center', gap: '15px' }}>
                            <Trophy size={20} color="#00ff80" />
                            <span style={{ color: '#00ff80', fontWeight: 900, fontSize: '1rem' }}>
                                {match.winner_team_id === match.team_a_id ? match.team_a?.name : match.team_b?.name} WON THE MATCH
                            </span>
                        </div>
                    )}
                </div>

                {/* Team Switcher */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '30px' }}>
                    <button 
                        onClick={() => setActiveTab('team1')}
                        className={activeTab === 'team1' ? 'btn-primary' : 'btn-secondary'}
                        style={{ padding: '20px', fontSize: '1rem', fontWeight: 900, borderRadius: '20px' }}
                    >
                        {match.team1?.name.toUpperCase()}
                    </button>
                    <button 
                        onClick={() => setActiveTab('team2')}
                        className={activeTab === 'team2' ? 'btn-primary' : 'btn-secondary'}
                        style={{ padding: '20px', fontSize: '1rem', fontWeight: 900, borderRadius: '20px' }}
                    >
                        {match.team2?.name.toUpperCase()}
                    </button>
                </div>

                {/* Scorecard Display */}
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: activeTab === 'team1' ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <MatchScorecard matchId={id as string} />
                </motion.div>

            </div>

            <style jsx>{`
                .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid var(--border); }
                .btn-primary { background: var(--primary); color: #000; border: none; font-weight: 900; cursor: pointer; transition: all 0.3s ease; }
                .btn-secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid var(--border); font-weight: 900; cursor: pointer; transition: all 0.3s ease; }
                .rotate { animation: rotate 2s linear infinite; }
                @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </main>
    );
}
