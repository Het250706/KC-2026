'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import RoleGuard from '@/components/RoleGuard';
import { useAuth } from '@/components/AuthProvider';
import { fixPhotoUrl } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Gavel,
    Loader2,
    Eye,
    History,
} from 'lucide-react';
import { getPurplePushp, MAX_SQUAD_SIZE } from '@/lib/auction-logic';

export default function CaptainAuctionPage() {
    return (
        <RoleGuard allowedRole="captain">
            <CaptainAuctionContent />
        </RoleGuard>
    );
}

function CaptainAuctionContent() {
    const { user } = useAuth();
    const [myTeam, setMyTeam] = useState<any>(null);
    const [mySquadCount, setMySquadCount] = useState(0);
    const [auctionState, setAuctionState] = useState<any>(null);
    const [currentPlayer, setCurrentPlayer] = useState<any>(null);
    const [highestBidTeam, setHighestBidTeam] = useState<any>(null);
    const [bidHistory, setBidHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const currentPlayerIdRef = useRef<string | null>(null);

    const fetchBidHistory = async (playerId: string) => {
        if (!playerId) { setBidHistory([]); return; }
        const { data } = await supabase
            .from('bids')
            .select('*, teams(name)')
            .eq('player_id', playerId)
            .order('created_at', { ascending: false })
            .limit(10);
        if (data) setBidHistory(data);
    };

    const fetchData = async () => {
        if (!user?.email) return;

        try {
            // Get My Team
            const { data: teamData } = await supabase
                .from('teams')
                .select('*')
                .eq('captain_email', user.email)
                .single();
            if (teamData) {
                setMyTeam(teamData);
                const { count } = await supabase
                    .from('players')
                    .select('*', { count: 'exact', head: true })
                    .eq('team_id', teamData.id)
                    .eq('auction_status', 'sold');
                setMySquadCount(count || 0);
            }

            // Get State
            const { data: stateData } = await supabase
                .from('auction_state')
                .select('*')
                .single();

            if (stateData) {
                setAuctionState(stateData);
                currentPlayerIdRef.current = stateData.current_player_id;

                // Get Current Player if active
                if (stateData.current_player_id && (!currentPlayer || currentPlayer.id !== stateData.current_player_id)) {
                    const { data: playerData } = await supabase
                        .from('players')
                        .select('*')
                        .eq('id', stateData.current_player_id)
                        .single();
                    setCurrentPlayer(playerData);
                } else if (!stateData.current_player_id) {
                    setCurrentPlayer(null);
                }

                // Get Highest Bid Team
                if (stateData.highest_bid_team_id) {
                    const { data: teamBidData } = await supabase
                        .from('teams')
                        .select('name')
                        .eq('id', stateData.highest_bid_team_id)
                        .single();
                    setHighestBidTeam(teamBidData);
                } else {
                    setHighestBidTeam(null);
                }

                // Fetch bid history
                if (stateData.current_player_id) {
                    fetchBidHistory(stateData.current_player_id);
                }
            }
        } catch (err) {
            console.error('Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const stateSub = supabase.channel('captain_auction_readonly')
            .on('postgres_changes', { event: '*', table: 'auction_state', schema: 'public' }, () => fetchData())
            .on('postgres_changes', { event: '*', table: 'teams', schema: 'public' }, (p: any) => {
                if (p.new && (p.new as any).captain_email === user?.email) fetchData();
            })
            .on('postgres_changes', { event: '*', table: 'players', schema: 'public' }, () => fetchData())
            .on('postgres_changes', { event: 'INSERT', table: 'bids', schema: 'public' }, () => {
                if (currentPlayerIdRef.current) fetchBidHistory(currentPlayerIdRef.current);
            })
            .subscribe();

        return () => { supabase.removeChannel(stateSub); };
    }, [user?.email]);

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>
            <Loader2 className="animate-spin" size={48} color="var(--primary)" />
        </div>
    );

    const formatPushp = (amount: number) => {
        const purple = getPurplePushp(amount);
        return `${amount.toLocaleString()} Pushp${purple ? ` (${purple} Purple Pushp)` : ''}`;
    };

    return (
        <main style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', paddingBottom: '40px' }}>
            <div className="container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>

                {/* Team Info Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px 30px',
                    background: 'rgba(255,215,0,0.05)',
                    borderRadius: '20px',
                    border: '1px solid rgba(255,215,0,0.1)',
                    marginBottom: '30px'
                }}>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 900, letterSpacing: '2px' }}>TEAM PORTAL</div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 900 }}>{myTeam?.name || 'CAPTAIN DASHBOARD'}</h1>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Squad: {mySquadCount} / {MAX_SQUAD_SIZE}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>REMAINING PURSE</div>
                        <motion.div
                            key={myTeam?.remaining_budget}
                            initial={{ scale: 1.1, color: '#fff' }}
                            animate={{ scale: 1, color: 'var(--primary)' }}
                            style={{ fontSize: '2rem', fontWeight: 950 }}
                        >
                            {myTeam?.remaining_budget || 0} P
                        </motion.div>
                    </div>
                </div>

                {/* READ-ONLY LIVE AUCTION BADGE */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '10px 20px',
                    background: 'rgba(0,210,255,0.08)',
                    borderRadius: '50px',
                    border: '1px solid rgba(0,210,255,0.2)',
                    marginBottom: '30px',
                    width: 'fit-content',
                    margin: '0 auto 30px'
                }}>
                    <Eye size={16} color="#00d2ff" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#00d2ff', letterSpacing: '2px' }}>LIVE AUCTION VIEW — ADMIN CONTROLLED BIDDING</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '30px' }}>
                    {/* LEFT — Player + Bid Info */}
                    <div>
                        <AnimatePresence mode="wait">
                            {auctionState?.status === 'BIDDING' && currentPlayer ? (
                                <motion.div
                                    key={currentPlayer.id}
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 1.05, y: -20 }}
                                >
                                    {/* Player Card */}
                                    <div className="glass" style={{ padding: '30px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '30px' }}>
                                        <div style={{ display: 'flex', gap: '40px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <div style={{ width: '220px', height: '260px', borderRadius: '25px', overflow: 'hidden', border: '3px solid var(--primary)', background: '#111', boxShadow: '0 0 30px rgba(255,215,0,0.1)' }}>
                                                <img
                                                    src={fixPhotoUrl(currentPlayer.photo_url, currentPlayer.first_name)}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    alt=""
                                                    onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentPlayer.first_name}`; }}
                                                />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h2 style={{ fontSize: '3rem', fontWeight: 950, lineHeight: 1, marginBottom: '15px', color: '#fff' }}>
                                                    {currentPlayer.first_name} {currentPlayer.last_name}
                                                </h2>
                                                <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
                                                    <div style={{ padding: '8px 20px', borderRadius: '12px', background: 'rgba(255,215,0,0.1)', color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 900, border: '1px solid rgba(255,215,0,0.2)' }}>
                                                        {currentPlayer.cricket_skill}
                                                    </div>
                                                    <div style={{ padding: '8px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', fontSize: '0.9rem', fontWeight: 800 }}>
                                                        KC3: {currentPlayer.was_present_kc3}
                                                    </div>
                                                    <div style={{ padding: '8px 20px', borderRadius: '12px', background: 'rgba(255,215,0,0.1)', color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 900, border: '1px solid rgba(255,215,0,0.2)' }}>
                                                        BASE: {currentPlayer.base_price} P
                                                    </div>
                                                </div>

                                                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '25px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 900, letterSpacing: '1px' }}>CURRENT BID</div>
                                                        <motion.div
                                                            key={auctionState.current_highest_bid}
                                                            initial={{ scale: 1.1 }}
                                                            animate={{ scale: 1 }}
                                                            style={{ fontSize: '3rem', fontWeight: 950, color: '#fff' }}
                                                        >
                                                            {formatPushp(auctionState.current_highest_bid || 0)}
                                                        </motion.div>
                                                    </div>
                                                    {highestBidTeam && (
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800 }}>HIGHEST BIDDER</div>
                                                            <div style={{ fontSize: '1.6rem', fontWeight: 950, color: 'var(--primary)' }}>{highestBidTeam.name}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Auction Status Badge */}
                                    {auctionState?.bidding_status && auctionState.bidding_status !== 'BIDDING OPEN' && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            style={{
                                                textAlign: 'center',
                                                padding: '15px',
                                                background: auctionState.bidding_status === 'GOING ONCE' ? 'rgba(255,165,0,0.15)' : 'rgba(255,75,75,0.15)',
                                                borderRadius: '15px',
                                                border: `1px solid ${auctionState.bidding_status === 'GOING ONCE' ? 'rgba(255,165,0,0.3)' : 'rgba(255,75,75,0.3)'}`,
                                                fontSize: '1.5rem',
                                                fontWeight: 950,
                                                color: auctionState.bidding_status === 'GOING ONCE' ? '#ffa500' : '#ff4b4b',
                                                letterSpacing: '4px'
                                            }}
                                        >
                                            ⚡ {auctionState.bidding_status}
                                        </motion.div>
                                    )}
                                </motion.div>
                            ) : auctionState?.status === 'SOLD' && currentPlayer ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    style={{
                                        padding: '60px 20px',
                                        textAlign: 'center',
                                        background: 'rgba(0,255,128,0.05)',
                                        borderRadius: '30px',
                                        border: '1px solid rgba(0,255,128,0.2)'
                                    }}
                                >
                                    <div style={{ fontSize: '6rem', marginBottom: '10px' }}>🔨</div>
                                    <h2 style={{ fontSize: '3rem', fontWeight: 950, color: '#00ff80', marginBottom: '10px' }}>SOLD!</h2>
                                    <p style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                                        {currentPlayer.first_name} {currentPlayer.last_name} — {auctionState.current_highest_bid} Pushp
                                    </p>
                                    {highestBidTeam && (
                                        <p style={{ fontSize: '1.5rem', fontWeight: 950, color: 'var(--primary)', marginTop: '5px' }}>
                                            → {highestBidTeam.name}
                                        </p>
                                    )}
                                </motion.div>
                            ) : auctionState?.status === 'UNSOLD' && currentPlayer ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    style={{
                                        padding: '60px 20px',
                                        textAlign: 'center',
                                        background: 'rgba(255,75,75,0.05)',
                                        borderRadius: '30px',
                                        border: '1px solid rgba(255,75,75,0.2)'
                                    }}
                                >
                                    <div style={{ fontSize: '4rem', marginBottom: '10px' }}>❌</div>
                                    <h2 style={{ fontSize: '2.5rem', fontWeight: 950, color: '#ff4b4b' }}>UNSOLD</h2>
                                    <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: '10px' }}>
                                        {currentPlayer.first_name} {currentPlayer.last_name} goes unsold
                                    </p>
                                </motion.div>
                            ) : (
                                <div style={{ padding: '100px 20px', textAlign: 'center', opacity: 0.5 }}>
                                    <Gavel size={60} style={{ margin: '0 auto 20px' }} />
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>AUCTION IDLE</h2>
                                    <p>Admin is preparing the next player.</p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* RIGHT — Bid History */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="glass" style={{ padding: '20px', borderRadius: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                                <History size={16} color="var(--primary)" />
                                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '1px' }}>LIVE BID HISTORY</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {bidHistory.length > 0 ? bidHistory.map((b, i) => (
                                    <motion.div
                                        key={b.id}
                                        initial={i === 0 ? { opacity: 0, x: -20 } : {}}
                                        animate={{ opacity: 1, x: 0 }}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            padding: '10px 14px',
                                            background: i === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.02)',
                                            borderRadius: '10px',
                                            fontSize: '0.85rem',
                                            border: i === 0 ? '1px solid rgba(255,215,0,0.2)' : '1px solid transparent'
                                        }}
                                    >
                                        <span style={{ fontWeight: 800 }}>{b.teams?.name || 'Unknown'}</span>
                                        <span style={{ fontWeight: 950, color: i === 0 ? 'var(--primary)' : '#fff' }}>{b.amount} P</span>
                                    </motion.div>
                                )) : (
                                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No bids yet</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .glass { backdrop-filter: blur(20px); background: rgba(255,255,255,0.02); }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @media (max-width: 768px) {
                    .container > div:last-child { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </main>
    );
}
