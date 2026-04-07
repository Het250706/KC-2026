'use client';

import Navbar from '@/components/Navbar';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import RoleGuard from '@/components/RoleGuard';

export default function AnalyticsPage() {
    return (
        <RoleGuard allowedRole="admin">
            <main style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
                <div className="container-responsive" style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '50px' }}>
                        <h1 className="title-gradient" style={{ fontSize: '3rem', fontWeight: 950, marginBottom: '10px' }}>AUCTION ANALYTICS</h1>
                        <p style={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '2px' }}>LIVE PERFORMANCE METRICS</p>
                    </div>

                    <AnalyticsDashboard />
                </div>
            </main>
        </RoleGuard>
    );
}
