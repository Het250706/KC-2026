'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Trophy, Zap, Users, History, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fixPhotoUrl } from '@/lib/utils';
import { getPurplePushp } from '@/lib/auction-logic';

export default function AuctionSummary() {
    const [players, setPlayers] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [auctionState, setAuctionState] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        const { data: p } = await supabase.from('players').select('*').order('updated_at', { ascending: false });
        const { data: t } = await supabase.from('teams').select('*').order('remaining_budget', { ascending: false });
        const { data: s } = await supabase.from('auction_state').select('*').single();

        if (p) setPlayers(p);
        if (t) setTeams(t);
        if (s) setAuctionState(s);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        const stateSub = supabase.channel('summary_sync_v3')
            .on('postgres_changes', { event: '*', table: 'auction_state' }, (payload: any) => setAuctionState(payload.new))
            .on('postgres_changes', { event: '*', table: 'players' }, () => fetchData())
            .on('postgres_changes', { event: '*', table: 'teams' }, () => fetchData())
            .subscribe();

        return () => { supabase.removeChannel(stateSub); };
    }, []);

    const formatPushp = (amount: number) => {
        const purple = getPurplePushp(amount);
        return `${amount.toLocaleString()} Pushp${purple ? ` (${purple} Purple)` : ''}`;
    };

    if (loading) return (
        <div style={{ height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 900 }}>
            LOADING KESHAV CUP ANALYTICS...
        </div>
    );

    const soldPlayers = players.filter(p => p.auction_status === 'sold');
    const currentPlayer = players.find(p => p.id === auctionState?.current_player_id);

    return (
        <main style={{ minHeight: '100vh', background: '#000', color: '#fff', paddingBottom: '50px' }}>
            <div className="container" style={{ maxWidth: '1600px', margin: '40px auto', padding: '0 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                    <div>
                        <h1 style={{ fontSize: '3rem', fontWeight: 950, letterSpacing: '-2px' }}>AUCTION <span style={{ color: 'var(--primary)' }}>SUMMARY</span></h1>
                        <p style={{ color: 'var(--text-muted)', fontWeight: 800 }}>KESHAV CUP 4.0 LIVE TRACKER</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '40px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                        {/* Current Floor */}
                        <div className="glass" style={{ padding: '40px', borderRadius: '35px', border: '1px solid rgba(255,215,0,0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
                                <Zap size={24} color="var(--primary)" fill="currentColor" />
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '2px' }}>ACTIVE FLOOR</h2>
                            </div>
                            <AnimatePresence mode="wait">
                                {currentPlayer ? (
                                    <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
                                        <div style={{ width: '220px', height: '280px', borderRadius: '25px', overflow: 'hidden', border: '2px solid var(--primary)' }}>
                                            <img src={fixPhotoUrl(currentPlayer.photo_url, currentPlayer.first_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '2.5rem', fontWeight: 950 }}>{currentPlayer.first_name} {currentPlayer.last_name}</h3>
                                            <div style={{ fontSize: '1.2rem', color: 'var(--primary)', fontWeight: 900, marginBottom: '20px' }}>{currentPlayer.cricket_skill}</div>
                                            <div style={{ fontSize: '4rem', fontWeight: 950 }}>{formatPushp(auctionState?.current_highest_bid || 0)}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '60px', opacity: 0.3 }}>
                                        <History size={60} style={{ margin: '0 auto 20px' }} />
                                        <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>FLOOR IDLE</div>
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Recent Acquisitions */}
                        <div className="glass" style={{ padding: '30px', borderRadius: '35px' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 950, marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}><Users size={20} color="var(--primary)" /> RECENT ACQUISITIONS</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                                {soldPlayers.map(p => {
                                    const team = teams.find(t => t.id === p.team_id);
                                    return (
                                        <div key={p.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: '5px' }}>{p.first_name} {p.last_name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 800 }}>{team?.name || 'N/A'}</div>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 950, marginTop: '10px', color: '#00ff80' }}>{p.sold_price} P</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                        <div className="glass" style={{ padding: '25px', borderRadius: '25px' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 950, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Award size={20} color="var(--primary)" /> LEADERBOARD</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {teams.map(t => (
                                    <div key={t.id} style={{ padding: '15px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 800 }}>{t.name}</span>
                                        <span style={{ fontWeight: 950, color: 'var(--primary)', fontSize: '1.1rem' }}>{t.remaining_budget} P</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style jsx>{`
                .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.05); }
            `}</style>
        </main>
    );
}
