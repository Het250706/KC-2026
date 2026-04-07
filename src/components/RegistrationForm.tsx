'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Phone, Calendar, Search, Zap, Trophy, ShieldCheck, ArrowRight, Save, Clock, Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function RegistrationForm() {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        age: '20',
        role: 'Batsman',
        category: 'Silver',
        batting_style: 'Right Handed',
        bowling_style: 'Right Arm',
        experience: '0',
        photo_url: '',
        team_preference: ''
    });

    const getBasePriceText = (cat: string) => {
        if (cat === 'Platinum') return '0.80 Cr';
        if (cat === 'Gold') return '0.50 Cr';
        if (cat === 'Silver') return '0.30 Cr';
        return '0.20 Cr';
    };

    const getBasePriceValue = (cat: string) => {
        if (cat === 'Platinum') return 80000000;
        if (cat === 'Gold') return 50000000;
        if (cat === 'Silver') return 30000000;
        return 20000000;
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError(null);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError, data } = await supabase.storage
                .from('player-photos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('player-photos')
                .getPublicUrl(filePath);

            setFormData({ ...formData, photo_url: publicUrl });
            setPreviewUrl(publicUrl);
        } catch (err: any) {
            console.error('Upload error:', err);
            setError('Photo upload failed: ' + (err.message || 'Unknown error'));
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/register-player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    base_price: getBasePriceValue(formData.category)
                })
            });

            const data = await res.json();

            if (data.success) {
                setSuccess(true);
                // Reset form or navigate
            } else {
                setError(data.error || 'Failed to submit registration');
            }
        } catch (err) {
            setError('Connection failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ textAlign: 'center', padding: '100px 40px' }}
            >
                <div style={{ width: '100px', height: '100px', background: 'rgba(0, 255, 128, 0.1)', border: '2px solid #00ff80', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 30px' }}>
                    <ShieldCheck size={50} color="#00ff80" />
                </div>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 950, marginBottom: '15px' }}>REGISTRATION COMPLETE</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto 40px' }}>
                    Welcome to the Keshav Cup 2026. You are now officially in the player pool.
                    Teams will be able to see your profile during the live auction.
                </p>
                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                    <button onClick={() => setSuccess(false)} className="btn-secondary" style={{ padding: '15px 40px' }}>REGISTER ANOTHER</button>
                    <a href="/" className="btn-primary" style={{ padding: '15px 40px', display: 'flex', alignItems: 'center', gap: '10px' }}>RETURN HOME <ArrowRight size={20} /></a>
                </div>
            </motion.div>
        );
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '30px', padding: '40px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
                <div className="form-group">
                    <label style={labelStyle}><User size={14} /> FIRST NAME</label>
                    <input
                        required
                        type="text"
                        placeholder="e.g. Het"
                        style={inputStyle}
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    />
                </div>
                <div className="form-group">
                    <label style={labelStyle}><User size={14} /> LAST NAME</label>
                    <input
                        required
                        type="text"
                        placeholder="e.g. Patel"
                        style={inputStyle}
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '25px' }}>
                <div className="form-group">
                    <label style={labelStyle}><Mail size={14} /> EMAIL ADDRESS</label>
                    <input
                        required
                        type="email"
                        placeholder="player@example.com"
                        style={inputStyle}
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                </div>
                <div className="form-group">
                    <label style={labelStyle}><Phone size={14} /> CONTACT NUMBER</label>
                    <input
                        required
                        type="tel"
                        placeholder="+91 XXXXX XXXXX"
                        style={inputStyle}
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                <div className="form-group">
                    <label style={labelStyle}><Calendar size={14} /> AGE</label>
                    <input
                        required
                        type="number"
                        style={inputStyle}
                        value={formData.age}
                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    />
                </div>
                <div className="form-group">
                    <label style={labelStyle}><Search size={14} /> PRIMARY ROLE</label>
                    <select
                        style={inputStyle}
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                        <option>Batsman</option>
                        <option>Bowler</option>
                        <option>All-rounder</option>
                        <option>Wicketkeeper</option>
                    </select>
                </div>
                <div className="form-group">
                    <label style={labelStyle}><Zap size={14} /> CATEGORY (BASE PRICE)</label>
                    <select
                        style={inputStyle}
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                        <option value="Platinum">Platinum ({getBasePriceText('Platinum')})</option>
                        <option value="Gold">Gold ({getBasePriceText('Gold')})</option>
                        <option value="Silver">Silver ({getBasePriceText('Silver')})</option>
                        <option value="Local">Local ({getBasePriceText('Local')})</option>
                    </select>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                <div className="form-group">
                    <label style={labelStyle}><Trophy size={14} /> BATTING STYLE</label>
                    <select
                        style={inputStyle}
                        value={formData.batting_style}
                        onChange={(e) => setFormData({ ...formData, batting_style: e.target.value })}
                    >
                        <option>Right Handed</option>
                        <option>Left Handed</option>
                    </select>
                </div>
                <div className="form-group">
                    <label style={labelStyle}><Zap size={14} /> BOWLING STYLE</label>
                    <select
                        style={inputStyle}
                        value={formData.bowling_style}
                        onChange={(e) => setFormData({ ...formData, bowling_style: e.target.value })}
                    >
                        <option>Right Arm</option>
                        <option>Left Arm</option>
                    </select>
                </div>
                <div className="form-group">
                    <label style={labelStyle}><Clock size={14} /> EXP (YRS)</label>
                    <input
                        type="number"
                        style={inputStyle}
                        value={formData.experience}
                        onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                    />
                </div>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 3' }}>
                <label style={labelStyle}><Camera size={14} /> PLAYER PHOTO (REQUIRED)</label>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div style={{
                        width: '120px',
                        height: '140px',
                        borderRadius: '20px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '2px dashed rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        position: 'relative'
                    }}>
                        {previewUrl ? (
                            <img src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Preview" />
                        ) : uploading ? (
                            <Loader2 size={30} className="animate-spin text-yellow-500" />
                        ) : (
                            <Camera size={30} style={{ opacity: 0.2 }} />
                        )}
                    </div>
                    <div style={{ flex: 1 }}>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            id="photo-upload"
                            style={{ display: 'none' }}
                        />
                        <label htmlFor="photo-upload" style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px 24px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}>
                            {uploading ? 'UPLOADING...' : previewUrl ? 'CHANGE PHOTO' : 'SELECT PHOTO'}
                        </label>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', marginTop: '10px', fontWeight: 600 }}>
                            JPG or PNG recommended. Max size 2MB.
                        </p>
                    </div>
                </div>
            </div>

            <div className="form-group">
                <label style={labelStyle}><Trophy size={14} /> TEAM PREFERENCE (OPTIONAL)</label>
                <input
                    type="text"
                    placeholder="Preferred Team Name (if any)"
                    style={inputStyle}
                    value={formData.team_preference}
                    onChange={(e) => setFormData({ ...formData, team_preference: e.target.value })}
                />
            </div>

            {error && (
                <div style={{ padding: '15px', background: 'rgba(255, 75, 75, 0.1)', color: '#ff4b4b', borderRadius: '15px', fontSize: '0.85rem', fontWeight: 800, border: '1px solid rgba(255, 75, 75, 0.2)' }}>
                    ERROR: {error}
                </div>
            )}

            <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                <button
                    disabled={loading}
                    type="submit"
                    className="btn-primary"
                    style={{
                        flex: 1,
                        height: '60px',
                        fontSize: '1rem',
                        fontWeight: 950,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        opacity: loading ? 0.7 : 1
                    }}
                >
                    <Save size={20} />
                    {loading ? 'Processing...' : 'CONFIRM REGISTRATION & JOIN POOL'}
                </button>
            </div>
        </form>
    );
}

const labelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.7rem',
    fontWeight: 800,
    color: 'var(--text-muted)',
    marginBottom: '8px',
    letterSpacing: '1px'
};

const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
    padding: '14px 20px',
    color: '#fff',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'all 0.3s ease',
    appearance: 'none' as const
};
