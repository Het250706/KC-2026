'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Info, CheckCircle, AlertCircle, TrendingUp, Hammer } from 'lucide-react';

interface Notification {
    id: string;
    message: string;
    type: 'info' | 'success' | 'warn' | 'bid';
    team?: string;
    playerName?: string;
}

export default function NotificationSystem() {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        const channel = supabase.channel('notif-system')
            .on('postgres_changes', { event: 'INSERT', table: 'bids', schema: 'public' }, async (payload: any) => {
                const { data: team } = await supabase.from('teams').select('name').eq('id', payload.new.team_id).single();
                const { data: player } = await supabase.from('players').select('first_name, last_name').eq('id', payload.new.player_id).single();

                const playerName = player ? `${player.first_name} ${player.last_name}` : 'Unknown Player';

                addNotification({
                    id: payload.new.id,
                    message: `${team?.name || 'A team'} bid ${payload.new.amount} Pushp`,
                    playerName: playerName,
                    type: 'bid',
                    team: team?.name
                });

                playBidSound();
            })
            .on('postgres_changes', { event: 'UPDATE', table: 'players', schema: 'public' }, async (payload: any) => {
                // If player status changed to 'sold'
                if (payload.new.auction_status === 'sold' && payload.old.auction_status !== 'sold') {
                    let teamName = payload.new.sold_team;
                    if (!teamName || teamName === 'null') {
                        if (payload.new.team_id) {
                            const { data: team } = await supabase.from('teams').select('name').eq('id', payload.new.team_id).single();
                            teamName = team?.name;
                        }
                    }

                    addNotification({
                        id: `sold-${payload.new.id}`,
                        message: `🔨 SOLD! ${payload.new.first_name} ${payload.new.last_name} to ${teamName || 'THE SQUAD'}`,
                        type: 'success'
                    });
                    playHammerSound();
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const addNotification = (notif: Notification) => {
        setNotifications(prev => [notif, ...prev].slice(0, 5));
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== notif.id));
        }, 3000);
    };

    const playBidSound = () => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
        audio.play().catch(() => { });
    };

    const playHammerSound = () => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2040/2040-preview.mp3');
        audio.play().catch(() => { });
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '40px',
            right: '40px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            pointerEvents: 'none'
        }}>
            <AnimatePresence>
                {notifications.map((n) => (
                    <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: 100, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                        style={{
                            padding: '12px 25px',
                            minWidth: '300px',
                            maxWidth: '450px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px',
                            background: n.type === 'success' ? 'rgba(255, 30, 30, 0.95)' :
                                n.type === 'bid' ? 'rgba(255, 215, 0, 0.95)' : 'rgba(0, 150, 255, 0.95)',
                            color: n.type === 'bid' ? '#000' : '#fff',
                            borderRadius: '20px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            pointerEvents: 'auto',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                            backdropFilter: 'blur(20px)'
                        }}
                    >
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: 'rgba(255,255,255,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {n.type === 'success' ? <Hammer size={20} /> :
                                n.type === 'bid' ? <TrendingUp size={20} /> : <Bell size={20} />}
                        </div>
                        <div style={{ flex: 1 }}>
                            {n.playerName && <div style={{ fontSize: '0.75rem', fontWeight: 900, opacity: 0.8, textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '1px' }}>{n.playerName}</div>}
                            <div style={{ fontSize: '1rem', fontWeight: 950, letterSpacing: '1px' }}>{n.message}</div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
