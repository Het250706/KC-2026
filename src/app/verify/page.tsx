'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function VerifyPage() {
    const [mobile, setMobile] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleVerify = async () => {
        if (mobile.length !== 10) {
            setError('Valid 10-digit number enter karo');
            return;
        }

        setLoading(true);
        setError('');

        const { data, error: dbError } = await supabase
            .from('registrations')
            .select('id, name')
            .eq('mobile', mobile)
            .single();

        if (dbError || !data) {
            setError('❌ Taro mobile number registered nathi. Pehla register karo.');
            setLoading(false);
            return;
        }

        // Set cookie - 1 day valid
        document.cookie = `kc_verified=true; path=/; max-age=${60 * 60 * 24}`;
        document.cookie = `kc_name=${data.name}; path=/; max-age=${60 * 60 * 24}`;

        router.push('/');
    };

    return (
        <main style={{
            minHeight: '100vh', background: '#0a0a0a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                background: '#fff', borderRadius: '12px', padding: '40px',
                maxWidth: '400px', width: '100%', textAlign: 'center'
            }}>
                <img src="/keshav-cup-banner.jpg" alt="Logo" style={{ width: '100%', borderRadius: '8px', marginBottom: '20px' }} />

                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
                    Keshav Cup 4.0
                </h2>
                <p style={{ color: '#666', marginBottom: '24px', fontSize: '0.9rem' }}>
                    App access mate taro registered mobile number enter karo
                </p>

                <input
                    type="number"
                    placeholder="10-digit Mobile Number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.slice(0, 10))}
                    style={{
                        width: '100%', padding: '14px', fontSize: '16px',
                        border: '2px solid #ddd', borderRadius: '8px',
                        marginBottom: '16px', textAlign: 'center',
                        boxSizing: 'border-box', outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#00c853'}
                    onBlur={(e) => e.target.style.borderColor = '#ddd'}
                />

                {error && (
                    <p style={{ color: '#d93025', fontSize: '0.9rem', marginBottom: '16px' }}>
                        {error}
                    </p>
                )}

                <button
                    onClick={handleVerify}
                    disabled={loading}
                    style={{
                        width: '100%', padding: '14px', background: '#00c853',
                        color: '#fff', border: 'none', borderRadius: '8px',
                        fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                        opacity: loading ? 0.6 : 1
                    }}
                >
                    {loading ? 'Checking...' : 'Verify & Enter →'}
                </button>

                <p style={{ marginTop: '16px', fontSize: '0.85rem', color: '#999' }}>
                    Registered nathi?{' '}
                    <a href="/register" style={{ color: '#00c853', fontWeight: 600 }}>
                        Register karo
                    </a>
                </p>
            </div>
        </main>
    );
}