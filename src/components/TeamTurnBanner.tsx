'use client';
import { motion } from 'framer-motion';

export default function TeamTurnBanner({ team }: { team: any }) {
    if (!team) return (
        <div style={{ padding: '40px', color: 'rgba(255,255,255,0.3)', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '2px' }}>
            SETTING UP TURN SEQUENCE...
        </div>
    );

    return (
        <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{
                background: 'rgba(0, 0, 0, 0.8)',
                borderBottom: '2px solid var(--primary)',
                padding: '35px 80px',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '40px',
                backdropFilter: 'blur(15px)',
                zIndex: 10,
                position: 'relative',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
            }}
        >
            <div style={{ 
                fontSize: '1.1rem', 
                fontWeight: 900, 
                letterSpacing: '5px', 
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase'
            }}>
                Now Picking
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
                <div style={{ 
                    width: '70px', 
                    height: '70px', 
                    background: 'rgba(255, 215, 0, 0.05)', 
                    borderRadius: '15px', 
                    padding: '10px',
                    border: '1px solid rgba(255, 215, 0, 0.2)'
                }}>
                    <img 
                        src={team.logo_url || '/logo.png'} 
                        alt={team.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 0 10px var(--primary))' }} 
                    />
                </div>
                <h2 style={{ 
                    fontSize: '4.5rem', 
                    fontWeight: 950, 
                    letterSpacing: '-3px', 
                    color: 'var(--primary)',
                    margin: 0,
                    textShadow: '0 0 30px rgba(255, 215, 0, 0.3)'
                }}>
                    {team.name.toUpperCase()}
                </h2>
            </div>
            
            <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} 
                transition={{ repeat: Infinity, duration: 2 }}
                style={{ 
                    width: '18px', 
                    height: '18px', 
                    borderRadius: '50%', 
                    background: 'var(--primary)', 
                    boxShadow: '0 0 25px var(--primary)' 
                }}
            />
        </motion.div>
    );
}
