'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import RoleGuard from '@/components/RoleGuard';
import { CardSlot, SlotPlayer, CardAuctionState } from '@/types/card-auction';
import { Sparkles, Timer, Shield, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlipCard } from '@/components/FlipCard';
import { fixPhotoUrl } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

export default function LiveAuctionReveal() {
    return (
        <RoleGuard allowedRole="admin,captain">
            <RevealContent />
        </RoleGuard>
    );
}

function RevealContent() {
    const { user, role } = useAuth();
    const [slot, setSlot] = useState<CardSlot | null>(null);
    const [cards, setCards] = useState<SlotPlayer[]>([]);
    const [state, setState] = useState<CardAuctionState | null>(null);
    const [turns, setTurns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPicking, setIsPicking] = useState(false);
    const [revealPopup, setRevealPopup] = useState<{player: any, team: any} | null>(null);
    
    // Determine if the current slot is "empty" or "fully completed"
    const isSlotComplete = state?.current_slot_id && cards.length > 0 && cards.every(c => c.is_picked);
    const isEmpty = state?.current_slot_id && cards.length === 0;
    
    // --- SMART SCALING FOR ZOOM PROOFING (16:9 RATIO) ---
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const handleResize = () => {
            const baseWidth = 1920; // 16:9 ratio base width
            const baseHeight = 1080;
            const ratio = baseWidth / baseHeight;
            
            const windowRatio = window.innerWidth / window.innerHeight;
            let newScale = 1;
            
            if (windowRatio > ratio) {
                newScale = window.innerHeight / baseHeight;
            } else {
                newScale = window.innerWidth / baseWidth;
            }
            setScale(newScale);
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Initial call
        
        fetchActiveState();
        
        const stateChannel = supabase.channel('auction-state-v6')
            .on('postgres_changes', { event: '*', table: 'card_auction_state', schema: 'public' }, () => fetchActiveState())
            .on('postgres_changes', { event: '*', table: 'card_slots', schema: 'public' }, () => fetchActiveState())
            .on('postgres_changes', { event: '*', table: 'slot_players', schema: 'public' }, (payload) => {
                if (payload.eventType === 'UPDATE') fetchCards(payload.new.slot_id);
            })
            .subscribe();

        return () => { 
            window.removeEventListener('resize', handleResize);
            supabase.removeChannel(stateChannel); 
        };
    }, []);

    const fetchActiveState = async () => {
        const { data: stateData } = await supabase.from('card_auction_state').select('*').single();
        if (stateData) {
            setState(stateData);
            if (stateData.current_slot_id) {
                fetchSlotDetails(stateData.current_slot_id);
                fetchCards(stateData.current_slot_id);
                fetchTurns(stateData.current_slot_id);
            }
        }
        setLoading(false);
    };

    const fetchSlotDetails = async (id: string) => {
        const { data } = await supabase.from('card_slots').select('*').eq('id', id).single();
        if (data) setSlot(data);
    };

    const fetchCards = async (activeSlotId: string) => {
        const { data } = await supabase
            .from('slot_players')
            .select('*, player:players(*), picked_by_team:teams(*)')
            .eq('slot_id', activeSlotId)
            .order('card_position');
        if (data) setCards(data);
    };

    const fetchTurns = async (activeSlotId: string) => {
        const { data } = await supabase
            .from('card_auction_turns')
            .select('*, team:teams(*)')
            .eq('slot_id', activeSlotId)
            .order('turn_order');
        if (data) setTurns(data);
    };

    // --- AUTO CLOSE REVEAL POPUP ---
    useEffect(() => {
        if (revealPopup) {
            const duration = isSlotComplete ? 5000 : 4000;
            const timer = setTimeout(() => {
                setRevealPopup(null);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [revealPopup, isSlotComplete]);

    const handlePickCard = async (position: number) => {
        if (!state?.is_active || isPicking || role !== 'admin' || isSlotComplete) return;

        setIsPicking(true);
        try {
            const { data, error } = await supabase.rpc('pick_card', {
                p_slot_id: slot?.id,
                p_card_position: position,
                p_team_id: null
            });

            if (error) {
                alert(error.message);
                return;
            }

            const response = data as any;
            if (response.success) {
                const pickedCard = cards.find(c => c.card_position === position);
                const currentTurn = turns.find(t => t.turn_order === state.current_turn);
                
                if (pickedCard && currentTurn) {
                    setRevealPopup({ player: pickedCard.player, team: currentTurn.team });
                    confetti({
                        particleCount: 200,
                        spread: 100,
                        origin: { y: 0.6 },
                        colors: ['#FFD700', '#FFFFFF', '#000000']
                    });
                }
            } else {
                alert(response.error);
            }
        } finally {
            setIsPicking(false);
        }
    };

    const currentTurnTeam = turns.find(t => t.turn_order === state?.current_turn)?.team?.name;
    const canPick = role === 'admin' && state?.is_active;

    const renderCenterContent = () => {
        if (!state?.current_slot_id || isSlotComplete || isEmpty) {
            return (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', zIndex: 10 }}>
                    <motion.img 
                        src="/logo.png" 
                        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                        transition={{ repeat: Infinity, duration: 6 }}
                        style={{ height: '220px', marginBottom: '40px', filter: 'drop-shadow(0 0 50px rgba(255,215,0,0.3))' }}
                    />
                    <h2 style={{ fontSize: '6rem', fontWeight: 950, color: 'var(--primary)', letterSpacing: '4px', textTransform: 'uppercase', margin: 0, lineHeight: 1 }}>
                        PLAYER SELECTION
                    </h2>
                    <div style={{ fontSize: '2rem', fontWeight: 950, color: '#fff', letterSpacing: '15px', textTransform: 'uppercase', opacity: 0.4, marginTop: '20px' }}>
                        JAY SWAMINARAYAN
                    </div>
                </motion.div>
            );
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%', height: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                    <div style={{ padding: '15px 40px', background: 'rgba(255,215,0,0.1)', border: '2px solid var(--primary)', color: 'var(--primary)', display: 'inline-block', borderRadius: '50px', fontSize: '1.5rem', fontWeight: 950, letterSpacing: '4px', boxShadow: '0 0 30px rgba(255,215,0,0.2)' }}>
                        {currentTurnTeam ? `UP NEXT: ${currentTurnTeam.toUpperCase()}` : 'WAITING...'}
                    </div>
                </div>

                <div style={{ 
                    flex: 1, 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(4, 1fr)', 
                    gridTemplateRows: 'repeat(2, 1fr)', 
                    gap: '20px',
                    padding: '10px'
                }}>
                    <AnimatePresence>
                        {cards.map(card => (
                            <FlipCard 
                                key={card.id} 
                                card={card} 
                                isActive={state?.is_active || false}
                                isCurrentTurn={canPick}
                                onPick={handlePickCard}
                                isPicking={isPicking}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        );
    };

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                <Timer size={40} color="var(--primary)" />
            </motion.div>
        </div>
    );

    return (
        <main style={{ 
            height: '100vh', 
            width: '100vw', 
            background: '#020202', 
            color: '#fff', 
            position: 'fixed', 
            inset: 0, 
            overflow: 'hidden', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
        }}>
            {/* WRAPPER (16:9 RATIO) */}
            <div style={{ 
                width: '1920px', 
                height: '1080px', 
                transform: `scale(${scale})`, 
                transformOrigin: 'center center', 
                flexShrink: 0,
                padding: '50px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* HEADER */}
                <div style={{ height: '120px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '4.5rem', fontWeight: 950, letterSpacing: '15px', color: '#fff', margin: 0 }}>
                        <img src="/logo.png" style={{ height: '80px', marginRight: '30px', verticalAlign: 'middle' }} />
                        KESHAV CUP 4.0
                        <img src="/logo.png" style={{ height: '80px', marginLeft: '30px', verticalAlign: 'middle' }} />
                    </h1>
                </div>

                {/* ARENA */}
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '350px 1fr 350px', gap: '50px', minHeight: 0 }}>
                    
                    {/* LEFT: TEAM ORDER */}
                    <div style={{ height: '100%', overflow: 'hidden' }}>
                        {state?.current_slot_id && !isSlotComplete && !isEmpty && (
                            <div className="glass" style={{ borderRadius: '35px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '15px', border: '1px solid rgba(255,215,0,0.1)', height: '100%', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', fontWeight: 950, letterSpacing: '2px' }}>
                                    <Shield size={20} /> TEAM ORDER
                                </div>
                                {turns.map(turn => (
                                    <div 
                                        key={turn.id} 
                                        style={{ 
                                            padding: '15px 20px', 
                                            background: state?.current_turn === turn.turn_order ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.03)', 
                                            color: state?.current_turn === turn.turn_order ? 'var(--primary)' : '#fff',
                                            borderRadius: '20px',
                                            border: state?.current_turn === turn.turn_order ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.05)',
                                            fontWeight: 950,
                                            fontSize: '1.2rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{turn.team?.name?.toUpperCase()}</span>
                                        {state?.current_turn === turn.turn_order && <div className="pulse" style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)' }} />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* CENTER STAGE */}
                    <div className="glass" style={{ borderRadius: '35px', border: '1px solid rgba(255,215,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px', background: 'radial-gradient(circle at center, rgba(255,215,0,0.05) 0%, transparent 80%)' }}>
                        {renderCenterContent()}
                    </div>

                    {/* RIGHT: RECENT PICKS */}
                    <div style={{ height: '100%', overflow: 'hidden' }}>
                        {state?.current_slot_id && !isSlotComplete && !isEmpty && (
                            <div className="glass" style={{ borderRadius: '35px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '15px', border: '1px solid rgba(255,215,0,0.1)', height: '100%', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', fontWeight: 950, letterSpacing: '2px' }}>
                                    <Trophy size={20} /> RECENT PICKS
                                </div>
                                {cards.filter(c => c.is_picked).sort((a, b) => new Date(b.picked_at || 0).getTime() - new Date(a.picked_at || 0).getTime()).map(card => (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} key={card.id} style={{ padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{ width: '50px', height: '50px', borderRadius: '12px', overflow: 'hidden', background: '#111' }}>
                                            <img src={fixPhotoUrl(card.player?.photo_url, card.player?.first_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 950, fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {card.player?.first_name} {card.player?.last_name}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 900 }}>{card.picked_by_team?.name.toUpperCase()}</div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* TICKER */}
                <div style={{ height: '80px', marginTop: '40px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    <div className="ticker-content" style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                        {[...Array(10)].map((_, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', paddingRight: '150px' }}>
                                <img src="/logo.png" style={{ height: '35px', margin: '0 40px' }} />
                                <span style={{ fontSize: '2rem', fontWeight: 950, color: '#fff', letterSpacing: '10px' }}>
                                    KESHAV CUP 4.0 PLAYER SELECTION / JAY SWAMINARAYAN
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* REVEAL POPUP - ULTRA PREMIUM CINEMATIC VERSION */}
            <AnimatePresence>
                {revealPopup && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }} 
                            onClick={() => setRevealPopup(null)} 
                            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 100000, backdropFilter: 'blur(30px)' }} 
                        />
                        <div style={{ 
                            position: 'fixed', 
                            inset: 0, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            zIndex: 100001,
                            pointerEvents: 'none'
                        }}>
                            <motion.div 
                                initial={{ scale: 0.3, opacity: 0, rotateY: 90 }} 
                                animate={{ scale: 1, opacity: 1, rotateY: 0 }} 
                                exit={{ scale: 1.5, opacity: 0, filter: 'blur(40px)' }} 
                                transition={{ type: 'spring', damping: 15, stiffness: 100 }}
                                style={{ 
                                    width: 'min(95vw, 1000px)', 
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '20px',
                                    textAlign: 'center',
                                    pointerEvents: 'auto'
                                }}
                            >
                                {/* Rotating Background Glow */}
                                <motion.div 
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                    style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        width: '1200px',
                                        height: '1200px',
                                        transform: 'translate(-50%, -50%)',
                                        background: 'conic-gradient(from 0deg, transparent, var(--primary), transparent, var(--primary), transparent)',
                                        opacity: 0.1,
                                        filter: 'blur(100px)',
                                        zIndex: -1
                                    }}
                                />

                                <div style={{ 
                                    background: 'linear-gradient(90deg, transparent, var(--primary), transparent)', 
                                    padding: '12px 140px', 
                                    color: '#000', 
                                    fontWeight: 950, 
                                    letterSpacing: '8px', 
                                    fontSize: '1.6rem', 
                                    borderRadius: '50px',
                                    boxShadow: '0 0 70px var(--primary-glow)',
                                    marginBottom: '10px',
                                    textTransform: 'uppercase'
                                }}>
                                    KESHAV CUP 2026
                                </div>

                                <div style={{ 
                                    height: '52vh',
                                    width: 'auto',
                                    aspectRatio: '1/1', 
                                    borderRadius: '40px', 
                                    border: '12px solid var(--primary)', 
                                    overflow: 'hidden', 
                                    boxShadow: '0 0 100px rgba(255,215,0,0.4)', 
                                    background: '#111', 
                                    position: 'relative'
                                }}>
                                    <img src={fixPhotoUrl(revealPopup.player?.photo_url, revealPopup.player?.first_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    {/* Bottom Overlay for Team */}
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, transparent 100%)', padding: '60px 40px 20px' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '8px', textTransform: 'uppercase' }}>
                                            {revealPopup.team?.name}
                                        </div>
                                    </div>
                                </div>

                                <motion.div
                                    initial={{ y: 30, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    style={{ width: '100%' }}
                                >
                                    <h2 style={{ fontSize: 'min(9vw, 8rem)', fontWeight: 950, margin: '10px 0', lineHeight: 0.75, letterSpacing: '-5px' }}>
                                        {revealPopup.player?.first_name.toUpperCase()}<br/>
                                        <span style={{ color: 'var(--primary)', textShadow: '0 0 100px rgba(255,215,0,0.6)' }}>
                                            {(revealPopup.player?.last_name || '').toUpperCase()}
                                        </span>
                                    </h2>
                                    
                                    <div style={{ fontSize: '2.4rem', fontWeight: 950, color: '#fff', letterSpacing: '4px', textTransform: 'uppercase', textShadow: '0 0 40px rgba(0,0,0,1)', marginTop: '5px' }}>
                                        WELCOME TO <span style={{ color: 'var(--primary)' }}>{(revealPopup.team?.name || 'THE SQUAD').toUpperCase()}</span> SQUAD
                                    </div>
                                </motion.div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>

            <style jsx global>{`
                .pulse { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7); animation: pulse 1.5s infinite; }
                @keyframes pulse {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7); }
                    70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(255, 215, 0, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 215, 0, 0); }
                }
                @keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
                .ticker-content { animation: ticker-scroll 40s linear infinite; }
            `}</style>
        </main>
    );
}
