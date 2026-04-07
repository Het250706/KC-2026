'use client';
import { motion } from 'framer-motion';
import { fixPhotoUrl } from '@/lib/utils';
import { Trophy, Star, ArrowRight } from 'lucide-react';

export default function WelcomeModal({ player, team, onClose }: { player: any, team: any, onClose: () => void }) {
    if (!player || !team) return null;

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.95)',
                backdropFilter: 'blur(30px)',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px'
            }}
        >
            <div style={{
                width: 'min(1000px, 100%)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '40px'
            }}>
                {/* Team Header */}
                <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    style={{ display: 'flex', alignItems: 'center', gap: '30px' }}
                >
                    <img src={team.logo_url || '/logo.png'} style={{ width: '100px', filter: 'drop-shadow(0 0 20px var(--primary))' }} />
                    <h2 style={{ fontSize: '3rem', fontWeight: 950, color: 'var(--primary)', letterSpacing: '-2px' }}>{team.name.toUpperCase()}</h2>
                </motion.div>

                {/* Welcome Animation */}
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    style={{ fontSize: '4rem', fontWeight: 950, letterSpacing: '-2px', textTransform: 'uppercase' }}
                >
                    🎉 Welcome to the Team 🎉
                </motion.div>

                {/* Player Profile */}
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.9, type: 'spring' }}
                    style={{
                        background: 'rgba(255,255,255,0.03)',
                        padding: '50px 100px',
                        borderRadius: '40px',
                        border: '2px solid rgba(255,215,0,0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '30px',
                        boxShadow: '0 30px 100px rgba(0,0,0,0.8)'
                    }}
                >
                    <div style={{ width: '250px', height: '250px', borderRadius: '50%', overflow: 'hidden', border: '5px solid var(--primary)', boxShadow: '0 0 50px rgba(255,215,0,0.3)' }}>
                        <img 
                            src={fixPhotoUrl(player.photo_url || player.photo, player.first_name)} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.first_name || 'Player')}`; }}
                        />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '4rem', fontWeight: 950, marginBottom: '10px', textTransform: 'uppercase' }}>{player.first_name} {player.last_name}</h1>
                        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '2px' }}>{player.cricket_skill || 'PLAYER'}</span>
                            <span style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.4)', fontWeight: 800 }}>•</span>
                            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'rgba(0, 255, 128, 0.8)', textTransform: 'uppercase', letterSpacing: '2px' }}>Franchise Pick</span>
                        </div>
                    </div>
                </motion.div>

                {/* Continue button */}
                <motion.button 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2 }}
                    onClick={onClose}
                    style={{
                        padding: '25px 60px',
                        background: 'var(--primary)',
                        color: '#000',
                        fontSize: '1.5rem',
                        fontWeight: 950,
                        borderRadius: '20px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        boxShadow: '0 15px 40px rgba(255, 215, 0, 0.3)',
                        marginTop: '20px'
                    }}
                >
                    NEXT TURN <ArrowRight size={28} />
                </motion.button>
            </div>
        </motion.div>
    );
}
