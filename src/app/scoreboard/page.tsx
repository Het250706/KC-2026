'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import { Activity, Trophy, Swords, Target, Timer, TrendingUp, User, Star, Lock, Mail, AlertCircle, Loader2, Menu, X, ArrowLeft, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fixPhotoUrl } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ScoreboardPage() {
    const [verified, setVerified] = useState(false);

    useEffect(() => {
        if (sessionStorage.getItem('kc_scoreboard_auth') === 'true') {
            setVerified(true);
        }
    }, []);

    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#000' }} />}>
            <ScoreboardContentWrapper onSuccess={() => setVerified(true)} verified={verified} />
        </Suspense>
    );
}

function ScoreboardContentWrapper({ onSuccess, verified }: { onSuccess: () => void, verified: boolean }) {
    if (!verified) {
        return <LoginScreen onSuccess={onSuccess} />;
    }

    return <ScoreboardContent />;
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        const loginEmail = email.trim().toLowerCase();
        const loginPassword = password.trim();
        if (loginEmail === 'bapspetlad@keshav.com' && loginPassword === 'keshavcup2026') {
            sessionStorage.setItem('kc_scoreboard_auth', 'true');
            onSuccess();
        } else {
            setError('Invalid credentials. Please try again.');
        }
        setLoading(false);
    };

    const loginInputStyle = {
        width: '100%',
        padding: '18px 20px 18px 60px',
        borderRadius: '16px',
        border: '1px solid rgba(255, 215, 0, 0.2)',
        background: 'rgba(255,255,255,0.05)',
        color: '#fff',
        fontSize: '1.1rem',
        fontWeight: 600,
        outline: 'none',
        transition: 'border-color 0.3s'
    };

    return (
        <main style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass pulse-border" style={{ width: 'min(480px, 92%)', padding: '50px', margin: '20px', border: '1px solid rgba(255, 215, 0, 0.2)', borderRadius: '32px' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{
                        width: '65px',
                        height: '65px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 25px'
                    }}>
                        <img
                            src="/logo.png"
                            alt="Keshav Cup Logo"
                            style={{ width: '100%', height: 'auto', filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.3))' }}
                        />
                    </div>
                    <h1 className="title-gradient" style={{ fontSize: '2.8rem', marginBottom: '12px', fontWeight: 950, letterSpacing: '-1.5px' }}>
                        SCOREBOARD
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 800, letterSpacing: '2px' }}>KESHAV CUP 2026</p>
                </div>

                {error && (
                    <div style={{ background: 'rgba(255, 75, 75, 0.1)', color: '#ff4b4b', padding: '15px', borderRadius: '12px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem', border: '1px solid rgba(255, 75, 75, 0.3)' }} className="fade-in">
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '1px' }}>EMAIL</label>
                        <div style={{ position: 'relative' }}>
                            <Mail style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="bapspetlad@keshav.com" style={loginInputStyle} required />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '1px' }}>SECURITY PASSWORD</label>
                        <div style={{ position: 'relative' }}>
                            <Lock style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={20} />
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={loginInputStyle} required />
                        </div>
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '20px', fontSize: '1.2rem', marginTop: '10px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                        {loading ? <Loader2 className="animate-spin" size={24} /> : 'SECURE ENTRY'}
                    </button>
                </form>
            </div>
            <style jsx>{`
                .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); }
                .title-gradient { background: linear-gradient(135deg, #ffd700, #ffaa00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
                .btn-primary { background: linear-gradient(135deg, #ffd700, #ffaa00); color: #000; border: none; cursor: pointer; width: 100%; box-shadow: 0 10px 30px rgba(255, 215, 0, 0.2); }
                .btn-primary:hover { transform: translateY(-3px); box-shadow: 0 15px 40px rgba(255, 215, 0, 0.3); }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .pulse-border { animation: pulse-border 4s infinite; }
                @keyframes pulse-border { 0%, 100% { border-color: rgba(255, 215, 0, 0.2); } 50% { border-color: rgba(255, 215, 0, 0.5); } }
                .fade-in { animation: fadeIn 0.5s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </main>
    );
}

function ScoreboardContent() {
    const { user, role } = useAuth();
    const searchParams = useSearchParams();
    const [match, setMatch] = useState<any>(null);
    const [nextMatch, setNextMatch] = useState<any>(null);
    const [innings, setInnings] = useState<any[]>([]);
    const [stats, setStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [allMatches, setAllMatches] = useState<any[]>([]);
    const [matchFilter, setMatchFilter] = useState<'all' | 'live' | 'completed'>('all');
    const [activeView, setActiveView] = useState<'home' | 'live' | 'matches' | 'teams' | 'stats'>('home');
    const [tournamentStats, setTournamentStats] = useState<any[]>([]);
    const [teamsData, setTeamsData] = useState<any[]>([]);
    const [selectedTeamForSquad, setSelectedTeamForSquad] = useState<any>(null);

    // Sync view with URL
    useEffect(() => {
        const view = searchParams.get('view');
        if (view === 'live' || view === 'matches' || view === 'teams' || view === 'stats') {
            setActiveView(view as any);
        } else {
            setActiveView('home');
        }
    }, [searchParams]);

    const teams = ['AISHWARYAM', 'SHAURYAM', 'DIVYAM', 'GYANAM', 'ASTIKAYAM', 'DASHATVAM', 'SATYAM', 'DHAIRYAM'];

    useEffect(() => {
        fetchScore();
        const channel = supabase.channel('scoreboard_sync_v2')
            .on('postgres_changes', { event: '*', table: 'innings', schema: 'public' }, () => fetchScore())
            .on('postgres_changes', { event: '*', table: 'matches', schema: 'public' }, () => fetchScore())
            .on('postgres_changes', { event: '*', table: 'player_match_stats', schema: 'public' }, () => fetchScore())
            .on('postgres_changes', { event: '*', table: 'players', schema: 'public' }, () => fetchScore())
            .on('postgres_changes', { event: '*', table: 'teams', schema: 'public' }, () => fetchScore())
            .on('postgres_changes', { event: '*', table: 'match_events', schema: 'public' }, () => fetchScore())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchScore = async () => {
        const { data: liveMatch } = await supabase.from('matches')
            .select('*, team1:teams!team1_id(*), team2:teams!team2_id(*)')
            .eq('status', 'live')
            .order('created_at', { ascending: false })
            .maybeSingle();

        let activeMatch = liveMatch;
        if (!activeMatch) {
            const { data: lastMatch } = await supabase.from('matches')
                .select('*, team1:teams!team1_id(*), team2:teams!team2_id(*)')
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            activeMatch = lastMatch;
        }

        if (activeMatch) {
            setMatch(activeMatch);
            const [{ data: innData }, { data: statsData }, { data: upMatch }] = await Promise.all([
                supabase.from('innings').select('*').eq('match_id', activeMatch.id).order('innings_number', { ascending: true }),
                supabase.from('player_match_stats').select('*, players(*)').eq('match_id', activeMatch.id),
                supabase.from('matches').select('*, team1:teams!team1_id(*), team2:teams!team2_id(*)').eq('status', 'upcoming').order('created_at', { ascending: true }).limit(1).maybeSingle()
            ]);
            if (innData) setInnings(innData);
            if (statsData) setStats(statsData);
            if (upMatch) setNextMatch(upMatch);
        }

        const { data: matchesList } = await supabase.from('matches')
            .select('*, team1:teams!team1_id(*), team2:teams!team2_id(*)')
            .order('created_at', { ascending: false });
        if (matchesList) setAllMatches(matchesList);

        const { data: tData } = await supabase.from('teams').select('*, players(*)').order('name');
        if (tData) setTeamsData(tData);

        const { data: tourneyStats } = await supabase.from('tournament_player_stats').select('*').order('total_runs', { ascending: false });
        if (tourneyStats) setTournamentStats(tourneyStats);

        setLoading(false);
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity className="rotate" size={40} color="var(--primary)" />
        </div>
    );

    const currentInn = innings.find(inn => !inn.is_completed) || innings[innings.length - 1];

    return (
        <main className="animated-bg" style={{ minHeight: '100vh', color: '#fff', padding: '0 20px 20px', position: 'relative' }}>
            <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px 20px' }}>

                {activeView !== 'home' && (
                    <Link href="/scoreboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '15px', background: 'rgba(255,255,255,0.03)', color: '#fff', border: '1px solid rgba(255,215,0,0.2)', padding: '16px 28px', borderRadius: '20px', cursor: 'pointer', marginBottom: '40px', fontWeight: 900, fontSize: '0.9rem', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', backdropFilter: 'blur(10px)', textDecoration: 'none' }} className="back-btn fade-in">
                        <ArrowLeft size={20} color="var(--primary)" /> BACK TO HOME
                    </Link>
                )}

                {activeView === 'home' && (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }} className="fade-in">
                        <div style={{ marginBottom: '15px', color: 'rgba(255, 215, 0, 0.5)', fontWeight: 900, fontSize: 'clamp(1.1rem, 5vw, 1.6rem)', letterSpacing: '6px', textTransform: 'uppercase', textShadow: '0 0 15px rgba(255, 215, 0, 0.1)' }}>Welcome to</div>
                        <h1 className="title-gradient" style={{ fontSize: 'clamp(3rem, 15vw, 6rem)', fontWeight: 950, marginBottom: '50px', letterSpacing: '-2px', lineHeight: 1.1, textShadow: '0 10px 40px rgba(255, 215, 0, 0.25)' }}>Keshav Cup - 2026</h1>
                        
                        <div className="main-logo-container" style={{ position: 'relative', margin: '0 auto 60px', width: 'min(400px, 80vw)', height: 'min(400px, 80vw)' }}>
                            <div style={{ position: 'absolute', inset: -20, background: 'radial-gradient(circle, rgba(255,215,0,0.12) 0%, transparent 75%)', filter: 'blur(50px)' }} />
                            <motion.img 
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                src="/logo.png" 
                                alt="Keshav Cup" 
                                style={{ 
                                    width: '100%', 
                                    height: 'auto', 
                                    position: 'relative', 
                                    zIndex: 1, 
                                    filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.2)) drop-shadow(0 20px 40px rgba(0,0,0,0.8))',
                                }} 
                            />
                        </div>

                        <p style={{ color: 'var(--text-muted)', letterSpacing: '4px', fontWeight: 700, fontSize: 'clamp(0.7rem, 3vw, 1rem)', margin: '20px 0 60px', textTransform: 'uppercase', padding: '0 20px' }}>Join us for an extraordinary celebration of Keshav Cup Cricket Tournament</p>

                        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.3), transparent)', width: '300px', margin: '0 auto 20px' }} />
                    </div>
                )}

                {activeView === 'stats' && (
                    <section className="fade-in">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '60px' }}>
                            <div style={{ padding: '15px', background: 'rgba(255,215,0,0.1)', borderRadius: '18px' }}>
                                <TrendingUp size={36} color="var(--primary)" />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '1.5px', margin: 0 }}>TOURNAMENT STATISTICS</h2>
                                <p style={{ color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '2px', fontSize: '0.9rem' }}>TOP 5 PERFORMERS LEADERBOARD</p>
                            </div>
                        </div>

                        <div id="stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '40px' }}>
                            {/* TOP 5 BATTING */}
                            <div className="glass premium" style={{ padding: '40px', borderRadius: '40px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '35px' }}>
                                    <div style={{ padding: '12px', background: 'rgba(255,215,0,0.1)', borderRadius: '15px' }}>
                                        <Trophy size={24} color="var(--primary)" />
                                    </div>
                                    <h3 style={{ fontWeight: 950, fontSize: '1.5rem', letterSpacing: '1px' }}>MOST RUNS (TOP 5)</h3>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                    {[...tournamentStats].sort((a,b) => (b.total_runs || 0) - (a.total_runs || 0)).slice(0, 5).map((s, idx) => (
                                        <div key={s.player_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 25px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)', transition: 'all 0.2s' }} className="hover-scale">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                                                <span style={{ fontWeight: 950, color: 'var(--primary)', fontSize: '0.9rem', width: '20px' }}>{idx + 1}</span>
                                                <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#111', overflow: 'hidden', border: '2px solid rgba(255,215,0,0.2)' }}>
                                                    <img src={fixPhotoUrl(s.photo_url, s.first_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.first_name}`; }} />
                                                </div>
                                                <div style={{ fontWeight: 900, fontSize: '1.15rem' }}>{s.first_name} {s.last_name}</div>
                                            </div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 950, color: 'var(--primary)' }}>{s.total_runs || 0} <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>RUNS</span></div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* TOP 5 BOWLING */}
                            <div className="glass premium" style={{ padding: '40px', borderRadius: '40px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '35px' }}>
                                    <div style={{ padding: '12px', background: 'rgba(0,255,128,0.1)', borderRadius: '15px' }}>
                                        <Target size={24} color="#00ff80" />
                                    </div>
                                    <h3 style={{ fontWeight: 950, fontSize: '1.5rem', letterSpacing: '1px' }}>MOST WICKETS (TOP 5)</h3>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                    {[...tournamentStats].sort((a,b) => (b.total_wickets || 0) - (a.total_wickets || 0)).slice(0, 5).map((s, idx) => (
                                        <div key={s.player_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 25px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)', transition: 'all 0.2s' }} className="hover-scale">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                                                <span style={{ fontWeight: 950, color: '#00ff80', fontSize: '0.9rem', width: '20px' }}>{idx + 1}</span>
                                                <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#111', overflow: 'hidden', border: '2px solid rgba(0,255,128,0.2)' }}>
                                                    <img src={fixPhotoUrl(s.photo_url, s.first_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.first_name}`; }} />
                                                </div>
                                                <div style={{ fontWeight: 900, fontSize: '1.15rem' }}>{s.first_name} {s.last_name}</div>
                                            </div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 950, color: '#00ff80' }}>{s.total_wickets || 0} <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>WKTS</span></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {activeView === 'teams' && (
                    <section style={{ marginBottom: '60px' }} className="fade-in">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
                            <div style={{ padding: '15px', background: 'rgba(255,215,0,0.1)', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src="/logo.png" alt="Logo" style={{ width: '50px', height: '50px', objectFit: 'contain' }} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '1.5px', margin: 0 }}>TOURNAMENT TEAMS</h2>
                                <p style={{ color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '2px', fontSize: '0.9rem' }}>KESHAV CUP 2026 LINEUP</p>
                            </div>
                        </div>
                        <div className="teams-grid">
                            {(teamsData.length > 0 ? teamsData : teams.map(t => ({ name: t }))).map((team: any) => (
                                <div key={team.id || team.name} onClick={() => team.id && setSelectedTeamForSquad(team)} className="team-card premium" style={{ padding: '40px 30px', background: 'rgba(255,255,255,0.03)', borderRadius: '32px', border: '1px solid rgba(255, 215, 0, 0.1)', textAlign: 'center', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', cursor: team.id ? 'pointer' : 'default' }}>
                                    <div style={{ position: 'relative', marginBottom: '25px' }}>
                                        <div style={{ position: 'absolute', inset: -15, background: 'rgba(255,215,0,0.05)', borderRadius: '50%', filter: 'blur(10px)' }} />
                                        <img src="/logo.png" alt={team.name} style={{ width: '90px', height: '90px', margin: '0 auto', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.2))' }} />
                                    </div>
                                    <div style={{ fontWeight: 950, fontSize: '1.4rem', letterSpacing: '1px', color: 'var(--primary)', textTransform: 'uppercase' }}>{team.name}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Squad Modal */}
                <AnimatePresence>
                    {selectedTeamForSquad && (
                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setSelectedTeamForSquad(null)}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                onClick={e => e.stopPropagation()}
                                style={{ background: '#0a0a0a', width: 'min(900px, 100%)', maxHeight: '95vh', borderRadius: '40px', border: '1px solid rgba(255, 215, 0, 0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 80px rgba(0,0,0,0.8)' }}
                            >
                                <div style={{ padding: '40px', background: 'linear-gradient(to bottom, rgba(255,215,0,0.05), transparent)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255, 215, 0, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
                                            <img src="/logo.png" alt="Logo" style={{ width: '60px', height: 'auto', filter: 'drop-shadow(0 0 5px rgba(255,215,0,0.2))' }} />
                                        </div>
                                        <div>
                                            <h2 style={{ fontSize: '2.5rem', fontWeight: 950, margin: 0 }}>{selectedTeamForSquad.name}</h2>
                                            <div style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <Users size={14} /> {selectedTeamForSquad.players?.length || 0} PLAYERS
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedTeamForSquad(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: '45px', height: '45px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                                        <X color="#fff" size={24} />
                                    </button>
                                </div>

                                <div style={{ padding: '30px', overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        {selectedTeamForSquad.players?.length > 0 ? (
                                            [...selectedTeamForSquad.players]
                                                .sort((a, b) => {
                                                    const isACaptain = a.email === selectedTeamForSquad.captain_email;
                                                    const isBCaptain = b.email === selectedTeamForSquad.captain_email;
                                                    if (isACaptain) return -1;
                                                    if (isBCaptain) return 1;
                                                    return 0;
                                                })
                                                .map((p) => (
                                                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '40px 50px', background: 'rgba(255,255,255,0.03)', borderRadius: '35px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                                                        {p.email === selectedTeamForSquad.captain_email && (
                                                            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '6px', background: 'var(--primary)' }} />
                                                        )}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                                                            <div style={{ width: '100px', height: '100px', borderRadius: '25px', overflow: 'hidden', background: '#111', border: p.email === selectedTeamForSquad.captain_email ? '3px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)' }}>
                                                                <img
                                                                    src={fixPhotoUrl(p.photo_url, p.first_name)}
                                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                    alt=""
                                                                    onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`; }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                    <div style={{ fontWeight: 950, fontSize: '1.8rem', color: '#fff' }}>{p.first_name} {p.last_name}</div>
                                                                    <div style={{ display: 'flex', gap: '15px' }}>
                                                                        {p.email === selectedTeamForSquad.captain_email && (
                                                                            <span style={{ fontSize: '0.75rem', fontWeight: 950, background: 'var(--primary)', color: '#000', padding: '3px 12px', borderRadius: '50px', letterSpacing: '1px' }}>CAPTAIN</span>
                                                                        )}
                                                                        <span style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.6)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>{p.cricket_skill || p.role}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.2)', fontWeight: 800 }}>SQUAD LISTING PENDING AUCTION COMPLETION</div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {activeView === 'live' && (
                    !match ? (
                        <div style={{ padding: '120px 20px', textAlign: 'center', color: '#fff' }} className="fade-in">
                            <div style={{ width: '120px', height: '120px', background: 'rgba(255,215,0,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 40px' }}>
                                <Swords size={60} color="var(--primary)" />
                            </div>
                            <h1 style={{ fontSize: '3rem', fontWeight: 950, letterSpacing: '1px' }}>NO ACTIVE MATCHES</h1>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', fontWeight: 700 }}>The arena is quiet. Stay tuned for live updates!</p>
                        </div>
                    ) : (
                        <div className="fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', background: 'rgba(255,255,255,0.03)', padding: '20px 40px', borderRadius: '60px', border: '1px solid rgba(255,215,0,0.1)', backdropFilter: 'blur(20px)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                                    <div style={{ width: '120px', height: '120px', background: 'rgba(255,215,0,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 40px' }}>
                                            <img src="/logo.png" alt="Logo" style={{ width: '80px', height: 'auto', filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.3))' }} />
                                    </div>
                                    <span style={{ fontWeight: 950, fontSize: '1rem', letterSpacing: '2px' }}>{(match.status || 'Live').toUpperCase()} SESSION</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'rgba(255,255,255,0.5)' }}>
                                    <Timer size={18} className="rotate-slow" />
                                    <span style={{ fontSize: '0.9rem', fontWeight: 900, letterSpacing: '1px' }}>REAL-TIME SYNC ACTIVE</span>
                                </div>
                            </div>

                            <div id="live" className="glass premium" style={{ padding: '80px 40px', borderRadius: '50px', marginBottom: '40px', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-100px', right: '-100px', opacity: 0.05 }}>
                                    <Trophy size={400} color="var(--primary)" />
                                </div>
                                <div style={{ textAlign: 'center', marginBottom: '60px', position: 'relative', zIndex: 1 }}>
                                    <div style={{ color: 'var(--primary)', fontWeight: 950, letterSpacing: '4px', fontSize: '1rem', textTransform: 'uppercase' }}>{(match.match_type || 'Tournament').toUpperCase()} • {(match.venue || 'KESAV ARENA').toUpperCase()}</div>
                                    <h1 style={{ fontSize: 'clamp(2rem, 6vw, 4rem)', fontWeight: 950, marginTop: '15px', letterSpacing: '-2px' }}>{match.match_name}</h1>
                                </div>

                                <div className="innings-grid" style={{ position: 'relative', zIndex: 1 }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ width: '80px', height: '80px', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,215,0,0.05)', borderRadius: '50%' }}>
                                            <img src="/logo.png" alt="Logo" style={{ width: '60px', height: 'auto', filter: 'drop-shadow(0 0 5px rgba(255,215,0,0.3))' }} />
                                        </div>
                                        <div style={{ fontSize: 'clamp(1.5rem, 6vw, 2.5rem)', fontWeight: 950, color: 'var(--primary)', marginBottom: '15px' }}>{match.team1?.name}</div>
                                        <ScoreDisplay inn={innings.find(i => i.batting_team_id === match.team1_id)} />
                                    </div>
                                    <div className="vs-divider" style={{ fontSize: '1.2rem', fontWeight: 950, color: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '50%', margin: '20px auto' }}>VS</div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ width: '80px', height: '80px', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,215,0,0.05)', borderRadius: '50%' }}>
                                            <img src="/logo.png" alt="Logo" style={{ width: '60px', height: 'auto', filter: 'drop-shadow(0 0 5px rgba(255,215,0,0.3))' }} />
                                        </div>
                                        <div style={{ fontSize: 'clamp(1.5rem, 6vw, 2.5rem)', fontWeight: 950, color: 'var(--primary)', marginBottom: '15px' }}>{match.team2?.name}</div>
                                        <ScoreDisplay inn={innings.find(i => i.batting_team_id === match.team2_id)} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                )}

                {activeView === 'matches' && (
                    <section className="fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{ padding: '15px', background: 'rgba(255,215,0,0.1)', borderRadius: '18px' }}>
                                    <Swords size={36} color="var(--primary)" />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '1px', margin: 0 }}>MATCH HISTORY</h2>
                                    <p style={{ color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '2px', fontSize: '0.9rem' }}>TOURNAMENT RESULTS</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '5px', borderRadius: '18px' }}>
                                {['all', 'live', 'completed'].map((f: any) => (
                                    <button key={f} onClick={() => setMatchFilter(f)} style={{ padding: '10px 25px', borderRadius: '15px', border: 'none', background: matchFilter === f ? 'var(--primary)' : 'transparent', color: matchFilter === f ? '#000' : '#fff', fontWeight: 900, cursor: 'pointer', transition: 'all 0.3s' }}>{f.toUpperCase()}</button>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '30px' }}>
                            {allMatches.filter(m => matchFilter === 'all' || m.status === matchFilter).map(m => (
                                <div key={m.id} className="glass premium hover-scale" style={{ padding: '40px', borderRadius: '40px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 950, color: m.status === 'live' ? '#00ff80' : 'var(--text-muted)', letterSpacing: '2px' }}>{m.status.toUpperCase()}</span>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.2)' }}>#{m.id.slice(0, 4)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,215,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
                                                <img src="/logo.png" alt="" style={{ width: '40px' }} />
                                            </div>
                                            <div style={{ fontWeight: 950, fontSize: '1rem' }}>{m.team1?.name}</div>
                                        </div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 950, opacity: 0.1 }}>VS</div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,215,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
                                                <img src="/logo.png" alt="" style={{ width: '40px' }} />
                                            </div>
                                            <div style={{ fontWeight: 950, fontSize: '1rem' }}>{m.team2?.name}</div>
                                        </div>
                                    </div>
                                    {m.status === 'completed' && m.result_message && (
                                        <div style={{ marginTop: '30px', padding: '15px', background: 'rgba(0,255,128,0.05)', borderRadius: '20px', border: '1px solid rgba(0,255,128,0.1)', textAlign: 'center', fontSize: '0.85rem', fontWeight: 800, color: '#00ff80' }}>
                                            {m.result_message}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            <style jsx global>{`
                :root { --primary: #ffd700; --primary-glow: rgba(255, 215, 0, 0.4); --text-muted: rgba(255, 255, 255, 0.5); --border: rgba(255, 255, 255, 0.1); }
                .animated-bg { background: radial-gradient(circle at top right, #111, #000); background-attachment: fixed; }
                .glass { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(20px); border: 1px solid var(--border); }
                .premium { border: 1px solid rgba(255, 215, 0, 0.1); box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4); }
                .title-gradient { background: linear-gradient(to right, #ffd700, #ffaa00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                .feature-card { background: rgba(255,255,255,0.03); padding: 50px 40px; border-radius: 40px; border: 1px solid rgba(255,215,0,0.1); text-align: center; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; position: relative; overflow: hidden; }
                .feature-card:hover { transform: translateY(-12px); background: rgba(255,215,0,0.04); border-color: var(--primary); box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
                .card-icon-circle { width: 90px; height: 90px; background: rgba(255,215,0,0.05); border-radius: 30px; display: flex; alignItems: center; justifyContent: center; margin: 0 auto 30px; transition: all 0.4s; }
                .feature-card:hover .card-icon-circle { transform: scale(1.1) rotate(5deg); background: var(--primary); color: #000; }
                .feature-card:hover .card-icon-circle * { color: #000 !important; }
                .hover-scale:hover { transform: scale(1.02); }
                .innings-grid { display: grid; gridTemplateColumns: 1fr auto 1fr; gap: 40px; alignItems: center; }
                @media (max-width: 768px) { .innings-grid { gridTemplateColumns: 1fr; } .vs-divider { display: none; } }
                .rotate { animation: spin 2s linear infinite; }
                .rotate-slow { animation: spin 6s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .pulse-green { animation: pulseG 2s infinite; }
                @keyframes pulseG { 0% { box-shadow: 0 0 0 0 rgba(0, 255, 128, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(0, 255, 128, 0); } 100% { box-shadow: 0 0 0 0 rgba(0, 255, 128, 0); } }
                .fade-in { animation: fadeIn 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .teams-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 25px; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,215,0,0.2); border-radius: 10px; }
            `}</style>
        </main>
    );
}

function ScoreDisplay({ inn }: { inn: any }) {
    if (!inn) return <div style={{ fontSize: '2rem', fontWeight: 950, color: 'rgba(255,255,255,0.05)' }}>YET TO BAT</div>;
    return (
        <div>
            <div style={{ fontSize: '4.5rem', fontWeight: 950, letterSpacing: '-3px', lineHeight: 1 }}>
                {inn.runs}<span style={{ color: 'var(--primary)', opacity: 0.8 }}>/</span>{inn.wickets}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', marginTop: '10px', letterSpacing: '1px' }}>
                {(inn.overs || 0).toFixed(1)} <span style={{ fontSize: '0.8rem' }}>OVERS</span>
            </div>
        </div>
    );
}