'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRole: string | string[];
}

export default function RoleGuard({ children, allowedRole }: RoleGuardProps) {
    const { user, role, loading } = useAuth();
    const router = useRouter();

    const allowedRolesArray = Array.isArray(allowedRole) 
        ? allowedRole.map(r => r.toLowerCase()) 
        : allowedRole.split(',').map(r => r.trim().toLowerCase());

    useEffect(() => {
        if (!loading) {
            const currentRole = role?.toLowerCase();
            const isAuthorized = currentRole && allowedRolesArray.includes(currentRole);

            if (!user || !isAuthorized) {
                console.log(`RoleGuard: Access Denied. Role: ${currentRole}, Required: ${allowedRolesArray.join('/')}`);
                const loginPath = allowedRolesArray.includes('admin') ? '/admin/login' : '/login';
                router.push(loginPath);
            }
        }
    }, [user, role, loading, allowedRole, router]);

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0a0a0a', color: '#fff' }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 className="spinning" size={48} color="#FFD700" style={{ margin: '0 auto 15px' }} />
                    <p style={{ fontWeight: 900, letterSpacing: '2px', fontSize: '0.8rem', color: '#FFD700' }}>VERIFYING CREDENTIALS...</p>
                </div>
                <style jsx>{`
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    .spinning { animation: spin 1s linear infinite; }
                `}</style>
            </div>
        );
    }

    const currentRole = role?.toLowerCase();
    const isAuthorized = currentRole && allowedRolesArray.includes(currentRole);

    if (!user || !isAuthorized) {
        return null;
    }

    return <>{children}</>;
}