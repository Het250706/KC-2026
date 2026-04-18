'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Trash2, X, Gavel, Users, UserPlus, Shield, LogOut, Zap, Shuffle, Download, Link as LinkIcon, ExternalLink, Settings, LayoutGrid, Hammer, RotateCcw, PieChart, History as HistoryIcon, Trophy, Target } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import RoleGuard from '@/components/RoleGuard';
import { fixPhotoUrl } from '@/lib/utils';

export default function AdminDashboardPage() {
    return (
        <RoleGuard allowedRole="admin">
            <AdminDashboardContent />
        </RoleGuard>
    );
}

function AdminDashboardContent() {
    const thStyle: React.CSSProperties = { padding: '10px', color: '#aaa', fontSize: '0.85rem', fontWeight: 950, textTransform: 'uppercase', whiteSpace: 'nowrap', textAlign: 'center' };
    const tdStyle: React.CSSProperties = { padding: '10px', fontSize: '0.8rem', textAlign: 'center', color: '#ddd' };

    const [players, setPlayers] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [auctionState, setAuctionState] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [sheetSyncing, setSheetSyncing] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<string>('All');
    const [showSlotManager, setShowSlotManager] = useState(false);
    const [newSlotName, setNewSlotName] = useState('');
    const [reAuctionLoading, setReAuctionLoading] = useState(false);
    const [allSlots, setAllSlots] = useState<string[]>([]);
    const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
    const [newSlotInput, setNewSlotInput] = useState('');
    const router = useRouter();

    const [registrationsCount, setRegistrationsCount] = useState(0);
    const [tournamentStats, setTournamentStats] = useState<any[]>([]);

    const captains = [
        'Shivkumar Mukesh bhai patel',
        'Vatsal Mukeshbhai Patel',
        'Taksh KaPatel',
        'Vandan AtulBhai patel',
        'Aksharbhai Patel',
        'PATEL DARPAN RAJNIKUMAR',
        'Miten Kalpeshbhai Chauhan',
        'Yogi Shah'
    ];

    const isCaptain = (firstName: string, lastName: string) => {
        const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
        return captains.some(c => c.trim().toLowerCase() === fullName);
    };

    const fetchData = async () => {
        try {
            const [playersRes, stateRes, teamsRes, regRes, rawStatsRes, matchesRes] = await Promise.all([
                supabase.from('players').select('*').order('created_at', { ascending: false }),
                supabase.from('auction_state').select('*').single(),
                supabase.from('teams').select('*').order('name'),
                supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('is_pushed', false),
                supabase.from('player_match_stats').select('*, players(*)'),
                supabase.from('matches').select('*').order('created_at', { ascending: false })
            ]);

            if (playersRes.data) setPlayers(playersRes.data);
            if (stateRes.data) setAuctionState(stateRes.data);
            if (teamsRes.data) setTeams(teamsRes.data);
            if (regRes.count !== null) setRegistrationsCount(regRes.count);
            
            // Manual Aggregation for Accuracy & Consistency
            if (rawStatsRes.data && teamsRes.data) {
                const playersMap = new Map();
                rawStatsRes.data.forEach((stat: any) => {
                    const pid = stat.player_id;
                    if (!playersMap.has(pid)) {
                        playersMap.set(pid, {
                            player_id: pid,
                            first_name: stat.players?.first_name || 'Unknown',
                            last_name: stat.players?.last_name || '',
                            team_id: stat.players?.team_id,
                            photo_url: stat.players?.photo_url || stat.players?.photo,
                            total_runs: 0,
                            total_wickets: 0,
                            pot_score: 0
                        });
                    }
                    const p = playersMap.get(pid);
                    p.total_runs += Number(stat.runs_scored || stat.runs || 0);
                    p.total_wickets += Number(stat.wickets_taken || stat.wickets || 0);
                    p.pot_score = p.total_runs + (p.total_wickets * 25);
                });

                const aggregated = Array.from(playersMap.values()).map(p => {
                    const team = teamsRes.data?.find(t => t.id === p.team_id);
                    return { 
                        ...p, 
                        team_name: team?.name || 'No Team'
                    };
                }).sort((a: any, b: any) => (b.pot_score || 0) - (a.pot_score || 0));
                setTournamentStats(aggregated);
            }

            // Combine unique slots from both tables for dropdowns
            const playerCats = playersRes.data?.map(p => p.category).filter(Boolean) || [];
            
            // Fetch ALL registration slots to populate the dropdown
            const { data: allRegs } = await supabase.from('registrations').select('slot');
            const regSlots = allRegs?.map(r => r.slot).filter(Boolean) || [];
            
            const merged = Array.from(new Set([...playerCats, ...regSlots, 'Unassigned'])).sort();
            setAllSlots(merged.filter(s => s !== 'Unassigned'));
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            console.error('FetchData Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        fetchData();

        const channelId = `admin_dashboard_realtime_${Math.random()}`;
        const stateSub = supabase.channel(channelId)
            .on('postgres_changes' as any, { event: '*', table: 'auction_state', schema: 'public' }, () => { if (isMounted) fetchData(); })
            .on('postgres_changes' as any, { event: '*', table: 'players', schema: 'public' }, () => { if (isMounted) fetchData(); })
            .on('postgres_changes' as any, { event: '*', table: 'teams', schema: 'public' }, () => { if (isMounted) fetchData(); })
            .on('postgres_changes' as any, { event: '*', table: 'bids', schema: 'public' }, () => { if (isMounted) fetchData(); })
            .on('postgres_changes' as any, { event: '*', table: 'matches', schema: 'public' }, () => { if (isMounted) fetchData(); })
            .on('postgres_changes' as any, { event: '*', table: 'match_events', schema: 'public' }, () => { if (isMounted) fetchData(); })
            .on('postgres_changes' as any, { event: '*', table: 'player_match_stats', schema: 'public' }, () => { if (isMounted) fetchData(); })
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(stateSub);
        };
    }, []);

    const controlAuction = async (action: string, playerId?: string) => {
        try {
            setSyncing(true);
            const url = action === 'start' ? '/api/auction/start' : '/api/auction/control';
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, player_id: playerId })
            });

            if (!res.ok) throw new Error('Auction action failed');
            // Optimistic refresh
            fetchData();
        } catch (err: any) {
            console.error('Auction Control Error:', err);
            alert('Action Failed: ' + err.message);
        } finally {
            setSyncing(false);
        }
    };

    const sellPlayer = async () => {
        if (!auctionState?.current_player_id || !auctionState?.highest_bid_team_id) {
            alert("No active player or no bids placed yet.");
            return;
        }

        try {
            const res = await fetch('/api/auction/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_id: auctionState.current_player_id
                })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Failed to assign player');

            alert('Player assigned successfully!');
            fetchData();
        } catch (error: any) {
            alert('Error: ' + error.message);
        }
    };

    const manualAssignTeam = async (playerId: string, teamId: string) => {
        if (!teamId) return;
        try {
            setSyncing(true);
            const { error } = await supabase
                .from('players')
                .update({
                    team_id: teamId,
                    auction_status: 'sold'
                })
                .eq('id', playerId);

            if (error) throw error;
            
            // Optionally audit budgets after manual assignment
            await fetch('/api/admin/audit-budgets', { method: 'POST' });
            
            fetchData();
        } catch (err: any) {
            console.error('Manual Assign Error:', err);
            alert('Failed to assign team: ' + err.message);
        } finally {
            setSyncing(false);
        }
    };

    const drawRandom = async () => {
        // Filter players based on selected slot
        const pool = selectedSlot === 'All'
            ? players.filter(p => p.auction_status === 'pending')
            : players.filter(p => p.auction_status === 'pending' && p.category === selectedSlot);

        if (pool.length === 0) {
            alert(selectedSlot === 'All' ? 'Auction Pool Empty!' : `Slot "${selectedSlot}" Completed. Move to Next Slot.`);
            return;
        }

        setLoading(true);
        try {
            // Pick a random player from the filtered pool locally and start their auction
            const randomPlayer = pool[Math.floor(Math.random() * pool.length)];
            await controlAuction('start', randomPlayer.id);
        } catch (err) {
            alert('Error drawing player');
        } finally {
            setLoading(false);
        }
    };

    const updatePlayerSlot = async (player: any, category: string) => {
        try {
            const res = await fetch('/api/players/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update', player: { id: player.id, category } })
            });
            if (res.ok) {
                // Also update in registrations to keep in sync
                const firstName = player.first_name;
                const lastName = player.last_name;
                
                await supabase.from('registrations')
                    .update({ slot: category })
                    .ilike('name', `%${firstName}%`)
                    .ilike('name', `%${lastName}%`);
                
                fetchData();
            }
        } catch (err) {
            alert('Error updating slot');
        }
    };

    const confirmNewSlot = async (player: any) => {
        const val = newSlotInput.trim();
        if (!val) {
            setEditingSlotId(null);
            return;
        }
        await updatePlayerSlot(player, val);
        setEditingSlotId(null);
        setNewSlotInput('');
    };

    const deleteSlot = async (slotName: string) => {
        if (slotName === 'Unassigned') return;
        if (!confirm(`🚨 Delete Slot "${slotName}"?\n\nThis will move all players in this slot back to "Unassigned".\nNo players will be deleted, only their category will be removed.`)) return;

        setSyncing(true);
        try {
            const playersInSlot = players.filter(p => p.category === slotName);

            // Update players in sequence (using manage API which uses admin key)
            await Promise.all(playersInSlot.map(p =>
                fetch('/api/players/manage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'update', player: { id: p.id, category: 'Unassigned' } })
                })
            ));

            if (selectedSlot === slotName) setSelectedSlot('All');
            alert(`✅ Slot "${slotName}" removed successfully.`);
            fetchData();
        } catch (err) {
            console.error('Delete Slot Error:', err);
            alert('Failed to delete slot.');
        } finally {
            setSyncing(false);
        }
    };

    const auditBudgets = async () => {
        if (!confirm('Re-calculate all team budgets based on actual sold players? This will fix discrepancies caused by manual deletions.')) return;

        setSyncing(true);
        try {
            const res = await fetch('/api/admin/audit-budgets', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('✅ Team budgets synchronized successfully!');
                fetchData();
            } else {
                throw new Error(data.error || 'Audit failed');
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSyncing(false);
        }
    };

    const resetPurses = async () => {
        if (!confirm('🚨 RESET ALL PURSES? This will set every team\'s remaining budget to their MAXIMUM capacity, regardless of current players. Continue?')) return;

        setSyncing(true);
        try {
            const res = await fetch('/api/admin/reset-purses', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('✅ All team purses reset successfully!');
                fetchData();
            } else {
                throw new Error(data.error || 'Reset failed');
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSyncing(false);
        }
    };

    const bulkPushPlayers = async () => {
        if (!confirm(`🚀 PUSH ALL PENDING REGISTRATIONS TO PLAYER POOL?\n\nThis will take all players from Registration Control and move them into the main Auction Pool. Continue?`)) return;

        setSyncing(true);
        try {
            const res = await fetch('/api/admin/bulk-push', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert(`✅ SUCCESS!\n\n${data.message}`);
                fetchData();
            } else {
                throw new Error(data.error || 'Bulk push failed');
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSyncing(false);
        }
    };

    const bulkDeleteAll = async () => {
        if (!confirm('🚨 EMERGENCY RESET: This will remove ALL players from the auction pool, clear ALL sold players, and return everyone to Registration Control. Are you absolutely sure?')) return;

        setSyncing(true);
        try {
            const res = await fetch('/api/admin/bulk-delete-all', { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                alert('✅ All players returned to registration control successfully!');
                fetchData();
            } else {
                throw new Error(data.error || 'Bulk delete failed');
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSyncing(false);
        }
    };

    const currentPlayer = players.find(p => p.id === auctionState?.current_player_id);

    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>LOADING CONSOLE...</div>;

    return (
        <>
        <main style={{ background: '#000', minHeight: '100vh', paddingBottom: '40px' }}>
            <div className="container-responsive" style={{ maxWidth: '1400px', margin: '0 auto', paddingTop: '20px' }}>

                <div className="responsive-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <h1 className="text-h1" style={{ fontSize: '2.5rem', fontWeight: 950, margin: 0 }}>Admin <span style={{ color: 'var(--primary)' }}>Control</span></h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                            <span style={{
                                background: 'rgba(255, 75, 75, 0.1)',
                                color: '#ff4b4b',
                                border: '1px solid rgba(255, 75, 75, 0.3)',
                                padding: '4px 12px',
                                borderRadius: '8px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '1px'
                            }}>LIVE CONSOLE</span>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Pool: <b style={{ color: '#fff' }}>{players.length}</b></p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>•</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Pending: <b style={{ color: 'var(--primary)' }}>{registrationsCount}</b></p>
                        </div>
                    </div>
                </div>

                <div className="grid-2 grid-3 grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                        {/* Registration Control Box */}
                        <motion.div
                            whileHover={{ scale: 1.02, translateY: -5 }}
                            onClick={() => router.push('/admin/registrations')}
                            className="glass"
                            style={{ padding: '25px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '20px', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '15px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                                <UserPlus size={28} color="var(--primary)" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '4px' }}>REGISTRATIONS</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{registrationsCount} Players Waiting</p>
                            </div>
                        </motion.div>

                        {/* Live Score Control Box */}
                        <motion.div
                            whileHover={{ scale: 1.02, translateY: -5 }}
                            onClick={() => router.push('/admin/live-score')}
                            className="glass"
                            style={{ padding: '25px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '20px', background: 'rgba(0, 255, 128, 0.05)', border: '1px solid rgba(0, 255, 128, 0.2)' }}
                        >
                            <div style={{ background: 'rgba(0, 255, 128, 0.1)', padding: '15px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #00ff80' }}>
                                <Zap size={28} color="#00ff80" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '4px' }}>LIVE SCORE</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Manage Matches</p>
                            </div>
                        </motion.div>

                        {/* Slot Management Box */}
                        <motion.div
                            whileHover={{ scale: 1.02, translateY: -5 }}
                            onClick={() => setShowSlotManager(!showSlotManager)}
                            className="glass"
                            style={{
                                padding: '25px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '20px',
                                background: showSlotManager ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.05)',
                                border: showSlotManager ? '2px solid #38bdf8' : '1px solid rgba(56, 189, 248, 0.2)'
                            }}
                        >
                            <div style={{ background: '#38bdf8', padding: '15px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Settings size={28} color="#000" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '4px' }}>SLOTS</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Configure Categories</p>
                            </div>
                        </motion.div>

                        {/* Live Reveal Display Box */}
                        <motion.div
                            whileHover={{ scale: 1.02, translateY: -5 }}
                            onClick={() => window.open('/auction/live-cards', '_blank')}
                            className="glass"
                            style={{
                                padding: '25px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '20px',
                                background: 'rgba(255, 215, 0, 0.05)',
                                border: '1px solid var(--primary)',
                                boxShadow: '0 0 30px rgba(255, 215, 0, 0.1)'
                            }}
                        >
                            <div style={{ background: 'var(--primary)', padding: '15px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Zap size={28} color="#000" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 950, marginBottom: '4px' }}>LIVE REVEAL</h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800 }}>Cinema Mode (Broadcast)</p>
                            </div>
                        </motion.div>
                    </div>

                    {/* SLOT MANAGEMENT DRAWER */}
                    <AnimatePresence>
                        {showSlotManager && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ overflow: 'hidden', marginBottom: '30px' }}
                            >
                                <div className="glass" style={{ padding: '30px', border: '1px solid #38bdf8' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <LayoutGrid size={20} color="#38bdf8" /> CONFIGURE AUCTION SLOTS
                                        </h2>
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                        {['All', ...Array.from(new Set(players.map(p => p.category || 'Unassigned')))].map(slot => (
                                            <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <button
                                                    onClick={() => setSelectedSlot(slot)}
                                                    style={{
                                                        padding: '10px 20px',
                                                        borderRadius: '12px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 800,
                                                        background: selectedSlot === slot ? '#38bdf8' : 'rgba(255,255,255,0.05)',
                                                        color: selectedSlot === slot ? '#000' : '#fff',
                                                        border: selectedSlot === slot ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                                                        transition: 'all 0.2s',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    {slot === 'All' ? '🌐 ALL PLAYERS' : `📦 SLOT: ${slot}`}
                                                    <span style={{ marginLeft: '8px', opacity: 0.5 }}>
                                                        ({players.filter(p => (slot === 'All' || p.category === slot) && p.auction_status === 'pending').length})
                                                    </span>
                                                </button>
                                                
                                                {slot !== 'All' && slot !== 'Unassigned' && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <button
                                                            onClick={() => router.push(`/admin/card-slots?import=${slot}`)}
                                                            style={{
                                                                padding: '10px 18px',
                                                                borderRadius: '12px',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 950,
                                                                background: 'rgba(255,215,0,0.05)',
                                                                color: 'var(--primary)',
                                                                border: '1px solid var(--primary)',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                whiteSpace: 'nowrap',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseOver={(e) => { (e.currentTarget as any).style.background = 'rgba(255,215,0,0.15)'; }}
                                                            onMouseOut={(e) => { (e.currentTarget as any).style.background = 'rgba(255,215,0,0.05)'; }}
                                                        >
                                                            🃏 CARD AUCTION
                                                        </button>
                                                        
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); deleteSlot(slot); }}
                                                            style={{
                                                                background: 'rgba(255, 75, 75, 0.1)',
                                                                border: '1px solid rgba(255, 75, 75, 0.2)',
                                                                padding: '10px',
                                                                borderRadius: '10px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: '#ff4b4b',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseOver={(e) => { (e.currentTarget as any).style.background = 'rgba(255, 75, 75, 0.2)'; }}
                                                            onMouseOut={(e) => { (e.currentTarget as any).style.background = 'rgba(255, 75, 75, 0.1)'; }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <p style={{ marginTop: '15px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>* Selecting a slot will restrict the "NEXT PLAYER" button to only players in that category.</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="admin-grid">
                        <div className="glass" style={{ padding: '0', overflow: 'hidden' }}>
                            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Shield size={18} color="var(--primary)" /> PLAYER POOL
                                </h2>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    {selectedSlot !== 'All' && (
                                        <div style={{ background: '#38bdf8', color: '#000', padding: '4px 12px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 950, textTransform: 'uppercase' }}>
                                            ACTIVE SLOT: {selectedSlot}
                                        </div>
                                    )}
                                    <button 
                                        onClick={bulkDeleteAll} 
                                        className="btn-secondary" 
                                        style={{ 
                                            fontSize: '0.7rem', 
                                            padding: '8px 15px', 
                                            color: '#ff4b4b', 
                                            borderColor: 'rgba(255, 75, 75, 0.3)', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '6px',
                                            background: 'rgba(255, 75, 75, 0.05)'
                                        }}
                                    >
                                        <Trash2 size={14} /> DELETE ALL
                                    </button>
                                </div>
                            </div>
                            <div className="table-responsive scrollable-table" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto', overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ ...thStyle, width: '70px' }}>PHOTO</th>
                                            <th style={{ ...thStyle, width: '150px', textAlign: 'left' }}>FULL NAME</th>
                                            <th style={{ ...thStyle, width: '110px' }}>CRICKET SKILL</th>
                                            <th style={{ ...thStyle, width: '100px' }}>KESHAV CUP </th>
                                            <th style={{ ...thStyle, width: '120px' }}>SLOTS</th>
                                            <th style={{ ...thStyle, width: '140px' }}>AUCTION</th>
                                            <th style={{ ...thStyle, width: '60px' }}>DELETE</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {players.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                    <Users size={32} style={{ opacity: 0.2, marginBottom: '10px' }} />
                                                    <div style={{ fontWeight: 700 }}>NO PLAYERS IN POOL</div>
                                                    <div style={{ fontSize: '0.75rem', marginTop: '5px' }}>Push some players from Registration Control.</div>
                                                </td>
                                            </tr>
                                        ) : (() => {
                                            const filteredPlayers = players.filter(p => selectedSlot === 'All' || p.category === selectedSlot);
                                            if (filteredPlayers.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan={7} style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                            <Users size={32} style={{ opacity: 0.2, marginBottom: '10px' }} />
                                                            <div style={{ fontWeight: 700 }}>NO PLAYERS IN {selectedSlot.toUpperCase()}</div>
                                                            <div style={{ fontSize: '0.75rem', marginTop: '5px' }}>Try selecting a different slot or assign players to this one.</div>
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                            const sortedPlayers = [...filteredPlayers].sort((a, b) => {
                                                const aCap = isCaptain(a.first_name, a.last_name);
                                                const bCap = isCaptain(b.first_name, b.last_name);
                                                if (aCap && !bCap) return -1;
                                                if (!aCap && bCap) return 1;
                                                return 0;
                                            });
                                            return sortedPlayers.map((p) => (
                                                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                                                    <td style={tdStyle}>
                                                        <div className="admin-photo-container" style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#222', overflow: 'hidden', margin: '0 auto', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                                                            <img
                                                                src={fixPhotoUrl(p.photo_url || p.photo, p.first_name)}
                                                                className="admin-photo"
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                alt=""
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`;
                                                                }}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'left' }}>
                                                        <div style={{ fontWeight: 800, color: '#fff', fontSize: '1.2rem' }}>
                                                            {p.first_name} {p.last_name}

                                                        </div>
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff' }}>{p.cricket_skill || p.role}</div>
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <div style={{ fontWeight: 900, color: (p.was_present_kc3 === 'હા' || p.was_present_kc3 === 'Yes') ? '#00ff80' : '#ff4b4b' }}>
                                                            {(p.was_present_kc3 === 'હા' || p.was_present_kc3 === 'Yes') ? 'YES' : 'NO'}
                                                        </div>
                                                    </td>
                                                    <td style={tdStyle}>
                                                        {editingSlotId === p.id ? (
                                                            <div style={{ display: 'flex', gap: '5px', width: '90%', margin: '0 auto' }}>
                                                                <input
                                                                    type="text"
                                                                    value={newSlotInput}
                                                                    onChange={(e) => setNewSlotInput(e.target.value)}
                                                                    autoFocus
                                                                    placeholder="Name..."
                                                                    onKeyDown={(e) => e.key === 'Enter' && confirmNewSlot(p)}
                                                                    style={{
                                                                        background: '#0a0a0a', border: '1px solid var(--primary)',
                                                                        color: '#fff', fontSize: '0.7rem', padding: '5px',
                                                                        borderRadius: '4px', width: '65%', outline: 'none'
                                                                    }}
                                                                />
                                                                <button
                                                                    onClick={() => confirmNewSlot(p)}
                                                                    style={{ background: 'var(--primary)', color: '#000', border: 'none', borderRadius: '4px', fontSize: '0.6rem', padding: '0 6px', fontWeight: 900, cursor: 'pointer' }}
                                                                >
                                                                    OK
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <select
                                                                value={p.category || 'Unassigned'}
                                                                onChange={(e) => {
                                                                    if (e.target.value === '+ New Slot') {
                                                                        setEditingSlotId(p.id);
                                                                        setNewSlotInput('');
                                                                    } else {
                                                                        updatePlayerSlot(p, e.target.value);
                                                                    }
                                                                }}
                                                                style={{
                                                                    background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.2)',
                                                                    color: '#fff', fontSize: '0.75rem', padding: '6px',
                                                                    borderRadius: '6px', width: '100%', fontWeight: 700,
                                                                    outline: 'none', cursor: 'pointer'
                                                                }}
                                                            >
                                                                <option value="Unassigned" style={{ background: '#0a0a0a', color: '#fff' }}>Unassigned</option>
                                                                {allSlots.map(slotName => (
                                                                    <option key={slotName} value={slotName} style={{ background: '#0a0a0a', color: '#fff' }}>
                                                                        {slotName.toUpperCase()}
                                                                    </option>
                                                                ))}
                                                                <option value="+ New Slot" style={{ background: '#0a0a0a', color: 'var(--primary)', fontWeight: 800 }}>+ NEW SLOT</option>
                                                            </select>
                                                        )}
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
                                                            {/* Status Badge */}
                                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                {p.auction_status === 'sold' && (
                                                                    <div style={{ background: 'rgba(0, 255, 128, 0.1)', color: '#00ff80', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 950 }}>SOLD</div>
                                                                )}
                                                                {p.auction_status === 'active' && (
                                                                    <div style={{ background: 'rgba(255, 215, 0, 0.1)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 950, border: '1px solid var(--primary)' }}>LIVE</div>
                                                                )}
                                                                {p.auction_status === 'unsold' && (
                                                                    <div style={{ background: 'rgba(255, 75, 75, 0.1)', color: '#ff4b4b', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 950 }}>UNSOLD</div>
                                                                )}
                                                                {p.auction_status === 'pending' && (
                                                                    <div style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#666', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 950 }}>PENDING</div>
                                                                )}
                                                            </div>

                                                            {/* Team Assignment Dropdown */}
                                                            <select
                                                                value={p.team_id || ''}
                                                                onChange={(e) => manualAssignTeam(p.id, e.target.value)}
                                                                style={{
                                                                    background: '#0a0a0a',
                                                                    border: p.team_id ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                                                                    color: p.team_id ? '#fff' : '#666',
                                                                    fontSize: '0.7rem',
                                                                    padding: '5px',
                                                                    borderRadius: '6px',
                                                                    width: '130px',
                                                                    fontWeight: 700,
                                                                    outline: 'none',
                                                                    cursor: 'pointer',
                                                                    textAlign: 'center'
                                                                }}
                                                            >
                                                                <option value="" style={{ color: '#666' }}>-- Assign Team --</option>
                                                                {teams.map(t => (
                                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <button onClick={async () => {
                                                            if (confirm('Delete player?')) {
                                                                const res = await fetch(`/api/admin/delete-player?id=${p.id}`, { method: 'DELETE' });
                                                                if (res.ok) fetchData();
                                                            }
                                                        }} style={{ color: '#ff4b4b', opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer' }}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ));
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Dashboard is focused on Card Slots now */}
                            <div className="glass" style={{ padding: '30px', textAlign: 'center', background: 'rgba(255,215,0,0.02)', border: '1px dashed var(--primary)' }}>
                                <div style={{ color: 'var(--primary)', fontWeight: 950, letterSpacing: '2px', fontSize: '0.8rem', marginBottom: '10px' }}>SYSTEM READY</div>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 950 }}>CARD FLIP MODE ACTIVE</h2>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '10px' }}>Manage your auction slots using the controls on the left.</p>
                            </div>
                    </div>
                </div>

                    {/* FULL TOURNAMENT STATISTICS (ADMIN ONLY) */}
                    <div style={{ marginTop: '60px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
                            <div style={{ padding: '12px', background: 'rgba(255,215,0,0.1)', borderRadius: '15px' }}>
                                <Trophy size={24} color="var(--primary)" />
                            </div>
                            <h2 style={{ fontSize: '1.8rem', fontWeight: 950, letterSpacing: '1px', margin: 0 }}>FULL TOURNAMENT STATISTICS</h2>
                        </div>

                        <div className="glass" style={{ borderRadius: '30px', overflow: 'hidden', padding: 0 }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '20px 30px', color: 'var(--primary)', fontWeight: 900, fontSize: '0.8rem', letterSpacing: '2px' }}>PLAYER</th>
                                            <th style={{ padding: '20px 20px', color: 'var(--primary)', fontWeight: 900, fontSize: '0.8rem', letterSpacing: '2px' }}>TEAM</th>
                                            <th style={{ padding: '20px 20px', color: 'var(--primary)', fontWeight: 900, fontSize: '0.8rem', letterSpacing: '2px', textAlign: 'center' }}>RUNS</th>
                                            <th style={{ padding: '20px 20px', color: 'var(--primary)', fontWeight: 900, fontSize: '0.8rem', letterSpacing: '2px', textAlign: 'center' }}>WKTS</th>
                                            <th style={{ padding: '20px 30px', color: 'var(--primary)', fontWeight: 900, fontSize: '0.8rem', letterSpacing: '2px', textAlign: 'right' }}>POT TOTAL (RUNS + WKTS * 25)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tournamentStats.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No statistics available yet.</td>
                                            </tr>
                                        ) : [...tournamentStats].sort((a,b) => (b.pot_score || 0) - (a.pot_score || 0)).map((s, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '15px 30px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                        <div style={{ width: '35px', height: '35px', borderRadius: '10px', background: '#111', overflow: 'hidden' }}>
                                                            <img 
                                                                src={fixPhotoUrl(s.photo_url || s.photo, s.first_name)} 
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                                alt="" 
                                                                onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.first_name}`; }}
                                                            />
                                                        </div>
                                                        <div style={{ fontWeight: 800 }}>{s.first_name} {s.last_name}</div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '15px 20px' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#aaa' }}>{s.team_name?.toUpperCase() || 'NO TEAM'}</span>
                                                </td>
                                                <td style={{ padding: '15px 20px', textAlign: 'center', fontWeight: 900, color: 'var(--primary)' }}>{s.total_runs || 0}</td>
                                                <td style={{ padding: '15px 20px', textAlign: 'center', fontWeight: 900, color: '#00ff80' }}>{s.total_wickets || 0}</td>
                                                <td style={{ padding: '15px 30px', textAlign: 'right', fontWeight: 950 }}>
                                                    <span style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>{Math.round(Number(s.total_runs || 0) + (Number(s.total_wickets || 0) * 25))}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                </AnimatePresence>
            </main>
            <style jsx>{`
                .admin-grid { display: grid; grid-template-columns: 1fr 400px; gap: 25px; }
                @media (max-width: 1100px) { .admin-grid { grid-template-columns: 1fr; } }
                .admin-photo-container { 
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: 1;
                }
                .admin-photo-container:hover { 
                    transform: scale(2.5);
                    z-index: 100;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.8);
                    border-color: var(--primary) !important;
                    border-radius: 8px !important;
                }
                .admin-photo {
                    transition: transform 0.3s ease;
                }
                .admin-photo-container:hover .admin-photo {
                    transform: scale(1.1);
                }
            `}</style>
        </>
    );
}
