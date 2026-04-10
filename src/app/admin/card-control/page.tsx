'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import RoleGuard from '@/components/RoleGuard';
import { CardSlot, CardAuctionState } from '@/types/card-auction';
import { Play, Square, Loader2, Sparkles, Activity, ShieldCheck, Timer, History as HistoryIcon, Shuffle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AuctionReportButton from '@/components/AuctionReportButton';

export default function CardControlPanel() {
    return (
        <RoleGuard allowedRole="admin">
            <CardControlContent />
        </RoleGuard>
    );
}

function CardControlContent() {
    const [slots, setSlots] = useState<CardSlot[]>([]);
    const [state, setState] = useState<CardAuctionState | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const [slotsRes, stateRes] = await Promise.all([
                supabase.from('card_slots').select('*, slot_players(player:players(*))').order('slot_number', { ascending: false }),
                supabase.from('card_auction_state').select('*').single()
            ]);
            if (slotsRes.data) {
                setSlots(slotsRes.data);
                if (slotsRes.data.length > 0 && !selectedSlotId) {
                    setSelectedSlotId(slotsRes.data[0].id);
                }
            }
            if (stateRes.data) setState(stateRes.data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const stateSub = supabase.channel('card_control_realtime')
            .on('postgres_changes', { event: '*', table: 'card_auction_state', schema: 'public' }, (payload: any) => {
                setState(payload.new);
            })
            .subscribe();

        return () => { supabase.removeChannel(stateSub); };
    }, []);

    const handleStartAuction = async () => {
        if (!selectedSlotId) return;
        setActionLoading(true);
        try {
            const isResuming = state?.current_slot_id === selectedSlotId;
            await supabase.from('card_auction_state').update({
                current_slot_id: selectedSlotId,
                current_turn: isResuming ? (state?.current_turn || 1) : 1,
                is_active: true,
                updated_at: new Date().toISOString()
            }).eq('id', 1);
            await supabase.from('card_slots').update({ status: 'active' }).eq('id', selectedSlotId);
            alert('Card Auction Started!');
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleStopAuction = async () => {
        setActionLoading(true);
        try {
            await supabase.from('card_auction_state').update({
                is_active: false,
                updated_at: new Date().toISOString()
            }).eq('id', 1);
            alert('Card Auction Stopped.');
            fetchData();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleHardReset = async () => {
        if (!confirm('WARNING: This will reset the live state, turns, and deactivate the current slot. Continue?')) return;
        setActionLoading(true);
        try {
            await supabase.from('card_auction_state').update({
                current_slot_id: null,
                current_turn: 1,
                is_active: false,
                updated_at: new Date().toISOString()
            }).eq('id', 1);
            alert('System hard reset complete. All live connections cleared.');
            fetchData();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleUndoLastPick = async () => {
        if (!state?.current_slot_id) {
            alert('No active slot found in system state.');
            return;
        }
        setActionLoading(true);
        try {
            let { data: lastCard } = await supabase
                .from('slot_players')
                .select('*, player:players(*)')
                .eq('slot_id', state.current_slot_id)
                .eq('is_picked', true)
                .order('picked_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!lastCard) {
                const { data: fallback } = await supabase
                    .from('slot_players')
                    .select('*, player:players(*)')
                    .eq('slot_id', state.current_slot_id)
                    .eq('is_picked', true)
                    .limit(1)
                    .maybeSingle();
                lastCard = fallback;
            }

            if (!lastCard) {
                alert(`No revealed cards found to undo in slot: ${state.current_slot_id}`);
                setActionLoading(false);
                return;
            }

            if (!confirm(`Undo selection of ${lastCard.player?.first_name || 'this player'}? This will re-hide them and shuffle all cards.`)) {
                setActionLoading(false);
                return;
            }

            await supabase.from('slot_players').update({
                is_picked: false,
                picked_by_team_id: null,
                picked_at: null,
                team_photo_id: null
            }).eq('id', lastCard.id);

            if (state.current_turn > 1) {
                await supabase.from('card_auction_state').update({
                    current_turn: state.current_turn - 1,
                    updated_at: new Date().toISOString()
                }).eq('id', 1);
            }

            const { data: unpickedPlayers } = await supabase
                .from('slot_players')
                .select('id, card_position')
                .eq('slot_id', state.current_slot_id)
                .eq('is_picked', false);

            if (unpickedPlayers && unpickedPlayers.length > 0) {
                const currentPositions = unpickedPlayers.map(p => p.card_position);
                const shuffledPositions = [...currentPositions].sort(() => Math.random() - 0.5);
                await Promise.all(unpickedPlayers.map((card, idx) => 
                    supabase.from('slot_players').update({ card_position: shuffledPositions[idx] }).eq('id', card.id)
                ));
            }

            alert('Last pick undone and all cards reshuffled!');
            fetchData();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleShuffleRemaining = async () => {
        if (!state?.current_slot_id) return;
        if (!confirm('This will reshuffle all UNPICKED cards among themselves. Revealed cards will stay in their places. Continue?')) return;
        setActionLoading(true);
        try {
            const { data: unpicked } = await supabase.from('slot_players').select('id, card_position').eq('slot_id', state.current_slot_id).eq('is_picked', false);
            if (unpicked && unpicked.length > 0) {
                const currentPositions = unpicked.map(p => p.card_position);
                const shuffledPositions = [...currentPositions].sort(() => Math.random() - 0.5);
                await Promise.all(unpicked.map((card, idx) => 
                    supabase.from('slot_players').update({ card_position: shuffledPositions[idx] }).eq('id', card.id)
                ));
                alert('Remaining cards reshuffled among themselves!');
                fetchData();
            }
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleShuffleAll = async () => {
        if (!state?.current_slot_id) return;
        if (!confirm('This will RESET all picked cards and scatter EVERYONE to new random positions. Continue?')) return;
        setActionLoading(true);
        try {
            await supabase.from('slot_players').update({
                is_picked: false,
                picked_by_team_id: null,
                picked_at: null,
                team_photo_id: null
            }).eq('slot_id', state.current_slot_id);
            await supabase.from('card_auction_state').update({ current_turn: 1, updated_at: new Date().toISOString() }).eq('id', 1);
            const { data: allPlayers } = await supabase.from('slot_players').select('id').eq('slot_id', state.current_slot_id);
            if (allPlayers && allPlayers.length > 0) {
                const positionsCount = Math.max(8, allPlayers.length);
                const availablePositions = Array.from({ length: positionsCount }, (_, i) => i + 1);
                const shuffledPositions = availablePositions.sort(() => Math.random() - 0.5);
                await Promise.all(allPlayers.map((card, idx) => 
                    supabase.from('slot_players').update({ card_position: shuffledPositions[idx] }).eq('id', card.id)
                ));
            }
            alert('Slot reset and everyone shuffled!');
            fetchData();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleResetAllSlots = async () => {
        if (!confirm('This will change ALL slots (including completed ones) back to PENDING. Use with caution!')) return;
        setActionLoading(true);
        try {
            await supabase.from('card_slots').update({ status: 'pending' }).neq('id', '00000000-0000-0000-0000-000000000000');
            alert('All slots reset to PENDING.');
            fetchData();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>
            <Loader2 className="animate-spin" size={48} color="var(--primary)" />
        </div>
    );

    return (
        <main style={{ minHeight: '100vh', background: '#050505', color: '#fff', paddingBottom: '100px' }}>
            <div className="container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
                <div style={{ marginBottom: '50px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'var(--primary)', fontWeight: 950, letterSpacing: '3px', marginBottom: '15px' }}>
                        <ShieldCheck size={20} /> CONTROL CENTER
                    </div>
                    <h1 style={{ fontSize: '4rem', fontWeight: 950, letterSpacing: '-2px' }}>
                        AUCTION <span style={{ color: 'var(--primary)' }}>COMMAND</span> PANEL
                    </h1>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    
                    {/* Left: Global State Monitor */}
                    <div className="glass" style={{ padding: '40px', borderRadius: '40px', border: '2px solid' + (state?.is_active ? ' var(--primary)' : ' rgba(255,255,255,0.05)'), position: 'relative', overflow: 'hidden' }}>
                        {state?.is_active && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'var(--primary)', boxShadow: '0 0 20px var(--primary)' }} />}
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: 950 }}>
                                <Activity size={24} color={state?.is_active ? 'var(--primary)' : '#666'} /> LIVE STATUS
                            </div>
                            <div style={{ padding: '8px 20px', borderRadius: '50px', background: state?.is_active ? 'rgba(0,255,128,0.1)' : 'rgba(255,255,255,0.05)', color: state?.is_active ? '#00ff80' : '#666', fontWeight: 900, fontSize: '0.8rem', letterSpacing: '1px' }}>
                                {state?.is_active ? 'LIVE' : 'IDLE'}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '25px', borderRadius: '25px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '5px', letterSpacing: '1px' }}>CURRENT SLOT</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 950 }}>
                                    {state?.is_active && state?.current_slot_id ? (
                                        (() => {
                                            const currentSlot = slots.find(s => s.id === state.current_slot_id);
                                            const category = (currentSlot as any)?.slot_players?.[0]?.player?.category;
                                            return category ? category.toUpperCase() : (currentSlot ? `SLOT ${currentSlot.slot_number}` : 'LOADING...');
                                        })()
                                    ) : '---'}
                                </div>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '25px', borderRadius: '25px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '5px', letterSpacing: '1px' }}>ACTIVE TURN</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 950 }}>{state?.is_active ? `TURN #${state?.current_turn}` : '---'}</div>
                            </div>
                        </div>

                        {state?.is_active ? (
                            <button onClick={handleStopAuction} disabled={actionLoading} style={{ width: '100%', marginTop: '30px', padding: '18px', background: '#ff4b4b', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 950, fontSize: '1rem', letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                {actionLoading ? <Loader2 className="animate-spin" /> : <><Square size={20} /> STOP SYSTEM</>}
                            </button>
                        ) : (
                            <div style={{ marginTop: '30px', textAlign: 'center', padding: '20px', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '25px', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.9rem' }}>
                                SYSTEM IS CURRENTLY OFFLINE
                            </div>
                        )}
                    </div>

                    {/* Right: Manual Start Selector */}
                    <div className="glass" style={{ padding: '40px', borderRadius: '40px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: 950, marginBottom: '30px' }}>
                            <Timer size={24} color="#666" /> QUEUE CONTROL
                        </div>

                        <div style={{ marginBottom: '30px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '2px', display: 'block', marginBottom: '10px' }}>SELECT SLOT TO BEGIN</label>
                            <select 
                                value={selectedSlotId || ''} 
                                onChange={(e) => setSelectedSlotId(e.target.value)}
                                style={{ width: '100%', padding: '15px 25px', borderRadius: '15px', background: 'rgba(255,255,255,0.03)', color: '#fff', border: '1px solid rgba(255,255,255,0.05)', fontWeight: 950, fontSize: '1rem' }}
                            >
                                <option value="" disabled>--- Select a Slot ---</option>
                                {slots.filter(s => s.status === 'pending').map(s => {
                                    const category = (s as any).slot_players?.[0]?.player?.category;
                                    const displayName = category ? category.toUpperCase() : (s.slot_number ? `SLOT ${s.slot_number}` : 'UNASSIGNED SLOT');
                                    return (
                                        <option key={s.id} value={s.id}>
                                            {displayName}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <button 
                            onClick={handleStartAuction} 
                            disabled={!selectedSlotId || state?.is_active || actionLoading}
                            className="btn-primary" 
                            style={{ width: '100%', padding: '18px', borderRadius: '20px', fontWeight: 950, fontSize: '1.2rem', letterSpacing: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                        >
                            {actionLoading ? <Loader2 className="animate-spin" /> : <><Play size={24} fill="currentColor" /> ACTIVATE SYSTEM</>}
                        </button>

                        <div style={{ marginTop: '20px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 700, fontStyle: 'italic' }}>
                            Warning: Activating will broadcast to all teams
                        </div>

                        {/* Maintenance Block */}
                        <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '25px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button 
                                    onClick={handleUndoLastPick}
                                    style={{ flex: 1, padding: '15px', background: 'rgba(255,165,0,0.1)', color: '#ffa500', border: '1px solid rgba(255,165,0,0.3)', borderRadius: '15px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <HistoryIcon size={16} /> UNDO & SHUFFLE
                                </button>
                                <button 
                                    onClick={handleShuffleRemaining}
                                    style={{ flex: 1, padding: '15px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '15px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    <Shuffle size={16} /> SHUFFLE REMAINING
                                </button>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button 
                                    onClick={handleShuffleAll}
                                    style={{ flex: 1, padding: '12px', background: 'rgba(0,255,128,0.05)', color: '#00ff80', border: '1px solid rgba(0,255,128,0.2)', borderRadius: '12px', fontWeight: 900, fontSize: '0.7rem', cursor: 'pointer', transition: 'all 0.3s' }}
                                >
                                    SHUFFLE ALL (RESET)
                                </button>
                                <button 
                                    onClick={handleHardReset}
                                    style={{ flex: 1, padding: '12px', background: 'rgba(255,75,75,0.05)', color: '#ff4b4b', border: '1px solid rgba(255,75,75,0.2)', borderRadius: '12px', fontWeight: 900, fontSize: '0.7rem', cursor: 'pointer', transition: 'all 0.3s' }}
                                >
                                    HARD RESET STATE
                                </button>
                                <button 
                                    onClick={handleResetAllSlots}
                                    style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.02)', color: '#888', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', fontWeight: 900, fontSize: '0.7rem', cursor: 'pointer', transition: 'all 0.3s' }}
                                >
                                    RESET ALL SLOTS
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
