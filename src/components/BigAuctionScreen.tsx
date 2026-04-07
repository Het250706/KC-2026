'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { fixPhotoUrl } from '@/lib/utils';
import { Trophy, User, Users, Gavel, Award, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getPurplePushp } from '@/lib/auction-logic';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string;
  cricket_skill: string;
  base_price: number;
  auction_status: string;
  was_present_kc3?: string;
}

interface Team {
  id: string;
  name: string;
}

interface AuctionState {
  status: 'IDLE' | 'BIDDING' | 'SOLD' | 'UNSOLD';
  bidding_status: string;
  current_player_id: string | null;
  current_highest_bid: number;
  highest_bid_team_id: string | null;
}

export default function BigAuctionScreen() {
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [leadingTeam, setLeadingTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  
  const prevBidRef = useRef<number>(0);
  const prevStatusRef = useRef<string>('IDLE');
  const currentPlayerRef = useRef<Player | null>(null);
  const autoDismissRef = useRef<NodeJS.Timeout | null>(null);
  
  // Audio Refs
  const bidSoundRef = useRef<HTMLAudioElement | null>(null);
  const hammerSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize Audio
    bidSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'); 
    hammerSoundRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2143/2143-preview.mp3'); 
    
    fetchInitialData();

    // Set up Realtime Subscription
    const channel = supabase
      .channel('big_auction_screen_realtime')
      .on(
        'postgres_changes' as any,
        { event: '*', table: 'auction_state', schema: 'public' },
        (payload: any) => {
          if (payload.new) {
            handleStateUpdate(payload.new as AuctionState);
          }
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', table: 'players', schema: 'public' },
        (payload: any) => {
          const updatedPlayer = payload.new as Player;
          if (updatedPlayer.id === currentPlayerRef.current?.id) {
            setCurrentPlayer(updatedPlayer);
            currentPlayerRef.current = updatedPlayer;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, []); // Run once on mount

  // Auto-dismiss SOLD state after 4 seconds
  useEffect(() => {
    if (auctionState?.status === 'SOLD') {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
      autoDismissRef.current = setTimeout(() => {
        // Local reset to prepare for next player
        setAuctionState(prev => prev ? { ...prev, status: 'IDLE' } : null);
        setCurrentPlayer(null);
        setLeadingTeam(null);
        autoDismissRef.current = null;
      }, 4000);
    }
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, [auctionState?.status]);

  const fetchInitialData = async () => {
    try {
      const { data: stateData, error: stateError } = await supabase
        .from('auction_state')
        .select('*')
        .single();

      if (stateError) throw stateError;
      if (stateData) {
        await handleStateUpdate(stateData);
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

    const handleStateUpdate = async (newState: AuctionState) => {
        // PRESERVE SOLD DATA: If the status is SOLD, keep the previous player/bid/team 
        // even if the DB has already reset them to 0/null.
        if (newState.status === 'SOLD') {
            if (!newState.current_player_id) newState.current_player_id = auctionState?.current_player_id || null;
            if (!newState.current_highest_bid) newState.current_highest_bid = auctionState?.current_highest_bid || 0;
            if (!newState.highest_bid_team_id) newState.highest_bid_team_id = auctionState?.highest_bid_team_id || null;
        }

        setAuctionState(newState);

        // Play Bid Sound if bid increased
        if (newState.current_highest_bid > prevBidRef.current) {
            bidSoundRef.current?.play().catch(() => { });
            prevBidRef.current = newState.current_highest_bid;
        }

    // Play Hammer Sound & Confetti if sold
    if (newState.status === 'SOLD' && prevStatusRef.current !== 'SOLD') {
      hammerSoundRef.current?.play().catch(() => {});
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#00FF80', '#1E90FF']
      });
    }
    prevStatusRef.current = newState.status || 'IDLE';

    // Fetch Player if changed
    if (newState.current_player_id && newState.current_player_id !== currentPlayerRef.current?.id) {
      fetchPlayer(newState.current_player_id);
    } else if (!newState.current_player_id) {
      setCurrentPlayer(null);
      currentPlayerRef.current = null;
    }

    // Fetch Team Name if changed
    if (newState.highest_bid_team_id) {
      const { data: teamData } = await supabase
        .from('teams')
        .select('id, name')
        .eq('id', newState.highest_bid_team_id)
        .single();
      if (teamData) setLeadingTeam(teamData);
    } else {
      setLeadingTeam(null);
    }
  };

  const fetchPlayer = async (id: string) => {
    const { data: playerData } = await supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .single();
    if (playerData) {
      setCurrentPlayer(playerData);
      currentPlayerRef.current = playerData;
      // Reset bid ref to current when player changes to avoid sound on initial load
      if (auctionState) prevBidRef.current = auctionState.current_highest_bid;
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-yellow-500"></div>
        <p className="text-yellow-500 mt-4 font-bold tracking-widest">INITIALIZING LIVE BROADCAST...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#020617] text-white overflow-hidden font-sans relative">
      {/* Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-900/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-purple-900/10 blur-[120px] rounded-full"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 h-24 flex items-center justify-center border-b border-white/10 bg-black/40 backdrop-blur-md">
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center gap-6"
        >
          <div className="h-12 w-12 bg-yellow-500 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.5)]">
            <Trophy className="text-black" size={32} />
          </div>
          <div className="flex flex-col items-center">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-yellow-200 to-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] uppercase">
              KESHAV CUP
            </h1>
            <p className="text-yellow-500 font-black text-sm tracking-[0.5em] mt-1">4.0 POWER EDITION</p>
          </div>
          <div className="px-3 py-1 bg-red-600 rounded-md animate-pulse">
            <span className="text-xs font-bold tracking-widest uppercase">Live</span>
          </div>
        </motion.div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 h-[calc(100vh-160px)] px-12 py-8 grid grid-cols-12 gap-8 items-center">
        
        {/* Left/Center Section - Player Card */}
        <div className="col-span-12 lg:col-span-7 h-full flex items-center justify-center">
          <AnimatePresence mode="wait">
            {!currentPlayer ? (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="text-center"
              >
                <div className="mb-8 flex justify-center">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="p-8 rounded-full bg-white/5 border border-white/10"
                  >
                    <Zap className="text-yellow-500 w-32 h-32" />
                  </motion.div>
                </div>
                <h2 className="text-6xl font-black mb-4 tracking-tight">READY FOR NEXT PLAYER</h2>
                <p className="text-2xl text-slate-400 font-medium tracking-wide">WAITING FOR ADMIN TO START BIDDING</p>
              </motion.div>
            ) : (
              <motion.div
                key={currentPlayer.id}
                initial={{ opacity: 0, x: -100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, filter: 'blur(20px)' }}
                className="w-full max-w-4xl"
              >
                <div className="relative group">
                  {/* Glassmorphism Player Card */}
                  <div className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-2xl rounded-[3rem] border border-white/20 p-8 shadow-2xl flex flex-col md:flex-row gap-12 items-center">
                    
                    {/* Player Image Container */}
                    <div className="relative">
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="rounded-full border-[1vw] border-yellow-500/50 p-2 relative z-10 overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.2)]"
                        style={{ width: 'clamp(350px, 25vw, 500px)', height: 'clamp(350px, 25vw, 500px)' }}
                      >
                        <img 
                          src={fixPhotoUrl(currentPlayer.photo_url, currentPlayer.first_name)} 
                          alt={currentPlayer.first_name}
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentPlayer.first_name}`;
                          }}
                        />

                        {/* Arpanam Stamp - STEP 1 */}
                        <AnimatePresence>
                          {auctionState?.status === 'SOLD' && (
                            <motion.img
                              key="stamp"
                              initial={{ scale: 0, rotate: -30, opacity: 0 }}
                              animate={{ scale: 1, rotate: -15, opacity: 0.9 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              transition={{ type: 'spring', damping: 12, stiffness: 100, duration: 0.5 }}
                              src="/arpanam-stamp.png"
                              className="absolute inset-0 m-auto z-20 pointer-events-none"
                              style={{ width: '60%', height: 'auto', filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))' }}
                            />
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </div>

                    {/* Player Info */}
                    <div className="flex-1 text-center md:text-left space-y-4">
                      <div className="space-y-0">
                        <motion.h3 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="font-bold text-slate-400"
                          style={{ fontSize: 'clamp(2.5rem, 5vw, 7rem)', lineHeight: 1 }}
                        >
                          {currentPlayer.first_name.toUpperCase()}
                        </motion.h3>
                        <motion.h2 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="font-black leading-none tracking-tighter text-white"
                          style={{ fontSize: 'clamp(4rem, 8vw, 12rem)' }}
                        >
                          {currentPlayer.last_name.toUpperCase()}
                        </motion.h2>
                      </div>

                      <div className="flex flex-wrap gap-[2vw] mt-[5vh]">
                        <div className="bg-white/5 border border-white/10 px-[2.5vw] py-[2.5vh] rounded-[2.5rem] min-w-[30%]">
                          <p className="text-slate-400 font-bold uppercase tracking-widest mb-[1vh]" style={{ fontSize: 'clamp(0.8rem, 1.5vw, 1.5rem)' }}>Base Price</p>
                          <p className="font-black text-white" style={{ fontSize: 'clamp(1.5rem, 3vw, 3rem)' }}>
                            {currentPlayer.base_price?.toLocaleString()} <span className="text-yellow-500" style={{ fontSize: 'clamp(1rem, 2vw, 2rem)' }}>Pushp</span>
                          </p>
                        </div>
                        <div className="bg-white/5 border border-white/10 px-[2.5vw] py-[2.5vh] rounded-[2.5rem] min-w-[30%]">
                          <p className="text-slate-400 font-bold uppercase tracking-widest mb-[1vh]" style={{ fontSize: 'clamp(0.8rem, 1.5vw, 1.5rem)' }}>CRICKET SKILL</p>
                          <p className="font-black text-white" style={{ fontSize: 'clamp(1.5rem, 3vw, 3rem)' }}>{currentPlayer.cricket_skill?.toUpperCase()}</p>
                        </div>
                        {currentPlayer.was_present_kc3 && (
                          <div className="bg-white/5 border border-white/10 px-[2.5vw] py-[2.5vh] rounded-[2.5rem] min-w-[30%]">
                            <p className="text-slate-400 font-bold uppercase tracking-widest mb-[1vh]" style={{ fontSize: 'clamp(0.8rem, 1.5vw, 1.5rem)' }}>LAST KC3 STATUS</p>
                            <p className="font-black text-white" style={{ fontSize: 'clamp(1.5rem, 3vw, 3rem)' }}>{currentPlayer.was_present_kc3}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Section - Bidding Info */}
        <div className="col-span-12 lg:col-span-5 h-full flex flex-col justify-center space-y-8">
          
          {/* Current Bid Display */}
          <div className="bg-gradient-to-br from-yellow-500/20 to-transparent backdrop-blur-xl rounded-[2.5rem] border border-yellow-500/30 p-10 relative overflow-hidden shadow-[0_0_80px_rgba(234,179,8,0.1)]">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Gavel size={120} />
            </div>

            {auctionState?.current_highest_bid && getPurplePushp(auctionState.current_highest_bid) && (
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: -15 }}
                style={{
                  position: 'absolute',
                  top: '-30px',
                  right: '20px',
                  width: '120px',
                  height: '120px',
                  background: 'rgba(147, 51, 234, 0.15)',
                  border: '6px double #9333ea',
                  borderRadius: '50%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9333ea',
                  zIndex: 10,
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 0 30px rgba(147, 51, 234, 0.3)'
                }}
              >
                <div style={{ fontSize: '1.4rem', fontWeight: 950 }}>અર્પણમ</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 950, lineHeight: 1 }}>{getPurplePushp(auctionState.current_highest_bid)}</div>
              </motion.div>
            )}
            
            <p className="text-yellow-500 font-black tracking-[0.2em] uppercase mb-[2vh] drop-shadow-md" style={{ fontSize: 'clamp(0.8rem, 1.5vw, 1.5rem)' }}>
              Current Highest Bid
            </p>
            
            <motion.div
              key={auctionState?.current_highest_bid}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative flex items-baseline gap-[1vw]"
            >
              <span className="font-black leading-none tracking-tighter text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]" style={{ fontSize: 'clamp(5rem, 10vw, 15rem)' }}>
                {auctionState?.current_highest_bid?.toLocaleString() || '0'}
              </span>
              <span className="font-bold text-yellow-500" style={{ fontSize: 'clamp(1.5rem, 3vw, 4rem)' }}>Pushp</span>
            </motion.div>

            {leadingTeam ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-[4vh] flex items-center gap-[2vw] bg-white/10 rounded-[2rem] p-[2vw] border border-white/10"
              >
                <div className="h-[5vw] w-[5vw] min-h-[50px] min-w-[50px] bg-white/10 rounded-full flex items-center justify-center">
                  <Users className="text-yellow-500 w-[60%] h-[60%]" />
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase tracking-[0.2em]" style={{ fontSize: 'clamp(0.8rem, 1.5vw, 1.5rem)' }}>Leading Team</p>
                  <p className="font-black text-white leading-tight" style={{ fontSize: 'clamp(3rem, 6vw, 8rem)' }}>{leadingTeam.name.toUpperCase()}</p>
                </div>
              </motion.div>
            ) : (
              <div className="mt-8 text-slate-500 font-bold tracking-widest text-xl">
                NO BIDS YET
              </div>
            )}
          </div>

          {/* Auction Status Indicator */}
          <div className="grid grid-cols-2 gap-6">
            <div className={`rounded-3xl p-8 border flex flex-col items-center justify-center transition-all duration-500 ${auctionState?.status === 'BIDDING' ? 'bg-green-500/20 border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.2)]' : 'bg-slate-900/50 border-white/10'}`}>
              <div className={`p-3 rounded-full mb-3 ${auctionState?.status === 'BIDDING' ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`}></div>
              <p className="font-bold uppercase tracking-widest text-slate-400" style={{ fontSize: 'clamp(0.8rem, 1.2vw, 1.2rem)' }}>Status</p>
              <p className="font-black" style={{ fontSize: 'clamp(1.5rem, 3vw, 3.5rem)' }}>{auctionState?.status || 'IDLE'}</p>
            </div>
            
            <div className="bg-slate-900/50 rounded-3xl p-8 border border-white/10 flex flex-col items-center justify-center">
              <p className="font-bold uppercase tracking-widest text-slate-400 mb-1" style={{ fontSize: 'clamp(0.8rem, 1.2vw, 1.2rem)' }}>Involved Teams</p>
              <p className="font-black text-white" style={{ fontSize: 'clamp(1.5rem, 4vw, 4.5rem)' }}>ALL</p>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Status Bar */}
      <footer className="relative z-10 h-16 bg-black/80 backdrop-blur-xl border-t border-white/10 flex items-center px-12 overflow-hidden">
        <div className="flex items-center gap-8 w-full">
          <div className="flex items-center gap-2 text-yellow-500 font-bold whitespace-nowrap">
            <Award size={20} />
            <span className="uppercase tracking-widest text-sm">Auction Protocol V4.0</span>
          </div>
          <div className="h-4 w-[1px] bg-white/20"></div>
          
          {/* Marquee effect for status transitions */}
          <div className="flex-1 overflow-hidden relative h-full flex items-center">
             <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-black to-transparent z-10"></div>
             <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-black to-transparent z-10"></div>
             
             <div className="flex whitespace-nowrap animate-marquee-fast hover:pause items-center">
                <span className="text-slate-400 font-black tracking-[0.3em] uppercase text-sm flex items-center gap-8 px-4">
                   <span className="text-yellow-500">•</span>
                   {auctionState?.bidding_status || 'SYSTEM STANDBY'}
                   <span className="text-yellow-500">•</span>
                   SECURE BIDDING ENABLED
                   <span className="text-yellow-500">•</span>
                   PURE REALTIME SYNC
                   <span className="text-yellow-500">•</span>
                   NEXT GENERATION DISPLAY
                   <span className="text-yellow-500">•</span>
                   KESHAV CUP 4.0 POWER EDITION
                   {leadingTeam && (
                     <>
                        <span className="text-yellow-500">•</span>
                        LEADING: {leadingTeam.name.toUpperCase()} ({auctionState?.current_highest_bid} P)
                     </>
                   )}
                   <span className="text-yellow-500">•</span>
                   JAY SWAMINARAYAN
                </span>
                {/* Duplicate for infinite loop */}
                <span className="text-slate-400 font-black tracking-[0.3em] uppercase text-sm flex items-center gap-8 px-4">
                   <span className="text-yellow-500">•</span>
                   {auctionState?.bidding_status || 'SYSTEM STANDBY'}
                   <span className="text-yellow-500">•</span>
                   SECURE BIDDING ENABLED
                   <span className="text-yellow-500">•</span>
                   PURE REALTIME SYNC
                   <span className="text-yellow-500">•</span>
                   NEXT GENERATION DISPLAY
                   <span className="text-yellow-500">•</span>
                   KESHAV CUP 4.0 POWER EDITION
                   <span className="text-yellow-500">•</span>
                   JAY SWAMINARAYAN
                </span>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Server: OK</span>
             </div>
             <div className="px-4 py-1 bg-white/5 rounded-full border border-white/10">
               <span className="text-xs font-bold text-white tracking-widest">4.0 EDITION</span>
             </div>
          </div>
        </div>
      </footer>

      {/* SOLD BANNER OVERLAY - STEP 2 & 3 */}
      <AnimatePresence>
        {auctionState?.status === 'SOLD' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 1 } }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-8 pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.5 } }}
              transition={{ delay: 0.5, type: 'spring', damping: 15 }}
              className="bg-[#00ff80]/10 border-4 border-[#00ff80] rounded-[40px] p-12 text-center shadow-[0_0_100px_rgba(0,255,128,0.3)] backdrop-blur-xl relative overflow-hidden"
              style={{ minWidth: '700px' }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-[#00ff80]/10 to-transparent"></div>
              
              <div className="relative z-10 space-y-10">
                 <h2 className="text-8xl font-black text-[#00ff80] drop-shadow-lg italic flex items-center justify-center gap-6">
                   🔨 SOLD!
                 </h2>
                 
                 <div className="space-y-3">
                    <p className="font-black text-white tracking-tighter" style={{ fontSize: 'clamp(3rem, 6vw, 8rem)' }}>
                      {currentPlayer?.first_name?.toUpperCase()} {currentPlayer?.last_name?.toUpperCase()}
                    </p>
                    <div className="h-1.5 w-32 bg-[#00ff80] mx-auto rounded-full"></div>
                 </div>

                 <div className="space-y-1">
                    <p className="text-2xl font-bold text-slate-400 tracking-[0.3em] uppercase">ACQUIRED BY</p>
                    <p className="font-black text-yellow-500 tracking-tight drop-shadow-md" style={{ fontSize: 'clamp(4rem, 8vw, 10rem)' }}>
                      {leadingTeam?.name?.toUpperCase() || 'TEAM'}
                    </p>
                 </div>

                 <div className="inline-block bg-[#00ff80]/20 px-16 py-6 rounded-[3rem] border border-[#00ff80]/40 shadow-inner">
                    <p className="font-black text-white" style={{ fontSize: 'clamp(3rem, 5vw, 6rem)' }}>
                      FOR {auctionState?.current_highest_bid?.toLocaleString()} <span className="text-yellow-500 text-3xl">PUSHP</span>
                    </p>
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* UNSOLD BANNER OVERLAY */}
      <AnimatePresence>
        {auctionState?.status === 'UNSOLD' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-lg flex items-center justify-center p-8"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 12 }}
              className="text-center space-y-8"
            >
              <div className="space-y-2">
                <h2 className="text-[12rem] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-red-400 to-red-700 drop-shadow-[0_0_50px_rgba(239,68,68,0.5)] uppercase italic">
                  Unsold
                </h2>
                <div className="h-2 w-full bg-gradient-to-r from-transparent via-red-500 to-transparent"></div>
              </div>

              <div className="space-y-4">
                <p className="text-5xl font-black text-white">
                  {currentPlayer?.first_name?.toUpperCase()} {currentPlayer?.last_name?.toUpperCase()}
                </p>
                <p className="text-2xl text-slate-400 font-bold tracking-widest uppercase">
                  No bids received for this player
                </p>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setAuctionState(prev => prev ? {...prev, status: 'IDLE'} : null)}
                className="px-12 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full font-bold tracking-widest text-slate-400 transition-colors"
              >
                DISMISS
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CLICK TO ENABLE AUDIO OVERLAY (Browser policy) */}
      {!loading && !prevStatusRef.current.includes('IDLE') && (
        <div className="hidden">
           {/* This is a placeholder for audio init, usually browsers need one click */}
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        
        body {
          font-family: 'Inter', sans-serif;
          background-color: #020617;
          margin: 0;
          overflow: hidden;
        }

        .text-glow {
          text-shadow: 0 0 20px rgba(234,179,8,0.4);
        }

        @keyframes marquee-fast {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .animate-marquee-fast {
          animation: marquee-fast 30s linear infinite;
        }

        @media (min-width: 1920px) {
          html { font-size: 1.25vw; }
          .max-w-4xl { max-width: 80vw; }
        }

        .hover\:pause:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
