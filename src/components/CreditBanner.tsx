'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

const CreditBanner: React.FC = () => {
    const pathname = usePathname();

    // STRICT: Only show on the absolute root Home Page path
    if (pathname !== '/' && pathname !== '') return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] pointer-events-none select-none max-w-[95vw]"
            aria-hidden="true"
        >
            <motion.div
                whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(234, 179, 8, 0.2)' }}
                whileTap={{ scale: 0.98 }}
                className="pointer-events-auto flex items-center gap-3 px-6 py-3 md:px-8 md:py-4
                    bg-black/60 backdrop-blur-2xl border border-white/10 rounded-full shadow-2xl
                    transition-all duration-500 group border-t-white/20"
            >
                {/* Glowing Icon Container */}
                <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 bg-yellow-400 blur-md opacity-20 group-hover:opacity-40 transition-opacity animate-pulse" />
                    <span className="relative text-yellow-400 text-lg md:text-xl drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">⚡</span>
                </div>

                <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm lg:text-base tracking-wide font-medium">
                    <span className="text-gray-300 opacity-90 whitespace-nowrap">
                        Keshav Cup 2026
                    </span>

                    <span className="text-gray-600 font-light px-1">|</span>

                    <span className="text-gray-400 font-normal">
                        Developed by
                    </span>

                    <span className="relative font-black text-white group-hover:text-yellow-400 transition-colors duration-300 uppercase">
                        Het Patel
                        {/* Underline Effect */}
                        <motion.span
                            className="absolute -bottom-1 left-0 w-0 h-[2px] bg-yellow-400/50"
                            whileHover={{ width: '100%' }}
                            transition={{ duration: 0.3 }}
                        />
                    </span>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default CreditBanner;