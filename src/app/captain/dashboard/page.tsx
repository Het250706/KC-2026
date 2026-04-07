'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import AuctionRoom from '@/components/AuctionRoom';
import Leaderboard from '@/components/Leaderboard';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Users, Zap, Shield, Trophy, PieChart } from 'lucide-react';
import { fixPhotoUrl } from '@/lib/utils';
import { TEAM_PURSE_LIMIT, MAX_SQUAD_SIZE, getPurplePushp } from '@/lib/auction-logic';

export default function DashboardPage() {
    const [team, setTeam] = useState<any>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [auctionState, setAuctionState] = useState<any>(null);
    const [lastBidAlert, setLastBidAlert] = useState<any>(null);

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const teamName = user.user_metadata?.team_name;
            const { data: teamData, error: teamErr } = await supabase
                .from('teams')
                .select('*')
                .eq('name', teamName)
                .single();

            if (teamData) {
                setTeam(teamData);
                const { data: playerData } = await supabase
                    .from('players')
                    .select('*')
                    .eq('team_id', teamData.id)
                    .eq('auction_status', 'sold');
                setPlayers(playerData || []);
            }

            const { data: auctionData } = await supabase.from('auction_state').select('*').single();
            if (auctionData) setAuctionState(auctionData);

        } catch (err) {
            console.error('Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const stateSub = supabase.channel('dashboard_sync_v3')
            .on('postgres_changes', { event: '*', table: 'auction_state' }, (p: any) => setAuctionState(p.new))
            .on('postgres_changes', { event: 'INSERT', table: 'bids' }, async (p: any) => {
                const { data: bTeam } = await supabase.from('teams').select('name').eq('id', p.new.team_id).single();
                setLastBidAlert({ ...p.new, team_name: bTeam?.name || 'A Franchise' });
                setTimeout(() => setLastBidAlert(null), 4000);
            })
            .on('postgres_changes', { event: '*', table: 'teams' }, (p: any) => {
                if (team && (p.new as any).id === team.id) setTeam(p.new);
            })
            .on('postgres_changes', { event: '*', table: 'players' }, () => fetchData())
            .subscribe();

        return () => { supabase.removeChannel(stateSub); };
    }, [team?.id]);

    const squadStats = useMemo(() => {
        return {
            Batsman: players.filter(p => p.cricket_skill === 'Batsman').length,
            Bowler: players.filter(p => p.cricket_skill === 'Bowler').length,
            'All-rounder': players.filter(p => p.cricket_skill === 'All-Rounder').length,
            Wicketkeeper: players.filter(p => p.cricket_skill === 'Wicket Keeper').length,
        };
    }, [players]);

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000', color: '#fff' }}>
            <Zap className="animate-spin" size={48} color="var(--primary)" />
        </div>
    );

    if (!team) return (
        <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000', color: '#fff' }}>
            <div className="glass" style={{ padding: '40px', textAlign: 'center' }}>
                <Shield size={64} style={{ marginBottom: '20px', color: 'var(--primary)' }} />
                <h2>Access Restricted</h2>
                <p>Please login to access your franchise dashboard.</p>
                <a href="/login" className="btn-primary" style={{ marginTop: '20px', display: 'inline-block' }}>LOGIN</a>
            </div>
        </div>
    );

    return (
        <main style={{ minHeight: '100vh', background: '#000', color: '#fff', paddingBottom: '50px' }}>

            <AnimatePresence>
                {lastBidAlert && (
                    <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 20, opacity: 1 }} exit={{ y: -50, opacity: 0 }} style={{ position: 'fixed', top: '80px', right: '20px', zIndex: 1000, background: 'rgba(255,215,0,0.1)', backdropFilter: 'blur(10px)', border: '1px solid var(--primary)', padding: '15px 25px', borderRadius: '15px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--primary)' }}>LIVE BID</div>
                        <div style={{ fontWeight: 800 }}>{lastBidAlert.team_name} bid {lastBidAlert.amount} P</div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div style={{ padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--primary)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 950, fontSize: '1.2rem' }}>{team.name[0]}</div>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 900 }}>FRANCHISE DASHBOARD</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 950 }}>{team.name.toUpperCase()}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '40px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>REMAINING PURSE</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 950, color: 'var(--primary)' }}>{team.remaining_budget} P</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>SQUAD SIZE</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 950 }}>{players.length} / {MAX_SQUAD_SIZE}</div>
                    </div>
                </div>
            </div>

            <div className="container" style={{ maxWidth: '1600px', margin: '30px auto', padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    <div className="glass" style={{ padding: '30px', borderRadius: '35px', background: 'linear-gradient(to bottom, rgba(255,215,0,0.05), transparent)' }}>
                        <AuctionRoom teamId={team.id} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                        <div className="glass" style={{ padding: '30px', borderRadius: '30px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                                <PieChart size={24} color="var(--primary)" />
                                <h3 style={{ fontWeight: 900 }}>SQUAD COMPOSITION</h3>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
                                {Object.entries(squadStats).map(([role, count]) => (
                                    <div key={role} style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '20px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '2rem', fontWeight: 950, color: count > 0 ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }}>{count}</div>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>{role.toUpperCase()}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="glass" style={{ padding: '30px', borderRadius: '30px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                                <Wallet size={24} color="var(--primary)" />
                                <h3 style={{ fontWeight: 900 }}>PURSE UTILIZATION</h3>
                            </div>
                            <div style={{ height: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
                                <motion.div initial={{ width: 0 }} animate={{ width: `${(team.remaining_budget / TEAM_PURSE_LIMIT) * 100}%` }} style={{ height: '100%', background: 'linear-gradient(90deg, var(--primary), #ffa500)' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>REMAINING</div><div style={{ fontSize: '1.8rem', fontWeight: 950 }}>{team.remaining_budget} P</div></div>
                                <div style={{ textAlign: 'right' }}><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SPENT</div><div style={{ fontSize: '1.8rem', fontWeight: 950, opacity: 0.5 }}>{TEAM_PURSE_LIMIT - team.remaining_budget} P</div></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                    <div className="glass" style={{ padding: '25px', borderRadius: '25px' }}>
                        <h3 style={{ fontWeight: 900, marginBottom: '20px' }}>TEAM SQUAD</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto' }}>
                            {players.length === 0 ? <p style={{ opacity: 0.3, textAlign: 'center', padding: '40px 0' }}>SQUAD EMPTY</p> : players.map(p => (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', overflow: 'hidden' }}><img src={fixPhotoUrl(p.photo_url, p.first_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`; }} /></div>
                                        <div><div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{p.first_name} {p.last_name}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.cricket_skill}</div></div>
                                    </div>
                                    <div style={{ fontWeight: 900, fontSize: '1rem' }}>{p.sold_price} P</div>
                                </div>
                            )).reverse()}
                        </div>
                    </div>
                    <Leaderboard selectedTeamId={team.id} />
                </div>
            </div>
        </main>
    );
}
