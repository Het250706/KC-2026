'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import RoleGuard from '@/components/RoleGuard';
import { CardSlot, PlayerSlotStatus } from '@/types/card-auction';
import { Shuffle, Calendar, Users, ListFilter, Trash2, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

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
    const [slots, setSlots] = useState<CardSlot[]>([]);
    const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'view' | 'create'>('view');
    const [importCategory, setImportCategory] = useState<string>('Select to Import');
    const searchParams = useSearchParams();

    const fetchSlots = async () => {
        setLoading(true);
        try {
            // Fetch slots with joined categories from players
            const { data: slotsData } = await supabase
                .from('card_slots')
                .select('*, slot_players(player:players(category))')
                .order('slot_number', { ascending: false });
            
            if (slotsData) setSlots(slotsData as any);

            const { data: playersData } = await supabase.from('players').select('*').eq('slot_status', 'unassigned').eq('auction_status', 'pending');
            if (playersData) {
                setAvailablePlayers(playersData);
                
                // --- NEW AUTO IMPORT LOGIC ---
                const importParam = searchParams.get('import');
                if (importParam && activeTab === 'view') {
                    // Switch to create tab and import
                    setActiveTab('create');
                    const playersInCat = playersData.filter(p => p.category === importParam);
                    const ids = playersInCat.map(p => p.id).slice(0, 8);
                    setSelectedPlayers(ids);
                    setImportCategory(importParam);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSlots();
    }, []);

    const handleImportFromCategory = (cat: string) => {
        if (cat === 'Select to Import' || cat === 'All') return;
        setImportCategory(cat);
        const playersInCat = availablePlayers.filter(p => p.category === cat);
        const ids = playersInCat.map(p => p.id).slice(0, 8);
        setSelectedPlayers(ids);
    };

    const togglePlayerSelection = (playerId: string) => {
        setSelectedPlayers(prev => 
            prev.includes(playerId) ? prev.filter(id => id !== playerId) : (prev.length < 8 ? [...prev, playerId] : prev)
        );
    };

    const handleCreateSlot = async () => {
        if (selectedPlayers.length === 0) return;
        setCreating(true);
        try {
            // 1. Create Slot
            const { data: newSlot, error: slotError } = await supabase.from('card_slots').insert({
                status: 'pending'
            }).select().single();

            if (slotError) throw slotError;

            // 2. Assign Players to Random Positions
            const shuffledPlayers = [...selectedPlayers].sort(() => Math.random() - 0.5);
            const slotPlayersInsert = shuffledPlayers.map((id, index) => ({
                slot_id: newSlot.id,
                player_id: id,
                card_position: index + 1
            }));

            const { error: playersError } = await supabase.from('slot_players').insert(slotPlayersInsert);
            if (playersError) throw playersError;

            // 3. Update Players Status
            const { error: statusError } = await supabase.from('players').update({ slot_status: 'in_slot' }).in('id', selectedPlayers);
            if (statusError) throw statusError;

            setSelectedPlayers([]);
            setActiveTab('view');
            fetchSlots();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteSlot = async (slotId: string) => {
        if (!confirm('This will delete the slot and all related data. Continue?')) return;
        try {
            // Get players from the slot to reset their status
            const { data: slotPlayers } = await supabase.from('slot_players').select('player_id').eq('slot_id', slotId);
            const playerIds = slotPlayers?.map(p => p.player_id) || [];

            await supabase.from('card_slots').delete().eq('id', slotId);
            if (playerIds.length > 0) {
                await supabase.from('players').update({ slot_status: 'unassigned' }).in('id', playerIds);
            }
            fetchSlots();
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <main style={{ minHeight: '100vh', background: '#050505', color: '#fff', paddingBottom: '100px' }}>
            <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
                <div style={{ marginBottom: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', fontWeight: 950, letterSpacing: '2px', marginBottom: '8px' }}>
                            <Calendar size={18} /> CARD AUCTION SYSTEM
                        </div>
                        <h1 style={{ fontSize: '3.5rem', fontWeight: 950, letterSpacing: '-1.5px' }}>
                            SLOT <span style={{ color: 'var(--primary)' }}>MANAGEMENT</span>
                        </h1>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '5px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <button 
                            onClick={() => setActiveTab('view')}
                            style={{ padding: '12px 30px', borderRadius: '12px', background: activeTab === 'view' ? 'var(--primary)' : 'transparent', color: activeTab === 'view' ? '#000' : '#fff', fontWeight: 950, fontSize: '0.85rem', cursor: 'pointer', border: 'none', transition: 'all 0.3s' }}
                        >
                            VIEW ALL
                        </button>
                        <button 
                            onClick={() => setActiveTab('create')}
                            style={{ padding: '12px 30px', borderRadius: '12px', background: activeTab === 'create' ? 'var(--primary)' : 'transparent', color: activeTab === 'create' ? '#000' : '#fff', fontWeight: 950, fontSize: '0.85rem', cursor: 'pointer', border: 'none', transition: 'all 0.3s' }}
                        >
                            CREATE SLOT
                        </button>
                        <button 
                            onClick={async () => {
                                if (confirm('This will delete ALL slots and reset the card system. Are you sure?')) {
                                    setLoading(true);
                                    await fetch('/api/admin/reset-cards', { method: 'POST' });
                                    fetchSlots();
                                }
                            }}
                            style={{ padding: '12px 30px', borderRadius: '12px', background: 'rgba(255, 75, 75, 0.1)', color: '#ff4b4b', fontWeight: 950, fontSize: '0.85rem', cursor: 'pointer', border: '1px solid rgba(255, 75, 75, 0.2)', transition: 'all 0.3s' }}
                        >
                            RESET ALL
                        </button>
                    </div>
                </div>

                {activeTab === 'create' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '40px' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 950, letterSpacing: '1px' }}>
                                        AVAILABLE PLAYERS ({availablePlayers.filter(p => importCategory === 'All' || importCategory === 'Select to Import' || p.category === importCategory).length})
                                    </h3>
                                    
                                    {/* --- NEW QUICK IMPORT DROP DOWN --- */}
                                    <div style={{ marginTop: '10px' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '1px', display: 'block', marginBottom: '5px' }}>QUICK IMPORT FROM OLD SYSTEM</label>
                                        <select 
                                            value={importCategory}
                                            onChange={(e) => handleImportFromCategory(e.target.value)}
                                            style={{ 
                                                padding: '10px 20px', 
                                                borderRadius: '12px', 
                                                background: '#000', 
                                                color: '#fff', 
                                                border: '1px solid rgba(255,215,0,0.3)', 
                                                cursor: 'pointer', 
                                                fontSize: '0.85rem',
                                                fontWeight: 800,
                                                outline: 'none',
                                                transition: 'all 0.3s'
                                            }}
                                        >
                                            <option disabled style={{ background: '#000', color: '#fff' }}>Select to Import</option>
                                            <option value="All" style={{ background: '#000', color: '#fff' }}>--- ALL SLOTS ---</option>
                                            {Array.from(new Set(availablePlayers.map(p => p.category))).filter(Boolean).map(cat => (
                                                <option key={cat} value={cat} style={{ background: '#000', color: '#fff' }}>{cat.toUpperCase()}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 700 }}>SELECT MAX 8 PLAYERS</div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                                {availablePlayers
                                    .filter(p => importCategory === 'All' || importCategory === 'Select to Import' || p.category === importCategory)
                                    .map(p => {
                                        const isSelected = selectedPlayers.includes(p.id);
                                        return (
                                            <div 
                                                key={p.id} 
                                                onClick={() => togglePlayerSelection(p.id)}
                                                className="glass clickable-card"
                                                style={{ 
                                                    padding: '20px', 
                                                    borderRadius: '20px', 
                                                    border: isSelected ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.05)',
                                                    background: isSelected ? 'rgba(255,215,0,0.05)' : 'rgba(255,255,255,0.02)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.3s'
                                                }}
                                            >
                                                <div style={{ fontSize: '1rem', fontWeight: 900, marginBottom: '5px' }}>{p.first_name} {p.last_name}</div>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px' }}>{p.category.toUpperCase()}</div>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>

                        <div className="glass" style={{ padding: '30px', borderRadius: '30px', height: 'fit-content', position: 'sticky', top: '20px', border: '1px solid rgba(255,215,0,0.1)' }}>
                            <div style={{ marginBottom: '30px' }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: 950, marginBottom: '10px' }}>SLOT SELECTION</div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 700 }}>{selectedPlayers.length} / 8 PLAYERS SELECTED</div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
                                {selectedPlayers.map(id => {
                                    const p = availablePlayers.find(pl => pl.id === id);
                                    return (
                                        <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,215,0,0.05)', padding: '12px 20px', borderRadius: '15px' }}>
                                            <span style={{ fontWeight: 900, fontSize: '0.9rem' }}>{p?.first_name} {p?.last_name}</span>
                                            <button onClick={() => togglePlayerSelection(id)} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                        </div>
                                    );
                                })}
                                {selectedPlayers.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '20px', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 700 }}>NO PLAYERS SELECTED</div>}
                            </div>

                            <button 
                                onClick={handleCreateSlot} 
                                disabled={selectedPlayers.length === 0 || creating}
                                className="btn-primary" 
                                style={{ width: '100%', padding: '18px', fontWeight: 950, fontSize: '1rem', letterSpacing: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                            >
                                {creating ? <Loader2 className="animate-spin" /> : <><Sparkles size={20} /> CREATE SLOT</>}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px' }}>
                        {slots.map(slot => (
                            <div key={slot.id} className="glass" style={{ padding: '30px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 950 }}>
                                        { (slot as any).slot_players?.[0]?.player?.category?.toUpperCase() || `SLOT ${slot.slot_number}` }
                                    </div>
                                    <div style={{ padding: '6px 12px', borderRadius: '50px', background: slot.status === 'completed' ? 'rgba(0,255,128,0.1)' : 'rgba(255,215,0,0.1)', color: slot.status === 'completed' ? '#00ff80' : 'var(--primary)', fontWeight: 900, fontSize: '0.7rem' }}>
                                        {slot.status.toUpperCase()}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
                                    <button onClick={() => handleDeleteSlot(slot.id)} style={{ color: '#ff4b4b', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 900, letterSpacing: '1px' }}>DELETE SLOT</button>
                                    <button className="btn-secondary" style={{ padding: '10px 20px', fontSize: '0.8rem', fontWeight: 900 }}>VIEW CARDS</button>
                                </div>
                            </div>
                        ))}
                        {slots.length === 0 && <div className="glass" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '30px', color: 'var(--text-muted)', fontWeight: 800 }}>NO SLOTS CREATED YET</div>}
                    </div>
                )}
            </div>

            <style jsx>{`
                .clickable-card:hover { transform: translateY(-5px); border-color: var(--primary) !important; background: rgba(255,215,0,0.05) !important; }
            `}</style>
        </main>
    );
}
