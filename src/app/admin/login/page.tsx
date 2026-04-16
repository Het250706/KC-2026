'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

export default function AdminLoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const { user: authUser, role: authRole, loading: authLoading } = useAuth();

    // Auto-redirect if already logged in as admin
    useEffect(() => {
        if (!authLoading && authUser && authRole?.toLowerCase() === 'admin') {
            router.push('/admin/dashboard');
        }
    }, [authUser, authRole, authLoading, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1. Try standard client-side auth
            let { data, error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password.trim()
            });

            // 2. Fallback to API if needed
            if (authError) {
                const loginRes = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email.trim(), password: password.trim() })
                });

                if (loginRes.ok) {
                    const loginData = await loginRes.json();
                    if (loginData.session) {
                        const { error: setSessionError } = await supabase.auth.setSession(loginData.session);
                        if (!setSessionError) {
                            authError = null;
                            data = { user: loginData.user, session: loginData.session };
                        }
                    }
                }
            }

            if (authError) throw new Error(authError.message);
            if (!data?.user) throw new Error('Authentication failed');

            // 3. Role Check
            const { data: roleData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', data.user.id)
                .single();

            if (!roleData || roleData.role.toLowerCase() !== 'admin') {
                await supabase.auth.signOut();
                throw new Error('Access Denied: Admin privileges required.');
            }

            router.push('/admin/dashboard');
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{
                width: '100%',
                maxWidth: '440px',
                padding: '50px 40px',
                background: '#0a0a0a',
                border: '1px solid #FFD700',
                borderRadius: '35px',
                margin: '20px',
                textAlign: 'center'
            }}>
                {/* Logo Section */}
                <div style={{ marginBottom: '30px' }}>
                    <div style={{ transform: 'scale(1.2)' }}>
                        <img src="/logo.png" alt="Keshav Cup 4.0" style={{ width: '120px', margin: '0 auto' }} />
                    </div>
                </div>

                {/* Title Section */}
                <div style={{ marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '1px', margin: 0 }}>
                        <span style={{ color: '#fff' }}>ADMIN </span>
                        <span style={{ color: '#FFD700' }}>LOGIN</span>
                    </h1>
                    <p style={{ color: '#666', fontSize: '0.8rem', marginTop: '10px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
                        Secure Infrastructure Access
                    </p>
                </div>

                {error && (
                    <div style={{ background: 'rgba(255, 75, 75, 0.1)', color: '#ff4b4b', padding: '12px', borderRadius: '12px', marginBottom: '25px', fontSize: '0.8rem', border: '1px solid rgba(255, 75, 75, 0.2)' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '25px', textAlign: 'left' }}>
                    {/* Email Input */}
                    <div>
                        <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', display: 'block' }}>
                            ADMIN EMAIL
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} color="#555" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@keshav.com"
                                style={{
                                    width: '100%',
                                    background: '#151515',
                                    border: '1px solid #222',
                                    borderRadius: '12px',
                                    padding: '16px 16px 16px 48px',
                                    color: '#fff',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#FFD700'}
                                onBlur={(e) => e.target.style.borderColor = '#222'}
                                required
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div>
                        <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', display: 'block' }}>
                            PASSWORD
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} color="#555" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{
                                    width: '100%',
                                    background: '#151515',
                                    border: '1px solid #222',
                                    borderRadius: '12px',
                                    padding: '16px 16px 16px 48px',
                                    color: '#fff',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#FFD700'}
                                onBlur={(e) => e.target.style.borderColor = '#222'}
                                required
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            background: '#FFD700',
                            color: '#000',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '18px',
                            fontSize: '1.1rem',
                            fontWeight: 900,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            marginTop: '10px',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            boxShadow: '0 8px 25px rgba(255, 215, 0, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                        onMouseOver={(e) => {
                            if (!loading) {
                                e.currentTarget.style.transform = 'scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 10px 30px rgba(255, 215, 0, 0.4)';
                            }
                        }}
                        onMouseOut={(e) => {
                            if (!loading) {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = '0 8px 25px rgba(255, 215, 0, 0.25)';
                            }
                        }}
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            'INITIALIZE ACCESS'
                        )}
                    </button>
                </form>

                {/* <div style={{ marginTop: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#444', fontSize: '0.75rem', fontWeight: 600 }}>
                    <ShieldCheck size={14} /> 256-BIT ENCRYPTED SESSION
                </div> */}
            </div>

            <style jsx global>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
                input:focus { border-color: #FFD700 !important; }
            `}</style>
        </main>
    );
}
