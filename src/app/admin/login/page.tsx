'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

// ALLOWED ADMIN EMAILS - Configurable as requested
const ALLOWED_ADMINS = [
    'admin@keshav.com',
    'het@keshav.com'
];

export default function AdminLoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { user: authUser, role: authRole, loading: authLoading } = useAuth();

    // REMOVED AUTO-REDIRECT to ensure password/email entry is required every time
    // useEffect(() => {
    //     if (!authLoading && authUser && authRole?.toLowerCase() === 'admin') {
    //         router.push('/admin/dashboard');
    //     }
    // }, [authUser, authRole, authLoading, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const loginEmail = email.trim();
        const loginPassword = password.trim();

        // 1. Check Allowed Admin Emails
        if (!ALLOWED_ADMINS.includes(loginEmail.toLowerCase())) {
            setError('Access Denied: This email is not authorized for Admin access.');
            setLoading(false);
            return;
        }

        try {
            // 2. Sign in via Supabase
            let { data, error: authError } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: loginPassword,
            });

            // FALLBACK: Server-side check if client-side is disabled
            if (authError && authError.message.toLowerCase().includes('email logins are disabled')) {
                const loginRes = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: loginEmail, password: loginPassword })
                });

                if (loginRes.ok) {
                    const loginData = await loginRes.json();
                    if (loginData.session) {
                        const { error: sessionError } = await supabase.auth.setSession(loginData.session);
                        if (!sessionError) {
                            authError = null;
                            data = { user: loginData.user, session: loginData.session };
                        }
                    }
                }
            }

            if (authError) {
                if (authError.message.toLowerCase().includes('invalid login credentials')) {
                    throw new Error('Incorrect credentials. Please check your admin email and password.');
                }
                throw authError;
            }

            if (!data?.user) throw new Error('Authentication failed');

            // 3. Verify Admin Role in Database
            const { data: roleData, error: roleError } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', data.user.id)
                .single();

            if (roleError || !roleData || roleData.role.toLowerCase() !== 'admin') {
                await supabase.auth.signOut();
                throw new Error('Access Denied: Your account does not have Administrator privileges.');
            }

            // SUCCESS Redirect to Admin Dashboard
            router.push('/admin/dashboard');

        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass" style={{
                width: 'min(480px, 92%)',
                padding: '50px',
                margin: '20px',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: '24px'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{
                        width: '100px',
                        height: '100px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 25px',
                    }}>
                        <img 
                            src="/logo.png" 
                            alt="Logo" 
                            style={{ width: '100%', height: 'auto' }} 
                        />
                    </div>
                    <h1 className="title-gradient" style={{ fontSize: '2.5rem', marginBottom: '12px', fontWeight: 950, letterSpacing: '-1px' }}>
                        ADMIN LOGIN
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Secure Infrastructure Access</p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(255, 75, 75, 0.1)',
                        color: '#ff4b4b',
                        padding: '15px',
                        borderRadius: '12px',
                        marginBottom: '25px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '0.9rem',
                        border: '1px solid rgba(255, 75, 75, 0.3)'
                    }}>
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700 }}>ADMIN EMAIL</label>
                        <div style={{ position: 'relative' }}>
                            <Mail style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@keshav.com"
                                style={inputStyle}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700 }}>PASSWORD</label>
                        <div style={{ position: 'relative' }}>
                            <Lock style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={inputStyle}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '18px', fontSize: '1.1rem', marginTop: '10px', fontWeight: 900 }}>
                        {loading ? <Loader2 className="animate-spin" size={24} /> : 'INITIALIZE ACCESS'}
                    </button>

                </form>
            </div>

            <style jsx>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </main>
    );
}

const inputStyle = {
    width: '100%',
    padding: '16px 16px 16px 52px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '1rem',
    outline: 'none',
    transition: 'all 0.3s ease',
};
