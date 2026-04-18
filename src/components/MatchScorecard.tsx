'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Swords, Target, Activity, Zap } from 'lucide-react';

export default function MatchScorecard({ matchId, forcedTeamId }: { matchId: string, forcedTeamId?: string }) {
    const [teamScores, setTeamScores] = useState<any[]>([]);
    const [matchDetails, setMatchDetails] = useState<any>(null);
    const [playerStats, setPlayerStats] = useState<any[]>([]);
    const [matchEvents, setMatchEvents] = useState<any[]>([]);
    const [matchPlayers, setMatchPlayers] = useState<any[]>([]);
    const [currentInnings, setCurrentInnings] = useState<any>(null);
    const [activeTeamTab, setActiveTeamTab] = useState<string | null>(forcedTeamId || null);
    const [loading, setLoading] = useState(true);

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

    useEffect(() => {
        if (forcedTeamId) setActiveTeamTab(forcedTeamId);
    }, [forcedTeamId]);

    useEffect(() => {
        if (!matchId) return;

        const fetchData = async () => {
            const [scoresRes, statsRes, eventsRes, innRes, matchRes, playersRes] = await Promise.all([
                supabase.from('team_scores').select('*, teams(name, captain_email)').eq('match_id', matchId),
                supabase.from('player_match_stats').select('*, players:players!player_id(*)').eq('match_id', matchId),
                supabase.from('match_events').select('*, batsman:players!batsman_id(*), bowler:players!bowler_id(*)').eq('match_id', matchId).order('created_at', { ascending: false }).limit(10),
                supabase.from('innings').select('*, striker:players!striker_id(*), bowler:players!bowler_id(*)').eq('match_id', matchId).order('innings_number', { ascending: true }),
                supabase.from('matches').select('*, team1:teams!team1_id(*), team2:teams!team2_id(*)').eq('id', matchId).single(),
                supabase.from('match_players').select('*').eq('match_id', matchId)
            ]);

            if (matchRes.data) setMatchDetails(matchRes.data);
            if (playersRes.data) setMatchPlayers(playersRes.data);
            if (scoresRes.data) {
                let scores = scoresRes.data;
                const allInnings = innRes.data || [];
                // If team_scores is empty or incomplete, try to use matchDetails and innings to fill it
                if (scores.length < 2 && matchRes.data) {
                    const m = matchRes.data;
                    const teams = [m.team1, m.team2];
                    scores = teams.map(t => {
                        const existing = scores.find(s => s.team_id === t.id);
                        const inn = allInnings.length > 0 ? allInnings.find(i => i.batting_team_id === t.id) : null;
                        return existing || { 
                            team_id: t.id, 
                            teams: t, 
                            runs: inn?.runs || 0, 
                            wickets: inn?.wickets || 0, 
                            overs: inn?.overs || 0 
                        };
                    });
                }
                setTeamScores(scores);
                
                // Smart tab selection & Innings tracking
                const liveInn = allInnings.find(i => !i.is_completed);
                if (liveInn) {
                    setCurrentInnings(liveInn);
                    if (!activeTeamTab) setActiveTeamTab(liveInn.batting_team_id);
                } else if (scores.length > 0 && !activeTeamTab) {
                    setActiveTeamTab(scores[0].team_id);
                }
            }
            if (statsRes.data) setPlayerStats(statsRes.data);
            if (eventsRes.data) setMatchEvents(eventsRes.data);
            setLoading(false);
        };

        fetchData();

        // REAL-TIME SUBSCRIPTIONS
        const channel = supabase.channel(`scorecard_${matchId}`)
            .on('postgres_changes', { event: '*', table: 'team_scores', schema: 'public', filter: `match_id=eq.${matchId}` }, (payload: any) => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', table: 'match_events', schema: 'public', filter: `match_id=eq.${matchId}` }, (payload: any) => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', table: 'innings', schema: 'public', filter: `match_id=eq.${matchId}` }, (payload: any) => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [matchId]);

    if (loading) return <div className="p-10 text-center animate-pulse">Loading Live Scorecard...</div>;

    return (
        <div className="scorecard-wrapper" style={{ color: '#fff' }}>

            {/* Scorecard Sections for each team */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                {teamScores.map(ts => {
                    // Use matchDetails for accurate opposite team detection
                    const oppositeTeamId = matchDetails?.team1_id === ts.team_id ? matchDetails?.team2_id : matchDetails?.team1_id;
                    const oppositeTeam = teamScores.find(other => other.team_id === oppositeTeamId) || { team_id: oppositeTeamId };
                    const teamName = ts.teams?.name || (matchDetails?.team1_id === ts.team_id ? matchDetails?.team1?.name : matchDetails?.team2?.name) || 'Unknown Team';
                    
                    return (
                        <div key={ts.team_id} className="team-innings-section">
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                marginBottom: '20px',
                                padding: '10px 0',
                                borderBottom: '2px solid var(--primary)'
                            }}>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 950, margin: 0, color: 'var(--primary)' }}>{teamName.toUpperCase()} INNINGS</h2>
                                <div style={{ fontSize: '1.2rem', fontWeight: 950 }}>{ts.runs}/{ts.wickets} <span style={{ fontSize: '0.9rem', color: '#888' }}>({ts.overs} ov)</span></div>
                            </div>

                            {/* Batting Table */}
                            <div className="glass-card" style={{ padding: '20px', borderRadius: '25px', marginBottom: '20px' }}>
                                <h3 className="section-title"><Swords size={18} /> BATTING</h3>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: '#888', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                                <th style={{ padding: '10px' }}>Batter</th>
                                                <th style={{ padding: '10px', textAlign: 'right' }}>R</th>
                                                <th style={{ padding: '10px', textAlign: 'right' }}>B</th>
                                                <th style={{ padding: '10px', textAlign: 'right' }}>4s</th>
                                                <th style={{ padding: '10px', textAlign: 'right' }}>6s</th>
                                                <th style={{ padding: '10px', textAlign: 'right' }}>SR</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                             {playerStats
                                                .filter(ps => {
                                                    const isMatchTeam = matchPlayers.some(mp => mp.player_id === ps.player_id && mp.team_id === ts.team_id);
                                                    const hasActivity = (ps.runs_scored || ps.runs || 0) > 0 || (ps.balls_faced || ps.balls || 0) > 0;
                                                    return isMatchTeam && hasActivity;
                                                })
                                                .sort((a, b) => (b.runs_scored || b.runs || 0) - (a.runs_scored || a.runs || 0))
                                                .map(ps => {
                                                    const r = ps.runs_scored !== undefined ? ps.runs_scored : (ps.runs || 0);
                                                    const b = ps.balls_faced !== undefined ? ps.balls_faced : (ps.balls || 0);
                                                    return (
                                                <tr key={ps.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: (currentInnings?.striker_id === ps.player_id) ? 'rgba(255,215,0,0.03)' : 'transparent' }}>
                                                    <td style={{ padding: '12px 10px', fontWeight: 700, fontSize: '0.9rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span>{ps.players ? `${ps.players.first_name || ''} ${ps.players.last_name || ''}` : 'Unknown Player'}</span>
                                                            {ps.players && isCaptain(ps.players.first_name, ps.players.last_name) && (
                                                                <span style={{ fontSize: '0.55rem', padding: '2px 5px', borderRadius: '4px', background: 'var(--primary)', color: '#000', fontWeight: 950 }}>C</span>
                                                            )}
                                                            {(currentInnings?.striker_id === ps.player_id) && <span style={{ color: 'var(--primary)' }}>*</span>}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 900, color: 'var(--primary)', fontSize: '1rem' }}>{r}</td>
                                                    <td style={{ padding: '12px 10px', textAlign: 'right', color: '#888', fontSize: '0.96rem' }}>{b}</td>
                                                    <td style={{ padding: '12px 10px', textAlign: 'right', fontSize: '0.9rem' }}>{ps.fours || 0}</td>
                                                    <td style={{ padding: '12px 10px', textAlign: 'right', fontSize: '0.9rem' }}>{ps.sixes || 0}</td>
                                                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700, fontSize: '0.85rem' }}>{b > 0 ? ((r / b) * 100).toFixed(1) : '0.0'}</td>
                                                </tr>
                                            );})}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Bowling Table (Showing the OPPOSITE team's bowlers for THIS innings) */}
                            {oppositeTeam && (
                                <div className="glass-card" style={{ padding: '20px', borderRadius: '25px' }}>
                                    <h3 className="section-title"><Target size={18} /> BOWLING</h3>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: '#888', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                                    <th style={{ padding: '10px' }}>Bowler</th>
                                                    <th style={{ padding: '10px', textAlign: 'right' }}>O</th>
                                                    <th style={{ padding: '10px', textAlign: 'right' }}>R</th>
                                                    <th style={{ padding: '10px', textAlign: 'right' }}>W</th>
                                                    <th style={{ padding: '10px', textAlign: 'right' }}>Econ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                 {playerStats
                                                    .filter(ps => {
                                                        const isMatchOppositeTeam = matchPlayers.some(mp => mp.player_id === ps.player_id && mp.team_id === oppositeTeam.team_id);
                                                        const hasActivity = (ps.overs_bowled || ps.overs || 0) > 0 || (ps.wickets_taken || ps.wickets || 0) > 0;
                                                        return isMatchOppositeTeam && hasActivity;
                                                    })
                                                    .sort((a, b) => {
                                                        const wA = a.wickets_taken !== undefined ? a.wickets_taken : (a.wickets || 0);
                                                        const wB = b.wickets_taken !== undefined ? b.wickets_taken : (b.wickets || 0);
                                                        if (wB !== wA) return wB - wA;
                                                        const oA = a.overs_bowled !== undefined ? a.overs_bowled : (a.overs || 0);
                                                        const oB = b.overs_bowled !== undefined ? b.overs_bowled : (b.overs || 0);
                                                        return oB - oA;
                                                    })
                                                    .map(ps => {
                                                        const o = ps.overs_bowled !== undefined ? ps.overs_bowled : (ps.overs || 0);
                                                        const rG = ps.runs_conceded !== undefined ? ps.runs_conceded : (ps.runs_given || 0);
                                                        const w = ps.wickets_taken !== undefined ? ps.wickets_taken : (ps.wickets || 0);
                                                        return (
                                                    <tr key={ps.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: (currentInnings?.bowler_id === ps.player_id) ? 'rgba(0,255,128,0.03)' : 'transparent' }}>
                                                        <td style={{ padding: '12px 10px', fontWeight: 700, fontSize: '0.9rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span>{ps.players ? `${ps.players.first_name || ''} ${ps.players.last_name || ''}` : 'Unknown Player'}</span>
                                                                {ps.players && isCaptain(ps.players.first_name, ps.players.last_name) && (
                                                                    <span style={{ fontSize: '0.55rem', padding: '2px 5px', borderRadius: '4px', background: 'var(--primary)', color: '#000', fontWeight: 950 }}>C</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 900, fontSize: '0.96rem' }}>{o}</td>
                                                        <td style={{ padding: '12px 10px', textAlign: 'right', color: '#ff4b4b', fontSize: '0.96rem' }}>{rG}</td>
                                                        <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 900, color: '#00ff80', fontSize: '1rem' }}>{w}</td>
                                                        <td style={{ padding: '12px 10px', textAlign: 'right', color: '#888', fontSize: '0.85rem' }}>{o > 0 ? (rG / parseFloat(o.toString())).toFixed(2) : '0.00'}</td>
                                                    </tr>
                                                );})}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {playerStats.length === 0 && (
                    <div className="glass-card" style={{ padding: '40px', textAlign: 'center', borderRadius: '30px', color: 'rgba(255,255,255,0.3)', fontWeight: 800 }}>
                        <Target size={40} style={{ marginBottom: '15px', opacity: 0.2 }} />
                        <p>No detailed player statistics available for this match yet.</p>
                    </div>
                )}
            </div>

            {/* Recent Match Events Feed */}
            <div className="glass-card" style={{ padding: '25px', borderRadius: '25px' }}>
                <h3 className="section-title"><Zap size={20} /> RECENT EVENTS</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {matchEvents.map((e, i) => (
                        <div key={e.id} className="event-row">
                            <span className="event-over">Over {e.over_number}.{e.ball_number}</span>
                            <span className="event-desc">
                                <strong>{e.batsman?.first_name} {e.batsman?.last_name}</strong> {e.event_type === 'run' ? `scored ${e.runs} run${e.runs !== 1 ? 's' : ''}` : e.event_type === 'four' ? 'hit FOUR!' : e.event_type === 'six' ? 'hit SIX!!' : e.event_type === 'wicket' ? 'is OUT!' : `received ${e.runs} extra (${e.event_type})`}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <style jsx>{`
                .tab-btn { flex: 1; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff; font-weight: 800; cursor: pointer; transition: 0.3s; font-size: 0.85rem; }
                .tab-btn.active { background: var(--primary); color: #000; border-color: var(--primary); }
                .glass-card { background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.05); overflow-x: auto; }
                .section-title { display: flex; alignItems: center; gap: 10px; font-weight: 900; margin-bottom: 20px; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; }
                .event-row { display: flex; gap: 15px; padding: 12px; background: rgba(255,255,255,0.02); border-radius: 12px; font-size: 0.85rem; }
                .event-over { color: var(--primary); font-weight: 900; min-width: 80px; }
                .pulse-dot { width: 8px; height: 8px; borderRadius: 50%; background: #ff4b4b; animation: pulse 1.5s infinite; }
                table { min-width: 500px; }
                @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }
                
                @media (max-width: 600px) {
                    .glass-card { padding: 15px !important; border-radius: 20px !important; }
                    .tab-btn { padding: 10px; font-size: 0.75rem; }
                    h2 { font-size: 1.8rem !important; }
                    .section-title { font-size: 0.9rem; }
                    td, th { padding: 10px 5px !important; font-size: 0.75rem !important; }
                }
            `}</style>
        </div>
    );
}
