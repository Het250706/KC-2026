'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Swords, Target, Activity, Zap } from 'lucide-react';

export default function MatchScorecard({ matchId }: { matchId: string }) {
    const [teamScores, setTeamScores] = useState<any[]>([]);
    const [playerStats, setPlayerStats] = useState<any[]>([]);
    const [matchEvents, setMatchEvents] = useState<any[]>([]);
    const [activeTeamTab, setActiveTeamTab] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!matchId) return;

        const fetchData = async () => {
            const [scoresRes, statsRes, eventsRes] = await Promise.all([
                supabase.from('team_scores').select('*, teams(name)').eq('match_id', matchId),
                supabase.from('player_match_stats').select('*, players(*)').eq('match_id', matchId),
                supabase.from('match_events').select('*, batsman:players!batsman_id(*), bowler:players!bowler_id(*)').eq('match_id', matchId).order('created_at', { ascending: false }).limit(10)
            ]);

            if (scoresRes.data) {
                setTeamScores(scoresRes.data);
                if (scoresRes.data.length > 0 && !activeTeamTab) {
                    setActiveTeamTab(scoresRes.data[0].team_id);
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
                setTeamScores(prev => {
                    const index = prev.findIndex(s => s.id === (payload.new as any).id);
                    if (index > -1) {
                        const updated = [...prev];
                        updated[index] = { ...updated[index], ...payload.new };
                        return updated;
                    }
                    return [...prev, payload.new];
                });
            })
            .on('postgres_changes', { event: '*', table: 'player_match_stats', schema: 'public', filter: `match_id=eq.${matchId}` }, (payload: any) => {
                fetchData(); // Simplest way to keep players & their relations synced
            })
            .on('postgres_changes', { event: 'INSERT', table: 'match_events', schema: 'public', filter: `match_id=eq.${matchId}` }, (payload: any) => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [matchId]);

    if (loading) return <div className="p-10 text-center animate-pulse">Loading Live Scorecard...</div>;

    const currentTeamScore = teamScores.find(ts => ts.team_id === activeTeamTab);
    const battingPlayers = playerStats.filter(ps => ps.players?.team_id === activeTeamTab && ps.balls > 0);
    const bowlingPlayers = playerStats.filter(ps => ps.players?.team_id !== activeTeamTab && ps.runs_given > 0);

    return (
        <div className="scorecard-wrapper" style={{ color: '#fff' }}>
            {/* Team Tabs */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                {teamScores.map(ts => (
                    <button
                        key={ts.team_id}
                        onClick={() => setActiveTeamTab(ts.team_id)}
                        className={`tab-btn ${activeTeamTab === ts.team_id ? 'active' : ''}`}
                    >
                        {ts.teams?.name?.toUpperCase()}
                    </button>
                ))}
            </div>

            {/* Main Score Display */}
            {currentTeamScore && (
                <div className="glass-card" style={{ padding: '30px', borderRadius: '25px', marginBottom: '30px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 12px', background: 'rgba(255,75,75,0.1)', borderRadius: '20px', border: '1px solid rgba(255,75,75,0.3)', color: '#ff4b4b', fontWeight: 900, fontSize: '0.75rem', marginBottom: '15px' }}>
                        <div className="pulse-dot" /> LIVE MATCH
                    </div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 950, marginBottom: '5px' }}>{currentTeamScore.teams?.name}</h2>
                    <div style={{ fontSize: '3.5rem', fontWeight: 950, color: 'var(--primary)' }}>
                        {currentTeamScore.runs}/{currentTeamScore.wickets}
                        <span style={{ fontSize: '1.5rem', color: '#888', marginLeft: '15px' }}>({currentTeamScore.overs} ov)</span>
                    </div>
                </div>
            )}

            {/* Batting Table */}
            <div className="glass-card" style={{ padding: '25px', borderRadius: '25px', marginBottom: '25px' }}>
                <h3 className="section-title"><Swords size={20} /> BATTING</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: '#888', fontSize: '0.8rem' }}>
                            <th style={{ padding: '10px' }}>Player</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>R</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>B</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>4s</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>6s</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>SR</th>
                        </tr>
                    </thead>
                    <tbody>
                        {battingPlayers.map(ps => (
                            <tr key={ps.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '15px 10px', fontWeight: 700 }}>{ps.players?.first_name} {ps.players?.last_name}</td>
                                <td style={{ padding: '15px 10px', textAlign: 'right', fontWeight: 900, color: 'var(--primary)' }}>{ps.runs}</td>
                                <td style={{ padding: '15px 10px', textAlign: 'right', color: '#888' }}>{ps.balls}</td>
                                <td style={{ padding: '15px 10px', textAlign: 'right' }}>{ps.fours}</td>
                                <td style={{ padding: '15px 10px', textAlign: 'right' }}>{ps.sixes}</td>
                                <td style={{ padding: '15px 10px', textAlign: 'right', fontWeight: 700 }}>{ps.balls > 0 ? ((ps.runs / ps.balls) * 100).toFixed(1) : '0.0'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Bowling Table */}
            <div className="glass-card" style={{ padding: '25px', borderRadius: '25px', marginBottom: '25px' }}>
                <h3 className="section-title"><Target size={20} /> BOWLING</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: '#888', fontSize: '0.8rem' }}>
                            <th style={{ padding: '10px' }}>Bowler</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>O</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>R</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>W</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Econ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bowlingPlayers.map(ps => (
                            <tr key={ps.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '15px 10px', fontWeight: 700 }}>{ps.players?.first_name} {ps.players?.last_name}</td>
                                <td style={{ padding: '15px 10px', textAlign: 'right', fontWeight: 900 }}>{ps.overs}</td>
                                <td style={{ padding: '15px 10px', textAlign: 'right', color: '#ff4b4b' }}>{ps.runs_given}</td>
                                <td style={{ padding: '15px 10px', textAlign: 'right', fontWeight: 900, color: '#00ff80' }}>{ps.wickets}</td>
                                <td style={{ padding: '15px 10px', textAlign: 'right', color: '#888' }}>{ps.overs > 0 ? (ps.runs_given / parseFloat(ps.overs.toString())).toFixed(2) : '0.00'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Recent Match Events Feed */}
            <div className="glass-card" style={{ padding: '25px', borderRadius: '25px' }}>
                <h3 className="section-title"><Zap size={20} /> RECENT EVENTS</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {matchEvents.map((e, i) => (
                        <div key={e.id} className="event-row">
                            <span className="event-over">Over {e.over_number}.{e.ball_number}</span>
                            <span className="event-desc">
                                <strong>{e.batsman?.first_name}</strong> {e.event_type === 'run' ? `scored ${e.runs} run${e.runs !== 1 ? 's' : ''}` : e.event_type === 'four' ? 'hit FOUR!' : e.event_type === 'six' ? 'hit SIX!!' : e.event_type === 'wicket' ? 'is OUT!' : `received ${e.runs} extra (${e.event_type})`}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <style jsx>{`
                .tab-btn { flex: 1; padding: 15px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 15px; color: #fff; font-weight: 800; cursor: pointer; transition: 0.3s; }
                .tab-btn.active { background: var(--primary); color: #000; border-color: var(--primary); }
                .glass-card { background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.05); }
                .section-title { display: flex; alignItems: center; gap: 10px; font-weight: 900; margin-bottom: 20px; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; }
                .event-row { display: flex; gap: 15px; padding: 12px; background: rgba(255,255,255,0.02); border-radius: 12px; font-size: 0.9rem; }
                .event-over { color: var(--primary); font-weight: 900; min-width: 80px; }
                .pulse-dot { width: 8px; height: 8px; borderRadius: 50%; background: #ff4b4b; animation: pulse 1.5s infinite; }
                @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }
            `}</style>
        </div>
    );
}
