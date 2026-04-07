'use client';

import BigScreenDraft from '@/components/BigScreenDraft';
import { motion } from 'framer-motion';

export default function BigScreenDraftPage() {
    return (
        <main style={{ 
            minHeight: '100vh', 
            background: '#000', 
            color: '#fff', 
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Fullscreen Overlay */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
                {/* Background Grid */}
                <div style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    backgroundImage: 'radial-gradient(rgba(255, 215, 0, 0.05) 1px, transparent 1px)', 
                    backgroundSize: '40px 40px',
                    opacity: 0.5 
                }} />
            </div>

            <div style={{ position: 'relative', zIndex: 1 }}>
                <BigScreenDraft />
            </div>

            <style jsx global>{`
                body {
                    cursor: crosshair;
                    overflow: hidden;
                    background: #000;
                }
                ::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </main>
    );
}
