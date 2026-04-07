'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import RoleGuard from '@/components/RoleGuard';
import { CardSlot, CardAuctionState } from '@/types/card-auction';
import { Play, Square, Loader2, Sparkles, Activity, ShieldCheck, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
                supabase.from('card_slots').select('*, slot_players(player:players(category))').eq('status', 'pending').order('slot_number'),
                supabase.from('card_auction_state').select('*').single()
            ]);
            if (slotsRes.data) {
                setSlots(slotsRes.data);
                if (slotsRes.data.length > 0) setSelectedSlotId(slotsRes.data[0].id);
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
            // 1. Update State
            await supabase.from('card_auction_state').update({
                current_slot_id: selectedSlotId,
                current_turn: 1,
                is_active: true,
                updated_at: new Date().toISOString()
            }).eq('id', 1);

            // 2. Update Slot status
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
                                <div style={{ fontSize: '1.8rem', fontWeight: 950 }}>{state?.current_slot_id ? 'SLOT LOADED' : 'NONE'}</div>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '25px', borderRadius: '25px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '5px', letterSpacing: '1px' }}>ACTIVE TURN</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 950 }}>TURN #{state?.current_turn}</div>
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
                                {slots.map(s => (
                                    <option key={s.id} value={s.id}>
                                        { (s as any).slot_players?.[0]?.player?.category?.toUpperCase() || `SLOT ${s.slot_number}` } ({s.status})
                                    </option>
                                ))}
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
                        <div style={{ marginTop: '40px', paddingTop: '30px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '10px' }}>
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
        </main>
    );
}
