'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { fixPhotoUrl } from '@/lib/utils';
import { User } from 'lucide-react';

export default function DraftCard({ player, isRevealed, onFlip, disabled }: { player: any, isRevealed: boolean, onFlip: () => void, disabled: boolean }) {
    return (
        <div 
            onClick={() => !isRevealed && !disabled && onFlip()}
            style={{
                width: '100%',
                aspectRatio: '1/1.4',
                perspective: '1500px',
                cursor: isRevealed || disabled ? 'default' : 'pointer'
            }}
        >
            <motion.div 
                initial={false}
                animate={{ rotateY: isRevealed ? 180 : 0 }}
                transition={{ duration: 0.8, type: 'spring', stiffness: 200, damping: 25 }}
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    transformStyle: 'preserve-3d'
                }}
            >
                {/* Back side (Initial) */}
                <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    background: 'linear-gradient(135deg, #111 0%, #050505 100%)',
                    border: '2px solid rgba(255, 215, 0, 0.2)',
                    borderRadius: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    overflow: 'hidden'
                }}>
                     <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'radial-gradient(circle at 50% 50%, rgba(255, 215, 0, 0.05) 0%, transparent 70%)',
                        zIndex: 0
                    }} />
                    <img 
                        src="/logo.png" 
                        alt="Logo" 
                        style={{ width: '110px', opacity: 0.9, filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.2))', position: 'relative', zIndex: 1 }} 
                    />
                    <div style={{
                        marginTop: '25px',
                        background: 'rgba(255, 215, 0, 0.1)',
                        border: '1px solid var(--primary)',
                        padding: '8px 24px',
                        borderRadius: '12px',
                        color: 'var(--primary)',
                        fontSize: '1rem',
                        fontWeight: 950,
                        textTransform: 'uppercase',
                        letterSpacing: '2px',
                        position: 'relative',
                        zIndex: 1,
                        boxShadow: '0 0 20px rgba(255, 215, 0, 0.1)'
                    }}>
                        {player.cricket_skill || player.role || 'PLAYER'}
                    </div>
                    <div style={{ 
                        marginTop: '15px', 
                        fontSize: '0.65rem', 
                        fontWeight: 900, 
                        color: 'rgba(255,255,255,0.4)', 
                        letterSpacing: '4px',
                        textTransform: 'uppercase',
                        position: 'relative',
                        zIndex: 1
                    }}>
                        KESHAV CUP 4.0
                    </div>
                </div>

                {/* Front side (Revealed) */}
                <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    background: '#0a0a0a',
                    border: '3px solid var(--primary)',
                    borderRadius: '24px',
                    transform: 'rotateY(180deg)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 0 40px rgba(255, 215, 0, 0.2)'
                }}>
                    <div style={{ height: '70%', background: '#111', overflow: 'hidden', position: 'relative' }}>
                        <img 
                            src={fixPhotoUrl(player.photo_url || player.photo, player.first_name)} 
                            alt={player.first_name} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.first_name || 'Player')}`; }}
                        />
                         <div style={{ 
                            position: 'absolute', 
                            bottom: 0, 
                            left: 0, 
                            right: 0, 
                            height: '50%', 
                            background: 'linear-gradient(to top, #0a0a0a, transparent)'
                        }} />
                    </div>
                    <div style={{ 
                        padding: '20px', 
                        textAlign: 'center', 
                        flex: 1, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'center',
                        gap: '8px'
                    }}>
                        <h3 style={{ 
                            fontSize: 'clamp(1rem, 2vw, 1.8rem)', 
                            fontWeight: 950, 
                            color: '#fff', 
                            margin: 0, 
                            lineHeight: 1.1,
                            letterSpacing: '-1px'
                        }}>
                            {player.first_name} <span style={{ color: 'var(--primary)' }}>{player.last_name}</span>
                        </h3>
                        <div style={{ 
                            fontSize: '0.85rem', 
                            color: 'rgba(255,255,255,0.6)', 
                            fontWeight: 800, 
                            letterSpacing: '1px',
                            textTransform: 'uppercase'
                        }}>
                            {player.cricket_skill || player.role || 'Player'}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
