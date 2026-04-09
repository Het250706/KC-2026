'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import RoleGuard from '@/components/RoleGuard';
import { CardSlot, PlayerSlotStatus } from '@/types/card-auction';
import { Shuffle, Calendar, Users, ChevronDown, Trash2, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { fixPhotoUrl } from '@/lib/utils';

export default function SlotManagement() {
    return (
        <RoleGuard allowedRole="admin">
            <Suspense fallback={<Loader2 className="animate-spin" />}>
                <SlotManagementContent />
            </Suspense>
        </RoleGuard>
    );
}

function SlotManagementContent() {
    const [slots, setSlots] = useState<any[]>([]);
    const [playersBySlot, setPlayersBySlot] = useState<Record<string, any[]>>({});
    const [loading, setLoading] = useState(true);
    const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null);
    const router = useRouter();

    const fetchSlotsAndPlayers = async () => {
        setLoading(true);
        try {
            // 1. Fetch all existing card slots
            const { data: slotsData } = await supabase
                .from('card_slots')
                .select('*, slot_players(player:players(*))')
                .order('slot_number', { ascending: false });
            
            // 2. Fetch all unique categories from players table
            const { data: allPlayers } = await supabase
                .from('players')
                .select('*')
                .eq('auction_status', 'pending');

            const categories = Array.from(new Set(allPlayers?.map(p => p.category).filter(Boolean) || []));
            
            // 3. Match categories with slots
            const derivedSlots = categories.map(cat => {
                // Find a slot that contains players of this specific category
                const existingSlot = slotsData?.find(s => 
                    s.slot_players && s.slot_players.length > 0 && 
                    s.slot_players.some((sp: any) => sp.player?.category === cat)
                );
                
                return {
                    id: existingSlot?.id || `new-${cat}`,
                    category: cat,
                    status: existingSlot?.status || 'uninitialized',
                    is_new: !existingSlot,
                    player_count: allPlayers?.filter(p => p.category === cat).length || 0,
                    players: allPlayers?.filter(p => p.category === cat) || []
                };
            });

            // --- SORT SLOTS ALPHABETICALLY ---
            derivedSlots.sort((a, b) => (a.category as string).localeCompare(b.category as string));

            setSlots(derivedSlots);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSlotsAndPlayers();
    }, []);

    const handleInitializeSlot = async (category: string, players: any[]) => {
        if (!confirm(`Initialize card-flip auction for ${category.toUpperCase()}?`)) return;
        setLoading(true);
        try {
            // 1. Create Slot
            const { data: newSlot, error: slotError } = await supabase.from('card_slots').insert({
                status: 'pending'
            }).select().single();

            if (slotError) throw slotError;

            // 2. Assign Players to Random Positions (MAX 8 per slot for cards system usually, but user wants ALL)
            // Let's take up to 8 if card mode is limited to 8, or all if it's dynamic. 
            // Looking at the previous code, it was .slice(0, 8). I'll keep 8 to respect component constraints if any.
            const shuffledPlayers = [...players].sort(() => Math.random() - 0.5).slice(0, 8);
            const slotPlayersInsert = shuffledPlayers.map((p, index) => ({
                slot_id: newSlot.id,
                player_id: p.id,
                card_position: index + 1
            }));

            const { error: playersError } = await supabase.from('slot_players').insert(slotPlayersInsert);
            if (playersError) throw playersError;

            // 3. Update Players Status
            await supabase.from('players').update({ slot_status: 'in_slot' }).in('id', shuffledPlayers.map(p => p.id));
            
            fetchSlotsAndPlayers();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSlot = async (slotId: string) => {
        if (slotId.startsWith('new-')) return;
        if (!confirm('This will delete the card assignments and reset turn order for this slot. Players will remain in the pool. Continue?')) return;
        
        try {
            const { data: slotPlayers } = await supabase.from('slot_players').select('player_id').eq('slot_id', slotId);
            const playerIds = slotPlayers?.map((p: any) => p.player_id) || [];

            await supabase.from('card_slots').delete().eq('id', slotId);
            if (playerIds.length > 0) {
                await supabase.from('players').update({ slot_status: 'unassigned' }).in('id', playerIds);
            }
            fetchSlotsAndPlayers();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const toggleExpansion = (id: string) => {
        setExpandedSlotId(expandedSlotId === id ? null : id);
    };

    return (
        <main style={{ minHeight: '100vh', background: '#050505', color: '#fff', paddingBottom: '100px' }}>
            <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
                <div style={{ marginBottom: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', fontWeight: 950, letterSpacing: '2px', marginBottom: '8px' }}>
                            <Sparkles size={18} /> CARD AUCTION SYSTEM
                        </div>
                        <h1 style={{ fontSize: '3.5rem', fontWeight: 950, letterSpacing: '-1.5px' }}>
                            SLOT <span style={{ color: 'var(--primary)' }}>MANAGEMENT</span>
                        </h1>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                            onClick={async () => {
                                if (confirm('This will delete ALL active card slots and reset the whole system. Are you sure?')) {
                                    setLoading(true);
                                    await fetch('/api/admin/reset-cards', { method: 'POST' });
                                    fetchSlotsAndPlayers();
                                }
                            }}
                            className="btn-secondary"
                            style={{ padding: '12px 30px', background: 'rgba(255, 75, 75, 0.1)', color: '#ff4b4b', borderColor: 'rgba(255, 75, 75, 0.2)' }}
                        >
                            RESET SYSTEM
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '25px' }}>
                    {slots.map(slot => (
                        <div key={slot.id} className="glass" style={{ padding: '0', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                            <div style={{ padding: '30px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div 
                                            onClick={() => toggleExpansion(slot.id)}
                                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.3s', transform: expandedSlotId === slot.id ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                        >
                                            <ChevronDown size={22} color="var(--primary)" />
                                        </div>
                                        <div style={{ fontSize: '1.4rem', fontWeight: 950, letterSpacing: '1px' }}>
                                            { slot.category.toUpperCase() }
                                        </div>
                                    </div>
                                    <div style={{ padding: '6px 12px', borderRadius: '50px', background: slot.status === 'completed' ? 'rgba(0,255,128,0.1)' : slot.is_new ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255,215,0,0.1)', color: slot.status === 'completed' ? '#00ff80' : slot.is_new ? '#38bdf8' : 'var(--primary)', fontWeight: 900, fontSize: '0.7rem' }}>
                                        {slot.is_new ? 'READY' : slot.status.toUpperCase()}
                                    </div>
                                </div>
                                
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '20px' }}>
                                    {slot.is_new ? `${slot.player_count} PLAYERS DETECTED` : `${slot.player_count} PLAYERS CONFIGURED`}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '30px' }}>
                                    {!slot.is_new ? (
                                        <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <button onClick={() => handleDeleteSlot(slot.id)} style={{ color: '#ff4b4b', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 900, letterSpacing: '1px' }}>
                                                DELETE
                                            </button>
                                            <button 
                                                onClick={() => router.push(`/admin/card-turns?slotId=${slot.id}`)}
                                                className="btn-primary" 
                                                style={{ padding: '10px 20px', fontSize: '0.8rem', fontWeight: 900, borderRadius: '15px' }}
                                            >
                                                VIEW CARDS
                                            </button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => handleInitializeSlot(slot.category, slot.players)}
                                            className="btn-primary" 
                                            style={{ width: '100%', padding: '15px', fontWeight: 950, fontSize: '0.9rem', background: '#38bdf8', color: '#000' }}
                                        >
                                            INITIALIZE SLOT
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {/* Expandable Player List */}
                            <AnimatePresence>
                                {expandedSlotId === slot.id && (
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: 'auto' }}
                                        exit={{ height: 0 }}
                                        style={{ overflow: 'hidden', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}
                                    >
                                        <div style={{ padding: '20px' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 950, marginBottom: '10px', letterSpacing: '1px' }}>PLAYER'S NAME</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {slot.players.map((p: any) => (
                                                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: '#111' }}>
                                                            <img 
                                                                src={fixPhotoUrl(p.photo_url || p.photo, p.first_name)} 
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                                alt=""
                                                                onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`; }}
                                                            />
                                                        </div>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
                                                            {p.first_name} {p.last_name}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                    {slots.length === 0 && <div className="glass" style={{ gridColumn: '1/-1', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '30px', color: 'var(--text-muted)', fontWeight: 800 }}>NO SLOTS DETECTED IN POOL</div>}
                </div>
            </div>
            {loading && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin" size={40} color="var(--primary)" /></div>}
            <style jsx>{`
                .clickable-card:hover { transform: translateY(-5px); border-color: var(--primary) !important; background: rgba(255,215,0,0.05) !important; }
            `}</style>
        </main>
    );
}
