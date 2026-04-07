'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Trophy, TrendingUp, Wallet } from 'lucide-react';

export default function Leaderboard({ selectedTeamId }: { selectedTeamId?: string }) {
    const [stats, setStats] = useState<any>({
        mostExpensive: null,
        highestSpending: null,
        highestRemaining: null,
        selectedTeamStats: null
    });

    useEffect(() => {
        fetchStats();
        const sub = supabase.channel('leaderboard')
            .on('postgres_changes' as any, { event: '*', table: 'teams' }, fetchStats)
            .on('postgres_changes' as any, { event: '*', table: 'players' }, fetchStats)
            .on('postgres_changes' as any, { event: '*', table: 'auction_state' }, fetchStats)
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [selectedTeamId]);

    const fetchStats = async () => {
        const { data: teams } = await supabase.from('teams').select('*');
        const { data: topPlayer } = await supabase.from('players').select('*').eq('auction_status', 'sold').order('sold_price', { ascending: false }).limit(1).single();

        if (teams && teams.length > 0) {
            const highestSpending = [...teams].sort((a, b) => (b.total_budget - b.remaining_budget) - (a.total_budget - a.remaining_budget))[0];
            const highestRemaining = [...teams].sort((a, b) => b.remaining_budget - a.remaining_budget)[0];
            const selectedTeam = selectedTeamId ? teams.find((t: any) => t.id === selectedTeamId) : null;

            setStats({
                mostExpensive: topPlayer,
                highestSpending,
                highestRemaining,
                selectedTeamStats: selectedTeam
            });
        }
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', margin: '40px 0' }}>
            {/* Most Expensive Overall */}
            <div className="glass" style={{ padding: '25px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ background: 'rgba(255, 215, 0, 0.1)', padding: '15px', borderRadius: '12px', display: 'flex' }}>
                    <Trophy color="var(--primary)" size={32} />
                </div>
                <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>MOST EXPENSIVE PLAYER</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{stats.mostExpensive ? `${stats.mostExpensive.first_name || stats.mostExpensive.name} ${stats.mostExpensive.last_name || ''}` : 'N/A'}</div>
                    <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
                        {stats.mostExpensive ? `${stats.mostExpensive.sold_price} Pushp` : '-'}
                    </div>
                </div>
            </div>

            {/* Spending Stat - Now dynamic based on selection */}
            <div className="glass" style={{ padding: '25px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ background: 'rgba(0, 75, 160, 0.1)', padding: '15px', borderRadius: '12px', display: 'flex' }}>
                    <TrendingUp color="var(--secondary)" size={32} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>TEAM SPENDING STATUS</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{stats.selectedTeamStats?.name || stats.highestSpending?.name || 'N/A'}</div>
                    <div style={{ color: 'var(--secondary)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Spent {(stats.selectedTeamStats || stats.highestSpending)?.total_budget - (stats.selectedTeamStats || stats.highestSpending)?.remaining_budget} Pushp</span>
                    </div>
                </div>
            </div>

            {/* Remaining Purse - Now dynamic based on selection */}
            <div className="glass" style={{ padding: '25px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '15px', borderRadius: '12px', display: 'flex' }}>
                    <Wallet color="#fff" size={32} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>PURSE REMAINING</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{stats.selectedTeamStats?.name || stats.highestRemaining?.name || 'N/A'}</div>
                    <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{(stats.selectedTeamStats || stats.highestRemaining)?.remaining_budget} Pushp</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
