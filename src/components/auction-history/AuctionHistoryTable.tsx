'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ScrollText, Calendar, Search, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { fixPhotoUrl } from '@/lib/utils';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function AuctionHistoryTable() {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [teams, setTeams] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchHistory();

        const channel = supabase.channel('history-sync')
            .on('postgres_changes', { event: 'UPDATE', table: 'players' }, () => fetchHistory())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchHistory = async () => {
        // Fetch teams for lookup
        const { data: teamsData } = await supabase.from('teams').select('id, name');
        const teamMap: Record<string, string> = {};
        teamsData?.forEach(t => { teamMap[t.id] = t.name; });
        setTeams(teamMap);

        const { data } = await supabase
            .from('players')
            .select('*')
            .eq('auction_status', 'sold')
            .order('created_at', { ascending: false });

        if (data) setHistory(data);
        setLoading(false);
    };

    const getPlayerTeamName = (p: any) => {
        // Check if sold_team is an ID or Name
        if (p.sold_team && teams[p.sold_team]) return teams[p.sold_team];
        if (p.team_id && teams[p.team_id]) return teams[p.team_id];
        if (p.sold_team_id && teams[p.sold_team_id]) return teams[p.sold_team_id];
        return p.sold_team || 'TEAM NAME';
    };

    const filteredHistory = history.filter((p: any) => {
        const teamName = getPlayerTeamName(p);
        return `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
               teamName.toLowerCase().includes(searchTerm.toLowerCase());
    });

    if (loading) return <LoadingSpinner />;

    return (
        <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
                <div className="glass" style={{ padding: '5px 20px', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '10px', width: '300px' }}>
                    <Search size={18} color="var(--primary)" />
                    <input
                        type="text"
                        placeholder="SEARCH PLAYER OR TEAM..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', padding: '12px 0', fontSize: '0.9rem', fontWeight: 700, width: '100%' }}
                    />
                </div>
            </div>

            <div className="history-table glass" style={{ borderRadius: '30px', overflow: 'hidden' }}>
                <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '80px 1.5fr 1fr 1fr 1fr', padding: '20px 30px', background: 'rgba(255, 215, 0, 0.05)', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '1px' }}>
                    <div>IMG</div>
                    <div>PLAYER NAME</div>
                    <div>TEAM NAME</div>
                    <div>STATUS</div>
                    <div>REVEAL TIME</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {filteredHistory.length === 0 ? (
                        <div style={{ padding: '100px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <ScrollText size={48} style={{ opacity: 0.1, marginBottom: '20px' }} />
                            <p>No records found matching your search.</p>
                        </div>
                    ) : (
                        filteredHistory.map((p, i) => (
                            <motion.div
                                key={p.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className="table-row"
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '80px 1.5fr 1fr 1fr 1fr',
                                    padding: '20px 30px',
                                    borderBottom: i === filteredHistory.length - 1 ? 'none' : '1px solid var(--border)',
                                    alignItems: 'center',
                                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                                }}
                            >
                                <div style={{ width: '50px', height: '50px', borderRadius: '12px', overflow: 'hidden', background: '#111', border: '1px solid var(--border)' }}>
                                    <img src={fixPhotoUrl(p.photo_url, p.first_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`; }} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.first_name} {p.last_name}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>{(p.role || p.cricket_skill || 'PLAYER').toUpperCase()} | {p.category.toUpperCase()}</div>
                                </div>
                                <div>
                                    <span style={{ padding: '6px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', fontSize: '0.8rem', fontWeight: 800, border: '1px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--primary)' }}>
                                        {getPlayerTeamName(p)}
                                    </span>
                                </div>
                                <div style={{ fontWeight: 950, color: '#00ff80', fontSize: '0.85rem' }}>✓ SECURED</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <Clock size={12} /> {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>

            <style jsx>{`
                .table-row:hover {
                    background: rgba(255, 215, 0, 0.03) !important;
                }
                @media (max-width: 900px) {
                    .table-header, .table-row {
                        grid-template-columns: 60px 1.2fr 1fr 1fr !important;
                    }
                    div:nth-child(5) { display: none !important; }
                }
                @media (max-width: 600px) {
                    .table-header, .table-row {
                        grid-template-columns: 60px 1.5fr 1fr !important;
                    }
                    div:nth-child(4) { display: none !important; }
                }
            `}</style>
        </div>
    );
}
