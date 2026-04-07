'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Zap, Users, Mail, Lock, AlertCircle, Loader2, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

const CAPTAIN_PASSWORD = '987654321';

const TEAMS = [
    { name: 'SHAURYAM', email: 'shauryam@keshav.com' },
    { name: 'DIVYAM', email: 'divyam@keshav.com' },
    { name: 'SATYAM', email: 'satyam@keshav.com' },
    { name: 'DASHATVAM', email: 'dashatvam@keshav.com' },
    { name: 'DHAIRYAM', email: 'dhairyam@keshav.com' },
    { name: 'GYANAM', email: 'gyanam@keshav.com' },
    { name: 'AISHWARYAM', email: 'aishwaryam@keshav.com' },
    { name: 'ASTIKAYAM', email: 'astikayam@keshav.com' },
];

export default function CaptainLoginPage() {
    const [selectedTeam, setSelectedTeam] = useState('');
    const [captainEmail, setCaptainEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const { user: authUser, role: authRole, loading: authLoading } = useAuth();

    // Auto-redirect if already logged in
    useEffect(() => {
        if (!authLoading && authUser) {
            if (authRole?.toLowerCase() === 'admin') router.push('/admin/dashboard');
            else if (authRole?.toLowerCase() === 'captain') router.push('/captain/dashboard');
        }
    }, [authUser, authRole, authLoading, router]);

    // Auto-fill email when team is selected
    useEffect(() => {
        if (selectedTeam) {
            const team = TEAMS.find(t => t.name === selectedTeam);
            if (team) {
                setCaptainEmail(team.email);
                setPassword(''); // Ensure password is empty when team changes
            }
        }
    }, [selectedTeam]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const loginEmail = captainEmail.trim();
        const loginPassword = password.trim();

        if (loginPassword !== CAPTAIN_PASSWORD) {
            setError('Incorrect password. Please Enter correct password for captain access.');
            setLoading(false);
            return;
        }

        try {
            // 1. Try to sign in via standard client first
            let { data, error: authError } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: loginPassword
            });

            // FALLBACK: If "Email logins are disabled" on client, try our server-side bypass
            if (authError && authError.message.toLowerCase().includes('email logins are disabled')) {
                console.log('Client-side auth disabled, attempting server-side bypass...');
                const loginRes = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: loginEmail, password: loginPassword })
                });

                if (loginRes.ok) {
                    const loginData = await loginRes.json();
                    if (loginData.session) {
                        // Manually set the session on the client
                        const { error: setSessionError } = await supabase.auth.setSession(loginData.session);
                        if (!setSessionError) {
                            // Successfully bypassed
                            authError = null;
                            data = { user: loginData.user, session: loginData.session };
                        } else {
                            authError = setSessionError as any;
                        }
                    }
                } else {
                    const fallbackError = await loginRes.json();
                    authError = { message: fallbackError.error } as any;
                }
            }

            // 2. Aggressive Repair: If login fails for any reason (except email confirmation/disabled), try to repair/register
            if (authError &&
                !authError.message.toLowerCase().includes('email not confirmed') &&
                !authError.message.toLowerCase().includes('email logins are disabled')) {

                console.log('Login failed, attempting auto-repair...', authError.message);
                const regRes = await fetch('/api/auth/register-captain', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: loginEmail,
                        password: loginPassword,
                        teamName: selectedTeam
                    })
                });

                if (regRes.ok) {
                    console.log('Repair successful, retrying login via API...');
                    // Use API for retry as well since we know it might be needed
                    const retryRes = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: loginEmail, password: loginPassword })
                    });

                    if (retryRes.ok) {
                        const retryData = await retryRes.json();
                        await supabase.auth.setSession(retryData.session);
                        data = { user: retryData.user, session: retryData.session };
                        authError = null;
                    } else {
                        const retryError = await retryRes.json();
                        authError = { message: retryError.error } as any;
                    }
                }
            }

            // 3. Final error handling for Auth
            if (authError) {
                console.error('Final Auth Error:', authError);
                if (authError.message.toLowerCase().includes('email not confirmed')) {
                    throw new Error('Email not confirmed. Please check your inbox.');
                }
                if (authError.message.toLowerCase().includes('email logins are disabled')) {
                    throw new Error('Supabase Configuration Error: Email logins are disabled in the dashboard. Please enable the "Email" provider in Authentication > Providers.');
                }
                if (authError.message.toLowerCase().includes('invalid login credentials')) {
                    throw new Error('Incorrect email or password. Please use the default password if you are a captain.');
                }
                throw new Error(authError.message);
            }

            if (!data || !data.user) throw new Error('Authentication failed');

            const user = data.user;

            // 4. Case-insensitive role check with Auto-Repair
            let { data: roleData, error: roleError } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .single();

            if (roleError || !roleData) {
                console.log('Role missing in DB, attempting repair sync...');
                const repairRes = await fetch('/api/auth/register-captain', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: loginEmail,
                        password: loginPassword,
                        teamName: selectedTeam
                    })
                });

                if (repairRes.ok) {
                    const repairData = await repairRes.json();
                    if (repairData.role) {
                        roleData = { role: repairData.role };
                    } else {
                        const { data: retryRole } = await supabase
                            .from('user_roles')
                            .select('role')
                            .eq('user_id', user.id)
                            .single();
                        roleData = retryRole;
                    }
                }
            }

            if (!roleData) {
                await supabase.auth.signOut();
                throw new Error('Unauthorized: Account verification failed. Role not found.');
            }

            const role = roleData.role.toLowerCase();

            // 5. Redirect based on role
            if (role === 'admin') {
                router.push('/admin/dashboard');
            } else if (role === 'captain') {
                router.push('/captain/dashboard');
            } else {
                router.push('/login');
            }
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <main style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="glass" style={{
                    width: '100%',
                    maxWidth: '520px',
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
                        <h1 className="title-gradient" style={{ fontSize: '2.5rem', marginBottom: '12px', fontWeight: 900, letterSpacing: '-1px' }}>
                            CAPTAIN LOGIN
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>KESHAV CUP Team Portal</p>
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
                            <label style={{
                                display: 'block',
                                marginBottom: '10px',
                                color: 'var(--text-muted)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '1px'
                            }}>
                                Select Your Team
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Users style={{
                                    position: 'absolute',
                                    left: '18px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)',
                                    pointerEvents: 'none',
                                    zIndex: 1
                                }} size={20} />
                                <select
                                    value={selectedTeam}
                                    onChange={(e) => setSelectedTeam(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '16px 16px 16px 52px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '12px',
                                        color: selectedTeam ? '#fff' : 'var(--text-muted)',
                                        fontSize: '1rem',
                                        outline: 'none',
                                        cursor: 'pointer',
                                        appearance: 'none',
                                        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23999\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 16px center',
                                    }}
                                    required
                                >
                                    <option value="" disabled>Choose your team...</option>
                                    {TEAMS.map(team => (
                                        <option key={team.name} value={team.name} style={{ background: '#111', color: '#fff' }}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label style={{
                                display: 'block',
                                marginBottom: '10px',
                                color: 'var(--text-muted)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '1px'
                            }}>
                                Captain Email
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Mail style={{
                                    position: 'absolute',
                                    left: '18px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)'
                                }} size={20} />
                                <input
                                    type="email"
                                    value={captainEmail}
                                    onChange={(e) => setCaptainEmail(e.target.value)}
                                    placeholder="captain@keshav.com"
                                    style={{
                                        width: '100%',
                                        padding: '16px 16px 16px 52px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '12px',
                                        color: '#fff',
                                        fontSize: '1rem',
                                        outline: 'none',
                                    }}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{
                                display: 'block',
                                marginBottom: '10px',
                                color: 'var(--text-muted)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '1px'
                            }}>
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Lock style={{
                                    position: 'absolute',
                                    left: '18px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)'
                                }} size={20} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    style={{
                                        width: '100%',
                                        padding: '16px 16px 16px 52px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '12px',
                                        color: '#fff',
                                        fontSize: '1rem',
                                        outline: 'none',
                                    }}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading}
                            style={{
                                padding: '18px',
                                fontSize: '1.1rem',
                                marginTop: '15px',
                                fontWeight: 800,
                                letterSpacing: '1px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px'
                            }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="rotate" />
                                    LOGGING IN...
                                </>
                            ) : (
                                <>
                                    <Zap size={20} />
                                    ENTER TEAM PORTAL
                                </>
                            )}
                        </button>
                    </form>

                    <div style={{
                        marginTop: '35px',
                        padding: '20px',
                        background: 'rgba(255, 215, 0, 0.05)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 215, 0, 0.1)',
                        textAlign: 'center'
                    }}>
                        <p style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px' }}>
                            JAY SWAMINARAYAN
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '15px' }}>
                            Welcome to KESHAV CUP 2026
                        </p>
                        <div style={{ borderTop: '1px solid rgba(255, 215, 0, 0.1)', paddingTop: '15px' }}>
                            <Link href="/admin/login" style={{
                                color: 'var(--text-muted)',
                                fontSize: '0.8rem',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                transition: 'color 0.3s ease'
                            }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                            >
                                <Shield size={14} />
                                Switching to Admin Access?
                            </Link>
                        </div>
                    </div>
                </div>

            </main>
            <style jsx>{`
                .rotate {
                    animation: rotate 1s linear infinite;
                }
                @keyframes rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
}
