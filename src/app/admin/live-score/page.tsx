'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { fixPhotoUrl } from '@/lib/utils';
import Navbar from '@/components/Navbar';
import {
    ChevronRight, Settings, Users, Save, Play, Square, Trophy, Target, TrendingUp, Hand,
    UserCheck, Search, Trash2, Shield, User, Loader2, Plus, Zap, RefreshCw,
    ChevronLeft, UserPlus, Activity, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import RoleGuard from '@/components/RoleGuard';
import MatchScorecard from '@/components/MatchScorecard';
export default function AdminLiveScorePage() {
    return (
        <RoleGuard allowedRole="admin">
            <AdminLiveScoreContent />
        </RoleGuard>
    );
}

function AdminLiveScoreContent() {
    // UI State
    const [view, setView] = useState<'matches' | 'create' | 'squad' | 'toss' | 'scoring' | 'stats' | 'report'>('matches');
    const [loading, setLoading] = useState(true);
    const [activeMatch, setActiveMatch] = useState<any>(null);

    // Data State
    const [matches, setMatches] = useState<any[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [teamAPlayers, setTeamAPlayers] = useState<any[]>([]);
    const [teamBPlayers, setTeamBPlayers] = useState<any[]>([]);
    const [matchPlayersA, setMatchPlayersA] = useState<any[]>([]);
    const [matchPlayersB, setMatchPlayersB] = useState<any[]>([]);
    const [selectedSquadA, setSelectedSquadA] = useState<string[]>([]);
    const [selectedSquadB, setSelectedSquadB] = useState<string[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        match_name: '',
        match_type: 'League Match',
        team1_id: '',
        team2_id: '',
        venue: 'Main Stadium',
        max_overs: '8'
    });

    const [tossData, setTossData] = useState({
        toss_winner_id: '',
        toss_decision: 'Batting'
    });

    // Scoring State
    const [currentInnings, setCurrentInnings] = useState<any>(null);
    const [strikerId, setStrikerId] = useState('');
    const [bowlerId, setBowlerId] = useState('');
    const [previousBowlerId, setPreviousBowlerId] = useState('');
    const [showWicketModal, setShowWicketModal] = useState(false);
    const [selectedWicketType, setSelectedWicketType] = useState('Bowled');
    const [dismissedId, setDismissedId] = useState('');
    const [firstInningsRuns, setFirstInningsRuns] = useState<number | null>(null);
    const [scoringTab, setScoringTab] = useState<'live' | 'team_a' | 'team_b'>('live');
    const [matchEvents, setMatchEvents] = useState<any[]>([]);

    // Stats State
    const [tournamentStats, setTournamentStats] = useState<any[]>([]);

    const getTeamName = (teamId: string) => {
        if (!teamId) return 'TBD';
        const team = teams?.find(t => t.id === teamId);
        if (team?.name) return team.name;
        if (teamId === activeMatch?.team1_id && activeMatch?.team1?.name) return activeMatch.team1.name;
        if (teamId === activeMatch?.team2_id && activeMatch?.team2?.name) return activeMatch.team2.name;
        return teamId === activeMatch?.team1_id ? 'Team 1' : 'Team 2';
    };

    useEffect(() => {
        init();

        const channel = supabase.channel('admin_livescore_system')
            .on('postgres_changes', { event: '*', table: 'match_events', schema: 'public' }, () => {
                fetchTournamentStats();
            })
            .on('postgres_changes', { event: '*', table: 'matches', schema: 'public' }, () => {
                fetchMatches();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    useEffect(() => {
        if (!activeMatch?.id) return;
        const matchChannel = supabase.channel(`admin_match_${activeMatch.id}`)
            .on('postgres_changes', { event: '*', table: 'match_events', schema: 'public', filter: `match_id=eq.${activeMatch.id}` }, () => {
                fetchMatchEvents(activeMatch.id);
            })
            .on('postgres_changes', { event: '*', table: 'innings', schema: 'public', filter: `match_id=eq.${activeMatch.id}` }, async () => {
                const { data: inn } = await supabase
                    .from('innings')
                    .select('*')
                    .eq('match_id', activeMatch.id)
                    .order('innings_number', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (inn) setCurrentInnings(inn);
            })
            .subscribe();

        return () => { supabase.removeChannel(matchChannel); };
    }, [activeMatch?.id]);

    const init = async () => {
        setLoading(true);
        await Promise.all([fetchMatches(), fetchTeams(), fetchTournamentStats()]);
        setLoading(false);
    };

    const fetchTournamentStats = async () => {
        const { data } = await supabase.from('tournament_player_stats').select('*').order('total_runs', { ascending: false });
        if (data) setTournamentStats(data);
    };

    const fetchMatches = async () => {
        const { data, error } = await supabase.from('matches').select('*, team1:teams!team1_id(name), team2:teams!team2_id(name)').order('created_at', { ascending: false });
        if (error) {
            console.error('FETCH_MATCHES_ERROR:', error);
            if (error.code === 'PGRST204' || error.code === '42P01' || error.message.includes('not found')) {
                alert('Database tables might be outdated! Please run the realtime_scoring_v2.sql script.');
            }
        }
        if (data) setMatches(data);
    };

    const fetchTeams = async () => {
        const { data } = await supabase.from('teams').select('id, name');
        if (data) setTeams(data);
    };

    const handleDeleteMatch = async (matchId: string) => {
        if (!confirm('🚨 EMERGENCY DELETE: This will permanently remove all scores, innings, and player stats for this match. Are you sure?')) return;

        const { error } = await supabase.from('matches').delete().eq('id', matchId);

        if (error) {
            console.error('DELETE_MATCH_ERROR:', error);
            alert(`Error deleting match: ${error.message}. You might need to delete related data first if CASCADE is not enabled.`);
        } else {
            alert('Match deleted successfully');
            await Promise.all([
                fetchMatches(),
                fetchTournamentStats()
            ]);
        }
    };

    // --- VIEW HANDLERS ---

    const handleCreateMatch = async () => {
        if (!formData.team1_id || !formData.team2_id || formData.team1_id === formData.team2_id) {
            alert('Please select two different teams');
            return;
        }

        const { data, error } = await supabase.from('matches').insert([{
            match_name: formData.match_name || 'Match',
            match_type: formData.match_type,
            team1_id: formData.team1_id,
            team2_id: formData.team2_id,
            max_overs: parseInt(formData.max_overs),
            venue: formData.venue,
            status: 'live'
        }]).select().single();

        if (error) {
            console.error('CREATE_MATCH_ERROR:', error);
            alert(`Error creating match: ${error.message || 'Unknown error'} (Code: ${error.code})`);
            if (error.code === 'PGRST204' || error.message.includes('match_type')) {
                alert('Missing database column "match_type". Please run VERCEL_SCHEMA_FIX.sql in your Supabase SQL editor.');
            }
        } else {
            await fetchMatches();
            setActiveMatch(data);
            await prepareSquad(data);
            setView('squad');
        }
    };

    const handleContinueMatch = async (match: any) => {
        setLoading(true);
        setActiveMatch(match);

        // 1. Fetch Latest Innings
        const { data: inn } = await supabase
            .from('innings')
            .select('*')
            .eq('match_id', match.id)
            .order('innings_number', { ascending: false })
            .limit(1)
            .maybeSingle();

        // 2. Fetch Match Squads (required for both Toss and Scoring)
        await fetchMatchSquad(match);

        if (inn) {
            setCurrentInnings(inn);
            if (inn.innings_number === 2) {
                const { data: inn1 } = await supabase.from('innings').select('runs').eq('match_id', match.id).eq('innings_number', 1).single();
                if (inn1) setFirstInningsRuns(inn1.runs);
            }
            if (match.status === 'completed') {
                setScoringTab('team_a'); // Tab names can remain as identifiers or change
            } else {
                setScoringTab('live');
            }
            fetchMatchEvents(match.id);
            setView('scoring');
        } else {
            // No innings yet, check if squads are saved
            const { count } = await supabase
                .from('match_players')
                .select('*', { count: 'exact', head: true })
                .eq('match_id', match.id);

            if (count && count > 0) {
                setView('toss');
            } else {
                await prepareSquad(match);
                setView('squad');
            }
        }
        setLoading(false);
    };

    const prepareSquad = async (match: any) => {
        if (!match) return;

        // Reset current squads
        setTeamAPlayers([]);
        setTeamBPlayers([]);
        setSelectedSquadA([]);
        setSelectedSquadB([]);

        try {
            // Get team details
            const { data: t1 } = await supabase.from('teams').select('id, name').eq('id', match.team1_id).single();
            const { data: t2 } = await supabase.from('teams').select('id, name').eq('id', match.team2_id).single();

            // Fetch players for Team 1
            const { data: p1 } = await supabase.from('players').select('*').eq('team_id', match.team1_id);

            // Fetch players for Team 2
            const { data: p2 } = await supabase.from('players').select('*').eq('team_id', match.team2_id);

            if (p1) setTeamAPlayers(p1);
            if (p2) setTeamBPlayers(p2);
        } catch (err) {
            console.error('PREPARE_SQUAD_ERROR:', err);
        }
    };

    const handleSaveSquad = async () => {
        if (!activeMatch) { alert('No active match found'); return; }
        if (selectedSquadA.length === 0 || selectedSquadB.length === 0) {
            alert('Please select at least one player for each team');
            return;
        }

        const matchPlayers = [
            ...selectedSquadA.map(pid => ({ match_id: activeMatch.id, player_id: pid, team_id: activeMatch.team1_id })),
            ...selectedSquadB.map(pid => ({ match_id: activeMatch.id, player_id: pid, team_id: activeMatch.team2_id }))
        ];

        const { error } = await supabase.from('match_players').insert(matchPlayers);
        if (error) {
            console.error('SAVE_SQUAD_ERROR:', error);
            alert(`Error saving squads: ${error.message} (Code: ${error.code})`);
        } else {
            setView('toss');
        }
    };

    const handleSaveToss = async () => {
        if (!tossData.toss_winner_id || !activeMatch) {
            alert('Please select toss winner and ensure match data is loaded');
            return;
        }

        let battingFirstId = tossData.toss_winner_id;
        if (tossData.toss_decision === 'Bowling') {
            battingFirstId = tossData.toss_winner_id === activeMatch.team1_id ? activeMatch.team2_id : activeMatch.team1_id;
        }

        const bowlingFirstId = battingFirstId === activeMatch.team1_id ? activeMatch.team2_id : activeMatch.team1_id;

        const { error } = await supabase.from('matches').update({
            toss_winner_id: tossData.toss_winner_id,
            toss_decision: tossData.toss_decision,
            batting_first_id: battingFirstId,
            status: 'live'
        }).eq('id', activeMatch.id);

        if (error) {
            console.error('SAVE_TOSS_ERROR:', error);
            alert(`Error saving toss: ${error.message} (Code: ${error.code}). Full Error: ${JSON.stringify(error)}`);
        }
        else {
            const { data: inn, error: innError } = await supabase.from('innings').insert([{
                match_id: activeMatch.id,
                innings_number: 1,
                batting_team_id: battingFirstId,
                bowling_team_id: bowlingFirstId,
                is_completed: false
            }]).select().single();

            if (innError) alert('Error initializing innings');
            else {
                setCurrentInnings(inn);
                setStrikerId('');
                setBowlerId('');
                setPreviousBowlerId('');
                await fetchMatchSquad(activeMatch);
                setView('scoring');
            }
        }
    };

    const fetchMatchSquad = async (match: any) => {
        if (!match) return;
        const { data } = await supabase.from('match_players').select('*, players(*)').eq('match_id', match.id);
        if (data) {
            setMatchPlayersA(data.filter((p: any) => p.team_id === match.team1_id).map((p: any) => p.players));
            setMatchPlayersB(data.filter((p: any) => p.team_id === match.team2_id).map((p: any) => p.players));
        }
    };

    // --- SYNC LIVE PLAYERS ---
    useEffect(() => {
        if (!currentInnings || (!strikerId && !bowlerId)) return;

        const syncPlayers = async () => {
            await supabase.from('innings').update({
                striker_id: strikerId || null,
                bowler_id: bowlerId || null
            }).eq('id', currentInnings.id);
        };

        syncPlayers();
    }, [strikerId, bowlerId, currentInnings?.id]);

    const fetchMatchEvents = async (matchId: string) => {
        const { data, error } = await supabase.from('match_events').select(`
            *,
            striker:players!batsman_id(*),
            bowler:players!bowler_id(*)
        `).eq('match_id', matchId).order('created_at', { ascending: true });

        if (error) {
            console.error('FETCH_EVENTS_ERROR:', error);
        } else if (data) {
            setMatchEvents(data);
        }
    };

    // --- SCORING ACTIONS ---

    const recordBall = async (runs: number, isWicket: boolean = false, extraType: 'run' | 'four' | 'six' | 'wicket' | 'wide' | 'no_ball' = 'run') => {
        if (!strikerId || !bowlerId || !activeMatch) {
            alert('Please select striker and bowler');
            return;
        }

        if (isWicket && !showWicketModal) {
            setDismissedId(strikerId);
            setShowWicketModal(true);
            return;
        }

        // Determine event type if not provided correctly
        let finalEventType = extraType;
        if (isWicket) finalEventType = 'wicket';
        else if (runs === 4 && extraType === 'run') finalEventType = 'four';
        else if (runs === 6 && extraType === 'run') finalEventType = 'six';

        // 1. Record Event (Triggers in DB will handle updating team_scores and player_match_stats)
        const { data: event, error: eventErr } = await supabase.from('match_events').insert([{
            match_id: activeMatch.id,
            innings_id: currentInnings.id,
            over_number: Math.floor(currentInnings?.overs || 0),
            ball_number: Math.round(((currentInnings?.overs || 0) % 1) * 10) + 1,
            batsman_id: strikerId,
            bowler_id: bowlerId,
            runs: runs,
            is_wicket: isWicket,
            event_type: finalEventType
        }]).select().single();

        if (eventErr) {
            console.error('RECORD_BALL_ERROR:', eventErr);
            alert(`Error recording ball: ${eventErr.message}`);
            return;
        }

        // 2. Refresh local events
        fetchMatchEvents(activeMatch.id);

        // 3. Handle Over Completion / Wicket
        if (isWicket) {
            setShowWicketModal(false);
            setStrikerId('');
        }

        const isLegalBall = extraType !== 'wide' && extraType !== 'no_ball';
        const currentBalls = Math.round(((currentInnings?.overs || 0) % 1) * 10);
        if (isLegalBall && currentBalls === 5) {
            alert('Over Completed! Please select a NEW bowler.');
            setPreviousBowlerId(bowlerId);
            setBowlerId('');
        }
    };

    const handleUndo = async () => {
        if (!currentInnings || !activeMatch) return;
        
        // 1. Confirm with user
        if (!confirm('🚨 Are you sure you want to UNDO the last ball? This action will reverse all statistics recorded for the last delivery.')) return;

        try {
            setLoading(true);

            // 2. Call the Atomic Undo RPC
            const { data, error } = await supabase.rpc('undo_last_ball', {
                p_match_id: activeMatch.id,
                p_innings_id: currentInnings.id
            });

            if (error) {
                console.error('UNDO_RPC_ERROR:', error);
                alert(`Error during undo: ${error.message}`);
                return;
            }

            if (data && data.success) {
                // 3. Success! Restore the striker and bowler selection
                // This is crucial if a wicket fell or a bowler was cleared after an over
                if (data.restored_striker) setStrikerId(data.restored_striker);
                if (data.restored_bowler) setBowlerId(data.restored_bowler);

                // 4. Refresh Match Events to update UI
                await fetchMatchEvents(activeMatch.id);

                // 5. Refresh current innings state to reflect reverted score/wickets/overs
                const { data: refreshedInn } = await supabase
                    .from('innings')
                    .select('*')
                    .eq('id', currentInnings.id)
                    .single();
                
                if (refreshedInn) setCurrentInnings(refreshedInn);

                // 6. Refresh tournament stats for consistency
                fetchTournamentStats();
                
                alert('✅ Last ball undone successfully. Statistics reverted.');
            } else {
                alert(`⚠️ ${data?.message || 'Failed to undo last ball.'}`);
            }
        } catch (err: any) {
            console.error('HANDLE_UNDO_CRITICAL_ERROR:', err);
            alert(`A critical error occurred: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const endInnings = async () => {
        if (!activeMatch || !currentInnings) {
            alert("Error: Match data not loaded correctly.");
            return;
        }

        if (!confirm('Are you sure you want to end this innings?')) return;

        try {
            if (currentInnings.innings_number === 1) {
                setFirstInningsRuns(currentInnings.runs || 0);

                // 1. Mark current innings as completed
                const { error: updateErr } = await supabase
                    .from('innings')
                    .update({ is_completed: true })
                    .eq('id', currentInnings.id);

                if (updateErr) {
                    console.error('FINISH_INN1_ERROR:', updateErr);
                    alert(`Database Error finishing innings: ${updateErr.message}`);
                    return;
                }

                // 2. Insert 2nd innings
                const { data: inn2, error: insertErr } = await supabase.from('innings').insert([{
                    match_id: activeMatch.id,
                    innings_number: 2,
                    batting_team_id: currentInnings.bowling_team_id,
                    bowling_team_id: currentInnings.batting_team_id,
                    runs: 0,
                    wickets: 0,
                    overs: 0.0
                }]).select().single();

                if (insertErr || !inn2) {
                    alert('Error creating second innings');
                } else {
                    setCurrentInnings(inn2);
                    setStrikerId('');
                    setBowlerId('');
                    setPreviousBowlerId('');
                    alert("First innings completed! Ready for second innings.");
                }
            } else {
                // ... logic for match completion
                const { data: inn1, error: e1 } = await supabase.from('innings').select('runs').eq('match_id', activeMatch.id).eq('innings_number', 1).single();
                const { data: inn2, error: e2 } = await supabase.from('innings').select('runs').eq('match_id', activeMatch.id).eq('innings_number', 2).single();

                if (e1 || e2) {
                    alert("Error fetching innings data to calculate winner.");
                    return;
                }

                let matchWinnerId = null;
                let resultMessage = 'Match Completed!';

                if (inn1 && inn2) {
                    if (inn2.runs > inn1.runs) {
                        matchWinnerId = currentInnings.batting_team_id;
                        resultMessage = `🏆 ${getTeamName(matchWinnerId)} won by ${10 - (currentInnings.wickets || 0)} wickets!`;
                    } else if (inn1.runs > inn2.runs) {
                        matchWinnerId = currentInnings.bowling_team_id;
                        resultMessage = `🏆 ${getTeamName(matchWinnerId)} won by ${inn1.runs - inn2.runs} runs!`;
                    } else {
                        resultMessage = "🤝 Match Tied!";
                    }
                }

                // Update Match Status
                const { error: matchErr } = await supabase.from('matches').update({
                    status: 'completed',
                    winner_team_id: matchWinnerId,
                    result_message: resultMessage
                }).eq('id', activeMatch.id);

                if (matchErr) {
                    alert(`Error finalizing match: ${matchErr.message}`);
                    return;
                }

                // Mark 2nd innings as completed
                await supabase.from('innings').update({ is_completed: true }).eq('id', currentInnings.id);

                alert(resultMessage);
                await Promise.all([
                    fetchMatches(),
                    fetchTournamentStats()
                ]);
                setView('matches');
            }
        } catch (err: any) {
            console.error('END_INNINGS_CRITICAL_ERROR:', err);
            alert(`A critical error occurred: ${err.message}`);
        }
    };

    const downloadReport = async (match: any) => {
        const { data: stats } = await supabase.from('player_match_stats').select('*, players(*)').eq('match_id', match.id);
        const { data: teamA } = await supabase.from('teams').select('name').eq('id', match.team1_id).single();
        const { data: teamB } = await supabase.from('teams').select('name').eq('id', match.team2_id).single();
        const { data: tossWinner } = await supabase.from('teams').select('name').eq('id', match.toss_winner_id).single();
        const { data: matchWinner } = await supabase.from('teams').select('name').eq('id', match.winner_team_id).single();

        if (!stats) return;

        let csv = 'Team Name,Player Name,Runs Scored,Wickets Taken,Overs Bowled,Batting Order,Bowling Order,Toss Winner,Toss Decision,Match Winner\n';

        stats.forEach((s: any) => {
            const teamName = s.team_id === match.team1_id ? teamA?.name : teamB?.name;
            csv += `${teamName},${s.players?.first_name} ${s.players?.last_name},${s.runs_scored},${s.wickets_taken},${s.overs_bowled},${s.batting_order || ''},${s.bowling_order || ''},${tossWinner?.name || ''},${match.toss_decision || ''},${matchWinner?.name || ''}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Match_Report_${match.match_name.replace(/\s+/g, '_')}.csv`;
        a.click();
    };

    // --- RENDERERS ---

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity className="rotate" size={40} color="var(--primary)" />
        </div>
    );

    return (
        <main style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
            <div className="container-responsive" style={{ padding: '40px 20px', maxWidth: '1400px', margin: '0 auto' }}>

                {/* Header Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 950 }}>
                            {view === 'matches' && <>Tournament <span style={{ color: 'var(--primary)' }}>Center</span></>}
                            {view === 'create' && <>Setup <span style={{ color: 'var(--primary)' }}>Match</span></>}
                            {view === 'squad' && <>Select <span style={{ color: 'var(--primary)' }}>Playing XI</span></>}
                            {view === 'toss' && <>Match <span style={{ color: 'var(--primary)' }}>Toss</span></>}
                            {view === 'scoring' && <>Live <span style={{ color: 'var(--primary)' }}>Scoring Console</span></>}
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Manage tournament matches and real-time scores</p>
                    </div>
                    {view !== 'matches' && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <a href="/scoreboard" target="_blank" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 255, 128, 0.1)', borderColor: '#00ff80', color: '#00ff80', textDecoration: 'none', fontSize: '0.8rem' }}>
                                <Zap size={18} /> LIVE PUBLIC LINK
                            </a>
                            <button onClick={fetchTournamentStats} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <RefreshCw size={18} /> REFRESH
                            </button>
                            <button onClick={() => setView('matches')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ChevronLeft size={18} /> EXIT CONSOLE
                            </button>
                        </div>
                    )}
                </div>

                {/* Top Statistics Bar */}
                {view === 'matches' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px' }}>
                        <div className="glass" style={{ padding: '20px', borderRadius: '20px', textAlign: 'center' }}>
                            <Trophy size={24} color="var(--primary)" style={{ marginBottom: '10px' }} />
                            <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)' }}>BEST BATSMAN</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>
                                {tournamentStats[0]?.total_runs > 0 ? `${tournamentStats[0].first_name} (${tournamentStats[0].total_runs} Runs)` : '---'}
                            </div>
                        </div>
                        <div className="glass" style={{ padding: '20px', borderRadius: '20px', textAlign: 'center', border: '1px solid rgba(0, 255, 128, 0.2)' }}>
                            <Target size={24} color="#00ff80" style={{ marginBottom: '10px' }} />
                            <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>BEST BOWLER</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#00ff80' }}>
                                {(() => {
                                    const best = [...tournamentStats].sort((a, b) => b.total_wickets - a.total_wickets)[0];
                                    return best && best.total_wickets > 0 ? `${best.first_name} (${best.total_wickets} Wkts)` : '---';
                                })()}
                            </div>
                        </div>
                        <div className="glass" style={{ padding: '20px', borderRadius: '20px', textAlign: 'center', border: '1px solid var(--primary)' }}>
                            <Zap size={24} color="#ffd700" style={{ marginBottom: '10px' }} />
                            <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>PLAYER OF TOURNAMENT</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary)' }}>
                                {(() => {
                                    const best = [...tournamentStats].sort((a, b) => (b.pot_score || 0) - (a.pot_score || 0))[0];
                                    return best && best.pot_score > 0 ? `${best.first_name}` : '---';
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {view === 'matches' && (
                        <motion.div key="matches" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginBottom: '20px' }}>
                                <a href="/scoreboard" target="_blank" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 255, 128, 0.1)', borderColor: '#00ff80', color: '#00ff80', textDecoration: 'none', fontSize: '0.8rem', padding: '0 20px' }}>
                                    <Zap size={18} /> LIVE PUBLIC LINK
                                </a>
                                <button onClick={() => setView('stats')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '15px 30px' }}>
                                    <Trophy size={20} /> FULL STATISTICS
                                </button>
                                <button onClick={() => setView('create')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '15px 30px' }}>
                                    <Plus size={20} /> CREATE MATCH
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '25px' }}>
                                {matches.map(m => (
                                    <div key={m.id} className="glass" style={{ padding: '30px', borderRadius: '25px', border: '1px solid var(--border)', position: 'relative' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                            <div>
                                                <div style={{ color: 'var(--primary)', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>{m.match_type}</div>
                                                <h3 style={{ fontSize: '1.4rem', fontWeight: 900, marginTop: '5px' }}>{m.match_name}</h3>
                                            </div>
                                            <div style={{ padding: '6px 12px', borderRadius: '8px', background: m.status === 'live' ? 'rgba(0, 255, 128, 0.1)' : 'rgba(255,255,255,0.05)', color: m.status === 'live' ? '#00ff80' : 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 900 }}>
                                                {m.status.toUpperCase()}
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '20px', margin: '20px 0' }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{m.team1?.name || 'TBD'}</div>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-muted)' }}>VS</div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{m.team2?.name || 'TBD'}</div>
                                            </div>
                                        </div>

                                        {m.status === 'completed' && (
                                            <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(0, 255, 128, 0.05)', borderRadius: '12px', border: '1px solid rgba(0, 255, 128, 0.2)', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.65rem', color: '#00ff80', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>Match Result</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#fff' }}>
                                                    {m.winner_team_id ? `${getTeamName(m.winner_team_id)} WON THE MATCH` : 'MATCH TIED'}
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button onClick={() => handleContinueMatch(m)} className="btn-primary" style={{ flex: 1, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <Activity size={16} /> {m.status === 'live' ? 'CONTINUE' : 'CONTINUE'}
                                            </button>
                                            <button onClick={() => downloadReport(m)} className="btn-secondary" style={{ flex: 1, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid var(--primary)', color: 'var(--primary)' }}>
                                                <Download size={16} /> REPORT
                                            </button>
                                            <button
                                                onClick={() => handleDeleteMatch(m.id)}
                                                className="btn-secondary"
                                                style={{ width: '40px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                title="Emergency Delete Match"
                                            >
                                                <Trash2 size={16} color="#ff4b4b" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {view === 'stats' && (
                        <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <div className="glass" style={{ padding: '40px', borderRadius: '30px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                                    <h2 style={{ fontWeight: 950 }}>TOURNAMENT <span style={{ color: 'var(--primary)' }}>LEADERBOARD</span></h2>
                                    <button onClick={() => setView('matches')} className="btn-secondary">BACK TO MATCHES</button>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left' }}>
                                                <th style={{ padding: '20px' }}>PLAYER</th>
                                                <th style={{ padding: '20px' }}>ROLE</th>
                                                <th style={{ padding: '20px' }}>RUNS</th>
                                                <th style={{ padding: '20px' }}>WICKETS</th>
                                                <th style={{ padding: '20px' }}>POT SCORE</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tournamentStats.map((s: any) => (
                                                <tr key={s.player_id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#222', overflow: 'hidden' }}>
                                                            <img src={fixPhotoUrl(s.photo_url, s.first_name)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.first_name}`; }} />
                                                        </div>
                                                        <span style={{ fontWeight: 800 }}>{s.first_name} {s.last_name}</span>
                                                    </td>
                                                    <td style={{ padding: '15px 20px', color: 'var(--text-muted)' }}>{s.role}</td>
                                                    <td style={{ padding: '15px 20px', fontWeight: 900 }}>{s.total_runs}</td>
                                                    <td style={{ padding: '15px 20px', fontWeight: 900, color: '#00ff80' }}>{s.total_wickets}</td>
                                                    <td style={{ padding: '15px 20px', fontWeight: 900, color: 'var(--primary)' }}>{Math.round(s.pot_score)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {view === 'create' && (
                        <motion.div key="create" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                            <div className="glass" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px', borderRadius: '30px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '25px' }}>
                                    <div>
                                        <label style={labelStyle}>MATCH NAME</label>
                                        <input style={inputStyle} placeholder="e.g. League Match 1" value={formData.match_name} onChange={e => setFormData({ ...formData, match_name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>MATCH TYPE</label>
                                        <select style={inputStyle} value={formData.match_type} onChange={e => setFormData({ ...formData, match_type: e.target.value })}>
                                            <option>League Match</option>
                                            <option>Quarter Final</option>
                                            <option>Semi Final</option>
                                            <option>Final</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ marginBottom: '25px' }}>
                                    <label style={labelStyle}>OVERS PER INNINGS</label>
                                    <select style={inputStyle} value={formData.max_overs} onChange={e => setFormData({ ...formData, max_overs: e.target.value })}>
                                        <option value="6">6 Overs</option>
                                        <option value="8">8 Overs</option>
                                        <option value="10">10 Overs</option>
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '25px' }}>
                                    <div>
                                        <label style={labelStyle}>TEAM 1</label>
                                        <select style={inputStyle} value={formData.team1_id} onChange={e => setFormData({ ...formData, team1_id: e.target.value })}>
                                            <option value="" style={optionStyle}>Select Team</option>
                                            {teams.map(t => <option key={t.id} value={t.id} style={optionStyle}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>TEAM 2</label>
                                        <select style={inputStyle} value={formData.team2_id} onChange={e => setFormData({ ...formData, team2_id: e.target.value })}>
                                            <option value="" style={optionStyle}>Select Team</option>
                                            {teams.map(t => <option key={t.id} value={t.id} style={optionStyle}>{t.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <button onClick={handleCreateMatch} className="btn-primary" style={{ width: '100%', padding: '18px', fontSize: '1.1rem', fontWeight: 900 }}>
                                    INITIALIZE MATCH
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {view === 'squad' && (
                        <motion.div key="squad" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
                                {/* TEAM A Squad Selector */}
                                <div className="glass" style={{ padding: '30px', borderRadius: '25px' }}>
                                    <h3 style={{ marginBottom: '20px', fontWeight: 900, textTransform: 'uppercase' }}>
                                        {getTeamName(activeMatch?.team1_id)} ROSTER ({selectedSquadA.length})
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto', paddingRight: '10px' }}>
                                        {teamAPlayers.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No players found for this team.</div>}
                                        {teamAPlayers.map(p => (
                                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: selectedSquadA.includes(p.id) ? 'rgba(0, 255, 128, 0.1)' : 'rgba(255,255,255,0.03)', borderRadius: '15px', border: '1px solid', borderColor: selectedSquadA.includes(p.id) ? '#00ff80' : 'var(--border)', cursor: 'pointer' }}>
                                                <input type="checkbox" style={{ display: 'none' }} checked={selectedSquadA.includes(p.id)} onChange={e => {
                                                    if (e.target.checked) setSelectedSquadA([...selectedSquadA, p.id]);
                                                    else setSelectedSquadA(selectedSquadA.filter(id => id !== p.id));
                                                }} />
                                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#222', overflow: 'hidden' }}>
                                                    <img
                                                        src={fixPhotoUrl(p.photo_url, p.first_name)}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        alt=""
                                                        referrerPolicy="no-referrer"
                                                        onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`; }}
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 800 }}>{p.first_name} {p.last_name}</div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{p.role}</div>
                                                </div>
                                                {selectedSquadA.includes(p.id) && <UserCheck size={20} color="#00ff80" />}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                {/* TEAM B Squad Selector */}
                                <div className="glass" style={{ padding: '30px', borderRadius: '25px' }}>
                                    <h3 style={{ marginBottom: '20px', fontWeight: 900, textTransform: 'uppercase' }}>
                                        {getTeamName(activeMatch?.team2_id)} ROSTER ({selectedSquadB.length})
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto', paddingRight: '10px' }}>
                                        {teamBPlayers.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No players found for this team.</div>}
                                        {teamBPlayers.map(p => (
                                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: selectedSquadB.includes(p.id) ? 'rgba(0, 255, 128, 0.1)' : 'rgba(255,255,255,0.03)', borderRadius: '15px', border: '1px solid', borderColor: selectedSquadB.includes(p.id) ? '#00ff80' : 'var(--border)', cursor: 'pointer' }}>
                                                <input type="checkbox" style={{ display: 'none' }} checked={selectedSquadB.includes(p.id)} onChange={e => {
                                                    if (e.target.checked) setSelectedSquadB([...selectedSquadB, p.id]);
                                                    else setSelectedSquadB(selectedSquadB.filter(id => id !== p.id));
                                                }} />
                                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#222', overflow: 'hidden' }}>
                                                    <img
                                                        src={fixPhotoUrl(p.photo_url, p.first_name)}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        alt=""
                                                        referrerPolicy="no-referrer"
                                                        onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.first_name}`; }}
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 800 }}>{p.first_name} {p.last_name}</div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{p.role}</div>
                                                </div>
                                                {selectedSquadB.includes(p.id) && <UserCheck size={20} color="#00ff80" />}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleSaveSquad} className="btn-primary" style={{ width: '100%', padding: '20px', fontWeight: 950 }}>
                                SAVE SQUADS & PROCEED TO TOSS
                            </button>
                        </motion.div>
                    )}

                    {view === 'toss' && (
                        <motion.div key="toss" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                            <div className="glass" style={{ maxWidth: '600px', margin: '0 auto', padding: '50px', borderRadius: '35px', textAlign: 'center' }}>
                                <Trophy size={60} color="var(--primary)" style={{ marginBottom: '30px' }} />
                                <h2 style={{ fontSize: '1.8rem', fontWeight: 950, marginBottom: '40px' }}>Toss Verification</h2>

                                <div style={{ marginBottom: '35px' }}>
                                    <label style={labelStyle}>WHO WON THE TOSS?</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                        <button
                                            onClick={() => setTossData({ ...tossData, toss_winner_id: activeMatch.team1_id })}
                                            className={tossData.toss_winner_id === activeMatch.team1_id ? 'btn-primary' : 'btn-secondary'}
                                            style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 900 }}
                                        >
                                            {getTeamName(activeMatch.team1_id)}
                                        </button>
                                        <button
                                            onClick={() => setTossData({ ...tossData, toss_winner_id: activeMatch.team2_id })}
                                            className={tossData.toss_winner_id === activeMatch.team2_id ? 'btn-primary' : 'btn-secondary'}
                                            style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 900 }}
                                        >
                                            {getTeamName(activeMatch.team2_id)}
                                        </button>
                                    </div>
                                </div>

                                {tossData.toss_winner_id && (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '40px' }}>
                                        <label style={labelStyle}>{getTeamName(tossData.toss_winner_id)} CHOSE TO:</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                            <button
                                                onClick={() => setTossData({ ...tossData, toss_decision: 'Batting' })}
                                                className={tossData.toss_decision === 'Batting' ? 'btn-primary' : 'btn-secondary'}
                                                style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 900 }}
                                            >
                                                BAT
                                            </button>
                                            <button
                                                onClick={() => setTossData({ ...tossData, toss_decision: 'Bowling' })}
                                                className={tossData.toss_decision === 'Bowling' ? 'btn-primary' : 'btn-secondary'}
                                                style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 900 }}
                                            >
                                                BOWL
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                <button
                                    disabled={!tossData.toss_winner_id || !tossData.toss_decision}
                                    onClick={handleSaveToss}
                                    className="btn-primary"
                                    style={{ width: '100%', padding: '20px', fontSize: '1.2rem', fontWeight: 950, boxShadow: tossData.toss_decision ? '0 0 30px var(--primary-glow)' : 'none', opacity: (tossData.toss_winner_id && tossData.toss_decision) ? 1 : 0.5 }}
                                >
                                    START LIVE SCORING
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {view === 'scoring' && currentInnings && (
                        <motion.div key="scoring" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            {/* Team Switcher */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', maxWidth: '800px', margin: '0 auto 20px auto' }}>
                                <button
                                    onClick={() => setScoringTab('team_a')}
                                    className={scoringTab === 'team_a' ? 'btn-primary' : 'btn-secondary'}
                                    style={{ padding: '15px 5px', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}
                                >
                                    {getTeamName(activeMatch?.team1_id)}
                                </button>
                                <button
                                    onClick={() => setScoringTab('team_b')}
                                    className={scoringTab === 'team_b' ? 'btn-primary' : 'btn-secondary'}
                                    style={{ padding: '15px 5px', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}
                                >
                                    {getTeamName(activeMatch?.team2_id)}
                                </button>
                                <button
                                    onClick={() => setScoringTab('live')}
                                    disabled={activeMatch.status === 'completed'}
                                    className={scoringTab === 'live' ? 'btn-primary' : 'btn-secondary'}
                                    style={{ padding: '15px 5px', fontSize: '0.75rem', fontWeight: 900, opacity: activeMatch.status === 'completed' ? 0.3 : 1 }}
                                >
                                    LIVE SCORING
                                </button>
                            </div>

                            {scoringTab === 'live' && (
                                <div className="glass shadow-premium" style={{ padding: '30px', borderRadius: '35px', maxWidth: '800px', margin: '0 auto' }}>
                                    {/* Score Indicator */}
                                    <div className="mobile-score-container" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '30px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '25px' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>{getTeamName(currentInnings?.batting_team_id)}</div>
                                            <div className="score-text" style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', fontWeight: 950, lineHeight: 1 }}>
                                                {currentInnings?.runs || 0} - {currentInnings?.wickets || 0}
                                            </div>
                                        </div>
                                        <div style={{ width: '2px', height: '60px', background: 'var(--border)', margin: '0 15px' }} />
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>OVERS</div>
                                            <div style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', fontWeight: 950 }}>
                                                {(currentInnings?.overs || 0).toFixed(1)} <span style={{ fontSize: 'min(1rem, 3vw)', color: 'var(--text-muted)' }}>/ {activeMatch?.max_overs || 8}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {currentInnings.innings_number === 2 && firstInningsRuns !== null && (
                                        <div style={{ textAlign: 'center', marginBottom: '20px', padding: '15px', background: 'rgba(0,255,128,0.1)', borderRadius: '25px', border: '1px solid rgba(0,255,128,0.2)' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.7rem', color: 'rgba(0,255,128,0.7)', fontWeight: 900, textTransform: 'uppercase' }}>Runs Required</div>
                                                    <div style={{ color: '#00ff80', fontWeight: 950, fontSize: '2rem' }}>
                                                        {Math.max(0, (firstInningsRuns + 1) - (currentInnings.runs || 0))}
                                                    </div>
                                                </div>
                                                <div style={{ borderLeft: '1px solid rgba(0,255,128,0.2)' }}>
                                                    <div style={{ fontSize: '0.7rem', color: 'rgba(0,255,128,0.7)', fontWeight: 900, textTransform: 'uppercase' }}>Balls Remaining</div>
                                                    <div style={{ color: '#00ff80', fontWeight: 950, fontSize: '2rem' }}>
                                                        {(() => {
                                                            const totalBalls = (activeMatch?.max_overs || 8) * 6;
                                                            const currentOvers = currentInnings.overs || 0;
                                                            const ballsBowled = Math.floor(currentOvers) * 6 + Math.round((currentOvers - Math.floor(currentOvers)) * 10);
                                                            return Math.max(0, totalBalls - ballsBowled);
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: '10px', fontSize: '0.85rem', fontWeight: 800, color: '#00ff80' }}>
                                                TARGET: {firstInningsRuns + 1}
                                            </div>
                                        </div>
                                    )}

                                    {/* Striker & Bowler Selection */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                                        <div>
                                            <label style={labelStyle}>STRIKER</label>
                                            <select style={inputStyle} value={strikerId} onChange={e => setStrikerId(e.target.value)}>
                                                <option value="">Select Striker</option>
                                                {(() => {
                                                    const battingTeamId = currentInnings.batting_team_id;
                                                    const players = battingTeamId === activeMatch.team1_id ? matchPlayersA : matchPlayersB;
                                                    // Filter out players who are already out in this innings
                                                    const outPlayerIds = matchEvents
                                                        .filter(e => e.innings_id === currentInnings.id && e.is_wicket)
                                                        .map(e => e.batsman_id);

                                                    return players.filter(p => !outPlayerIds.includes(p.id)).map(p => (
                                                        <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                                                    ));
                                                })()}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>CURRENT BOWLER</label>
                                            <select style={inputStyle} value={bowlerId} onChange={e => setBowlerId(e.target.value)}>
                                                <option value="">Select Bowler</option>
                                                {(() => {
                                                    const bowlingTeamId = currentInnings.bowling_team_id;
                                                    const players = bowlingTeamId === activeMatch.team1_id ? matchPlayersA : matchPlayersB;

                                                    return players.map(p => (
                                                        <option key={p.id} value={p.id} disabled={p.id === previousBowlerId}>
                                                            {p.first_name} {p.last_name} {p.id === previousBowlerId ? '(Cannot bowl back-to-back overs)' : ''}
                                                        </option>
                                                    ));
                                                })()}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Run Buttons */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
                                        {[0, 4, 6].map(runs => (
                                            <button
                                                key={runs}
                                                onClick={() => recordBall(runs)}
                                                className="btn-secondary"
                                                style={{ padding: '30px 0', fontSize: '2.5rem', fontWeight: 950, borderRadius: '25px', background: runs === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,215,0,0.1)', borderColor: runs === 0 ? 'var(--border)' : 'var(--primary)' }}
                                            >
                                                {runs}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Extras & Actions */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                                        <button onClick={() => recordBall(0, false, 'wide')} className="btn-secondary" style={{ padding: '20px', fontSize: '1.1rem', fontWeight: 900, borderRadius: '20px', color: '#ffd700', borderColor: '#ffd700' }}>WIDE</button>
                                        <button onClick={() => recordBall(0, false, 'no_ball')} className="btn-secondary" style={{ padding: '20px', fontSize: '1.1rem', fontWeight: 900, borderRadius: '20px', color: '#ffd700', borderColor: '#ffd700' }}>NO BALL</button>
                                    </div>

                                    <button
                                        onClick={() => recordBall(0, true)}
                                        className="btn-secondary"
                                        style={{ width: '100%', padding: '25px', fontSize: '1.5rem', fontWeight: 950, borderRadius: '25px', color: '#ff4b4b', borderColor: '#ff4b4b', marginBottom: '20px', background: 'rgba(255, 75, 75, 0.1)' }}
                                    >
                                        WICKET
                                    </button>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                        <button
                                            onClick={handleUndo}
                                            disabled={loading || matchEvents.filter(e => e.innings_id === currentInnings.id).length === 0}
                                            className="btn-secondary"
                                            style={{ 
                                                padding: '15px', 
                                                fontSize: '0.8rem', 
                                                fontWeight: 900, 
                                                borderRadius: '15px', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center', 
                                                gap: '5px',
                                                opacity: (loading || matchEvents.filter(e => e.innings_id === currentInnings.id).length === 0) ? 0.4 : 1,
                                                cursor: (loading || matchEvents.filter(e => e.innings_id === currentInnings.id).length === 0) ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            {loading ? <Activity size={14} className="rotate" /> : <RefreshCw size={14} />} UNDO
                                        </button>
                                        <button
                                            onClick={endInnings}
                                            className="btn-secondary"
                                            style={{ padding: '15px', fontSize: '0.8rem', fontWeight: 900, borderRadius: '15px', borderColor: '#ff4b4b', color: '#ff4b4b' }}
                                        >
                                            END INNINGS
                                        </button>
                                        <button
                                            onClick={() => {
                                                const overs = currentInnings.overs || 0;
                                                const balls = Math.round((overs - Math.floor(overs)) * 10);
                                                if (balls !== 0) {
                                                    if (confirm('Over is not complete. Manual End Over?')) {
                                                        const nextOver = Math.ceil(overs);
                                                        supabase.from('innings').update({ overs: nextOver }).eq('id', currentInnings.id).then(() => {
                                                            alert('New over! Please select next bowler.');
                                                            setBowlerId('');
                                                            init();
                                                        });
                                                    }
                                                } else {
                                                    alert('Over completed! Please select a NEW bowler.');
                                                    setPreviousBowlerId(bowlerId);
                                                    setBowlerId('');
                                                }
                                            }}
                                            className="btn-secondary"
                                            style={{ padding: '15px', fontSize: '0.8rem', fontWeight: 900, borderRadius: '15px', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                                        >
                                            END OVER
                                        </button>
                                    </div>
                                </div>
                            )}

                            {(scoringTab === 'team_a' || scoringTab === 'team_b') && activeMatch && (
                                <MatchScorecard matchId={activeMatch.id} />
                            )}
                        </motion.div>
                    )}

                    {/* Wicket Modal */}
                    {showWicketModal && (
                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
                            <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '40px', borderRadius: '30px' }}>
                                <h2 style={{ marginBottom: '30px', fontWeight: 950 }}>WICKET DETAILS</h2>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={labelStyle}>DISMISSED BATSMAN</label>
                                    <div style={inputStyle}>
                                        {getTeamName(currentInnings.batting_team_id === activeMatch.team1_id ? activeMatch.team1_id : activeMatch.team2_id)}: {
                                            (matchPlayersA.find(p => p.id === strikerId) || matchPlayersB.find(p => p.id === strikerId))?.first_name
                                        } {
                                            (matchPlayersA.find(p => p.id === strikerId) || matchPlayersB.find(p => p.id === strikerId))?.last_name
                                        } (Striker)
                                    </div>
                                </div>
                                <div style={{ marginBottom: '30px' }}>
                                    <label style={labelStyle}>WICKET TYPE</label>
                                    <select style={inputStyle} value={selectedWicketType} onChange={(e: any) => setSelectedWicketType(e.target.value)}>
                                        <option>Bowled</option>
                                        <option>Caught</option>
                                        <option>Stumped</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <button onClick={() => setShowWicketModal(false)} className="btn-secondary" style={{ flex: 1 }}>CANCEL</button>
                                    <button onClick={() => recordBall(0, true)} className="btn-primary" style={{ flex: 2 }}>CONFIRM WICKET</button>
                                </div>
                            </div>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            <style jsx>{`
                .btn-primary { background: var(--primary); color: #000; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 800; cursor: pointer; transition: all 0.3s ease; }
                .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 15px var(--primary-glow); }
                .btn-secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid var(--border); padding: 12px 20px; border-radius: 12px; font-weight: 800; cursor: pointer; transition: all 0.3s ease; }
                .btn-secondary:hover { background: rgba(255,255,255,0.1); }
                .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); border: 1px solid var(--border); }
                .rotate { animation: rotate 2s linear infinite; }
                @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                @media (max-width: 600px) {
                    .mobile-score-container { padding: 15px !important; }
                    .score-text { font-size: 3rem !important; }
                    .btn-secondary { padding: 15px !important; font-size: 1.5rem !important; }
                }
            `}</style>
        </main>
    );
}

const labelStyle = { fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-muted)', marginBottom: '10px', display: 'block', letterSpacing: '1px' };
const inputStyle = { width: '100%', padding: '15px', background: '#111', border: '1px solid var(--border)', borderRadius: '15px', color: '#fff', outline: 'none', fontSize: '1rem', fontWeight: 600, appearance: 'none' as const };
const optionStyle = { background: '#111', color: '#fff', padding: '10px' };
