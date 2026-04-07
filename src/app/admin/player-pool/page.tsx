'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Search, Trash2, RefreshCw, Loader2, Gavel } from 'lucide-react';
import RoleGuard from '@/components/RoleGuard';
import { motion, AnimatePresence } from 'framer-motion';
import { fixPhotoUrl } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function PlayerPoolPage() {
    return (
        <RoleGuard allowedRole="admin">
            <PlayerPoolContent />
        </RoleGuard>
    );
}

function PlayerPoolContent() {
    const [players, setPlayers] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const router = useRouter();

    const fetchPlayers = async () => {
        setLoading(true);
        const [playersRes, teamsRes] = await Promise.all([
            supabase.from('players').select('*').order('created_at', { ascending: false }),
            supabase.from('teams').select('*').order('name')
        ]);
        
        if (playersRes.error) {
            console.error('Error fetching players:', playersRes.error);
        } else {
            setPlayers(playersRes.data || []);
        }

        if (teamsRes.data) {
            setTeams(teamsRes.data);
        }
        setLoading(false);
    };

    const deletePlayer = async (id: string) => {
        if (!confirm('Are you sure you want to remove this player from the auction pool and return them to registrations?')) return;

        try {
            const res = await fetch(`/api/admin/delete-player?id=${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            
            if (data.success) {
                setPlayers(prev => prev.filter(p => p.id !== id));
            } else {
                alert('Delete failed: ' + (data.error || 'Unknown error'));
            }
        } catch (err: any) {
            alert('Error deleting player: ' + err.message);
        }
    };

    const deleteAllPlayers = async () => {
        if (!confirm('🚨 CAUTION!\n\nThis will REMOVE ALL players from the auction pool and return them to registrations.\nAll bids and budgets will also be reset.\n\nTHIS ACTION CANNOT BE UNDONE. Continue?')) return;
        
        if (!confirm('Are you ABSOLUTELY SURE you want to clear the entire pool?')) return;

        setLoading(true);
        try {
            const res = await fetch('/api/admin/bulk-delete-all', {
                method: 'DELETE'
            });
            const data = await res.json();
            
            if (data.success) {
                setPlayers([]);
                alert('✅ Success! Player pool wiped and all players returned to registrations.');
            } else {
                alert('Delete failed: ' + (data.error || 'Unknown error'));
            }
        } catch (err: any) {
            alert('Error deleting players: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const startAuction = async (playerId: string) => {
        try {
            setSyncingId(playerId);
            const res = await fetch('/api/auction/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start', player_id: playerId })
            });

            if (!res.ok) throw new Error('Failed to start auction');
            
            router.push('/admin/auction');
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSyncingId(null);
        }
    };

    useEffect(() => {
        fetchPlayers();

        const channel = supabase
            .channel('players_pool_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
                fetchPlayers();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const filtered = players.filter(p => 
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <main style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
            <div style={{ padding: '60px 20px', maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        AUCTION PLAYER POOL
                    </h1>
                    <button
                        onClick={deleteAllPlayers}
                        disabled={loading || players.length === 0}
                        style={{
                            padding: '12px 25px',
                            background: 'rgba(255,75,75,0.1)',
                            border: '1px solid #ff4b4b',
                            color: '#ff4b4b',
                            borderRadius: '12px',
                            fontWeight: 900,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}
                    >
                        <Trash2 size={18} />
                        DELETE ALL PLAYERS
                    </button>
                </div>

                {/* Search Bar */}
                <div className="glass" style={{
                    padding: '15px 25px',
                    borderRadius: '16px',
                    marginBottom: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    border: '1px solid rgba(255,255,255,0.05)',
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    <Search size={18} color="#666" style={{ marginRight: '15px' }} />
                    <input
                        type="text"
                        placeholder="Search Player Pool..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1rem', outline: 'none', width: '100%', fontWeight: 500 }}
                    />
                </div>

                {/* Table Layout */}
                <div className="glass" style={{ borderRadius: '0 0 16px 16px', overflowX: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <th style={{ ...thStyle, width: '70px' }}>PHOTO</th>
                                <th style={{ ...thStyle, width: '150px' }}>FULL NAME</th>
                                <th style={{ ...thStyle, width: '110px' }}>CRICKET SKILL</th>
                                <th style={{ ...thStyle, width: '100px' }}>KESHAV CUP PARTICIPATION</th>
                                <th style={{ ...thStyle, width: '120px' }}>SLOTS</th>
                                <th style={{ ...thStyle, width: '140px' }}>AUCTION</th>
                                <th style={{ ...thStyle, width: '60px' }}>DELETE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '100px', textAlign: 'center', color: '#666' }}>
                                        <RefreshCw size={30} className="rotate" style={{ marginBottom: '15px' }} />
                                        <p>Loading player pool...</p>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '100px', textAlign: 'center', color: '#666', fontSize: '1.1rem', fontWeight: 500 }}>
                                        No players found in pool.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((p) => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} className="table-row-hover">
                                        <td style={tdStyle}>
                                            <div style={{ width: '56px', height: '56px', borderRadius: '12px', overflow: 'hidden', background: '#111', margin: '0 auto', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                <img
                                                    src={fixPhotoUrl(p.photo_url || p.photo, p.first_name)}
                                                    alt=""
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.first_name || 'Player')}`; }}
                                                />
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff' }}>{p.first_name} {p.last_name}</div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#fff' }}>{p.cricket_skill || p.role}</div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 900, color: (p.was_present_kc3 === 'હા' || p.was_present_kc3 === 'Yes') ? '#00ff80' : '#ff4b4b' }}>
                                                {(p.was_present_kc3 === 'હા' || p.was_present_kc3 === 'Yes') ? 'YES' : 'NO'}
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)' }}>
                                                {p.category || 'Unassigned'}
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            {p.auction_status === 'sold' ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                                    <div style={{ background: 'rgba(0, 255, 128, 0.1)', color: '#00ff80', padding: '6px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 950, display: 'inline-block' }}>
                                                        SOLD
                                                    </div>
                                                    <div style={{ fontSize: '0.65rem', color: '#888', fontWeight: 800 }}>{teams.find(t => t.id === (p.team_id || p.sold_to_team_id))?.name || 'ASSIGNED'}</div>
                                                </div>
                                            ) : p.auction_status === 'unsold' ? (
                                                <div style={{ background: 'rgba(255, 75, 75, 0.1)', color: '#ff4b4b', padding: '6px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 950, display: 'inline-block' }}>
                                                    UNSOLD
                                                </div>
                                            ) : (
                                                <div style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#444', fontWeight: 900, fontSize: '0.65rem', border: '1px solid rgba(255,255,255,0.1)', cursor: 'not-allowed', textTransform: 'uppercase' }}>
                                                    CARD SYSTEM ACTIVE
                                                </div>
                                            )}
                                        </td>
                                        <td style={tdStyle}>
                                            <button
                                                onClick={() => deletePlayer(p.id)}
                                                style={{ background: 'none', border: 'none', color: '#ff4b4b', cursor: 'pointer', opacity: 0.7 }}
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style jsx>{`
                .rotate { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .table-row-hover:hover { background: rgba(255,255,255,0.02); }
                .push-btn:hover { background: var(--primary) !important; color: #000 !important; }
            `}</style>
        </main>
    );
}

const thStyle: React.CSSProperties = {
    padding: '12px 10px',
    fontSize: '0.65rem',
    fontWeight: 900,
    textAlign: 'center',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    color: '#888'
};

const tdStyle: React.CSSProperties = {
    padding: '10px',
    textAlign: 'center',
    fontSize: '0.8rem',
    color: '#ddd'
};
