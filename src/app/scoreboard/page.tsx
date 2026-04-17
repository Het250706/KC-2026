'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import { Activity, Trophy, Swords, Target, Timer, TrendingUp, User, Star, Lock, Mail, AlertCircle, Loader2, Menu, X, ArrowLeft, Users, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fixPhotoUrl } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MatchScorecard from '@/components/MatchScorecard';

export default function ScoreboardPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#000' }} />}>
            <ScoreboardContent />
        </Suspense>
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
    const [activeView, setActiveView] = useState<'home' | 'live' | 'matches' | 'teams' | 'stats' | 'points'>('home');
    const [tournamentStats, setTournamentStats] = useState<any[]>([]);
    const [teamsData, setTeamsData] = useState<any[]>([]);
    const [pointsTable, setPointsTable] = useState<any[]>([]);
    const [selectedTeamForSquad, setSelectedTeamForSquad] = useState<any>(null);
    const [activeScorecardTeamId, setActiveScorecardTeamId] = useState<string | null>(null);
    const [historyMatch, setHistoryMatch] = useState<any>(null);
    const [historyInnings, setHistoryInnings] = useState<any[]>([]);

    // Sync view with URL
    useEffect(() => {
        const view = searchParams.get('view');
        if (view === 'live' || view === 'matches' || view === 'teams' || view === 'stats' || view === 'points') {
            setActiveView(view as any);
        } else {
            setActiveView('home');
        }
    }, [searchParams]);

    const convertOversToBalls = (overs: number) => {
        const full = Math.floor(overs);
        const rem = Math.round((overs - full) * 10);
        return (full * 6) + rem;
    };

    const calculatePointsTable = (teamsList: any[], matchesList: any[], scoresList: any[]) => {
        const stats = teamsList.map(t => ({
            id: t.id,
            name: t.name,
            played: 0,
            won: 0,
            lost: 0,
            pts: 0,
            runsScored: 0,
            oversFaced: 0,
            runsConceded: 0,
            oversBowled: 0,
            nrr: 0
        }));

        matchesList.filter(m => m.status === 'completed').forEach(m => {
            const team1 = stats.find(s => s.id === m.team1_id);
            const team2 = stats.find(s => s.id === m.team2_id);
            if (!team1 || !team2) return;

            team1.played++;
            team2.played++;

            if (m.winner_team_id === m.team1_id) {
                team1.won++;
                team1.pts += 2;
                team2.lost++;
            } else if (m.winner_team_id === m.team2_id) {
                team2.won++;
                team2.pts += 2;
                team1.lost++;
            } else if (m.winner_team_id === null) {
                team1.pts += 1;
                team2.pts += 1;
            }

            const s1 = scoresList.find(s => s.match_id === m.id && s.team_id === m.team1_id);
            const s2 = scoresList.find(s => s.match_id === m.id && s.team_id === m.team2_id);

            if (s1 && s2) {
                team1.runsScored += s1.runs || 0;
                const ballsFaced1 = convertOversToBalls(s1.overs || 0);
                team1.oversFaced += ballsFaced1 / 6;

                team2.runsConceded += s1.runs || 0;
                team2.oversBowled += ballsFaced1 / 6;

                team2.runsScored += s2.runs || 0;
                const ballsFaced2 = convertOversToBalls(s2.overs || 0);
                team2.oversFaced += ballsFaced2 / 6;

                team1.runsConceded += s2.runs || 0;
                team1.oversBowled += ballsFaced2 / 6;
            }
        });

        return stats.map(s => {
            const rpoScored = s.oversFaced > 0 ? s.runsScored / s.oversFaced : 0;
            const rpoConceded = s.oversBowled > 0 ? s.runsConceded / s.oversBowled : 0;
            return {
                ...s,
                nrr: rpoScored - rpoConceded
            };
        }).sort((a, b) => b.pts - a.pts || b.nrr - a.nrr);
    };

    const teams = ['AISHWARYAM', 'SHAURYAM', 'DIVYAM', 'GYANAM', 'ASTIKAYAM', 'DASHATVAM', 'SATYAM', 'DHAIRYAM'];
    const captains = [
        'Shivkumar Mukesh bhai patel',
        'Vatsal Mukeshbhai Patel',
        'Taksh KaPatel',
        'Vandan AtulBhai patel',
        'Aksharbhai Patel',
        'PATEL DARPAN RAJNIKUMAR',
        'Miten Kalpeshbhai Chauhan',
        'Yogi Shah',
        'Shivkumar Patel'
    ];

    const isCaptain = (firstName: string, lastName: string) => {
        if (!firstName) return false;
        const full = `${firstName} ${lastName || ''}`.toLowerCase().trim().replace(/\s+/g, ' ');
        return captains.some(c => {
            const cap = c.toLowerCase().trim().replace(/\s+/g, ' ');
            return full === cap || full.includes(cap);
        });
    };

    const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'reconnecting'>('connected');
    const lastFetchTime = useRef(0);
    const fetchTimeout = useRef<any>(null);

    const fetchScore = async () => {
        const now = Date.now();
        if (now - lastFetchTime.current < 1500) {
            if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
            fetchTimeout.current = setTimeout(fetchScore, 1500);
            return;
        }
        lastFetchTime.current = now;

        try {
            const { data: liveMatch } = await supabase.from('matches')
                .select('*, team1:teams!team1_id(*), team2:teams!team2_id(*)')
                .eq('status', 'live')
                .order('created_at', { ascending: false })
                .maybeSingle();

            setMatch(liveMatch);
            let activeMatch = liveMatch;

            if (activeMatch) {
                const results = await Promise.all([
                    supabase.from('innings').select('*, striker:players!striker_id(*), bowler:players!bowler_id(*)').eq('match_id', activeMatch.id).order('innings_number', { ascending: true }),
                    supabase.from('player_match_stats').select('*, players(*)').eq('match_id', activeMatch.id),
                    supabase.from('matches').select('*, team1:teams!team1_id(*), team2:teams!team2_id(*)').eq('status', 'upcoming').order('created_at', { ascending: true }).limit(1).maybeSingle()
                ]);

                if (results[0].data) setInnings(results[0].data);
                if (results[1].data) setStats(results[1].data);
                if (results[2].data) setNextMatch(results[2].data);
            }

            const { data: matchesList } = await supabase.from('matches')
                .select('*, team1:teams!team1_id(*), team2:teams!team2_id(*)')
                .order('created_at', { ascending: false });
            
            if (matchesList) {
                setAllMatches(matchesList);
                if (historyMatch) {
                    const stillExists = matchesList.some(m => m.id === historyMatch.id);
                    if (!stillExists) setHistoryMatch(null);
                }
            }

            if (!activeMatch) {
                setInnings([]);
                setStats([]);
            }

            // Fetch data with individual error handling to prevent one failure from breaking everything
            const tRes = await supabase.from('teams').select('*').order('name');
            const pRes = await supabase.from('players').select('*');
            
            let sRes: any = { data: null };
            try {
                const { data, error } = await supabase.from('tournament_player_stats').select('*').order('total_runs', { ascending: false });
                if (!error) sRes.data = data;
            } catch (e) {
                console.error('Tournament stats fetch error:', e);
            }

            if (tRes.error) console.error('Teams fetch error:', tRes.error);
            if (pRes.error) console.error('Players fetch error:', pRes.error);

            if (tRes.data) {
                const pData = pRes.data || [];
                const teamsWithPlayers = tRes.data.map(team => ({
                    ...team,
                    players: pData.filter(p => p.team_id === team.id)
                }));
                setTeamsData(teamsWithPlayers);

                // Fetch team scores for points table
                const { data: allTeamScores } = await supabase.from('team_scores').select('*');
                if (matchesList && allTeamScores) {
                    const table = calculatePointsTable(tRes.data, matchesList, allTeamScores);
                    setPointsTable(table);
                }
            }

            if (sRes.data) setTournamentStats(sRes.data);
            setRealtimeStatus('connected');
        } catch (err) {
            console.error('Fetch error:', err);
            setRealtimeStatus('reconnecting');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchScore();
        const channel = supabase.channel('scoreboard_sync_v3')
            .on('postgres_changes', { event: '*', table: 'innings', schema: 'public' }, () => fetchScore())
            .on('postgres_changes', { event: '*', table: 'matches', schema: 'public' }, () => fetchScore())
            .on('postgres_changes', { event: '*', table: 'player_match_stats', schema: 'public' }, () => fetchScore())
            .on('postgres_changes', { event: '*', table: 'players', schema: 'public' }, () => fetchScore())
            .on('postgres_changes', { event: '*', table: 'teams', schema: 'public' }, () => fetchScore())
            .on('postgres_changes', { event: '*', table: 'match_events', schema: 'public' }, () => fetchScore())
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
                else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setRealtimeStatus('reconnecting');
            });

        return () => { 
            if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
            supabase.removeChannel(channel); 
        };
    }, []);

    const viewMatchHistory = async (m: any) => {
        setLoading(true);
        setHistoryMatch(m);
        const { data: innData } = await supabase
            .from('innings')
            .select('*')
            .eq('match_id', m.id)
            .order('innings_number', { ascending: true });
        if (innData) setHistoryInnings(innData);
        setActiveView('matches'); // Stay in matches view but show detail
        setLoading(false);
    };

    const currentInn = innings.find(inn => !inn.is_completed) || innings[innings.length - 1];

    useEffect(() => {
        if (currentInn && !activeScorecardTeamId) {
            setActiveScorecardTeamId(currentInn.batting_team_id);
        }
    }, [currentInn, activeScorecardTeamId]);

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity className="rotate" size={40} color="var(--primary)" />
        </div>
    );

    return (
        <main className="animated-bg" style={{ minHeight: '100vh', color: '#fff', position: 'relative' }}>
            <div className="container-responsive" style={{ maxWidth: '1200px', margin: '0 auto', paddingTop: '10px' }}>
                {/* Branding Header with Dual Logos */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', marginBottom: '10px' }}>
                    <div style={{ width: '40px', height: '40px' }}>
                        <img src="/logo.png" alt="Logo" style={{ width: '100%', height: 'auto', filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.3))' }} />
                    </div>
                    <div className="title-gradient" style={{ fontSize: 'clamp(1rem, 4vw, 1.5rem)', fontWeight: 900, textAlign: 'center', letterSpacing: '2px' }}>
                        KESHAV CUP - 2026
                    </div>
                    <div style={{ width: '40px', height: '40px' }}>
                        <img src="/logo.png" alt="Logo" style={{ width: '100%', height: 'auto', filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.3))' }} />
                    </div>
                </div>

                <div className="sticky-nav-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px', position: 'sticky', top: '15px', zIndex: 1000 }}>
                    <div className="glass shadow-premium nav-bar" style={{ display: 'flex', gap: '5px', padding: '6px', borderRadius: '30px', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,215,0,0.15)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', width: 'max-content' }}>
                        {[
                            { id: 'home', icon: Activity, label: 'HOME' },
                            { id: 'live', icon: Zap, label: 'LIVE' },
                            { id: 'points', icon: Trophy, label: 'TABLE' },
                            { id: 'matches', icon: Swords, label: 'MATCHES' },
                            { id: 'teams', icon: Users, label: 'TEAMS' },
                            { id: 'stats', icon: TrendingUp, label: 'STATS' }
                        ].map(btn => (
                            <button
                                key={btn.id}
                                onClick={() => {
                                    setActiveView(btn.id as any);
                                    setHistoryMatch(null);
                                    setSelectedTeamForSquad(null);
                                }}
                                className={`nav-btn ${activeView === btn.id ? 'active' : ''}`}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '10px 15px',
                                    borderRadius: '20px',
                                    border: 'none',
                                    background: activeView === btn.id ? 'var(--primary)' : 'transparent',
                                    color: activeView === btn.id ? '#000' : '#fff',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    fontWeight: 950,
                                    letterSpacing: '0.5px',
                                    minWidth: '60px'
                                }}
                            >
                                <btn.icon size={18} />
                                <span className="nav-label" style={{ fontSize: '0.65rem' }}>{btn.label}</span>
                            </button>
                        ))}
                    </div>
                    
                    {/* Realtime Status Indicator */}
                    <div style={{ 
                        marginTop: '10px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '4px 12px', 
                        borderRadius: '12px', 
                        background: 'rgba(0,0,0,0.4)', 
                        border: '1px solid rgba(255,255,255,0.05)',
                        fontSize: '0.65rem',
                        fontWeight: 900,
                        letterSpacing: '1px',
                        color: realtimeStatus === 'connected' ? '#00ff80' : '#ff4b4b'
                    }}>
                        <div style={{ 
                            width: '6px', 
                            height: '6px', 
                            borderRadius: '50%', 
                            background: realtimeStatus === 'connected' ? '#00ff80' : '#ff4b4b',
                            boxShadow: realtimeStatus === 'connected' ? '0 0 8px #00ff80' : 'none'
                        }} />
                        {realtimeStatus === 'connected' ? 'LIVE SYNC ACTIVE' : 'RECONNECTING...'}
                    </div>
                </div>

                {activeView !== 'home' && (
                    <button 
                        onClick={() => {
                            if (historyMatch) setHistoryMatch(null);
                            else if (selectedTeamForSquad) setSelectedTeamForSquad(null);
                            else setActiveView('home');
                        }} 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', color: '#fff', border: '1px solid rgba(255,215,0,0.2)', padding: '12px 24px', borderRadius: '18px', cursor: 'pointer', marginBottom: '30px', fontWeight: 900, fontSize: '0.85rem', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', backdropFilter: 'blur(10px)', textDecoration: 'none' }} 
                        className="back-btn fade-in"
                    >
                        <ArrowLeft size={18} color="var(--primary)" /> {(historyMatch || selectedTeamForSquad) ? 'BACK TO LIST' : 'BACK TO HOME'}
                    </button>
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

                {activeView === 'points' && (
                    <section className="fade-in">
                        <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
                            <div style={{ padding: '15px', background: 'rgba(255,215,0,0.1)', borderRadius: '18px', flexShrink: 0 }}>
                                <Trophy size={36} color="var(--primary)" />
                            </div>
                            <div>
                                <h2 className="responsive-title" style={{ fontSize: 'clamp(1.5rem, 6vw, 2.5rem)', fontWeight: 950, letterSpacing: '1px', margin: 0, lineHeight: 1.2 }}>POINTS TABLE</h2>
                                <p style={{ color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '1.5px', fontSize: 'clamp(0.7rem, 2vw, 0.9rem)', marginTop: '4px' }}>TOURNAMENT STANDINGS</p>
                            </div>
                        </div>

                        <div className="glass premium" style={{ borderRadius: '30px', overflow: 'hidden', border: '1px solid rgba(255,215,0,0.1)' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--primary)', color: '#000' }}>
                                            <th style={{ padding: '15px 20px', textAlign: 'center', fontWeight: 900 }}>POS</th>
                                            <th style={{ padding: '15px 20px', textAlign: 'left', fontWeight: 900 }}>TEAM</th>
                                            <th style={{ padding: '15px 20px', textAlign: 'center', fontWeight: 900 }}>P</th>
                                            <th style={{ padding: '15px 20px', textAlign: 'center', fontWeight: 900 }}>W</th>
                                            <th style={{ padding: '15px 20px', textAlign: 'center', fontWeight: 900 }}>L</th>
                                            <th style={{ padding: '15px 20px', textAlign: 'center', fontWeight: 900 }}>PTS</th>
                                            <th style={{ padding: '15px 20px', textAlign: 'right', fontWeight: 900 }}>NRR</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pointsTable.map((t, idx) => (
                                            <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                                <td style={{ padding: '18px 20px', textAlign: 'center', fontWeight: 900 }}>{idx + 1}</td>
                                                <td style={{ padding: '18px 20px', textAlign: 'left' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ width: '30px', height: '30px', background: 'rgba(255,215,0,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            <img src="/logo.png" style={{ width: '18px' }} alt="" />
                                                        </div>
                                                        <span style={{ fontWeight: 900, letterSpacing: '0.5px' }}>{t.name.toUpperCase()}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '18px 20px', textAlign: 'center', fontWeight: 800 }}>{t.played}</td>
                                                <td style={{ padding: '18px 20px', textAlign: 'center', fontWeight: 800 }}>{t.won}</td>
                                                <td style={{ padding: '18px 20px', textAlign: 'center', fontWeight: 800 }}>{t.lost}</td>
                                                <td style={{ padding: '18px 20px', textAlign: 'center', fontWeight: 950, color: 'var(--primary)' }}>{t.pts}</td>
                                                <td style={{ padding: '18px 20px', textAlign: 'right', fontWeight: 900, color: t.nrr >= 0 ? '#00ff80' : '#ff4b4b' }}>
                                                    {t.nrr >= 0 ? '+' : ''}{t.nrr.toFixed(3)}
                                                </td>
                                            </tr>
                                        ))}
                                        {pointsTable.length === 0 && (
                                            <tr>
                                                <td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontWeight: 800 }}>
                                                    NO DATA AVAILABLE YET
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                )}

                {activeView === 'stats' && (
                    <section className="fade-in">
                        <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
                            <div style={{ padding: '15px', background: 'rgba(255,215,0,0.1)', borderRadius: '18px', flexShrink: 0 }}>
                                <TrendingUp size={36} color="var(--primary)" />
                            </div>
                            <div>
                                <h2 className="responsive-title" style={{ fontSize: 'clamp(1.5rem, 6vw, 2.5rem)', fontWeight: 950, letterSpacing: '1px', margin: 0, lineHeight: 1.2 }}>TOURNAMENT STATISTICS</h2>
                                <p style={{ color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '1.5px', fontSize: 'clamp(0.7rem, 2vw, 0.9rem)', marginTop: '4px' }}>TOP 5 PERFORMERS LEADERBOARD</p>
                            </div>
                        </div>

                        <div id="stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '40px' }}>
                            {/* TOP 5 BATTING */}
                            <div className="glass premium" style={{ padding: '40px', borderRadius: '40px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '35px' }}>
                                    <div style={{ padding: '12px', background: 'rgba(255,215,0,0.1)', borderRadius: '15px' }}>
                                        <Trophy size={24} color="var(--primary)" />
                                    </div>
                                    <h3 style={{ fontWeight: 950, fontSize: '1.5rem', letterSpacing: '1px' }}>BEST BATSMAN (ORANGE CAP)</h3>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                    {tournamentStats.filter(s => (s.total_runs || 0) > 0).length > 0 ? (
                                        [...tournamentStats]
                                            .filter(s => (s.total_runs || 0) > 0)
                                            .sort((a,b) => (b.total_runs || 0) - (a.total_runs || 0))
                                            .slice(0, 5)
                                            .map((s, idx) => (
                                            <div key={s.player_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 25px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)', transition: 'all 0.2s' }} className="hover-scale">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                                                    <span style={{ fontWeight: 950, color: 'var(--primary)', fontSize: '0.9rem', width: '20px' }}>{idx + 1}</span>
                                                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#111', overflow: 'hidden', border: '2px solid rgba(255,215,0,0.2)' }}>
                                                        <img src={fixPhotoUrl(s.photo_url, s.first_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.first_name}`; }} />
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <div style={{ fontWeight: 900, fontSize: '1.15rem' }}>
                                                            {s.first_name} {s.last_name}
                                                        </div>
                                                        <div style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--primary)', opacity: 0.8 }}>
                                                            {s.team_name?.toUpperCase() || 'NO TEAM'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '1.4rem', fontWeight: 950, color: 'var(--primary)' }}>{s.total_runs || 0} <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>RUNS</span></div>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.1)', fontWeight: 800 }}>
                                            <div style={{ fontSize: '0.8rem', letterSpacing: '2px', marginBottom: '10px' }}>LEADERBOARD PENDING</div>
                                            WAITING FOR FIRST BOUNDARY...
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* TOP 5 BOWLING */}
                            <div className="glass premium" style={{ padding: '40px', borderRadius: '40px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '35px' }}>
                                    <div style={{ padding: '12px', background: 'rgba(0,255,128,0.1)', borderRadius: '15px' }}>
                                        <Target size={24} color="#00ff80" />
                                    </div>
                                    <h3 style={{ fontWeight: 950, fontSize: '1.5rem', letterSpacing: '1px' }}>BEST BOWLER (PURPLE CAP)</h3>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                    {tournamentStats.filter(s => (s.total_wickets || 0) > 0).length > 0 ? (
                                        [...tournamentStats]
                                            .filter(s => (s.total_wickets || 0) > 0)
                                            .sort((a,b) => (b.total_wickets || 0) - (a.total_wickets || 0))
                                            .slice(0, 5)
                                            .map((s, idx) => (
                                            <div key={s.player_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 25px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)', transition: 'all 0.2s' }} className="hover-scale">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                                                    <span style={{ fontWeight: 950, color: '#00ff80', fontSize: '0.9rem', width: '20px' }}>{idx + 1}</span>
                                                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#111', overflow: 'hidden', border: '2px solid rgba(0,255,128,0.2)' }}>
                                                        <img src={fixPhotoUrl(s.photo_url, s.first_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.first_name}`; }} />
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <div style={{ fontWeight: 900, fontSize: '1.15rem' }}>
                                                            {s.first_name} {s.last_name}
                                                        </div>
                                                        <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#00ff80', opacity: 0.8 }}>
                                                            {s.team_name?.toUpperCase() || 'NO TEAM'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '1.4rem', fontWeight: 950, color: '#00ff80' }}>{s.total_wickets || 0} <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>WKTS</span></div>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.1)', fontWeight: 800 }}>
                                            <div style={{ fontSize: '0.8rem', letterSpacing: '2px', marginBottom: '10px' }}>LEADERBOARD PENDING</div>
                                            WAITING FOR FIRST WICKET...
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                )}







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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', background: 'rgba(255,255,255,0.03)', padding: '15px 30px', borderRadius: '40px', border: '1px solid rgba(255,215,0,0.1)', backdropFilter: 'blur(20px)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ width: '60px', height: '60px', background: 'rgba(255,215,0,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <img src="/logo.png" alt="Logo" style={{ width: '40px', height: 'auto', filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.3))' }} />
                                    </div>
                                    <span style={{ fontWeight: 950, fontSize: '0.85rem', letterSpacing: '2px' }}>{(match.status || 'Live').toUpperCase()} SESSION</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.5)' }}>
                                    <Timer size={16} className="rotate-slow" />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 900, letterSpacing: '1px' }}>REAL-TIME SYNC</span>
                                </div>
                            </div>

                            <div id="live" className="glass premium" style={{ padding: '20px 15px', borderRadius: '25px', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-30px', right: '-30px', opacity: 0.03 }}>
                                    <Trophy size={150} color="var(--primary)" />
                                </div>
                                <div style={{ textAlign: 'center', marginBottom: '15px', position: 'relative', zIndex: 1 }}>
                                    <div style={{ color: 'var(--primary)', fontWeight: 950, letterSpacing: '1px', fontSize: '0.65rem', textTransform: 'uppercase' }}>{(match.match_type || 'Tournament').toUpperCase()} • {(match.venue || 'KESAV ARENA').toUpperCase()}</div>
                                    <h1 style={{ fontSize: '1.2rem', fontWeight: 950, marginTop: '2px', letterSpacing: '-0.2px', marginBottom: '8px' }}>{match.match_name}</h1>
                                    
                                    {match.status === 'completed' && match.result_message && (
                                        <div className="glass shadow-premium pulse-green" style={{ 
                                            display: 'inline-flex', 
                                            alignItems: 'center', 
                                            gap: '10px', 
                                            padding: '12px 25px', 
                                            borderRadius: '20px', 
                                            background: 'rgba(0,255,128,0.1)', 
                                            border: '1px solid rgba(0,255,128,0.3)',
                                            marginTop: '15px',
                                            boxShadow: '0 0 30px rgba(0,255,128,0.15)'
                                        }}>
                                            <Trophy size={20} color="#00ff80" />
                                            <span style={{ fontSize: '1rem', fontWeight: 950, color: '#00ff80', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                                {match.result_message}
                                            </span>
                                        </div>
                                    )}

                                    {match.status !== 'completed' && match.toss_winner_id && (
                                        <div className="glass shadow-premium" style={{ 
                                            display: 'inline-flex', 
                                            alignItems: 'center', 
                                            gap: '8px', 
                                            padding: '6px 16px', 
                                            borderRadius: '15px', 
                                            background: 'rgba(255,215,0,0.08)', 
                                            border: '1px solid rgba(255,215,0,0.2)',
                                            marginTop: '8px'
                                        }}>
                                            <Trophy size={14} color="var(--primary)" />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '0.2px' }}>
                                                {(match.toss_winner_id === match.team1_id ? match.team1?.name : match.team2?.name)?.toUpperCase()} WON THE TOSS & ELECTED TO {(match.toss_decision || 'BAT').toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="innings-grid" style={{ position: 'relative', zIndex: 1, marginBottom: '15px', gap: '15px' }}>
                                    <div 
                                        onClick={() => setActiveScorecardTeamId(match.team1_id)}
                                        style={{ 
                                            textAlign: 'center', 
                                            cursor: 'pointer',
                                            padding: '15px',
                                            borderRadius: '20px',
                                            background: activeScorecardTeamId === match.team1_id ? 'rgba(255,215,0,0.05)' : 'transparent',
                                            border: activeScorecardTeamId === match.team1_id ? '1px solid rgba(255,215,0,0.2)' : '1px solid transparent',
                                            transition: 'all 0.3s ease'
                                        }}
                                        className="team-score-clickable"
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '5px' }}>
                                            <div style={{ width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,215,0,0.05)', borderRadius: '50%' }}>
                                                <img src="/logo.png" alt="Logo" style={{ width: '25px', height: 'auto' }} />
                                            </div>
                                            <div style={{ fontSize: '1rem', fontWeight: 950, color: 'var(--primary)' }}>{match.team1?.name}</div>
                                        </div>
                                        <ScoreDisplay inn={innings.find(i => i.batting_team_id === match.team1_id)} />
                                    </div>
                                    <div className="vs-divider" style={{ fontSize: '0.7rem', fontWeight: 950, color: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '50%', margin: '5px auto' }}>VS</div>
                                    <div 
                                        onClick={() => setActiveScorecardTeamId(match.team2_id)}
                                        style={{ 
                                            textAlign: 'center', 
                                            cursor: 'pointer',
                                            padding: '15px',
                                            borderRadius: '20px',
                                            background: activeScorecardTeamId === match.team2_id ? 'rgba(255,215,0,0.05)' : 'transparent',
                                            border: activeScorecardTeamId === match.team2_id ? '1px solid rgba(255,215,0,0.2)' : '1px solid transparent',
                                            transition: 'all 0.3s ease'
                                        }}
                                        className="team-score-clickable"
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '5px' }}>
                                            <div style={{ width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,215,0,0.05)', borderRadius: '50%' }}>
                                                <img src="/logo.png" alt="Logo" style={{ width: '25px', height: 'auto' }} />
                                            </div>
                                            <div style={{ fontSize: '1rem', fontWeight: 950, color: 'var(--primary)' }}>{match.team2?.name}</div>
                                        </div>
                                        <ScoreDisplay inn={innings.find(i => i.batting_team_id === match.team2_id)} />
                                    </div>
                                </div>

                                {innings.length === 2 && !innings[1].is_completed && (
                                    <div style={{ textAlign: 'center', marginBottom: '25px', padding: '15px', background: 'rgba(0,255,128,0.05)', borderRadius: '20px', border: '1px solid rgba(0,255,128,0.1)' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                            <div>
                                                <div style={{ fontSize: '0.6rem', color: 'rgba(0,255,128,0.7)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>Runs Required</div>
                                                <div style={{ color: '#00ff80', fontWeight: 950, fontSize: '1.8rem' }}>
                                                    {Math.max(0, (innings[0].runs + 1) - (innings[1].runs || 0))}
                                                </div>
                                            </div>
                                            <div style={{ borderLeft: '1px solid rgba(0,255,128,0.1)' }}>
                                                <div style={{ fontSize: '0.6rem', color: 'rgba(0,255,128,0.7)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>Balls Remaining</div>
                                                <div style={{ color: '#00ff80', fontWeight: 950, fontSize: '1.8rem' }}>
                                                    {(() => {
                                                        const totalBalls = (match?.max_overs || 8) * 6;
                                                        const currentOvers = innings[1].overs || 0;
                                                        const ballsBowled = Math.floor(currentOvers) * 6 + Math.round((currentOvers - Math.floor(currentOvers)) * 10);
                                                        return Math.max(0, totalBalls - ballsBowled);
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '8px', fontSize: '0.75rem', fontWeight: 800, color: '#00ff80', letterSpacing: '1px' }}>
                                            TARGET: {innings[0].runs + 1}
                                        </div>
                                    </div>
                                )}

                                {/* Detailed Scorecard Integration */}
                                <div style={{ borderTop: '1px solid rgba(255,215,0,0.1)', paddingTop: '15px' }}>
                                    <h2 style={{ textAlign: 'center', fontSize: '1rem', fontWeight: 950, marginBottom: '15px', color: 'var(--primary)' }}>SCORECARD</h2>
                                    <MatchScorecard 
                                        matchId={match.id} 
                                        forcedTeamId={activeScorecardTeamId || undefined}
                                    />
                                </div>
                            </div>
                        </div>
                    )
                )}

                {activeView === 'teams' && (
                    <section className="fade-in">
                        {!selectedTeamForSquad ? (
                            <div className="team-list-view">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
                                    <div style={{ padding: '15px', background: 'rgba(255,215,0,0.1)', borderRadius: '18px' }}>
                                        <Users size={36} color="var(--primary)" />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '1px', margin: 0 }}>TOURNAMENT TEAMS</h2>
                                        <p style={{ color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '2px', fontSize: '0.9rem' }}>KESHAV CUP 2026 LINEUP</p>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
                                    {(teamsData.length > 0 ? teamsData : teams.map(t => ({ name: t, id: t }))).map((t: any) => (
                                        <div 
                                            key={t.id} 
                                            onClick={() => {
                                                console.log("Selected team:", t);
                                                setSelectedTeamForSquad(t);
                                            }}
                                            className="glass premium hover-scale" 
                                            style={{ padding: '30px', borderRadius: '35px', textAlign: 'center', cursor: 'pointer', border: '1px solid rgba(255,215,0,0.05)' }}
                                        >
                                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,215,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                                <img src="/logo.png" alt="" style={{ width: '50px' }} />
                                            </div>
                                            <h3 style={{ fontSize: '1.2rem', fontWeight: 950, color: 'var(--primary)', letterSpacing: '1px', textTransform: 'uppercase' }}>{t.name}</h3>
                                            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.2)', marginTop: '10px' }}>VIEW FULL SQUAD</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="squad-view-container fade-in">
                                <button 
                                    onClick={() => setSelectedTeamForSquad(null)}
                                    className="back-btn"
                                    style={{ marginBottom: '25px', padding: '12px 25px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', color: '#fff', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                                >
                                    ← BACK TO TEAMS
                                </button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '30px', marginBottom: '50px', background: 'rgba(255,255,255,0.02)', padding: '30px', borderRadius: '40px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,215,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <img src="/logo.png" alt="" style={{ width: '70px' }} />
                                    </div>
                                    <div>
                                        <h1 style={{ fontSize: '3.5rem', fontWeight: 950, margin: 0, color: 'var(--primary)' }}>{selectedTeamForSquad.name.toUpperCase()}</h1>
                                        <div style={{ display: 'flex', gap: '15px', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.9rem', marginTop: '5px' }}>
                                            <span>SQUAD LIST</span>
                                            <span>•</span>
                                            <span style={{ color: 'var(--primary)' }}>{(selectedTeamForSquad.players || selectedTeamForSquad.squad || [])?.length || 0} PLAYERS</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="glass premium" style={{ borderRadius: '40px', overflow: 'hidden' }}>
                                    <div style={{ padding: '30px 40px', background: 'rgba(255,215,0,0.05)', borderBottom: '1px solid rgba(255,215,0,0.1)' }}>
                                        <h3 style={{ margin: 0, fontWeight: 950, letterSpacing: '1px' }}>TEAM SQUAD</h3>
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ textAlign: 'left', background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                                    <th style={{ padding: '20px 40px' }}>Player Name</th>
                                                    <th style={{ padding: '20px 40px', textAlign: 'right' }}>Role</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(selectedTeamForSquad.players || []).sort((a: any, b: any) => {
                                                    const aCap = isCaptain(a.first_name, a.last_name);
                                                    const bCap = isCaptain(b.first_name, b.last_name);
                                                    if (aCap && !bCap) return -1;
                                                    if (!aCap && bCap) return 1;
                                                    return 0;
                                                }).map((p: any) => (
                                                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.3s' }} className="hover-bg">
                                                        <td style={{ padding: '15px 40px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                                <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: '#222', overflow: 'hidden', border: isCaptain(p.first_name, p.last_name) ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)' }}>
                                                                    <img 
                                                                        src={fixPhotoUrl(p.photo_url || p.photo, p.first_name)} 
                                                                        alt="" 
                                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                        onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`; }}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontWeight: 900, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        {p.first_name} {p.last_name}
                                                                        {isCaptain(p.first_name, p.last_name) && (
                                                                            <span style={{ fontSize: '0.65rem', padding: '3px 8px', borderRadius: '6px', background: 'var(--primary)', color: '#000', fontWeight: 950 }}>CAPTAIN</span>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>{p.cricket_skill || p.role}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '20px 40px', textAlign: 'right' }}>
                                                            <span style={{ padding: '6px 15px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', fontSize: '0.8rem', fontWeight: 800, letterSpacing: '1px' }}>{(p.cricket_skill || p.role || 'Player').toUpperCase()}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {activeView === 'matches' && (
                    <section className="fade-in">
                        {!historyMatch ? (
                            <>
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
                                        <div 
                                            key={m.id} 
                                            onClick={() => viewMatchHistory(m)}
                                            className="glass premium hover-scale" 
                                            style={{ padding: '40px', borderRadius: '40px', cursor: 'pointer' }}
                                        >
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
                            </>
                        ) : (
                            <div className="match-report-view">
                                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                                    <div style={{ color: 'var(--primary)', fontWeight: 950, letterSpacing: '2px', fontSize: '0.8rem', textTransform: 'uppercase' }}>MATCH REPORT</div>
                                    <h1 style={{ fontSize: '2.5rem', fontWeight: 950, marginTop: '5px' }}>{historyMatch.match_name}</h1>
                                    
                                    {historyMatch.result_message && (
                                        <div style={{ 
                                            display: 'inline-flex', 
                                            alignItems: 'center', 
                                            gap: '10px', 
                                            padding: '12px 25px', 
                                            borderRadius: '20px', 
                                            background: 'rgba(0,255,128,0.1)', 
                                            border: '1px solid rgba(0,255,128,0.3)',
                                            marginTop: '15px'
                                        }}>
                                            <Trophy size={20} color="#00ff80" />
                                            <span style={{ fontSize: '1rem', fontWeight: 950, color: '#00ff80', textTransform: 'uppercase' }}>
                                                {historyMatch.result_message}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="innings-grid" style={{ marginBottom: '40px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 950, color: 'var(--primary)', marginBottom: '10px' }}>{historyMatch.team1?.name}</div>
                                        <ScoreDisplay inn={historyInnings.find(i => i.batting_team_id === historyMatch.team1_id)} />
                                    </div>
                                    <div className="vs-divider">VS</div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 950, color: 'var(--primary)', marginBottom: '10px' }}>{historyMatch.team2?.name}</div>
                                        <ScoreDisplay inn={historyInnings.find(i => i.batting_team_id === historyMatch.team2_id)} />
                                    </div>
                                </div>

                                <MatchScorecard matchId={historyMatch.id} />
                            </div>
                        )}
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
                .innings-grid { display: grid; grid-template-columns: 1fr auto 1fr; gap: 40px; align-items: center; }
                @media (max-width: 768px) { .innings-grid { display: flex; flex-direction: column; gap: 20px; } .vs-divider { display: none; } }
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
                
                @media (max-width: 850px) {
                    .innings-grid { display: flex !important; flex-direction: column !important; gap: 20px !important; }
                    .vs-divider { display: none; }
                    .nav-bar { border-radius: 25px !important; padding: 5px !important; }
                    .nav-btn { padding: 8px 14px !important; gap: 5px !important; border-radius: 18px !important; }
                }
                @media (max-width: 650px) {
                    .nav-label { display: none; }
                    .nav-bar { border-radius: 20px !important; padding: 4px !important; gap: 3px !important; }
                    .nav-btn { padding: 10px !important; border-radius: 15px !important; }
                    .main-logo-container { width: 75vw !important; height: 75vw !important; }
                    h1.title-gradient { font-size: 2.8rem !important; margin-bottom: 30px !important; }
                    .teams-grid { grid-template-columns: 1fr !important; }
                    .glass.premium { padding: 25px 15px !important; border-radius: 30px !important; }
                    .back-btn { padding: 10px 18px !important; font-size: 0.8rem !important; margin-bottom: 25px !important; border-radius: 15px !important; }
                    .section-header { gap: 15px !important; }
                    .modal-header { padding: 20px !important; }
                    .player-modal-card { padding: 15px !important; border-radius: 20px !important; }
                    .player-modal-img { width: 50px !important; height: 50px !important; border-radius: 12px !important; }
                    .modal-logo { width: 50px !important; height: 50px !important; }
                    .modal-logo img { width: 35px !important; }
                }
                @media (max-width: 400px) {
                    h1.title-gradient { font-size: 2.2rem !important; }
                    .responsive-title { font-size: 1.4rem !important; }
                }
            `}</style>
            <style jsx>{`
                @media (max-width: 768px) {
                    .nav-btn { padding: 8px 10px !important; min-width: 55px !important; }
                    .nav-label { font-size: 0.55rem !important; margin-top: 2px; }
                    .nav-bar { gap: 2px !important; padding: 4px !important; border-radius: 20px !important; }
                    .sticky-nav-container { top: 10px !important; }
                }
            `}</style>
        </main>
    );
}

function ScoreDisplay({ inn }: { inn: any }) {
    if (!inn) return <div style={{ fontSize: '0.9rem', fontWeight: 950, color: 'rgba(255,255,255,0.05)' }}>YET TO BAT</div>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '10px' }}>
                <div style={{ fontSize: '2rem', fontWeight: 950, letterSpacing: '-1px', lineHeight: 1 }}>
                    {inn.runs}<span style={{ color: 'var(--primary)', opacity: 0.8 }}>/</span>{inn.wickets}
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px' }}>
                    {(inn.overs || 0).toFixed(1)} <span style={{ fontSize: '0.6rem' }}>ov</span>
                </div>
            </div>
            
            {!inn.is_completed && (inn.striker || inn.bowler) && (
                <div style={{ 
                    display: 'flex', 
                    gap: '12px', 
                    fontSize: '0.65rem', 
                    fontWeight: 900, 
                    color: 'rgba(255,255,255,0.5)', 
                    textTransform: 'uppercase', 
                    letterSpacing: '1px',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '4px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    {inn.striker && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: 'var(--primary)' }}>🏏</span> {inn.striker.first_name}
                        </span>
                    )}
                    {inn.bowler && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: '#00ff80' }}>🥎</span> {inn.bowler.first_name}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}