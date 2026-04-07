'use client';

import { useState } from 'react';
import { Shield, Mail, Key, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function SyncAdminPage() {
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleSync = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setMessage('');

        try {
            const res = await fetch('/api/auth/sync-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await res.json();
            if (res.ok) {
                setStatus('success');
                setMessage(data.message || 'Admin accounts synced successfully! You can now login.');
            } else {
                setStatus('error');
                setMessage(data.error || 'Failed to sync admin accounts.');
            }
        } catch (err: any) {
            setStatus('error');
            setMessage(err.message || 'An unexpected error occurred.');
        }
    };

    return (
        <main style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="glass" style={{ width: '100%', maxWidth: '450px', padding: '40px', borderRadius: '24px', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div style={{ background: 'var(--primary)', width: '60px', height: '60px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 0 20px var(--primary-glow)' }}>
                        <Shield size={32} color="#000" />
                    </div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '10px' }}>ADMIN SYNC</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Initialize Admin Accounts in Supabase</p>
                </div>

                {status === 'success' ? (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#00ff80', marginBottom: '20px' }}><CheckCircle size={48} style={{ margin: '0 auto' }} /></div>
                        <p style={{ color: '#fff', fontWeight: 600, marginBottom: '25px' }}>{message}</p>
                        <button onClick={() => window.location.href = '/admin/login'} className="btn-primary" style={{ width: '100%', padding: '15px' }}>GO TO LOGIN</button>
                    </div>
                ) : (
                    <form onSubmit={handleSync} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {status === 'error' && (
                            <div style={{ background: 'rgba(255, 75, 75, 0.1)', color: '#ff4b4b', padding: '12px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(255, 75, 75, 0.2)' }}>
                                <AlertCircle size={18} /> {message}
                            </div>
                        )}
                        
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700 }}>VERIFICATION PASSWORD</label>
                            <div style={{ position: 'relative' }}>
                                <Key style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter new admin password"
                                    style={{ width: '100%', padding: '14px 14px 14px 45px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '12px', color: '#fff' }}
                                    required
                                />
                            </div>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>* This will register admin@keshav.com and het@keshav.com with this password.</p>
                        </div>

                        <button type="submit" className="btn-primary" disabled={status === 'loading'} style={{ padding: '15px', fontWeight: 900 }}>
                            {status === 'loading' ? <Loader2 className="animate-spin" size={20} /> : 'SYNC ADMIN ACCOUNTS'}
                        </button>
                    </form>
                )}
            </div>
        </main>
    );
}
