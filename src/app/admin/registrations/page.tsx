'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Search, Trash2, Camera, RefreshCw, Upload } from 'lucide-react';
import RoleGuard from '@/components/RoleGuard';
import { motion, AnimatePresence } from 'framer-motion';
import { fixPhotoUrl } from '@/lib/utils';

export default function RegistrationControl() {
    return (
        <RoleGuard allowedRole="admin">
            <RegistrationControlContent />
        </RoleGuard>
    );
}

function RegistrationControlContent() {
    const [registrations, setRegistrations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [pushingId, setPushingId] = useState<string | null>(null);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [hidePushed, setHidePushed] = useState(true);
    const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
    const [newSlotInput, setNewSlotInput] = useState('');

    // Photo Management State
    const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
    const [showModal, setShowModal] = useState(false);
    const [useCamera, setUseCamera] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchRegistrations = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('registrations')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching registrations:', error);
        } else {
            setRegistrations(data || []);
        }
        setLoading(false);
    };

    const uploadPhoto = async (fileOrBlob: File | Blob) => {
        if (!selectedPlayer) return;
        setUploadingId(selectedPlayer.id);
        setShowModal(false);

        try {
            const fileName = `${selectedPlayer.mobile || Date.now()}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('player-photos')
                .upload(fileName, fileOrBlob, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('player-photos')
                .getPublicUrl(fileName);

            const { error: regErr } = await supabase
                .from('registrations')
                .update({ photo: publicUrl })
                .eq('id', selectedPlayer.id);

            if (regErr) throw regErr;

            const nameParts = selectedPlayer.name?.split(' ') || ['Unknown', 'Player'];
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || 'Player';

            await supabase
                .from('players')
                .update({ photo_url: publicUrl })
                .eq('first_name', firstName)
                .eq('last_name', lastName);

            fetchRegistrations();
            alert("Photo updated successfully!");
        } catch (err: any) {
            console.error('Upload error:', err);
            alert("Failed to upload photo: " + (err.message || "Unknown error"));
        } finally {
            setUploadingId(null);
            setSelectedPlayer(null);
            stopCamera();
        }
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setUseCamera(true);
        } catch (err) {
            alert("Camera access denied or not available");
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setUseCamera(false);
    };

    const capturePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
            if (blob) uploadPhoto(blob);
        }, 'image/jpeg', 0.8);
    };

    const bulkPushAll = async () => {
        const pending = registrations.filter(p => !p.is_pushed);
        if (pending.length === 0) {
            alert("No pending players to push.");
            return;
        }

        if (!confirm(`🚀 Push ALL ${pending.length} pending players to the main player pool?`)) return;
        
        setLoading(true);
        try {
            const res = await fetch('/api/admin/bulk-push', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert(`✅ SUCCESS!\n\n${data.message}`);
                fetchRegistrations();
            } else {
                throw new Error(data.error || 'Bulk push failed');
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const pushToPool = async (player: any) => {
        if (!confirm(`Push ${player.name} to the main player pool?`)) return;
        setPushingId(player.id);
        try {
            const res = await fetch('/api/admin/push-player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player })
            });
            
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const result = await res.json();
                if (result.success) {
                    setRegistrations(prev => prev.map(p =>
                        p.id === player.id ? { ...p, is_pushed: true } : p
                    ));
                    alert(`SUCCESS! ${player.name} moved to the Player Pool.`);
                } else {
                    alert('Failed to push: ' + result.error);
                }
            } else {
                const text = await res.text();
                console.error('Non-JSON response received:', text);
                alert(`Error pushing player: Server returned ${res.status}. Check console for details.`);
            }
        } catch (err: any) {
            console.error('Fetch error:', err);
            alert('Error pushing player: ' + err.message);
        } finally {
            setPushingId(null);
        }
    };

    const updateRegistrationSlot = async (id: string, newSlot: string) => {
        const { error } = await supabase.from('registrations').update({ slot: newSlot }).eq('id', id);
        if (error) {
            alert('Failed to update slot: ' + error.message);
        } else {
            setRegistrations(prev => prev.map(p => p.id === id ? { ...p, slot: newSlot } : p));
        }
    };

    const confirmNewSlot = async (id: string) => {
        const val = newSlotInput.trim();
        if (!val) {
            setEditingSlotId(null);
            return;
        }
        await updateRegistrationSlot(id, val);
        setEditingSlotId(null);
        setNewSlotInput('');
    };

    const deleteRegistration = async (id: string) => {
        const player = registrations.find(p => p.id === id);
        if (!player) return;

        if (player.is_pushed) {
            // Pushed player — players table ma thi remove + is_pushed reset
            if (!confirm(`${player.name} is already pushed to Player Pool.\n\nThis will:\n✅ Remove from Player Pool\n✅ Keep in Registration Control\n✅ Allow re-pushing later\n\nContinue?`)) return;

            // 1. Players table ma thi delete karo
            const nameParts = player.name?.split(' ') || ['Unknown', 'Player'];
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || 'Player';

            await supabase
                .from('players')
                .delete()
                .eq('first_name', firstName)
                .eq('last_name', lastName);

            // 2. Registration ma is_pushed = false karo
            const { error } = await supabase
                .from('registrations')
                .update({ is_pushed: false })
                .eq('id', id);

            if (error) {
                alert('Failed: ' + error.message);
            } else {
                setRegistrations(prev => prev.map(p =>
                    p.id === id ? { ...p, is_pushed: false } : p
                ));
                alert(`${player.name} removed from Player Pool. Can be re-pushed anytime.`);
            }
        } else {
            // Not pushed — permanently delete
            if (!confirm(`Permanently delete ${player.name}'s registration?`)) return;
            const { error } = await supabase.from('registrations').delete().eq('id', id);
            if (error) {
                alert('Delete failed: ' + error.message);
            } else {
                setRegistrations(prev => prev.filter(p => p.id !== id));
            }
        }
    };

    useEffect(() => {
        fetchRegistrations();

        const channel = supabase
            .channel('registrations_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
                fetchRegistrations();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const filtered = registrations.filter(p => {
        const matchesSearch =
            p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.mobile?.includes(searchTerm);

        if (hidePushed && p.is_pushed) return false;
        return matchesSearch;
    });

    // Extract unique existing slots from ALL registrations (not just filtered)
    const existingSlots = Array.from(new Set(registrations.map(r => r.slot).filter(s => s && s !== 'Unassigned'))).sort();

    return (
        <main style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
            <div style={{ padding: '60px 20px', maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        PLAYER REGISTRATION CONTROL
                    </h1>
                    <button
                        onClick={async () => {
                            if (!confirm('Sync registrations from Google Sheet?')) return;
                            setLoading(true);
                            try {
                                const res = await fetch('/api/admin/sync-sheet');
                                const data = await res.json();
                                if (data.success) {
                                    let details = '';
                                    if (data.skippedDetails?.length > 0) {
                                        details = '\n\nSkipped Highlights:\n' + data.skippedDetails.slice(0, 3).map((d: any) => `Row ${d.row}: ${d.reason}`).join('\n');
                                        if (data.skippedDetails.length > 3) details += `\n...and ${data.skippedDetails.length - 3} more`;
                                    }
                                    alert(`✅ Sync complete!\n\nTotal: ${data.totalRows || 0}\nNew: ${data.synced || 0}\nUpdated: ${data.updated || 0}\nSkipped (in Pool): ${data.inPool || 0}\nInvalid: ${data.invalid || 0}${details}`);
                                    fetchRegistrations();
                                } else {
                                    alert('Sync failed: ' + data.error);
                                }
                            } catch (err: any) {
                                alert('Error: ' + err.message);
                            } finally {
                                setLoading(false);
                            }
                        }}
                        disabled={loading}
                        style={{
                            padding: '12px 25px',
                            background: 'rgba(255,215,0,0.1)',
                            border: '1px solid var(--primary)',
                            color: 'var(--primary)',
                            borderRadius: '12px',
                            fontWeight: 900,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}
                    >
                        <RefreshCw size={18} className={loading ? 'rotate' : ''} />
                        SYNC FROM SHEET
                    </button>
                </div>

                {/* Search and Filter Bar */}
                <div className="glass" style={{
                    padding: '15px 25px',
                    borderRadius: '16px',
                    marginBottom: '2px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid rgba(255,255,255,0.05)',
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flex: 1 }}>
                        <Search size={18} color="#666" />
                        <input
                            type="text"
                            placeholder="Search Registrations..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1rem', outline: 'none', width: '100%', fontWeight: 500 }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                            type="checkbox"
                            id="hidePushed"
                            checked={hidePushed}
                            onChange={(e) => setHidePushed(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                        />
                        <label htmlFor="hidePushed" style={{ fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', color: '#fff', textTransform: 'uppercase' }}>
                            HIDE PUSHED
                        </label>
                    </div>
                </div>

                {/* Table Layout */}
                <div className="glass" style={{ borderRadius: '0 0 16px 16px', overflowX: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <th style={{ ...thStyle, width: '60px' }}>PHOTO</th>
                                <th style={{ ...thStyle, width: '140px' }}>FULL NAME</th>
                                <th style={{ ...thStyle, width: '100px' }}>CRICKET SKILL</th>
                                <th style={{ ...thStyle, width: '80px' }}>KESHAV CUP PARTICIPATION</th>
                                <th style={{ ...thStyle, width: '130px' }}>SLOTS</th>
                                <th style={{ ...thStyle, width: '120px' }}>PUSH BUTTON</th>
                                <th style={{ ...thStyle, width: '60px' }}>DELETE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '100px', textAlign: 'center', color: '#666' }}>
                                        <RefreshCw size={30} className="rotate" style={{ marginBottom: '15px' }} />
                                        <p>Loading registrations...</p>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '100px', textAlign: 'center', color: '#666', fontSize: '1.1rem', fontWeight: 500 }}>
                                        No registrations found.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((p) => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} className="table-row-hover">
                                        <td style={tdStyle}>
                                            <div
                                                style={{
                                                    width: '56px', height: '56px', borderRadius: '12px',
                                                    overflow: 'hidden', background: '#111', margin: '0 auto',
                                                    position: 'relative', cursor: 'pointer',
                                                    border: '1px solid rgba(255,255,255,0.1)'
                                                }}
                                                className="photo-container"
                                                onClick={() => { setSelectedPlayer(p); setShowModal(true); }}
                                            >
                                                <img
                                                    src={fixPhotoUrl(p.photo, p.name)}
                                                    alt=""
                                                    className="photo-img"
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: uploadingId === p.id ? 0.3 : 1 }}
                                                    onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.name || 'Player')}`; }}
                                                />
                                                <div className="photo-overlay"><Camera size={18} /></div>
                                                {uploadingId === p.id && (
                                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <RefreshCw size={18} className="rotate" />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#fff' }}>{p.name}</div>
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff' }}>{p.role}</div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: p.city === 'હા' ? '#00ff80' : '#888' }}>
                                                {p.city === 'હા' ? 'YES' : 'NO'}
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            {editingSlotId === p.id ? (
                                                <div style={{ display: 'flex', gap: '5px', width: '90%', margin: '0 auto' }}>
                                                    <input
                                                        type="text"
                                                        value={newSlotInput}
                                                        onChange={(e) => setNewSlotInput(e.target.value)}
                                                        autoFocus
                                                        placeholder="Name..."
                                                        onKeyDown={(e) => e.key === 'Enter' && confirmNewSlot(p.id)}
                                                        style={{
                                                            background: '#0a0a0a', border: '1px solid var(--primary)',
                                                            color: '#fff', fontSize: '0.7rem', padding: '5px',
                                                            borderRadius: '4px', width: '65%', outline: 'none'
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => confirmNewSlot(p.id)}
                                                        style={{ background: 'var(--primary)', color: '#000', border: 'none', borderRadius: '4px', fontSize: '0.6rem', padding: '0 6px', fontWeight: 900, cursor: 'pointer' }}
                                                    >
                                                        OK
                                                    </button>
                                                </div>
                                            ) : (
                                                <select
                                                    value={p.slot || 'Unassigned'}
                                                    onChange={(e) => {
                                                        if (e.target.value === '+ New Slot') {
                                                            setEditingSlotId(p.id);
                                                            setNewSlotInput('');
                                                        } else {
                                                            updateRegistrationSlot(p.id, e.target.value);
                                                        }
                                                    }}
                                                    style={{
                                                        background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.2)',
                                                        color: '#fff', fontSize: '0.7rem', padding: '5px',
                                                        borderRadius: '6px', width: '90%', fontWeight: 700,
                                                        outline: 'none', cursor: 'pointer'
                                                    }}
                                                >
                                                    <option value="Unassigned" style={{ background: '#0a0a0a', color: '#fff' }}>Unassigned</option>
                                                    {existingSlots.map(slotName => (
                                                        <option key={slotName} value={slotName} style={{ background: '#0a0a0a', color: '#fff' }}>
                                                            {slotName}
                                                        </option>
                                                    ))}
                                                    <option value="+ New Slot" style={{ background: '#0a0a0a', color: 'var(--primary)', fontWeight: 800 }}>+ New Slot</option>
                                                </select>
                                            )}
                                        </td>
                                        <td style={tdStyle}>
                                            <button
                                                onClick={() => pushToPool(p)}
                                                disabled={pushingId === p.id || p.is_pushed}
                                                className="push-btn"
                                                style={{
                                                    padding: '10px 24px', borderRadius: '10px',
                                                    background: p.is_pushed ? 'rgba(0, 255, 128, 0.05)' : 'rgba(255,215,0,0.05)',
                                                    border: `1px solid ${p.is_pushed ? 'rgba(0, 255, 128, 0.3)' : 'rgba(255, 215, 0, 0.3)'}`,
                                                    color: p.is_pushed ? '#00ff80' : 'var(--primary)',
                                                    fontWeight: 900, fontSize: '0.65rem',
                                                    cursor: p.is_pushed ? 'default' : 'pointer',
                                                    textTransform: 'uppercase', transition: 'all 0.2s ease'
                                                }}
                                            >
                                                {pushingId === p.id ? '...' : p.is_pushed ? 'PUSHED' : 'PUSH'}
                                            </button>
                                        </td>
                                        <td style={tdStyle}>
                                            <button
                                                onClick={() => deleteRegistration(p.id)}
                                                style={{
                                                    background: 'none', border: 'none',
                                                    color: p.is_pushed ? '#ffd700' : '#ff4b4b',
                                                    cursor: 'pointer', opacity: 0.7
                                                }}
                                                title={p.is_pushed ? 'Remove from Player Pool' : 'Delete Registration'}
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'center' }}>
                    <button
                        onClick={bulkPushAll}
                        disabled={loading || registrations.filter(p => !p.is_pushed).length === 0}
                        style={{
                            padding: '18px 40px',
                            borderRadius: '16px',
                            background: 'var(--primary)',
                            color: '#000',
                            fontWeight: 950,
                            fontSize: '1rem',
                            border: 'none',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            boxShadow: '0 10px 30px rgba(255, 215, 0, 0.2)',
                            transition: 'all 0.3s ease'
                        }}
                        className="bulk-push-btn"
                    >
                        <Upload size={20} /> PUSH ALL PENDING TO POOL ({registrations.filter(p => !p.is_pushed).length})
                    </button>
                </div>
            </div>

            {/* Upload Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                            className="glass"
                            style={{ padding: '40px', borderRadius: '24px', width: '450px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                            <h2 style={{ fontSize: '1.8rem', fontWeight: 950, marginBottom: '10px' }}>UPDATE PHOTO</h2>
                            <p style={{ color: '#888', marginBottom: '30px', fontSize: '0.9rem', fontWeight: 600 }}>
                                Update profile picture for <span style={{ color: 'var(--primary)' }}>{selectedPlayer?.name}</span>
                            </p>

                            {!useCamera ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                                        className="modal-btn"
                                    >
                                        <Upload size={24} color="var(--primary)" />
                                        <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>UPLOAD FILE</span>
                                    </button>
                                    <button
                                        onClick={startCamera}
                                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                                        className="modal-btn"
                                    >
                                        <Camera size={24} color="var(--primary)" />
                                        <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>TAKE PHOTO</span>
                                    </button>
                                    <input
                                        ref={fileInputRef} type="file" accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
                                    />
                                    <button
                                        onClick={() => { setShowModal(false); setSelectedPlayer(null); }}
                                        style={{ gridColumn: 'span 2', marginTop: '10px', padding: '12px', background: 'transparent', border: 'none', color: '#ff4b4b', fontWeight: 800, cursor: 'pointer' }}
                                    >
                                        CANCEL
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#000', borderRadius: '16px', overflow: 'hidden', marginBottom: '20px' }}>
                                        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={capturePhoto} style={{ flex: 1, padding: '15px', borderRadius: '12px', background: 'var(--primary)', color: '#000', fontWeight: 900, border: 'none', cursor: 'pointer' }}>
                                            CAPTURE PHOTO
                                        </button>
                                        <button onClick={stopCamera} style={{ padding: '15px', borderRadius: '12px', background: 'rgba(255,75,75,0.1)', color: '#ff4b4b', fontWeight: 900, border: '1px solid #ff4b4b', cursor: 'pointer' }}>
                                            CANCEL
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style jsx>{`
                .rotate { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .table-row-hover:hover { background: rgba(255,255,255,0.02); }
                .push-btn:hover { background: var(--primary) !important; color: #000 !important; }
                th { color: #888; letter-spacing: 1px; }
                .photo-container:hover .photo-overlay { opacity: 1; }
                .photo-overlay {
                    position: absolute; inset: 0;
                    background: rgba(0,0,0,0.6);
                    display: flex; align-items: center; justify-content: center;
                    opacity: 0; transition: all 0.2s ease;
                    color: var(--primary);
                }
                .photo-container { 
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important; 
                    z-index: 1;
                }
                .photo-container:hover { 
                    transform: scale(2.2); 
                    z-index: 100; 
                    border-color: var(--primary) !important;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.8);
                }
                .photo-img {
                    transition: transform 0.3s ease;
                }
                .photo-container:hover .photo-img {
                    transform: scale(1.1);
                }
                .modal-btn:hover {
                    background: rgba(255,215,0,0.05) !important;
                    border-color: var(--primary) !important;
                    transform: translateY(-2px);
                }
                .bulk-push-btn:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 15px 40px rgba(255, 215, 0, 0.4);
                }
                .bulk-push-btn:active {
                    transform: translateY(-1px);
                }
            `}</style>
        </main>
    );
}

const thStyle: React.CSSProperties = {
    padding: '10px', fontSize: '0.85rem', fontWeight: 950,
    textAlign: 'center', textTransform: 'uppercase', whiteSpace: 'nowrap',
    color: '#aaa'
};

const tdStyle: React.CSSProperties = {
    padding: '8px 10px', textAlign: 'center', fontSize: '0.8rem', color: '#ddd'
};