'use client';

import { motion } from 'framer-motion';

export default function LoadingSpinner({ fullPage = false }: { fullPage?: boolean }) {
    const spinner = (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        border: '4px solid rgba(255, 215, 0, 0.1)',
                        borderTopColor: 'var(--primary)',
                        boxShadow: '0 0 20px var(--primary-glow)'
                    }}
                />
                <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        right: '10px',
                        bottom: '10px',
                        borderRadius: '50%',
                        border: '4px solid rgba(255, 255, 255, 0.05)',
                        borderTopColor: '#fff',
                        opacity: 0.5
                    }}
                />
            </div>
            <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '4px' }}
            >
                PREPARING ARENA...
            </motion.div>
        </div>
    );

    if (fullPage) {
        return (
            <div style={{
                height: '100vh',
                width: '100vw',
                background: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'fixed',
                top: 0,
                left: 0,
                zIndex: 9999
            }}>
                {spinner}
            </div>
        );
    }

    return spinner;
}
