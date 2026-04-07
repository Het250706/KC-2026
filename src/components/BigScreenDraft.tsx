'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import DraftCard from './DraftCard';
import TeamTurnBanner from './TeamTurnBanner';
import WelcomeModal from './WelcomeModal';

export default function BigScreenDraft() {
    const [players, setPlayers] = useState<any[]>([]);
    const [draftState, setDraftState] = useState<any>(null);
    const [revealedPlayer, setRevealedPlayer] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showSlotReveal, setShowSlotReveal] = useState(false);
    const [lastSlot, setLastSlot] = useState<number | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const fetchData = async (isInitial = false) => {
        if (isInitial) setLoading(true);
        
        // Fetch current draft state with joining teams info
        const { data: state, error: stateError } = await supabase
            .from('draft_state')
            .select('*, teams(*)')
            .maybeSingle();

        if (state) {
            const slotChanged = lastSlot !== null && state.current_slot !== lastSlot;
            
            if (slotChanged) {
                setShowSlotReveal(true);
                setTimeout(() => setShowSlotReveal(false), 5000);
            }
            
            // Only fetch players if slot changed OR it's initial load
            if (slotChanged || isInitial || !players.length) {
                const { data: p } = await supabase
                    .from('players')
                    .select('*')
                    .eq('slot_number', state.current_slot)
                    .order('created_at', { ascending: true });
                
                setPlayers(p || []);
                
                // Pre-fetch player images
                if (p) {
                    p.forEach(player => {
                        const img = new Image();
                        img.src = player.photo_url || player.photo;
                    });
                }
            }

            setLastSlot(state.current_slot);
            setDraftState(state);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData(true); // Initial fetch with full loading

        // Real-time synchronization
        const channel = supabase.channel('draft_big_screen_v40')
            .on('postgres_changes', { event: '*', table: 'draft_state', schema: 'public' }, (payload) => {
                // Smart update instead of full refresh
                if (payload.new) {
                    setDraftState((prev: any) => ({ ...prev, ...payload.new }));
                    // If slot changed, we need a full fetch
                    if (payload.new.current_slot !== lastSlot) {
                        fetchData(false);
                    }
                }
            })
            .on('postgres_changes', { event: '*', table: 'players', schema: 'public' }, (payload) => {
                if (payload.new && payload.new.is_selected) {
                    setPlayers(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleFlip = async (player: any) => {
        if (draftState?.is_reveal_open || player.is_selected) return;

        try {
            const res = await fetch('/api/draft/select-player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: player.id })
            });

            if (res.ok) {
                // Trigger Sound Effect (optional, if file exists)
                if (audioRef.current) audioRef.current.play().catch(() => {});
                
                // Trigger Confetti
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#ffd700', '#ffffff', '#ffaa00']
                });

                // Show welcome modal
                setRevealedPlayer(player);
            }
        } catch (err) {
            console.error('Pick error:', err);
        }
    };

    const handleCloseModal = async () => {
        setRevealedPlayer(null);
        await fetch('/api/draft/next-turn', { method: 'POST' });
    };

    if (loading && !draftState) return (
        <div style={{ height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 900, fontSize: '2rem', letterSpacing: '10px' }}>
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                LOADING DRAFT ARENA...
            </motion.div>
        </div>
    );

    // Check if slot logic applies
    const isSlotComplete = draftState && players.length > 0 && players.every(p => p.is_selected);
    const isEmpty = draftState && players.length === 0;

    if (!draftState || isSlotComplete || isEmpty) return (
        <div style={{ height: '100vh', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', position: 'relative', overflow: 'hidden' }}>
             {/* TOP HEADER */}
             <div style={{ 
                position: 'fixed', 
                top: '0', 
                left: 0, 
                right: 0, 
                height: '140px',
                background: 'rgba(0,0,0,0.85)',
                backdropFilter: 'blur(20px)',
                zIndex: 2100, 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
                <h1 
                    style={{ 
                        fontSize: '5rem', 
                        fontWeight: 950, 
                        color: '#ffffff', 
                        margin: 0,
                        textTransform: 'uppercase',
                        letterSpacing: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '30px'
                    } as any}
                >
                    <img src="/logo.png" style={{ height: '70px', width: 'auto' }} />
                    <span>KESHAV CUP 4.0 PLAYER SELECTION</span>
                    <img src="/logo.png" style={{ height: '70px', width: 'auto' }} />
                </h1>
            </div>

             <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ textAlign: 'center', zIndex: 10 }}
             >
                <div style={{ position: 'relative', display: 'inline-block' }}>
                     <motion.img 
                        src="/logo.png" 
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 5 }}
                        style={{ height: '150px', width: 'auto', marginBottom: '20px', filter: 'drop-shadow(0 0 30px rgba(255,215,0,0.3))' }}
                    />
                </div>
                <h2 style={{ fontSize: '7rem', fontWeight: 950, color: 'var(--primary)', letterSpacing: '4px', textTransform: 'uppercase', margin: 0, textShadow: '0 10px 50px rgba(0,0,0,1)' }}>
                    {isSlotComplete ? 'SLOT COMPLETED' : 'PLAYER SELECTION IN PROGRESS'}
                </h2>
                <div style={{ fontSize: '2.5rem', fontWeight: 950, color: '#fff', letterSpacing: '15px', textTransform: 'uppercase', opacity: 0.6 }}>
                    {isSlotComplete ? 'PREPARING NEXT ROUND...' : 'JAY SWAMINARAYAN'}
                </div>
             </motion.div>

             {/* BOTTOM TICKER */}
            <div style={{ 
                position: 'fixed', 
                bottom: 0, 
                left: 0, 
                right: 0, 
                height: '110px', 
                background: 'rgba(0,0,0,0.98)', 
                borderTop: '2px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                zIndex: 2100
            }}>
                <div className="ticker-content" style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    whiteSpace: 'nowrap'
                }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', paddingRight: '120px' }}>
                            <img src="/logo.png" style={{ height: '70px', width: 'auto', margin: '0 40px' }} />
                            <span style={{ 
                                fontSize: '4rem', 
                                fontWeight: 950, 
                                color: '#ffffff', 
                                letterSpacing: '12px',
                                textTransform: 'uppercase'
                            }}>
                                KESHAV CUP 4.0 PLAYER SELECTION / JAY SWAMINARAYAN
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <main style={{ 
            minHeight: '100vh', 
            background: 'linear-gradient(to bottom, #000, #0a0a0a)', 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden',
            position: 'relative'
        }}>
            {/* Background elements */}
             <div style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: '10%', left: '5%', width: '600px', height: '600px', background: 'var(--primary)', filter: 'blur(150px)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: '700px', height: '700px', background: '#004ba0', filter: 'blur(180px)', borderRadius: '50%' }} />
            </div>

            {/* TOP HEADER */}
            <div style={{ 
                position: 'fixed', 
                top: '0', 
                left: 0, 
                right: 0, 
                height: '140px',
                background: 'rgba(0,0,0,0.85)',
                backdropFilter: 'blur(20px)',
                zIndex: 2100, 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
                <h1 
                    style={{ 
                        fontSize: '5rem', 
                        fontWeight: 950, 
                        color: '#ffffff', 
                        margin: 0,
                        textTransform: 'uppercase',
                        letterSpacing: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '30px'
                    } as any}
                >
                    <img src="/logo.png" style={{ height: '70px', width: 'auto' }} />
                    <span>KESHAV CUP 4.0 PLAYER SELECTION</span>
                    <img src="/logo.png" style={{ height: '70px', width: 'auto' }} />
                </h1>
            </div>

            <div style={{ marginTop: '160px', width: '100%' }}>
                <TeamTurnBanner team={draftState.teams} />
            </div>

            <div style={{ 
                flex: 1, 
                padding: '60px 80px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                zIndex: 1
            }}>
                <div style={{ textAlign: 'center', marginBottom: '50px' }}>
                    <div style={{ fontSize: '1.2rem', color: 'var(--primary)', fontWeight: 950, letterSpacing: '6px', textTransform: 'uppercase' }}>
                        Slot {draftState.current_slot} • Group Release
                    </div>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(280px, 1fr))',
                    gap: '40px',
                    width: '100%',
                    maxWidth: '1400px'
                }}>
                    <AnimatePresence>
                        {players.map((p, i) => (
                            <motion.div 
                                key={p.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <DraftCard 
                                    player={p} 
                                    isRevealed={p.is_selected} 
                                    onFlip={() => handleFlip(p)}
                                    disabled={draftState.is_reveal_open}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Stats Overlay at Bottom */}
            <div style={{ 
                background: 'rgba(0,0,0,0.95)', 
                padding: '20px 60px', 
                display: 'flex', 
                justifyContent: 'center', 
                gap: '80px', 
                borderTop: '4px solid rgba(255,215,0,0.05)', 
                backdropFilter: 'blur(20px)',
                zIndex: 10,
                marginBottom: '120px'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', fontWeight: 900, letterSpacing: '4px', textTransform: 'uppercase' }}>Current Release</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 950, color: 'var(--primary)', letterSpacing: '2px' }}>SLOT {draftState.current_slot}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', fontWeight: 900, letterSpacing: '4px', textTransform: 'uppercase' }}>Available Cards</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 950, color: '#fff', letterSpacing: '2px' }}>{players.filter(p => !p.is_selected).length}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', fontWeight: 900, letterSpacing: '4px', textTransform: 'uppercase' }}>Selected Cards</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 950, color: '#00ff80', letterSpacing: '2px' }}>{players.filter(p => p.is_selected).length}</div>
                </div>
            </div>

            {/* BOTTOM TICKER */}
            <div style={{ 
                position: 'fixed', 
                bottom: 0, 
                left: 0, 
                right: 0, 
                height: '110px', 
                background: 'rgba(0,0,0,0.98)', 
                borderTop: '2px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                zIndex: 2100
            }}>
                <div className="ticker-content" style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    whiteSpace: 'nowrap'
                }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', paddingRight: '120px' }}>
                            <img src="/logo.png" style={{ height: '70px', width: 'auto', margin: '0 40px' }} />
                            <span style={{ 
                                fontSize: '4rem', 
                                fontWeight: 950, 
                                color: '#ffffff', 
                                letterSpacing: '12px',
                                textTransform: 'uppercase'
                            }}>
                                KESHAV CUP 4.0 PLAYER SELECTION / JAY SWAMINARAYAN
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <AnimatePresence>
                {revealedPlayer && (
                    <WelcomeModal 
                        player={revealedPlayer} 
                        team={draftState.teams} 
                        onClose={handleCloseModal}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showSlotReveal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 1 } }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 2000,
                            background: 'rgba(0,0,0,0.95)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backdropFilter: 'blur(50px)'
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0, y: 100 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 1.5, opacity: 0, filter: 'blur(40px)' }}
                            transition={{ type: 'spring', damping: 20 }}
                            style={{ textAlign: 'center' }}
                        >
                            <motion.img 
                                src="/logo.png" 
                                style={{ height: '300px', width: 'auto', marginBottom: '60px', filter: 'drop-shadow(0 0 50px rgba(255,215,0,0.3))' }}
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ repeat: Infinity, duration: 4 }}
                            />
                            <div style={{ color: 'var(--primary)', fontSize: '4rem', fontWeight: 950, letterSpacing: '20px', textTransform: 'uppercase', marginBottom: '20px', opacity: 0.8 }}>
                                PREPARING RELEASE
                            </div>
                            <h2 style={{ fontSize: '15rem', fontWeight: 950, color: '#fff', lineHeight: 0.8, letterSpacing: '-10px', textTransform: 'uppercase' }}>
                                SLOT {draftState.current_slot}<br/>
                                <span style={{ color: 'var(--primary)', fontSize: '10rem', letterSpacing: '5px' }}>REVEAL</span>
                            </h2>
                            <div style={{ marginTop: '50px', height: '10px', width: '400px', background: 'rgba(255,215,0,0.1)', borderRadius: '50px', margin: '60px auto', overflow: 'hidden' }}>
                                <motion.div 
                                    initial={{ x: '-100%' }}
                                    animate={{ x: '100%' }}
                                    transition={{ duration: 5, ease: 'linear' }}
                                    style={{ height: '100%', width: '100%', background: 'var(--primary)', boxShadow: '0 0 20px var(--primary)' }}
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <audio ref={audioRef} src="/reveal_sound.mp3" preload="auto" />
            <style jsx global>{`
                @keyframes ticker-scroll {
                    0% { transform: translate3d(0, 0, 0); }
                    100% { transform: translate3d(-50%, 0, 0); }
                }

                .ticker-content {
                    animation: ticker-scroll 30s linear infinite;
                }
            `}</style>
        </main>
    );
}
