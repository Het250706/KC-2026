'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { supabase } from '@/lib/supabase';
import { fixPhotoUrl } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// --- STYLES & CONSTANTS ---
const COLORS = {
    bg: '#000000',
    white: '#ffffff',
    electricBlue: '#00d2ff',
    neonGreen: '#39ff14',
    steelGray: '#1c1c1c',
    cardLight: 'rgba(255, 255, 255, 0.03)',
    soldRed: '#ff3131',
    stamp: '#ff0000',
    accentGlow: 'rgba(0, 210, 255, 0.2)',
    brightYellow: '#ffff00',
};

const BROADCAST_NAME = "KESHAV CUP 4.0 PLAYER AUCTION / JAY SWAMINARAYAN";

const DisplayAuctionPage = memo(function DisplayAuctionPage() {
    // --- STATE ---
    const [state, setState] = useState<any>({
        auctionState: null,
        currentPlayer: null,
        highestBidTeam: null,
        loading: true,
        showStamp: false,
        showSoldBanner: false,
        playedSoldPlayerId: null
    });
    const [bidNotifications, setBidNotifications] = useState<any[]>([]);
    const [showSoldMessage, setShowSoldMessage] = useState(false);
    const [soldData, setSoldData] = useState<{ playerName: string, teamName: string, amount: number } | null>(null);

    // --- REFS ---
    const lastBidValueRef = useRef<number>(0);
    const hammerSoundRef = useRef<HTMLAudioElement | null>(null);
    const bidSoundRef = useRef<HTMLAudioElement | null>(null);
    const isFirstLoadRef = useRef(true);
    const preloadedImageRef = useRef<HTMLImageElement | null>(null);

    // --- HELPERS ---
    const fetchPlayer = useCallback(async (id: string) => {
        if (!id) return null;
        const { data } = await supabase
            .from('players')
            .select('id, first_name, last_name, photo_url, role, base_price, was_present_kc3')
            .eq('id', id)
            .single();
        return data;
    }, []);

    const fetchTeam = useCallback(async (id: string) => {
        if (!id) return null;
        const { data } = await supabase
            .from('teams')
            .select('name')
            .eq('id', id)
            .single();
        return data;
    }, []);

    const triggerSoldSequence = useCallback(async (finalState: any) => {
        const [player, team] = await Promise.all([
            finalState.current_player_id ? fetchPlayer(finalState.current_player_id) : Promise.resolve(null),
            finalState.highest_bid_team_id ? fetchTeam(finalState.highest_bid_team_id) : Promise.resolve(null)
        ]);

        // Populate Sold Message Data
        if (player) {
            setSoldData({
                playerName: `${player.first_name} ${player.last_name}`,
                teamName: team?.name || 'Unknown Team',
                amount: finalState.current_highest_bid || 0
            });
            setShowSoldMessage(true);

            // Clean up sequence aligned to 5 seconds
            setTimeout(() => {
                setShowSoldMessage(false);
                setState((prev: any) => ({
                    ...prev,
                    auctionState: { ...prev.auctionState, status: 'IDLE' },
                    currentPlayer: null,
                    highestBidTeam: null,
                    showStamp: false,
                    showSoldBanner: false,
                    playedSoldPlayerId: null,
                    loading: false
                }));
                setBidNotifications([]);
                lastBidValueRef.current = 0;
            }, 5000);
        }

        setState((prev: any) => ({
            ...prev,
            auctionState: finalState,
            currentPlayer: player,
            highestBidTeam: team,
            showStamp: true,
            loading: false
        }));

        hammerSoundRef.current?.play().catch(() => { });
    }, [fetchPlayer, fetchTeam]);

    const fetchData = useCallback(async () => {
        try {
            const { data: stateData } = await supabase
                .from('auction_state')
                .select('status, current_player_id, highest_bid_team_id, current_highest_bid')
                .single();

            if (stateData) {
                const playerChanged = stateData.current_player_id !== state.auctionState?.current_player_id;

                if (stateData.status === 'SOLD') {
                    if (state.playedSoldPlayerId !== stateData.current_player_id) {
                        setState((prev: any) => ({ ...prev, playedSoldPlayerId: stateData.current_player_id }));
                        triggerSoldSequence(stateData);
                    }
                } else if (stateData.status === 'BIDDING') {
                    const [player, team] = await Promise.all([
                        playerChanged ? fetchPlayer(stateData.current_player_id) : Promise.resolve(state.currentPlayer),
                        fetchTeam(stateData.highest_bid_team_id)
                    ]);

                    setState((prev: any) => ({
                        ...prev,
                        auctionState: stateData,
                        currentPlayer: player,
                        highestBidTeam: team,
                        playedSoldPlayerId: null,
                        showStamp: false,
                        showSoldBanner: false,
                        loading: false
                    }));

                    // Preload next player
                    if (stateData.current_player_id) {
                        try {
                            const { data: nextPlayers } = await supabase
                                .from('players')
                                .select('photo_url, first_name')
                                .is('team_id', null)
                                .neq('id', stateData.current_player_id)
                                .limit(1);

                            if (nextPlayers?.[0]) {
                                const url = fixPhotoUrl(nextPlayers[0].photo_url, nextPlayers[0].first_name);
                                preloadedImageRef.current = new Image();
                                preloadedImageRef.current.src = url;
                            }
                        } catch (e) { }
                    }
                } else {
                    setState((prev: any) => ({
                        ...prev,
                        auctionState: stateData,
                        currentPlayer: null,
                        highestBidTeam: null,
                        playedSoldPlayerId: null,
                        showStamp: false,
                        showSoldBanner: false,
                        loading: false
                    }));
                }

                if (stateData.current_highest_bid > lastBidValueRef.current && stateData.status === 'BIDDING') {
                    const timestamp = Date.now();
                    const newNotif = {
                        id: `bid-${timestamp}`,
                        message: `NEW BID: ${stateData.current_highest_bid} PUSHP`,
                        timestamp,
                    };
                    setBidNotifications((prev) => {
                        const updated = [...prev, newNotif];
                        setTimeout(() => {
                            setBidNotifications((current) => current.filter((n) => n.id !== newNotif.id));
                        }, 3000);
                        return updated.slice(-3);
                    });
                    bidSoundRef.current?.play().catch(() => { });
                }

                lastBidValueRef.current = stateData.current_highest_bid;
            }
        } catch (err) {
            console.error("Fetch error:", err);
        }
    }, [state.auctionState?.current_player_id, state.currentPlayer, state.playedSoldPlayerId, triggerSoldSequence, fetchPlayer, fetchTeam]);

    useEffect(() => {
        if (typeof Audio !== 'undefined') {
            hammerSoundRef.current = new Audio('/hammer.mp3');
            hammerSoundRef.current.volume = 0.2;
            bidSoundRef.current = new Audio('/bid.mp3');
            bidSoundRef.current.volume = 0.15;
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 800);
        return () => clearInterval(interval);
    }, [fetchData]);

    useEffect(() => {
        if (isFirstLoadRef.current && state.auctionState?.current_player_id) {
            const currentBid = state.auctionState?.current_highest_bid || 0;
            lastBidValueRef.current = currentBid;
            isFirstLoadRef.current = false;
        }
    }, [state.auctionState?.current_player_id, state.auctionState?.current_highest_bid]);

    const { auctionState, currentPlayer, highestBidTeam, loading, showStamp, showSoldBanner } = state;

    return (
        <main style={{
            width: '100vw',
            height: '100vh',
            minHeight: '100vh',
            background: COLORS.bg,
            color: COLORS.white,
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: '"Inter", sans-serif'
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { margin: 0; padding: 0; overflow: hidden; }
                
                @keyframes ticker-scroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                
                /* Responsive breakpoints */
                @media (max-width: 1920px) {
                    .player-card { max-width: min(45vw, 900px) !important; }
                }
                
                @media (max-width: 1600px) {
                    .player-card { max-width: min(48vw, 800px) !important; }
                    .notification-container { bottom: 12vh !important; right: 3vw !important; }
                }
                
                @media (max-width: 1366px) {
                    .player-card { max-width: min(50vw, 700px) !important; }
                    .notification-container { bottom: 11vh !important; }
                }
                
                @media (max-width: 1280px) {
                    .player-card { max-width: min(52vw, 650px) !important; }
                }
                
                @media (max-height: 900px) {
                    .main-content { padding-top: 3vh !important; }
                }
            `}</style>

            <audio ref={hammerSoundRef} preload="auto" />
            <audio ref={bidSoundRef} preload="auto" />

            {/* FULL-SCREEN SOLD OVERLAY */}
            <AnimatePresence>
                {showSoldMessage && soldData && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.95))',
                            backdropFilter: 'blur(30px)',
                            zIndex: 9999,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            padding: '5vh'
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.5, rotate: -10 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', damping: 12 }}
                            style={{
                                fontSize: 'clamp(6rem, 12vw, 15rem)',
                                fontWeight: 950,
                                color: COLORS.brightYellow,
                                textShadow: `0 0 80px rgba(255, 255, 0, 0.8), 0 0 120px rgba(255, 255, 0, 0.4)`,
                                letterSpacing: 'clamp(10px, 2vw, 30px)',
                                marginBottom: '4vh'
                            }}
                        >
                            SOLD!
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            style={{
                                fontSize: 'clamp(3rem, 6vw, 7rem)',
                                fontWeight: 700,
                                color: COLORS.white,
                                marginBottom: '3vh',
                                textShadow: '0 0 30px rgba(255,255,255,0.3)'
                            }}
                        >
                            {soldData.playerName}
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            style={{
                                fontSize: 'clamp(2.5rem, 5vw, 6rem)',
                                fontWeight: 600,
                                color: COLORS.electricBlue,
                                marginBottom: '2vh',
                                textShadow: `0 0 40px ${COLORS.electricBlue}`
                            }}
                        >
                            to {soldData.teamName}
                        </motion.div>

                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.7, type: 'spring' }}
                            style={{
                                fontSize: 'clamp(4rem, 8vw, 10rem)',
                                fontWeight: 950,
                                color: COLORS.neonGreen,
                                textShadow: `0 0 60px ${COLORS.neonGreen}, 0 0 100px rgba(57, 255, 20, 0.5)`,
                                background: 'linear-gradient(to right, transparent, rgba(57, 255, 20, 0.1), rgba(57, 255, 20, 0.2), rgba(57, 255, 20, 0.1), transparent)',
                                padding: 'clamp(20px, 3vh, 50px) clamp(40px, 6vw, 100px)',
                                borderRadius: 'clamp(30px, 5vw, 60px)',
                                border: '3px solid rgba(57, 255, 20, 0.3)',
                                boxShadow: '0 30px 80px rgba(0,0,0,0.9), inset 0 0 60px rgba(57, 255, 20, 0.1)'
                            }}
                        >
                            {soldData.amount} PUSHP
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MAIN CONTENT AREA */}
            <div className="main-content" style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: '5vh',
                paddingBottom: '15vh',
                position: 'relative',
                zIndex: 1
            }}>
                <AnimatePresence mode="wait">
                    {currentPlayer && auctionState?.status === 'BIDDING' ? (
                        <motion.div
                            key={currentPlayer.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3 }}
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative'
                            }}
                        >
                            <div className="player-card" style={{
                                background: 'linear-gradient(135deg, rgba(20,20,20,0.95), rgba(40,40,40,0.9))',
                                borderRadius: 'clamp(20px, 2vw, 40px)',
                                padding: 'clamp(30px, 4vh, 60px)',
                                border: `3px solid ${COLORS.electricBlue}`,
                                boxShadow: `0 0 80px ${COLORS.accentGlow}, 0 30px 100px rgba(0,0,0,0.9)`,
                                backdropFilter: 'blur(20px)',
                                position: 'relative',
                                width: '90%',
                                maxWidth: 'min(50vw, 1000px)',
                                minHeight: 'clamp(500px, 60vh, 700px)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 'clamp(20px, 3vh, 40px)',
                                overflow: 'visible'
                            }}>
                                {/* STAMP OVERLAY */}
                                <AnimatePresence>
                                    {showStamp && (
                                        <motion.div
                                            initial={{ scale: 0, rotate: -45, opacity: 0 }}
                                            animate={{ scale: 1, rotate: -15, opacity: 0.9 }}
                                            style={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                fontSize: 'clamp(6rem, 12vw, 16rem)',
                                                fontWeight: 950,
                                                color: COLORS.stamp,
                                                textShadow: `0 0 60px ${COLORS.stamp}`,
                                                border: `8px solid ${COLORS.stamp}`,
                                                borderRadius: '30px',
                                                padding: 'clamp(20px, 3vh, 50px) clamp(40px, 5vw, 100px)',
                                                zIndex: 100,
                                                pointerEvents: 'none',
                                                letterSpacing: 'clamp(10px, 2vw, 30px)'
                                            }}
                                        >
                                            SOLD
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* PLAYER IMAGE */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    marginBottom: 'clamp(10px, 2vh, 20px)'
                                }}>
                                    <motion.img
                                        key={currentPlayer.id}
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ duration: 0.4 }}
                                        src={fixPhotoUrl(currentPlayer.photo_url, currentPlayer.first_name)}
                                        alt={currentPlayer.first_name}
                                        style={{
                                            width: 'clamp(200px, 25vw, 400px)',
                                            height: 'clamp(200px, 25vw, 400px)',
                                            objectFit: 'cover',
                                            borderRadius: '50%',
                                            border: `6px solid ${COLORS.electricBlue}`,
                                            boxShadow: `0 0 60px ${COLORS.accentGlow}, 0 20px 50px rgba(0,0,0,0.8)`
                                        }}
                                    />
                                </div>

                                {/* PLAYER NAME */}
                                <motion.h1
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    style={{
                                        fontSize: 'clamp(3rem, 6vw, 7rem)',
                                        fontWeight: 950,
                                        textAlign: 'center',
                                        color: COLORS.white,
                                        textShadow: `0 0 40px ${COLORS.accentGlow}`,
                                        letterSpacing: 'clamp(4px, 1vw, 10px)',
                                        textTransform: 'uppercase',
                                        lineHeight: 1.1
                                    }}
                                >
                                    {currentPlayer.first_name} {currentPlayer.last_name}
                                </motion.h1>

                                {/* PLAYER INFO GRID */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                    gap: 'clamp(15px, 2vw, 30px)',
                                    marginTop: 'clamp(10px, 2vh, 20px)'
                                }}>
                                    <InfoCard label="ROLE" value={currentPlayer.role} />
                                    <InfoCard label="BASE PRICE" value={`${currentPlayer.base_price} P`} />
                                    {currentPlayer.was_present_kc3 && (
                                        <InfoCard
                                            label="KC 3.0"
                                            value="VETERAN"
                                            highlight
                                        />
                                    )}
                                </div>

                                {/* CURRENT BID SECTION */}
                                <motion.div
                                    initial={{ scale: 0.9 }}
                                    animate={{ scale: 1 }}
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(0, 210, 255, 0.15), rgba(0, 100, 150, 0.1))',
                                        border: `3px solid ${COLORS.electricBlue}`,
                                        borderRadius: 'clamp(15px, 2vw, 30px)',
                                        padding: 'clamp(20px, 3vh, 40px)',
                                        marginTop: 'clamp(10px, 2vh, 20px)',
                                        boxShadow: `0 0 40px ${COLORS.accentGlow}, inset 0 0 30px rgba(0, 210, 255, 0.1)`
                                    }}
                                >
                                    <div style={{
                                        textAlign: 'center',
                                        fontSize: 'clamp(1.8rem, 3vw, 3rem)',
                                        fontWeight: 600,
                                        color: COLORS.electricBlue,
                                        marginBottom: 'clamp(10px, 1.5vh, 20px)',
                                        letterSpacing: 'clamp(3px, 0.5vw, 8px)'
                                    }}>
                                        CURRENT BID
                                    </div>

                                    <AnimatePresence mode="wait">
                                        {highestBidTeam ? (
                                            <motion.div
                                                key={`${highestBidTeam.name}-${auctionState.current_highest_bid}`}
                                                initial={{ scale: 0.8, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0.8, opacity: 0 }}
                                            >
                                                <div style={{
                                                    textAlign: 'center',
                                                    fontSize: 'clamp(2rem, 4vw, 4.5rem)',
                                                    fontWeight: 700,
                                                    color: COLORS.white,
                                                    marginBottom: 'clamp(8px, 1vh, 15px)'
                                                }}>
                                                    {highestBidTeam.name}
                                                </div>
                                                <motion.div
                                                    animate={{ scale: [1, 1.1, 1] }}
                                                    transition={{ duration: 0.5 }}
                                                    style={{
                                                        textAlign: 'center',
                                                        fontSize: 'clamp(4rem, 8vw, 9rem)',
                                                        fontWeight: 950,
                                                        color: COLORS.neonGreen,
                                                        textShadow: `0 0 50px ${COLORS.neonGreen}, 0 0 80px rgba(57, 255, 20, 0.4)`,
                                                        letterSpacing: 'clamp(5px, 1vw, 15px)'
                                                    }}
                                                >
                                                    {auctionState.current_highest_bid} PUSHP
                                                </motion.div>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="awaiting"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                style={{
                                                    textAlign: 'center',
                                                    fontSize: 'clamp(2.5rem, 5vw, 5rem)',
                                                    fontWeight: 700,
                                                    color: COLORS.white,
                                                    opacity: 0.6
                                                }}
                                            >
                                                AWAITING BIDS...
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            </div>

                            {/* OLD SOLD BANNER (HIDDEN IF NEW OVERLAY IS ON) */}
                            <AnimatePresence>
                                {showSoldBanner && highestBidTeam && !showSoldMessage && (
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        style={{
                                            position: 'absolute',
                                            bottom: '-10vh',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            zIndex: 300,
                                            width: '80%',
                                            textAlign: 'center'
                                        }}
                                    >
                                        <div style={{
                                            fontSize: 'clamp(4rem, 8vw, 9rem)',
                                            fontWeight: 950,
                                            color: COLORS.brightYellow,
                                            textShadow: `0 0 60px rgba(255, 255, 0, 0.5)`,
                                            background: 'linear-gradient(to right, transparent, rgba(255, 255, 0, 0.1), rgba(255, 255, 0, 0.2), rgba(255, 255, 0, 0.1), transparent)',
                                            padding: 'clamp(30px, 4vh, 60px) clamp(50px, 8vw, 150px)',
                                            borderRadius: 'clamp(40px, 6vw, 100px)',
                                            borderTop: '2px solid rgba(255, 255, 0, 0.3)',
                                            borderBottom: '2px solid rgba(255, 255, 0, 0.3)',
                                            boxShadow: '0 50px 100px rgba(0,0,0,0.9)',
                                            backdropFilter: 'blur(20px)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        } as any}>
                                            SOLD TO <span style={{ color: COLORS.brightYellow }}>{highestBidTeam.name.toUpperCase()}</span> FOR {auctionState.current_highest_bid} PUSHP
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="waiting-screen"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{ textAlign: 'center', zIndex: 10 }}
                        >
                            <motion.img
                                src="/logo.png"
                                style={{
                                    height: 'clamp(100px, 15vh, 200px)',
                                    width: 'auto',
                                    marginBottom: 'clamp(20px, 4vh, 60px)'
                                }}
                                animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            />
                            <h1 style={{
                                color: '#FFD700',
                                fontSize: 'clamp(4rem, 8vw, 10rem)',
                                fontWeight: 950,
                                margin: 0,
                                textShadow: '0 0 40px rgba(255, 215, 0, 0.3)',
                                letterSpacing: 'clamp(5px, 1vw, 15px)'
                            }}>
                                AUCTION IN PROGRESS
                            </h1>
                            <h2 style={{
                                color: '#FFD700',
                                fontSize: 'clamp(2rem, 4vw, 4rem)',
                                fontWeight: 600,
                                marginTop: 'clamp(10px, 2vh, 20px)',
                                letterSpacing: 'clamp(3px, 0.5vw, 8px)',
                                opacity: 0.7
                            }}>
                                JAY SWAMINARAYAN
                            </h2>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* BID NOTIFICATIONS - FIXED SIZE & POSITION */}
            <div className="notification-container" style={{
                position: 'fixed',
                bottom: '14vh',
                right: '4vw',
                display: 'flex',
                flexDirection: 'column',
                gap: 'clamp(15px, 2vh, 30px)',
                zIndex: 1000,
                pointerEvents: 'none',
                maxWidth: '35vw'
            }}>
                <AnimatePresence>
                    {bidNotifications.map((n) => (
                        <motion.div
                            key={n.id}
                            initial={{ opacity: 0, x: 200, rotate: 10 }}
                            animate={{ opacity: 1, x: 0, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.5, filter: 'blur(20px)' }}
                            style={{
                                background: 'linear-gradient(to right, rgba(0,0,0,0.95), rgba(26,26,26,0.95))',
                                color: COLORS.white,
                                borderLeft: `clamp(6px, 0.8vw, 12px) solid ${COLORS.electricBlue}`,
                                boxShadow: `0 20px 50px rgba(0,0,0,0.9), 0 0 40px ${COLORS.accentGlow}`,
                                padding: 'clamp(20px, 3vh, 50px) clamp(30px, 4vw, 70px)',
                                borderRadius: 'clamp(15px, 2vw, 35px)',
                                fontSize: 'clamp(1.5rem, 2.5vw, 3rem)',
                                fontWeight: 950,
                                backdropFilter: 'blur(30px)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'clamp(15px, 2vw, 35px)',
                                border: `2px solid ${COLORS.electricBlue}`,
                                minWidth: 'fit-content'
                            }}
                        >
                            <motion.div
                                animate={{ scale: [1, 1.5, 1] }}
                                transition={{ duration: 0.5 }}
                                style={{
                                    width: 'clamp(12px, 1.5vw, 25px)',
                                    height: 'clamp(12px, 1.5vw, 25px)',
                                    borderRadius: '50%',
                                    background: COLORS.electricBlue,
                                    boxShadow: `0 0 20px ${COLORS.electricBlue}`,
                                    flexShrink: 0
                                }}
                            />
                            <span style={{ whiteSpace: 'nowrap' }}>{n.message}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* BOTTOM TICKER - RESPONSIVE */}
            <div style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: 'clamp(80px, 10vh, 140px)',
                background: 'rgba(0,0,0,0.98)',
                borderTop: '4px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                zIndex: 500
            }}>
                <div className="ticker-content" style={{
                    display: 'flex',
                    alignItems: 'center',
                    animation: 'ticker-scroll 30s linear infinite',
                    whiteSpace: 'nowrap',
                    willChange: 'transform'
                }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} style={{
                            display: 'flex',
                            alignItems: 'center',
                            paddingRight: 'clamp(40px, 6vw, 100px)'
                        }}>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                height: '100%'
                            }}>
                                <img
                                    src="/logo.png"
                                    style={{
                                        height: 'clamp(60px, 8vh, 120px)',
                                        width: 'auto',
                                        margin: '0 clamp(20px, 3vw, 50px)',
                                        verticalAlign: 'middle',
                                        display: 'inline-flex',
                                        alignItems: 'center'
                                    }}
                                    alt="Logo"
                                />
                            </span>
                            <span style={{
                                fontSize: 'clamp(2.5rem, 4vw, 6.5rem)',
                                fontWeight: 950,
                                color: COLORS.white,
                                letterSpacing: 'clamp(8px, 1.5vw, 22px)',
                                background: `linear-gradient(to bottom, #fff 0%, #aaa 100%)`,
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                display: 'inline-flex',
                                alignItems: 'center'
                            } as any}>
                                {BROADCAST_NAME}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
});

// Helper component for info cards
const InfoCard = ({ label, value, highlight = false }: { label: string, value: string, highlight?: boolean }) => (
    <div style={{
        background: highlight
            ? 'linear-gradient(135deg, rgba(0, 210, 255, 0.2), rgba(0, 150, 200, 0.15))'
            : 'rgba(255, 255, 255, 0.05)',
        border: `2px solid ${highlight ? COLORS.electricBlue : 'rgba(255, 255, 255, 0.1)'}`,
        borderRadius: 'clamp(10px, 1.5vw, 20px)',
        padding: 'clamp(15px, 2vh, 30px)',
        textAlign: 'center',
        boxShadow: highlight
            ? `0 0 30px ${COLORS.accentGlow}`
            : '0 10px 30px rgba(0,0,0,0.5)'
    }}>
        <div style={{
            fontSize: 'clamp(1rem, 1.8vw, 2rem)',
            fontWeight: 600,
            color: highlight ? COLORS.electricBlue : 'rgba(255, 255, 255, 0.6)',
            marginBottom: 'clamp(5px, 1vh, 10px)',
            letterSpacing: 'clamp(2px, 0.4vw, 6px)'
        }}>
            {label}
        </div>
        <div style={{
            fontSize: 'clamp(1.5rem, 2.8vw, 3.5rem)',
            fontWeight: 950,
            color: COLORS.white,
            letterSpacing: 'clamp(1px, 0.2vw, 3px)'
        }}>
            {value}
        </div>
    </div>
);

export default DisplayAuctionPage;