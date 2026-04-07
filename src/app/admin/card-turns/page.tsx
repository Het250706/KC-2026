'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import RoleGuard from '@/components/RoleGuard';
import { CardSlot, CardAuctionTurn } from '@/types/card-auction';
import { Shuffle, Settings, GripVertical, Save, Loader2, Sparkles } from 'lucide-react';
import { 
    DndContext, 
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function TurnManagement() {
    return (
        <RoleGuard allowedRole="admin">
            <TurnManagementContent />
        </RoleGuard>
    );
}

function SortableItem({ id, teamName }: { id: string, teamName: string }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div 
            ref={setNodeRef} 
            style={{ 
                ...style, 
                display: 'flex', 
                alignItems: 'center', 
                gap: '20px', 
                padding: '20px 30px', 
                background: 'rgba(255,255,255,0.03)', 
                borderRadius: '20px', 
                border: '1px solid rgba(255,255,255,0.05)',
                marginBottom: '10px'
            }}
        >
            <div {...attributes} {...listeners} style={{ cursor: 'grab', color: 'rgba(255,255,255,0.2)' }}>
                <GripVertical size={24} />
            </div>
            <div style={{ flex: 1, fontWeight: 950, fontSize: '1.15rem' }}>{teamName.toUpperCase()}</div>
        </div>
    );
}

function TurnManagementContent() {
    const [slots, setSlots] = useState<CardSlot[]>([]);
    const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
    const [teams, setTeams] = useState<any[]>([]);
    const [turns, setTurns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const fetchData = async () => {
        setLoading(true);
        try {
            const [slotsRes, teamsRes] = await Promise.all([
                supabase.from('card_slots').select('*, slot_players(player:players(category))').order('slot_number', { ascending: false }),
                supabase.from('teams').select('*').order('name')
            ]);
            if (slotsRes.data) {
                setSlots(slotsRes.data);
                if (slotsRes.data.length > 0) setSelectedSlotId(slotsRes.data[0].id);
            }
            if (teamsRes.data) setTeams(teamsRes.data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchTurns = async (slotId: string) => {
        const { data } = await supabase.from('card_auction_turns').select('*, team:teams(name)').eq('slot_id', slotId).order('turn_order');
        if (data && data.length > 0) {
            setTurns(data.map(t => ({ id: t.id, teamId: t.team_id, teamName: t.team.name })));
        } else {
            // Default: All teams in random order
            setTurns(teams.map(t => ({ id: t.id, teamId: t.id, teamName: t.name })));
        }
    };

    useEffect(() => {
        if (selectedSlotId && teams.length > 0) fetchTurns(selectedSlotId);
    }, [selectedSlotId, teams]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setTurns((items) => {
                const oldIndex = items.findIndex(i => i.id === active.id);
                const newIndex = items.findIndex(i => i.id === over?.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleRandomize = () => {
        setTurns(prev => [...prev].sort(() => Math.random() - 0.5));
    };

    const handleSave = async () => {
        if (!selectedSlotId) return;
        setSaving(true);
        try {
            // Delete old turns for this slot
            await supabase.from('card_auction_turns').delete().eq('slot_id', selectedSlotId);

            // Insert new turns
            const turnsInsert = turns.map((t, index) => ({
                slot_id: selectedSlotId,
                team_id: t.teamId,
                turn_order: index + 1
            }));

            const { error } = await supabase.from('card_auction_turns').insert(turnsInsert);
            if (error) throw error;
            alert('Turn order saved successfully!');
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <main style={{ minHeight: '100vh', background: '#050505', color: '#fff', paddingBottom: '100px' }}>
            <div className="container" style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
                <div style={{ marginBottom: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', fontWeight: 950, letterSpacing: '2px', marginBottom: '8px' }}>
                            <Settings size={18} /> TURN CONFIGURATION
                        </div>
                        <h1 style={{ fontSize: '3rem', fontWeight: 950, letterSpacing: '-1.5px' }}>
                            REDEFINE <span style={{ color: 'var(--primary)' }}>TURN ORDER</span>
                        </h1>
                    </div>

                    <select 
                        value={selectedSlotId || ''} 
                        onChange={(e) => setSelectedSlotId(e.target.value)}
                        style={{ padding: '12px 25px', borderRadius: '15px', background: 'rgba(255,255,255,0.03)', color: '#fff', border: '1px solid rgba(255,255,255,0.05)', fontWeight: 950, fontSize: '0.85rem' }}
                    >
                        {slots.map(s => (
                            <option key={s.id} value={s.id}>
                                { (s as any).slot_players?.[0]?.player?.category?.toUpperCase() || `SLOT ${s.slot_number}` }
                            </option>
                        ))}
                    </select>
                </div>

                <div className="glass" style={{ padding: '40px', borderRadius: '40px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <DndContext 
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext 
                            items={turns.map(t => t.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {turns.map((turn, index) => (
                                    <div key={turn.id} style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(255,215,0,0.1)', color: 'var(--primary)', fontWeight: 950, fontSize: '0.9rem' }}>
                                            {index + 1}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <SortableItem id={turn.id} teamName={turn.teamName} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>

                    <div style={{ display: 'flex', gap: '15px', marginTop: '40px' }}>
                        <button 
                            onClick={handleRandomize} 
                            style={{ flex: 1, padding: '18px', background: 'rgba(255,255,255,0.03)', color: '#fff', borderRadius: '20px', fontWeight: 950, letterSpacing: '1px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                        >
                            <Shuffle size={18} /> RANDOMIZE
                        </button>
                        <button 
                            onClick={handleSave} 
                            disabled={saving}
                            className="btn-primary" 
                            style={{ flex: 2, padding: '18px', borderRadius: '20px', fontWeight: 950, letterSpacing: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                        >
                            {saving ? <Loader2 className="animate-spin" /> : <><Save size={20} /> SAVE TURN ORDER</>}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}
