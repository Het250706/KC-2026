'use client';

import { Suspense } from "react";
import Navbar from '@/components/Navbar';
import AuctionHistoryTable from '@/components/auction-history/AuctionHistoryTable';
import RoleGuard from '@/components/RoleGuard';

export const dynamic = "force-dynamic";

function AuctionHistoryContent() {
    return (
        <RoleGuard allowedRole="admin">
            <main style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
                <div style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
                    <h1 style={{ fontSize: '3rem', fontWeight: 900 }}>
                        AUCTION HISTORY
                    </h1>

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