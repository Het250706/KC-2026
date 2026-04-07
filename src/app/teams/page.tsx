'use client';

import Navbar from '@/components/Navbar';
import TeamSquadList from '@/components/team-squad/TeamSquadList';
import RoleGuard from '@/components/RoleGuard';

export default function TeamSquadPage() {
    return (
        <RoleGuard allowedRole="admin">
            <main style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
                <div className="container-responsive" style={{ padding: '40px 20px', maxWidth: '1400px', margin: '0 auto' }}>
                    <div style={{ marginBottom: '40px' }}>
                        <h1 className="title-gradient" style={{ fontSize: '3rem', fontWeight: 950, marginBottom: '10px' }}>TEAM SQUADS</h1>
                        <p style={{ color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '2px' }}>FRANCHISE ACQUISITIONS & BUDGETS</p>
                    </div>

                    <TeamSquadList />
                </div>
            </main>
        </RoleGuard>
    );
}
