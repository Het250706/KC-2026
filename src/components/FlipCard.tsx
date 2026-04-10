'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { fixPhotoUrl } from '@/lib/utils';
import { SlotPlayer } from '@/types/card-auction';

interface FlipCardProps {
    card: SlotPlayer;
    isCurrentTurn: boolean;
    isActive: boolean;
    onPick: (cardPosition: number) => void;
    isPicking: boolean;
}

export const FlipCard: React.FC<FlipCardProps> = ({ 
    card, 
    isCurrentTurn, 
    isActive, 
    onPick,
    isPicking
}) => {
    const isPickable = isActive && isCurrentTurn && !card.is_picked && !isPicking;

    return (
        <motion.div 
            layout
            style={{ 
                perspective: '1000px', 
                width: '100%', 
                aspectRatio: '4/5', 
                cursor: isPickable ? 'pointer' : 'default' 
            }}
            transition={{ 
                layout: { type: 'spring', damping: 25, stiffness: 120 },
                duration: 0.8
            }}
            onClick={() => isPickable && onPick(card.card_position)}
        >
            <motion.div
                initial={false}
                animate={{ rotateY: card.is_picked ? 180 : 0 }}
                transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
                style={{ 
                    position: 'relative', 
                    width: '100%', 
                    height: '100%', 
                    transformStyle: 'preserve-3d',
                }}
            >
                {/* Front (Logo and Card Number) */}
                <div
                    className="glass"
                    style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        backfaceVisibility: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '40px',
                        border: isPickable ? '6px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                        background: isPickable 
                            ? 'radial-gradient(circle at center, rgba(255,215,0,0.1) 0%, rgba(0,0,0,1) 100%)' 
                            : 'rgba(255,255,255,0.02)',
                        boxShadow: isPickable ? '0 0 80px rgba(255,215,0,0.2), inset 0 0 100px rgba(0,0,0,0.8)' : 'none',
                        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        padding: '40px 20px'
                    }}
                >
                    <motion.img 
                        src="/logo.png" 
                        animate={isPickable ? { 
                            scale: [1, 1.05, 1],
                        } : {}}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        style={{ 
                            height: '120px', // Smaller to fit inside rounded corners
                            marginBottom: '20px', 
                            opacity: isPickable ? 1 : 0.15,
                            filter: isPickable ? 'drop-shadow(0 0 30px rgba(255,215,0,0.3))' : 'grayscale(100%)'
                        }} 
                        alt="Keshav Cup Logo" 
                    />
                    
                    <div style={{ 
                        fontSize: '4.5rem', // Even smaller font as requested
                        fontWeight: 950, 
                        color: isPickable ? '#FFFFFF' : 'rgba(255,255,255,0.1)', 
                        textShadow: isPickable ? '0 0 20px rgba(255,255,255,0.3)' : 'none',
                        lineHeight: 1,
                        letterSpacing: '0px', // Normal spacing for smaller font
                        zIndex: 1
                    }}>
                        {card.card_position}
                    </div>

                    {isPickable && (
                        <motion.div 
                            animate={{ opacity: [0.4, 0.8, 0.4] }} 
                            transition={{ duration: 2, repeat: Infinity }}
                            style={{ 
                                position: 'absolute', 
                                top: '25px', 
                                right: '25px', 
                                width: '12px', 
                                height: '12px', 
                                borderRadius: '50%', 
                                background: 'var(--primary)',
                                boxShadow: '0 0 15px var(--primary)'
                            }}
                        />
                    )}
                </div>

                {/* Back (Player Image) */}
                <div
                    style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        borderRadius: '40px',
                        overflow: 'hidden',
                        background: '#111',
                        border: '6px solid var(--primary)'
                    }}
                >
                    {card.player && (
                        <>
                            <img 
                                src={fixPhotoUrl(card.player.photo_url, card.player.first_name)} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                alt=""
                            />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 60%, transparent 100%)', padding: '40px 20px', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.6rem', fontWeight: 950, color: '#fff', textShadow: '0 2px 15px rgba(0,0,0,0.8)', lineHeight: 1.1 }}>
                                    {(card.player.first_name + ' ' + (card.player.last_name || '')).toUpperCase()}
                                </div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '3px', marginTop: '8px' }}>
                                    {card.picked_by_team?.name?.toUpperCase() || 'PICKED'}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};
