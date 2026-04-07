'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Camera, Upload, CheckCircle2, AlertCircle, Loader2, RefreshCw, RotateCcw } from 'lucide-react';

export default function PublicRegistrationPage() {
    const [formData, setFormData] = useState({
        yuva_sabha: '',
        name: '',
        mobile: '',
        address: '',
        area_contact: '',
        birth_date: '',
        occupation: '',
        occupation_other: '',
        prev_participation: '',
        skill: '',
        tshirt_size: '',
        tshirt_number: ''
    });

    const [photoFile, setPhotoFile] = useState<File | Blob | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const [useCamera, setUseCamera] = useState(false);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [stream, setStream] = useState<MediaStream | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const karyakars = [
        'Dev Kachhiya', 'Meet Mochi', 'Subham Kachhiya',
        'Taksh Kachhiya (Patel Nagar)', 'Darpan Patel',
        'Shiv Patel', 'Vatsal Patel'
    ];

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.yuva_sabha) newErrors.yuva_sabha = 'આ ક્ષેત્ર આવશ્યક છે';
        if (!formData.name) newErrors.name = 'Full Name is required';
        if (!formData.mobile || formData.mobile.length !== 10) newErrors.mobile = 'Valid 10-digit Mo. no. is required';
        if (!formData.address) newErrors.address = 'Address is required';
        if (!formData.area_contact) newErrors.area_contact = 'આ ક્ષેત્ર આવશ્યક છે';
        if (!formData.occupation) newErrors.occupation = 'Occupation is required';
        if (formData.occupation === 'Other:' && !formData.occupation_other) newErrors.occupation_other = 'Please specify';
        if (!photoFile) newErrors.photo = 'Photo is required';
        if (!formData.prev_participation) newErrors.prev_participation = 'આ ક્ષેત્ર આવશ્યક છે';
        if (!formData.skill) newErrors.skill = 'Skill is required';
        if (!formData.tshirt_size) newErrors.tshirt_size = 'T-shirt size is required';
        if (!formData.tshirt_number) newErrors.tshirt_number = 'T-shirt number is required';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const startCamera = async (facing: 'environment' | 'user' = 'environment') => {
        // Pehla juna stream band karo
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }

        try {
            // { ideal: facing } — back camera properly open karse
            const constraints = {
                video: {
                    facingMode: { ideal: facing },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(newStream);
            setFacingMode(facing);
            setUseCamera(true);
            setPhotoPreview(null);

            // Stream video element sathe attach karo
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = newStream;
                }
            }, 100);

        } catch (err) {
            console.error('Camera error:', err);
            alert('Camera access denied or not available');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        setStream(null);
        setUseCamera(false);
    };

    const switchCamera = () => {
        const newMode = facingMode === 'environment' ? 'user' : 'environment';
        startCamera(newMode);
    };

    const capturePhoto = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (facingMode === 'user') {
            // Front camera — saved photo flip correct karo (mirror hatavo)
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        // Back camera — normal draw, koi flip nahi
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (blob) {
                setPhotoFile(blob);
                setPhotoPreview(URL.createObjectURL(blob));
                stopCamera();
            }
        }, 'image/jpeg', 0.9);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setLoading(true);
        try {
            // 1. Upload Photo
            const timestamp = Date.now();
            const fileName = `${formData.mobile}_${timestamp}.jpg`;
            const { error: uploadError } = await supabase.storage
                .from('player-photos')
                .upload(fileName, photoFile!, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('player-photos')
                .getPublicUrl(fileName);

            // 2. Insert into DB
            const { error: insertError } = await supabase
                .from('registrations')
                .insert([{
                    name: formData.name,
                    mobile: formData.mobile,
                    address: formData.address,
                    role: formData.skill,
                    city: formData.prev_participation,
                    photo: publicUrl,
                    yuva_sabha: formData.yuva_sabha,
                    area_contact: formData.area_contact,
                    birth_date: formData.birth_date || null,
                    occupation: formData.occupation === 'Other:' ? formData.occupation_other : formData.occupation,
                    is_pushed: false,
                    age: 20,
                    base_price: 20000000,
                    tshirt_size: formData.tshirt_size,
                    tshirt_number: formData.tshirt_number
                }]);

            if (insertError) throw insertError;

            // 3. Register to Google Sheet (Non-blocking)
            fetch('/api/register-to-sheet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, photo: publicUrl })
            }).catch(e => console.error('Sheet sync failed:', e));

            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setFormData({
                    yuva_sabha: '',
                    name: '',
                    mobile: '',
                    address: '',
                    area_contact: '',
                    birth_date: '',
                    occupation: '',
                    occupation_other: '',
                    prev_participation: '',
                    skill: '',
                    tshirt_size: '',
                    tshirt_number: ''
                });
                setPhotoFile(null);
                setPhotoPreview(null);
            }, 3000);

        } catch (err: any) {
            alert('Submit failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <main style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card" style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '12px', color: '#000', maxWidth: '500px', width: '100%' }}>
                    <CheckCircle2 size={80} color="#00c853" style={{ margin: '0 auto 20px' }} />
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#00c853' }}>તમારી નોંધણી સફળ થઈ! આભાર 🙏</h2>
                </motion.div>
            </main>
        );
    }

    return (
        <main className="main-viewport">
            {/* Banner */}
            <div className="banner-container">
                <img
                    src="/keshav-cup-banner.jpg"
                    alt="Keshav Cup Banner"
                    className="banner-img"
                />
            </div>

            <div className="form-container">
                {/* Header Card */}
                <div className="card-header">
                    <h1>Keshav Cup 4.0</h1>
                    <p className="subtitle">BAPS Petlad Yuva</p>
                    <hr className="divider" />
                    <p className="required-note">* Indicates required question</p>
                </div>

                <form onSubmit={handleSubmit} className="reg-form">
                    {/* Q1: Yuva Sabha */}
                    <div className="card-q">
                        <label className="q-label">તમે યુવક સભા માં આવો છો? *</label>
                        <div className="radio-group">
                            {['હા ( રેગ્યુલર )', 'હા ( પણ ઇ-રેગ્યુલર છું. )', 'ના', 'ના ( નવો યુવક છું. )'].map(opt => (
                                <label key={opt} className="radio-item">
                                    <input type="radio" name="yuva_sabha" value={opt} onChange={(e) => setFormData({ ...formData, yuva_sabha: e.target.value })} checked={formData.yuva_sabha === opt} required />
                                    <span>{opt}</span>
                                </label>
                            ))}
                        </div>
                        {errors.yuva_sabha && <span className="error-msg"><AlertCircle size={14} /> {errors.yuva_sabha}</span>}
                    </div>

                    {/* Q2: Full Name */}
                    <div className="card-q">
                        <label className="q-label">Full Name: *</label>
                        <input type="text" className="text-input" placeholder="Your answer" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                        {errors.name && <span className="error-msg"><AlertCircle size={14} /> {errors.name}</span>}
                    </div>

                    {/* Q3: Mobile */}
                    <div className="card-q">
                        <label className="q-label">Mo. no. *</label>
                        <input type="number" className="text-input" placeholder="Your answer" value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value.slice(0, 10) })} required />
                        {errors.mobile && <span className="error-msg"><AlertCircle size={14} /> {errors.mobile}</span>}
                    </div>

                    {/* Q4: Address */}
                    <div className="card-q">
                        <label className="q-label">Address: *</label>
                        <input type="text" className="text-input" placeholder="Your answer" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} required />
                        {errors.address && <span className="error-msg"><AlertCircle size={14} /> {errors.address}</span>}
                    </div>

                    {/* Q5: Karyakar */}
                    <div className="card-q">
                        <label className="q-label">તમારા સંપર્ક કાર્યકર કોણ છે? / (Area wise) *</label>
                        <select className="text-input select-input" value={formData.area_contact} onChange={(e) => setFormData({ ...formData, area_contact: e.target.value })} required>
                            <option value="">Choose</option>
                            {karyakars.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                        {errors.area_contact && <span className="error-msg"><AlertCircle size={14} /> {errors.area_contact}</span>}
                    </div>

                    {/* Q6: Birth Date */}
                    <div className="card-q">
                        <label className="q-label">Birth Date</label>
                        <input type="date" className="text-input" value={formData.birth_date} onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })} />
                    </div>

                    {/* Q7: Occupation */}
                    <div className="card-q">
                        <label className="q-label">Occupation (વ્યવસાય) *</label>
                        <div className="radio-group">
                            {['School Student ( 9th STD -10th STD)', 'School Student ( 11th STD -12th STD)', 'College Student', 'Doing Job', 'Job સોધી રહિયો છું.', 'Other:'].map(opt => (
                                <label key={opt} className="radio-item">
                                    <input type="radio" name="occupation" value={opt} onChange={(e) => setFormData({ ...formData, occupation: e.target.value })} checked={formData.occupation === opt} required />
                                    <span>{opt}</span>
                                </label>
                            ))}
                            {formData.occupation === 'Other:' && (
                                <input type="text" className="text-input-sub" placeholder="Your answer" value={formData.occupation_other} onChange={(e) => setFormData({ ...formData, occupation_other: e.target.value })} />
                            )}
                        </div>
                        {errors.occupation && <span className="error-msg"><AlertCircle size={14} /> {errors.occupation}</span>}
                    </div>

                    {/* Q8: Photo */}
                    <div className="card-q">
                        <label className="q-label">Your Photo (Half body Portrait photo) *</label>
                        <p className="photo-hint">Upload 1 supported file. Max 10 MB.</p>

                        {!useCamera && (
                            <div className="btn-upload-container">
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-upload">
                                    <Upload size={18} /> Upload File
                                </button>
                                <button type="button" onClick={() => startCamera('environment')} className="btn-upload">
                                    <Camera size={18} /> Take Photo
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handlePhotoChange}
                                />
                            </div>
                        )}

                        {useCamera && (
                            <div className="camera-overlay">
                                <div className="camera-label">
                                    {facingMode === 'environment' ? '📷 Back Camera' : '🤳 Front Camera'}
                                </div>
                                <div className="video-container">
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        // Front camera preview mirror dikhao (natural selfie)
                                        // Back camera — normal
                                        style={{
                                            width: '100%',
                                            height: 'auto',
                                            background: '#000',
                                            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
                                        }}
                                    />
                                </div>
                                <div className="camera-controls">
                                    <button type="button" onClick={stopCamera} className="btn-cam-action">
                                        Cancel
                                    </button>
                                    <button type="button" onClick={capturePhoto} className="btn-cam-capture">
                                        <div className="capture-inner" />
                                    </button>
                                    <button type="button" onClick={switchCamera} className="btn-cam-action">
                                        <RefreshCw size={24} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {photoPreview && !useCamera && (
                            <div className="photo-preview-section">
                                <div className="photo-preview-container">
                                    <img src={photoPreview} alt="Preview" className="photo-preview-img" />
                                </div>
                                <button type="button" onClick={() => startCamera('environment')} className="btn-retake">
                                    <RotateCcw size={16} /> Retake Photo
                                </button>
                            </div>
                        )}
                        {errors.photo && <span className="error-msg" style={{ marginTop: '10px' }}><AlertCircle size={14} /> {errors.photo}</span>}
                    </div>

                    {/* Q9: Previous Participation */}
                    <div className="card-q">
                        <label className="q-label">પહેલા ના વર્ષો માં કેશવ કપ માં ભાગ લીધો હતો? *</label>
                        <div className="radio-group-flex">
                            {['હા', 'ના'].map(opt => (
                                <label key={opt} className="radio-item">
                                    <input type="radio" name="prev" value={opt} onChange={(e) => setFormData({ ...formData, prev_participation: e.target.value })} checked={formData.prev_participation === opt} required />
                                    <span>{opt}</span>
                                </label>
                            ))}
                        </div>
                        {errors.prev_participation && <span className="error-msg"><AlertCircle size={14} /> {errors.prev_participation}</span>}
                    </div>

                    {/* Q10: Skill */}
                    <div className="card-q">
                        <label className="q-label">કેશવ કપ દરમ્યાન તમારી આગવી વિશેષતા? *</label>
                        <div className="radio-group">
                            {['Batsman', 'Bowler', 'All Rounder'].map(opt => (
                                <label key={opt} className="radio-item">
                                    <input type="radio" name="skill" value={opt} onChange={(e) => setFormData({ ...formData, skill: e.target.value })} checked={formData.skill === opt} required />
                                    <span>{opt}</span>
                                </label>
                            ))}
                        </div>
                        {errors.skill && <span className="error-msg"><AlertCircle size={14} /> {errors.skill}</span>}
                    </div>
                    
                    {/* Q11: T-Shirt Size */}
                    <div className="card-q">
                        <label className="q-label">T-Shirt Size *</label>
                        <select className="text-input select-input" value={formData.tshirt_size} onChange={(e) => setFormData({ ...formData, tshirt_size: e.target.value })} required>
                            <option value="">Choose Size</option>
                            {['S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(size => <option key={size} value={size}>{size}</option>)}
                        </select>
                        {errors.tshirt_size && <span className="error-msg"><AlertCircle size={14} /> {errors.tshirt_size}</span>}
                    </div>

                    {/* Q12: T-Shirt Number */}
                    <div className="card-q">
                        <label className="q-label">T-Shirt Number (તમે જે નંબર રાખવા માંગતા હોય તે) *</label>
                        <input type="text" className="text-input" placeholder="e.g. 07, 10, 18" value={formData.tshirt_number} onChange={(e) => setFormData({ ...formData, tshirt_number: e.target.value })} required />
                        {errors.tshirt_number && <span className="error-msg"><AlertCircle size={14} /> {errors.tshirt_number}</span>}
                    </div>

                    <button type="submit" disabled={loading} className="btn-submit">
                        {loading ? <Loader2 className="animate-spin" /> : 'Submit'}
                    </button>

                    <div className="footer-links">
                        <span>Never submit passwords.</span>
                        <a href="#">Report Abuse</a>
                    </div>
                </form>
            </div>

            <style jsx>{`
                .main-viewport {
                    min-height: 100vh;
                    background: #0a0a0a;
                    color: #fff;
                    padding-bottom: 60px;
                    overflow-x: hidden;
                    width: 100%;
                }
                .banner-container {
                    width: 100%;
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                    border-radius: 0 0 16px 16px;
                }
                .banner-img {
                    width: 100%;
                    object-fit: cover;
                    display: block;
                }
                @media (max-width: 640px) {
                    .banner-img { height: 150px; }
                    .form-container { padding: 10px; margin: 0; }
                }
                @media (min-width: 641px) {
                    .banner-img { height: 200px; }
                    .form-container { padding: 0 20px; margin: 8px auto; }
                }

                .form-container {
                    max-width: 640px;
                    width: 100%;
                    margin: 0 auto;
                    box-sizing: border-box;
                }
                .reg-form {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .card-q, .card-header {
                    background: #fff;
                    color: #000;
                    border: 1px solid #ddd;
                    box-sizing: border-box;
                    width: 100%;
                }
                .card-header {
                    border-top: 10px solid #00c853;
                    margin-bottom: 12px;
                }
                @media (max-width: 640px) {
                    .card-q, .card-header { padding: 16px; border-radius: 8px; }
                    .card-header h1 { font-size: 1.5rem; margin: 0 0 8px 0; font-weight: 700; }
                    .card-header .subtitle { font-size: 1rem; margin: 0 0 15px 0; }
                }
                @media (min-width: 641px) {
                    .card-q, .card-header { padding: 24px; border-radius: 12px; }
                    .card-header h1 { font-size: 1.8rem; margin: 0 0 8px 0; font-weight: 700; }
                    .card-header .subtitle { font-size: 1.1rem; margin: 0 0 20px 0; }
                }

                .divider { border: none; border-top: 1px solid #ddd; margin: 0 0 10px 0; }
                .required-note { color: #d93025; font-size: 0.9rem; margin: 0; }
                
                .q-label {
                    display: block;
                    font-size: 1.1rem;
                    margin-bottom: 15px;
                    font-weight: 500;
                }
                .text-input, .text-input-sub, .select-input {
                    width: 100%;
                    border: none;
                    border-bottom: 1px solid #ddd;
                    padding: 12px;
                    font-size: 16px;
                    outline: none;
                    transition: border-color 0.3s;
                    box-sizing: border-box;
                    background: transparent;
                    color: #000;
                    min-height: 44px;
                }
                .text-input:focus, .text-input-sub:focus { border-bottom: 2px solid #00c853; }
                
                .radio-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 0;
                    cursor: pointer;
                    min-height: 44px;
                    font-size: 0.95rem;
                }
                .radio-item input { width: 20px; height: 20px; accent-color: #00c853; cursor: pointer; }
                
                .radio-group-flex { display: flex; gap: 20px; }

                .photo-hint { color: #5f6368; font-size: 0.85rem; margin-bottom: 15px; }
                .btn-upload-container { display: flex; gap: 10px; margin-bottom: 15px; }
                .btn-upload {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 12px 16px;
                    border: 1px solid #ddd;
                    background: #fff;
                    border-radius: 4px;
                    font-weight: 600;
                    cursor: pointer;
                    color: #00c853;
                    min-height: 44px;
                }
                @media (max-width: 640px) {
                    .btn-upload-container { flex-direction: column; }
                    .btn-upload { width: 100%; }
                }

                .photo-preview-container {
                    position: relative;
                    width: 120px;
                    height: 160px;
                    border-radius: 8px;
                    overflow: hidden;
                    border: 2px solid #00c853;
                }
                .photo-preview-img { width: 100%; height: 100%; object-fit: cover; }

                /* Camera UI */
                .camera-overlay {
                    width: 100%;
                    background: #000;
                    border-radius: 12px;
                    overflow: hidden;
                    margin-bottom: 15px;
                }
                .camera-label {
                    text-align: center;
                    color: #fff;
                    font-size: 0.85rem;
                    padding: 8px;
                    background: rgba(0,0,0,0.7);
                    font-weight: 600;
                }
                .video-container { width: 100%; line-height: 0; }
                .camera-controls {
                    display: flex;
                    align-items: center;
                    justify-content: space-around;
                    padding: 20px;
                    background: rgba(0,0,0,0.8);
                }
                .btn-cam-action {
                    background: transparent;
                    border: none;
                    color: #fff;
                    font-size: 1rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 60px;
                    font-weight: 600;
                }
                .btn-cam-capture {
                    width: 70px;
                    height: 70px;
                    border-radius: 50%;
                    background: #fff;
                    border: 4px solid rgba(255,255,255,0.4);
                    padding: 0;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .capture-inner {
                    width: 54px;
                    height: 54px;
                    border-radius: 50%;
                    background: #fff;
                    border: 2px solid #333;
                    transition: transform 0.1s;
                }
                .btn-cam-capture:active .capture-inner { transform: scale(0.88); }

                .photo-preview-section { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
                .btn-retake {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #00c853;
                    background: transparent;
                    border: 1px solid #00c853;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    width: fit-content;
                    font-weight: 600;
                }

                .btn-submit {
                    width: 100%;
                    min-height: 50px;
                    background: #00c853;
                    color: white;
                    padding: 12px 24px;
                    border: none;
                    border-radius: 4px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: filter 0.2s;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .btn-submit:hover { filter: brightness(0.9); }
                .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

                .error-msg {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    color: #d93025;
                    font-size: 0.85rem;
                    margin-top: 10px;
                }
                .footer-links {
                    display: flex;
                    justify-content: space-between;
                    padding: 0 5px;
                    opacity: 0.6;
                    font-size: 0.8rem;
                }
                .footer-links a { color: #fff; }

                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </main>
    );
}