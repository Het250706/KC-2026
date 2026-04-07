'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, UserCheck, UserMinus, DollarSign, Trophy, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import LoadingSpinner from '@/components/LoadingSpinner';
import { fixPhotoUrl } from '@/lib/utils';

export default function AnalyticsDashboard() {
    const [stats, setStats] = useState({
        totalPlayers: 0,
        soldPlayers: 0,
        unsoldPlayers: 0,
        totalMoneySpent: 0,
        highestBid: { name: 'N/A', amount: 0, photo: '' }
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();

        const channel = supabase.channel('analytics-updates')
            .on('postgres_changes', { event: '*', table: 'players' }, () => fetchStats())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchStats = async () => {
        const { data: players } = await supabase.from('players').select('*');

        if (players) {
            const sold = players.filter((p: any) => p.auction_status === 'sold');
            const unsold = players.filter((p: any) => p.auction_status === 'unsold');
            const totalSpent = sold.reduce((acc: number, p: any) => acc + (Number(p.sold_price) || 0), 0);

            const highest = [...sold].sort((a: any, b: any) => (b.sold_price || 0) - (a.sold_price || 0))[0];

            setStats({
                totalPlayers: players.length,
                soldPlayers: sold.length,
                unsoldPlayers: unsold.length,
                totalMoneySpent: totalSpent,
                highestBid: highest ? {
                    name: `${highest.first_name} ${highest.last_name}`,
                    amount: highest.sold_price,
                    photo: highest.photo_url
                } : { name: 'N/A', amount: 0, photo: '' }
            });
        }
        setLoading(false);
    };

    if (loading) return <LoadingSpinner />;

    const cards = [
        { title: 'Total Players', value: stats.totalPlayers, icon: Users, color: 'var(--primary)' },
        { title: 'Sold Players', value: stats.soldPlayers, icon: UserCheck, color: '#00ff80' },
        { title: 'Unsold Players', value: stats.unsoldPlayers, icon: UserMinus, color: '#ff4b4b' },
        { title: 'Pushp Spent', value: `${stats.totalMoneySpent} P`, icon: DollarSign, color: '#00d2ff' },
    ];

    return (
        <div style={{ width: '100%' }}>
            <div className="stats-grid">
                {cards.map((card, i) => (
                    <motion.div
                        key={card.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass"
                        style={{ padding: '30px', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}
                    >
                        <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1 }}>
                            <card.icon size={100} color={card.color} />
                        </div>
                        <card.icon size={24} color={card.color} style={{ marginBottom: '15px' }} />
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '5px' }}>{card.title.toUpperCase()}</h3>
                        <div style={{ fontSize: '2.5rem', fontWeight: 950, color: '#fff' }}>{card.value}</div>
                    </motion.div>
                ))}
            </div>

            <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px' }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass"
                    style={{ padding: '40px', borderRadius: '30px', border: '1px solid rgba(255, 215, 0, 0.3)', background: 'linear-gradient(135deg, rgba(255,215,0,0.05) 0%, transparent 100%)' }}
                >
                    <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                        <div style={{ width: '150px', height: '200px', borderRadius: '20px', overflow: 'hidden', border: '2px solid var(--primary)', background: '#111' }}>
                                <img
                                    src={fixPhotoUrl(stats.highestBid.photo, stats.highestBid.name)}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    alt=""
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${stats.highestBid.name}`;
                                    }}
                                />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '10px' }}>
                                <Trophy size={20} />
                                <span style={{ fontSize: '0.8rem', fontWeight: 900, letterSpacing: '2px' }}>HIGHEST BID PLAYER</span>
                            </div>
                            <h2 style={{ fontSize: '2.5rem', fontWeight: 950, marginBottom: '10px' }}>{stats.highestBid.name}</h2>
                            <div style={{ fontSize: '3.5rem', fontWeight: 950, color: 'var(--primary)' }}>{stats.highestBid.amount} P</div>
                        </div>
                    </div>
                </motion.div>

                <div className="glass" style={{ padding: '40px', borderRadius: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 900, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Activity size={20} color="var(--primary)" /> AUCTION PROGRESS
                    </h3>
                    <div style={{ height: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', marginBottom: '15px' }}>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(stats.soldPlayers / stats.totalPlayers) * 100}%` }}
                            style={{ height: '100%', background: 'var(--primary)', boxShadow: '0 0 20px var(--primary-glow)' }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 800 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{stats.soldPlayers} SOLD</span>
                        <span style={{ color: 'var(--primary)' }}>{Math.round((stats.soldPlayers / stats.totalPlayers) * 100) || 0}% COMPLETE</span>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                }
                @media (max-width: 900px) {
                    .stats-grid { grid-template-columns: 1fr 1fr; }
                    div[style*="grid-template-columns: 1.5fr 1fr"] { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </div>
    );
}
