'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import RoleGuard from '@/components/RoleGuard';
import { fixPhotoUrl } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Gavel,
    Users,
    ChevronRight,
    RotateCcw,
    Search,
    Loader2,
    Award,
    Hammer,
    Zap,
    History
} from 'lucide-react';
import { getPurplePushp, getNextBid, MAX_SQUAD_SIZE } from '@/lib/auction-logic';

const TEAM_ORDER = [
    'SHAURYAM',
    'DIVYAM',
    'SATYAM',
    'DASHATYAM',
    'DHAIRYAM',
    'GYANAM',
    'AISHWARYAM',
    'ASTIKAYAM'
];

function TimeSince({ dateString }: { dateString: string }) {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const ms = now.getTime() - new Date(dateString).getTime();
    if (ms < 0) return <span>Just now</span>;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    let text = '';
    if (hours > 0) text = `${hours}h ${minutes % 60}m ago`;
    else if (minutes > 0) text = `${minutes}m ${seconds % 60}s ago`;
    else text = `${seconds}s ago`;

    return <span style={{ color: 'var(--primary)', fontSize: '0.85rem', marginLeft: '8px' }}>({text})</span>;
}

export default function AdminAuctionPage() {
    return (
        <RoleGuard allowedRole="admin">
            <AdminAuctionContent />
        </RoleGuard>
    );
}

function AdminAuctionContent() {
    const [players, setPlayers] = useState<any[]>([]);
    const [auctionState, setAuctionState] = useState<any>(null);
    const [teams, setTeams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showPlayerSelect, setShowPlayerSelect] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSoldAnimating, setIsSoldAnimating] = useState(false);
    const [recentBids, setRecentBids] = useState<any[]>([]);
    const currentPlayerIdRef = useRef<string | null>(null);
    const [bidCooldowns, setBidCooldowns] = useState<Record<string, boolean>>({});
    const [bidToast, setBidToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string>('All');

    const fetchRecentBids = async (playerId: string) => {
        if (!playerId) {
            setRecentBids([]);
            return;
        }
        const { data } = await supabase
            .from('bids')
            .select('*')
            .eq('player_id', playerId)
            .order('created_at', { ascending: false })
            .limit(5);
        if (data) setRecentBids(data);
    };

    const fetchData = async () => {
        try {
            const [playersRes, stateRes, teamsRes] = await Promise.all([
                supabase.from('players').select('*').order('created_at', { ascending: false }),
                supabase.from('auction_state').select('*').single(),
                supabase.from('teams').select('*').order('name')
            ]);

            if (playersRes.data) setPlayers(playersRes.data);
            if (stateRes.data) {
                setAuctionState(stateRes.data);
                currentPlayerIdRef.current = stateRes.data.current_player_id;
                fetchRecentBids(stateRes.data.current_player_id);
            }
            if (teamsRes.data) {
                // Fetch squad counts for each team
                const teamsWithSquadCount = await Promise.all(teamsRes.data.map(async (t: any) => {
                    const { count } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('team_id', t.id).eq('auction_status', 'sold');
                    return { ...t, squad_count: count || 0 };
                }));

                // Sort by fixed TEAM_ORDER
                const sortedTeams = [...teamsWithSquadCount].sort((a, b) => {
                    return TEAM_ORDER.indexOf(a.name) - TEAM_ORDER.indexOf(b.name);
                });

                setTeams(sortedTeams);
            }
        } catch (err) {
            console.error('Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const stateSub = supabase.channel('admin_auction_realtime_v3')
            .on('postgres_changes', { event: '*', table: 'auction_state', schema: 'public' }, (p: any) => {
                setAuctionState(p.new);
                if ((p.new as any).status === 'SOLD') {
                    setIsSoldAnimating(true);
                    setTimeout(() => setIsSoldAnimating(false), 3000);
                }
                if (p.new.current_player_id) {
                    currentPlayerIdRef.current = p.new.current_player_id;
                    fetchRecentBids(p.new.current_player_id);
                }
            })
            .on('postgres_changes', { event: 'INSERT', table: 'bids', schema: 'public' }, (payload: any) => {
                // Use ref to avoid stale closure
                if (currentPlayerIdRef.current && payload.new.player_id === currentPlayerIdRef.current) {
                    fetchRecentBids(payload.new.player_id);
                }
            })
            .on('postgres_changes', { event: '*', table: 'players', schema: 'public' }, () => fetchData())
            .on('postgres_changes', { event: '*', table: 'teams', schema: 'public' }, () => fetchData())
            .subscribe();

        return () => { supabase.removeChannel(stateSub); };
    }, []);

    const handleAction = async (action: string, payload: any = {}) => {
        setActionLoading(true);
        try {
            let url = '/api/auction/v3/control';
            if (action === 'sell') url = '/api/auction/v3/sell';

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...payload })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Action failed');

            if (action === 'start') setShowPlayerSelect(false);
            fetchData();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // === ADMIN TEAM BIDDING ===
    const handleTeamBid = async (teamId: string) => {
        if (bidCooldowns[teamId] || actionLoading || auctionState?.status !== 'BIDDING') return;

        const team = teams.find(t => t.id === teamId);
        if (!team) return;

        const nextBid = getNextBid(auctionState.current_highest_bid || 0);

        // Purse safety check
        if (team.remaining_budget < nextBid) {
            setBidToast({ message: "Insufficient purse for this bid", type: 'error' });
            setTimeout(() => setBidToast(null), 3000);
            return;
        }

        // Squad full check
        if (team.squad_count >= MAX_SQUAD_SIZE) {
            setBidToast({ message: `${team.name} squad is full (${MAX_SQUAD_SIZE}/${MAX_SQUAD_SIZE})`, type: 'error' });
            setTimeout(() => setBidToast(null), 3000);
            return;
        }

        // Double click protection — cooldown per team
        setBidCooldowns(prev => ({ ...prev, [teamId]: true }));
        setTimeout(() => setBidCooldowns(prev => ({ ...prev, [teamId]: false })), 1500);

        try {
            const res = await fetch('/api/auction/v3/bid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team_id: teamId })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Bid failed');

            setBidToast({ message: `${team.name} bid ${nextBid} Pushp ✓`, type: 'success' });
            setTimeout(() => setBidToast(null), 2500);
            fetchData();
        } catch (err: any) {
            setBidToast({ message: err.message, type: 'error' });
            setTimeout(() => setBidToast(null), 3000);
        }
    };

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>
            <Loader2 className="animate-spin" size={48} color="var(--primary)" />
        </div>
    );

    const currentPlayer = players.find(p => p.id === auctionState?.current_player_id);
    const winningTeam = teams.find(t => t.id === auctionState?.highest_bid_team_id);

    // Support Slots and Re-Auction Pool
    const poolPlayers = selectedSlot === 'Re-Auction'
        ? players.filter(p => p.auction_status === 'unsold')
        : selectedSlot === 'All'
            ? players.filter(p => p.auction_status === 'pending')
            : players.filter(p => p.auction_status === 'pending' && p.category === selectedSlot);

    const filteredPlayers = poolPlayers.filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()));

    const formatPushp = (amount: number) => {
        const purple = getPurplePushp(amount);
        return `${amount.toLocaleString()} Pushp${purple ? ` (${purple} Purple Pushp)` : ''}`;
    };

    return (
        <main style={{ minHeight: '100vh', background: '#050505', color: '#fff', paddingBottom: '100px' }}>
            <div className="container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
                <div style={{ padding: '30px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-1px' }}>
                            <span style={{ color: 'var(--primary)' }}>AUCTION</span> CONSOLE
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Official Tournament Bidding Engine</p>
                    </div>
                    <button onClick={() => handleAction('reset')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}>
                        <RotateCcw size={18} /> RESET
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 450px', gap: '40px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                        {currentPlayer ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass" style={{ padding: '40px', borderRadius: '30px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,215,0,0.1)', position: 'relative' }}>
                                <div style={{ position: 'absolute', top: '30px', right: '30px', zIndex: 10 }}>
                                    <div style={{ padding: '5px 12px', borderRadius: '50px', background: 'var(--primary)', color: '#000', fontWeight: 900, fontSize: '0.75rem' }}>
                                        {auctionState?.bidding_status || 'PENDING'}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '40px' }}>
                                    <div style={{ width: '300px', height: '380px', borderRadius: '24px', overflow: 'hidden', border: '2px solid var(--primary)', background: '#111' }}>
                                        <img
                                            src={fixPhotoUrl(currentPlayer.photo_url, currentPlayer.first_name)}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            alt=""
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentPlayer.first_name}`;
                                            }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h2 style={{ fontSize: '4rem', fontWeight: 950, lineHeight: 1, marginBottom: '20px' }}>{currentPlayer.first_name} <span style={{ color: 'var(--primary)' }}>{currentPlayer.last_name}</span></h2>
                                        <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
                                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 20px', borderRadius: '12px', fontSize: '1rem', fontWeight: 800 }}>{currentPlayer.cricket_skill}</div>
                                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 20px', borderRadius: '12px', fontSize: '1rem', fontWeight: 800 }}>KC3: {currentPlayer.was_present_kc3}</div>
                                        </div>
                                        <div style={{ background: 'rgba(0,0,0,0.4)', padding: '30px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 900, letterSpacing: '1px' }}>CURRENT BID</div>
                                            <div style={{ fontSize: '4rem', fontWeight: 950 }}>{formatPushp(auctionState?.current_highest_bid || 0)}</div>
                                            {winningTeam && <div style={{ marginTop: '10px', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-muted)' }}>Highest Bidder: <span style={{ color: 'var(--primary)' }}>{winningTeam.name}</span></div>}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px' }}>
                                    <button onClick={() => handleAction('status_update', { bidding_status: 'GOING ONCE' })} className="btn-secondary" style={{ padding: '15px', fontWeight: 900 }}>GOING ONCE</button>
                                    <button onClick={() => handleAction('status_update', { bidding_status: 'GOING TWICE' })} className="btn-secondary" style={{ padding: '15px', fontWeight: 900 }}>GOING TWICE</button>
                                    <button onClick={() => handleAction('sell', { player_id: currentPlayer.id })} disabled={!winningTeam} className="btn-primary" style={{ padding: '15px', fontWeight: 950, fontSize: '1.1rem' }}>🔨 SOLD</button>
                                    <button onClick={() => handleAction('unsold', { player_id: currentPlayer.id })} className="btn-secondary" style={{ padding: '15px', fontWeight: 900, color: '#ff4b4b' }}>UNSOLD</button>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="glass" style={{ height: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '30px' }}>
                                <Hammer size={100} style={{ opacity: 0.1, marginBottom: '20px' }} />
                                <button onClick={() => setShowPlayerSelect(true)} className="btn-primary" style={{ padding: '15px 50px', fontSize: '1.2rem', fontWeight: 900 }}>SELECT NEXT PLAYER</button>
                            </div>
                        )}

                        {/* === TEAM BIDDING PANEL === */}
                        {currentPlayer && auctionState?.status === 'BIDDING' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    background: 'rgba(255,215,0,0.03)',
                                    borderRadius: '25px',
                                    padding: '25px',
                                    border: '2px solid rgba(255,215,0,0.15)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Gavel size={20} color="var(--primary)" />
                                        <span style={{ fontSize: '1rem', fontWeight: 950, color: 'var(--primary)', letterSpacing: '2px' }}>PLACE BID FOR TEAM</span>
                                    </div>
                                    <div style={{ padding: '6px 16px', borderRadius: '50px', background: 'rgba(255,215,0,0.15)', fontSize: '0.85rem', fontWeight: 900, color: 'var(--primary)' }}>
                                        NEXT BID: {getNextBid(auctionState.current_highest_bid || 0)} P
                                    </div>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '12px',
                                    justifyContent: 'center'
                                }}>
                                    {teams.map(t => {
                                        const nextBid = getNextBid(auctionState.current_highest_bid || 0);
                                        const isInsufficient = t.remaining_budget < nextBid;
                                        const isSquadFull = t.squad_count >= MAX_SQUAD_SIZE;
                                        const isCoolingDown = bidCooldowns[t.id];
                                        const isLeading = auctionState.highest_bid_team_id === t.id;
                                        const isDisabled = isInsufficient || isSquadFull || isCoolingDown || isLeading;

                                        return (
                                            <button
                                                key={t.id}
                                                onClick={() => handleTeamBid(t.id)}
                                                disabled={isDisabled}
                                                style={{
                                                    flex: '1 1 200px',
                                                    minWidth: '200px',
                                                    maxWidth: '280px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '16px 12px',
                                                    borderRadius: '16px',
                                                    background: isLeading
                                                        ? 'rgba(0,255,128,0.15)'
                                                        : isDisabled
                                                            ? 'rgba(255,255,255,0.02)'
                                                            : 'rgba(255,215,0,0.08)',
                                                    border: isLeading
                                                        ? '2px solid rgba(0,255,128,0.4)'
                                                        : isDisabled
                                                            ? '1px solid rgba(255,255,255,0.05)'
                                                            : '1px solid rgba(255,215,0,0.2)',
                                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    opacity: isDisabled && !isLeading ? 0.4 : 1,
                                                    color: '#fff',
                                                    boxShadow: isLeading ? '0 0 20px rgba(0,255,128,0.2)' : 'none'
                                                }}
                                                className="team-bid-card"
                                            >
                                                <div style={{ fontSize: '0.9rem', fontWeight: 950, letterSpacing: '0.5px', color: isLeading ? '#00ff80' : 'var(--primary)', textAlign: 'center' }}>
                                                    {t.name}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                                                    {t.remaining_budget} P · {t.squad_count}/{MAX_SQUAD_SIZE}
                                                </div>
                                                <div style={{
                                                    marginTop: '4px',
                                                    width: '100%',
                                                    padding: '8px',
                                                    borderRadius: '10px',
                                                    background: isLeading
                                                        ? 'rgba(0,255,128,0.2)'
                                                        : isDisabled
                                                            ? 'rgba(255,255,255,0.05)'
                                                            : 'var(--primary)',
                                                    color: isLeading ? '#00ff80' : isDisabled ? 'rgba(255,255,255,0.3)' : '#000',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 950,
                                                    textTransform: 'uppercase',
                                                    textAlign: 'center'
                                                }}>
                                                    {isLeading ? '✓ LEADING' : isSquadFull ? 'FULL' : isInsufficient ? 'NO PURSE' : isCoolingDown ? '...' : 'BID'}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </div>


                    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', position: 'sticky', top: '20px', alignSelf: 'start' }}>
                        {/* LIVE BID STATUS PANEL */}
                        <div className="glass" style={{ padding: '25px', borderRadius: '25px', border: '2px solid var(--primary)', background: 'rgba(255, 215, 0, 0.03)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 950, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                                    <Zap size={20} fill="var(--primary)" /> LIVE BID STATUS
                                </h3>
                                <div style={{
                                    padding: '5px 12px',
                                    borderRadius: '50px',
                                    background: auctionState?.status === 'BIDDING' ? '#00ff80' : auctionState?.status === 'SOLD' ? '#ff4b4b' : '#666',
                                    color: '#000',
                                    fontSize: '0.7rem',
                                    fontWeight: 900,
                                    textTransform: 'uppercase'
                                }}>
                                    {auctionState?.status === 'BIDDING' ? 'Live Auction' : auctionState?.status === 'SOLD' ? 'SOLD' : 'Paused'}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '5px' }}>PLAYER</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>
                                        {currentPlayer ? `${currentPlayer.first_name} ${currentPlayer.last_name}` : 'No Active Player'}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '5px' }}>HIGHEST BID</div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 950, color: 'var(--primary)' }}>
                                            {auctionState?.current_highest_bid || 0} P
                                        </div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '5px' }}>LAST BID TIME</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 800 }}>
                                            {recentBids[0] ? (
                                                <>
                                                    {new Date(recentBids[0].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    <TimeSince dateString={recentBids[0].created_at} />
                                                </>
                                            ) : '--:--'}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '5px' }}>CURRENT LEADER</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: winningTeam ? '#00ff80' : '#fff' }}>
                                        {winningTeam?.name || 'Waiting for Bids...'}
                                    </div>
                                </div>

                                {/* RECENT BIDS */}
                                <div style={{ marginTop: '10px' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 900, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <History size={16} /> RECENT BIDS
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {recentBids.length > 0 ? recentBids.map((bid, i) => {
                                            const team = teams.find(t => t.id === bid.team_id);
                                            return (
                                                <div key={i} style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '10px 15px',
                                                    background: i === 0 ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255,255,255,0.02)',
                                                    borderRadius: '10px',
                                                    border: i === 0 ? '1px solid rgba(255, 215, 0, 0.2)' : '1px solid transparent'
                                                }}>
                                                    <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{team?.name || 'Unknown'}</span>
                                                    <span style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '1rem' }}>{bid.amount} P</span>
                                                </div>
                                            );
                                        }) : (
                                            <div style={{ textAlign: 'center', padding: '10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No bids yet</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="glass" style={{ padding: '25px', borderRadius: '25px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Award size={20} color="var(--primary)" /> LEADERBOARD (9 SQUAD LIMIT)
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {teams.map(t => (
                                    <div key={t.id} style={{ padding: '15px', borderRadius: '15px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 800 }}>{t.name}</span>
                                            <span style={{ fontWeight: 900, color: 'var(--primary)' }}>{t.remaining_budget} P</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                                            <span>Squad Size: {t.squad_count} / {MAX_SQUAD_SIZE}</span>
                                            <span>{(t.squad_count / 9 * 100).toFixed(0)}% Full</span>
                                        </div>
                                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                                            <div style={{ width: `${(t.squad_count / 9) * 100}%`, height: '100%', background: t.squad_count >= 9 ? '#ff4b4b' : 'var(--primary)' }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SOLD OVERLAY */}
            <AnimatePresence>
                {isSoldAnimating && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,255,128,0.2)', backdropFilter: 'blur(20px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <motion.div initial={{ scale: 0.5, y: 50 }} animate={{ scale: 1, y: 0 }} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '12rem' }}>🔨</div>
                            <h2 style={{ fontSize: '8rem', fontWeight: 950, color: '#fff', textShadow: '0 0 50px rgba(0,255,128,0.8)' }}>SOLD</h2>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PLAYER SELECT DRAWER */}
            <AnimatePresence>
                {showPlayerSelect && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPlayerSelect(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, backdropFilter: 'blur(10px)' }} />
                        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: '500px', background: '#0a0a0a', zIndex: 1001, padding: '40px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                                <h2 style={{ fontSize: '1.8rem', fontWeight: 950 }}>SELECT PLAYER</h2>
                                <button
                                    onClick={() => {
                                        if (poolPlayers.length === 0) {
                                            alert('No players left in this category!');
                                            return;
                                        }
                                        const random = poolPlayers[Math.floor(Math.random() * poolPlayers.length)];
                                        handleAction('start', { player_id: random.id });
                                        setShowPlayerSelect(false);
                                    }}
                                    className="btn-primary"
                                    style={{ padding: '8px 15px', fontSize: '0.7rem', borderRadius: '8px' }}
                                >
                                    🎲 RANDOM
                                </button>
                            </div>

                            <div style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '1px' }}>CHOOSE SLOT / POOL</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {['All', ...Array.from(new Set(players.map(p => p.category || 'Unassigned'))), 'Re-Auction'].map(slot => (
                                        <button
                                            key={slot}
                                            onClick={() => setSelectedSlot(slot)}
                                            style={{
                                                padding: '6px 14px',
                                                borderRadius: '10px',
                                                fontSize: '0.7rem',
                                                fontWeight: 800,
                                                background: selectedSlot === slot ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                                color: selectedSlot === slot ? '#000' : '#fff',
                                                border: '1px solid transparent',
                                            }}
                                        >
                                            {slot} ({
                                                slot === 'Re-Auction'
                                                    ? players.filter(p => p.auction_status === 'unsold').length
                                                    : players.filter(p => (slot === 'All' || p.category === slot) && p.auction_status === 'pending').length
                                            })
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ position: 'relative', marginBottom: '30px' }}>
                                <Search style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                                <input type="text" placeholder="Search player..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '15px 15px 15px 50px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: 'calc(100vh - 350px)', overflowY: 'auto' }}>
                                {filteredPlayers.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '50px 0', opacity: 0.5, fontSize: '0.9rem' }}>
                                        No players in this category.
                                    </div>
                                ) : filteredPlayers.map(p => (
                                    <div key={p.id} onClick={() => handleAction('start', { player_id: p.id })} style={{ padding: '12px', borderRadius: '15px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', border: '1px solid transparent' }} className="select-card">
                                        <div style={{ width: '45px', height: '45px', borderRadius: '10px', overflow: 'hidden' }}><img src={fixPhotoUrl(p.photo_url, p.first_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`; }} /></div>
                                        <div style={{ flex: 1 }}><div style={{ fontWeight: 800 }}>{p.first_name} {p.last_name}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.cricket_skill}</div></div>
                                        <ChevronRight size={18} color="var(--primary)" />
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            <style jsx>{`
                .btn-primary:active { transform: scale(0.98); }
                .select-card:hover { border-color: var(--primary); background: rgba(255,215,0,0.05) !important; }
                .team-bid-card:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255,215,0,0.15); }
                .team-bid-card:active:not(:disabled) { transform: scale(0.96); }
                @media (max-width: 1100px) {
                    .container { padding: 0 10px !important; }
                }
            `}</style>

            {/* BID TOAST NOTIFICATION */}
            <AnimatePresence>
                {bidToast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        style={{
                            position: 'fixed',
                            bottom: '30px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            padding: '16px 40px',
                            borderRadius: '50px',
                            background: bidToast.type === 'success' ? 'rgba(0,255,128,0.95)' : 'rgba(255,75,75,0.95)',
                            color: bidToast.type === 'success' ? '#000' : '#fff',
                            fontWeight: 900,
                            fontSize: '1rem',
                            zIndex: 9000,
                            boxShadow: bidToast.type === 'success' ? '0 10px 40px rgba(0,255,128,0.4)' : '0 10px 40px rgba(255,75,75,0.4)',
                            backdropFilter: 'blur(10px)'
                        }}
                    >
                        {bidToast.message}
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
