'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Shield, Users, ChevronRight, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '@/components/LoadingSpinner';
import { fixPhotoUrl } from '@/lib/utils';

export default function TeamSquadList() {
    const [teams, setTeams] = useState<any[]>([]);
    const [players, setPlayers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

    useEffect(() => {
        fetchData();

        const channel = supabase.channel('teams-sync')
            .on('postgres_changes', { event: '*', table: 'players', schema: 'public' }, () => fetchData())
            .on('postgres_changes', { event: '*', table: 'teams', schema: 'public' }, () => fetchData())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchData = async () => {
        const { data: t } = await supabase.from('teams').select('*').order('name');
        const { data: p } = await supabase.from('players').select('*').eq('auction_status', 'sold');

        if (t) setTeams(t);
        if (p) setPlayers(p);
        setLoading(false);
    };

    const filteredTeams = teams.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <LoadingSpinner />;

    return (
        <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
                <div className="glass" style={{ padding: '5px 20px', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '10px', width: '300px' }}>
                    <Search size={18} color="var(--primary)" />
                    <input
                        type="text"
                        placeholder="SEARCH TEAM..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', padding: '12px 0', fontSize: '0.9rem', fontWeight: 700, width: '100%' }}
                    />
                </div>
            </div>

            <div className="teams-grid">
                {filteredTeams.map((team, i) => {
                    const squad = players.filter((p: any) => p.sold_team_id === team.id || p.team_id === team.id);
                    const isExpanded = expandedTeam === team.id;

                    return (
                        <motion.div
                            key={team.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                            className="glass team-card"
                            style={{
                                borderRadius: '30px',
                                overflow: 'hidden',
                                border: isExpanded ? '2px solid var(--primary)' : '1px solid var(--border)',
                                background: isExpanded ? 'rgba(255, 215, 0, 0.03)' : 'rgba(255,255,255,0.02)',
                                transition: 'all 0.3s ease',
                                marginBottom: '20px'
                            }}
                        >
                            <div
                                onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                                style={{ padding: '30px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                    <div style={{ width: '60px', height: '60px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Shield size={32} color="var(--primary)" />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 950 }}>{team.name}</h2>
                                        <div style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <Users size={14} /> {squad.length} PLAYERS SECURED
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <motion.div animate={{ rotate: isExpanded ? 90 : 0 }}>
                                    <ChevronRight size={24} color={isExpanded ? 'var(--primary)' : 'var(--text-muted)'} />
                                </motion.div>
                            </div>

                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        <div style={{ padding: '0 30px 30px', borderTop: '1px solid var(--border)' }}>
                                            <div style={{ marginTop: '20px' }}>
                                                <h3 style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '2px', marginBottom: '15px' }}>CURRENT SQUAD</h3>
                                                {squad.length === 0 ? (
                                                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px', fontSize: '0.9rem' }}>No players assigned yet.</p>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        {squad.map((p) => (
                                                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', overflow: 'hidden', background: '#111' }}>
                                                                        <img
                                                                            src={fixPhotoUrl(p.photo_url, p.first_name)}
                                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                            alt=""
                                                                            onError={(e) => {
                                                                                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`;
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{p.first_name} {p.last_name}</div>
                                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>{(p.role || p.cricket_skill || 'PLAYER').toUpperCase()} | {p.category.toUpperCase()}</div>
                                                                    </div>
                                                                </div>
                                                                <div style={{ fontWeight: 950, color: 'var(--primary)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                    <Shield size={12} /> VERIFIED
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>

            <style jsx>{`
                .teams-grid {
                    display: flex;
                    flex-direction: column;
                }
                .team-card:hover {
                    border-color: rgba(255, 215, 0, 0.4);
                    transform: translateY(-2px);
                }
            `}</style>
        </div>
    );
}
