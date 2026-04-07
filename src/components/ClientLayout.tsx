'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import NotificationSystem from '@/components/NotificationSystem';
import CreditBanner from '@/components/CreditBanner';
import { AuthProvider } from '@/components/AuthProvider';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isScoreboard = pathname === '/scoreboard';
  // Also remove padding for dashboards to keep them "up" as requested
  const isDashboard = pathname.includes('/dashboard') || pathname.includes('/auction');
  const noPadding = isScoreboard || isDashboard;

  return (
    <AuthProvider>
      <React.Suspense fallback={null}>
        <Navbar />
      </React.Suspense>
      <main style={{ minHeight: '100vh', paddingTop: noPadding ? '0px' : '80px' }}>
        {children}
      </main>
      <NotificationSystem />
      <CreditBanner />
    </AuthProvider>
  );
}
