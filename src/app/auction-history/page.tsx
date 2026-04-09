'use client';

import { Suspense } from "react";
import Navbar from '@/components/Navbar';
import AuctionHistoryTable from '@/components/auction-history/AuctionHistoryTable';
import RoleGuard from '@/components/RoleGuard';

import AuctionReportButton from '@/components/AuctionReportButton';

export const dynamic = "force-dynamic";

function AuctionHistoryContent() {
    return (
        <RoleGuard allowedRole="admin">
            <main style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
                <div style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                        <h1 style={{ fontSize: '3rem', fontWeight: 900 }}>
                            AUCTION <span style={{ color: 'var(--primary)' }}>HISTORY</span>
                        </h1>
                        <div className="glass" style={{ padding: '15px 30px', borderRadius: '20px', border: '1px solid rgba(255,215,0,0.1)', display: 'flex', alignItems: 'center', gap: '20px' }}>
                             <div style={{ textAlign: 'right' }}>
                                 <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>OFFICIAL PDF LOG</div>
                                 <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Generate summary report</div>
                             </div>
                             <AuctionReportButton />
                        </div>
                    </div>

                    <AuctionHistoryTable />
                </div>
            </main>
        </RoleGuard>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<div style={{ color: "white" }}>Loading...</div>}>
            <AuctionHistoryContent />
        </Suspense>
    );
}