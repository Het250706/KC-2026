'use client';

import Link from 'next/link';
import { LayoutDashboard, Zap, ScrollText, Shield, PieChart, Users, History as HistoryIcon, User as UserIcon, LogOut, Menu, X, Trophy, History, UserCheck, Trash2, Gavel, UserPlus, Shuffle, FileText, Download, Link as LinkIcon, FileSpreadsheet, ExternalLink, Settings, LayoutGrid, Home, Activity, Swords } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, role, loading } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScoreboardAuth, setIsScoreboardAuth] = useState(false);

    // 1. Identify Contexts
    const isLoginPage = pathname === '/login' || pathname === '/admin/login';
    const isScoreboardPage = pathname === '/scoreboard';
    const isLiveScorePage = pathname === '/live-score' || pathname.startsWith('/match/');
    const isPublicNavPage = isScoreboardPage || isLiveScorePage;

    const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/analytics') || pathname.startsWith('/teams') || pathname.startsWith('/history') || pathname === '/auction-history';
    const isCaptainRoute = pathname.startsWith('/captain');

    // Track scoreboard auth state for players
    useEffect(() => {
        if (typeof window !== 'undefined' && isScoreboardPage) {
            const checkAuth = () => {
                const auth = sessionStorage.getItem('kc_scoreboard_auth') === 'true';
                setIsScoreboardAuth(auth);
            };
            checkAuth();
            const interval = setInterval(checkAuth, 1000);
            return () => clearInterval(interval);
        }
    }, [isScoreboardPage]);

    const shouldShowNavbar = (() => {
        if (isLoginPage) return false;
        if (isScoreboardPage) return isScoreboardAuth;
        
        const canShowAdmin = user && role === 'admin' && (isAdminRoute || isPublicNavPage);
        const canShowCaptain = user && role === 'captain' && (isCaptainRoute || isPublicNavPage);
        const canShowPublicOther = isLiveScorePage && !user;

        return (canShowAdmin || canShowCaptain || canShowPublicOther);
    })();

    if (!shouldShowNavbar) return null;

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            if (typeof window !== 'undefined') {
                localStorage.clear();
                sessionStorage.clear();
            }
            window.location.replace('/');
        } catch (err) {
            window.location.replace('/');
        }
    };

    const getNavLinkStyle = (path: string) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: pathname === path ? 'var(--primary)' : 'var(--text-muted)',
        fontWeight: 600,
        transition: 'all 0.3s ease',
        fontSize: '0.85rem'
    });

    // --- RENDER HELPERS ---

    const AdminLinks = () => (
        <>
            <Link href="/admin/dashboard" style={getNavLinkStyle('/admin/dashboard')} onClick={() => setIsMenuOpen(false)}>
                <Shield size={18} /> <span>Admin Panel</span>
            </Link>
            <div className="mobile-only">
                <Link href="/teams" style={getNavLinkStyle('/teams')} onClick={() => setIsMenuOpen(false)}>
                    <Users size={18} /> <span>Team Squads</span>
                </Link>
                <Link href="/auction-history" style={getNavLinkStyle('/auction-history')} onClick={() => setIsMenuOpen(false)}>
                    <HistoryIcon size={18} /> <span>History</span>
                </Link>
            </div>

            <Link href="/admin/card-slots" style={getNavLinkStyle('/admin/card-slots')} onClick={() => setIsMenuOpen(false)}>
                <LayoutGrid size={18} /> <span>Slots</span>
            </Link>
            <Link href="/admin/card-turns" style={getNavLinkStyle('/admin/card-turns')} onClick={() => setIsMenuOpen(false)}>
                <Shuffle size={18} /> <span>Turns</span>
            </Link>
            <Link href="/admin/card-control" style={getNavLinkStyle('/admin/card-control')} onClick={() => setIsMenuOpen(false)}>
                <Activity size={18} /> <span>Card Control</span>
            </Link>
            <div className="mobile-only">
                <Link href="/auction/live-cards" style={getNavLinkStyle('/auction/live-cards')} onClick={() => setIsMenuOpen(false)}>
                    <Zap size={18} /> <span>Live Reveal</span>
                </Link>
            </div>
        </>
    );

    const CaptainLinks = () => (
        <>
            <Link href="/captain/dashboard" style={getNavLinkStyle('/captain/dashboard')} onClick={() => setIsMenuOpen(false)}>
                <LayoutDashboard size={18} /> <span>Dashboard</span>
            </Link>
        </>
    );

    const PublicLinks = () => (
        <>
            <Link href="/" style={getNavLinkStyle('/')} onClick={() => setIsMenuOpen(false)}>
                <span>Home</span>
            </Link>
            <Link href="/scoreboard" style={getNavLinkStyle('/scoreboard')} onClick={() => setIsMenuOpen(false)}>
                <span>Live Scoreboard</span>
            </Link>
            <Link href="/live-score" style={getNavLinkStyle('/live-score')} onClick={() => setIsMenuOpen(false)}>
                <span>Match Center</span>
            </Link>
        </>
    );

    // --- MAIN LAYOUTS ---

    const ScoreboardLinks = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {[
                { label: 'HOME', path: '/scoreboard', icon: <Home size={22} /> },
                { label: 'LIVE MATCH', path: '/scoreboard?view=live', icon: <Activity size={22} /> },
                { label: 'MATCH HISTORY', path: '/scoreboard?view=matches', icon: <Swords size={22} /> },
                { label: 'TEAM LINEUP', path: '/scoreboard?view=teams', icon: <Trophy size={22} /> },
                { label: 'FULL STATISTICS', path: '/scoreboard?view=stats', icon: <PieChart size={22} /> }
            ].map(item => {
                return (
                    <button 
                        key={item.label}
                        onClick={() => { 
                            if (item.path.includes('=')) {
                                const view = item.path.split('=')[1];
                                router.push(`/scoreboard?view=${view}`);
                            } else {
                                router.push('/scoreboard');
                            }
                            setIsMenuOpen(false); 
                        }} 
                        style={{ 
                            background: 'rgba(255,215,0,0.03)', 
                            border: '1px solid rgba(255,215,0,0.1)', 
                            padding: '18px 25px', 
                            borderRadius: '16px', 
                            color: '#fff', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '20px',
                            transition: 'all 0.3s ease',
                            width: '100%',
                            textAlign: 'left'
                        }}
                        className="hover-scale"
                    >
                        <span style={{ color: 'var(--primary)', filter: 'drop-shadow(0 0 5px rgba(255,215,0,0.4))' }}>{item.icon}</span>
                        <span style={{ fontWeight: 900, fontSize: '1.05rem', letterSpacing: '2px', textTransform: 'uppercase' }}>{item.label}</span>
                    </button>
                );
            })}
        </div>
    );

    // 1. SCOREBOARD SPECIAL LAYOUT (Logo Left, Burger Right)
    if (isScoreboardPage) {
        return (
            <nav className="glass" style={{ margin: '10px 15px', padding: '10px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: '10px', zIndex: 1000, border: '1px solid rgba(255, 215, 0, 0.3)' }}>
                {/* Logo on LEFT */}
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '15px', textDecoration: 'none' }}>
                    <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/logo.png" alt="Logo" style={{ width: '100%', height: 'auto', filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.5))' }} />
                    </div>
                    <span className="title-gradient" style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '1px' }}>KESHAV CUP - 2026</span>
                </Link>

                {/* Burger on RIGHT */}
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ color: 'var(--primary)', padding: '5px', background: 'none', border: 'none', cursor: 'pointer' }}>
                    {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
                </button>

                {/* Mobile Menu Overlay for Scoreboard (Strictly for match data) */}
                <AnimatePresence>
                    {isMenuOpen && (
                        <motion.div initial={{ opacity: 0, x: 300 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 300 }} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '320px', background: 'rgba(5,5,5,0.98)', backdropFilter: 'blur(30px)', padding: '40px 25px 25px', display: 'flex', flexDirection: 'column', gap: '25px', zIndex: 1001, boxShadow: '-20px 0 60px rgba(0,0,0,0.9)' }}>
                            {/* Premium Gradient Border (Left Side Only) */}
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px', background: 'linear-gradient(to bottom, transparent, var(--primary) 15%, var(--primary) 85%, transparent)' }} />
                            
                            {/* Header: Logo Icon and Close Button */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <div style={{ width: '55px', height: '55px', borderRadius: '50%', background: 'rgba(255,215,0,0.05)', border: '2px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', boxShadow: '0 0 20px rgba(255,215,0,0.2)' }}>
                                    <img src="/logo.png" alt="Logo" style={{ width: '100%', height: 'auto' }} />
                                </div>
                                <button 
                                    onClick={() => setIsMenuOpen(false)} 
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Menu Links */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
                                {[
                                    { label: 'HOME', path: '/scoreboard', icon: <Home size={20} /> },
                                    { label: 'LIVE MATCH', path: '/scoreboard?view=live', icon: <Activity size={20} /> },
                                    { label: 'MATCH HISTORY', path: '/scoreboard?view=matches', icon: <Swords size={20} /> },
                                    { label: 'TEAM LINEUP', path: '/scoreboard?view=teams', icon: <Trophy size={20} /> },
                                    { label: 'FULL STATISTICS', path: '/scoreboard?view=stats', icon: <PieChart size={20} /> }
                                ].map(item => {
                                    const isActive = pathname === '/scoreboard' && (
                                        (item.label === 'HOME' && !searchParams.get('view')) ||
                                        (item.path.includes('=') && searchParams.get('view') === item.path.split('=')[1])
                                    );

                                    return (
                                        <button 
                                            key={item.label}
                                            onClick={() => { 
                                                if (item.path.includes('=')) {
                                                    const view = item.path.split('=')[1];
                                                    router.push(`/scoreboard?view=${view}`);
                                                } else {
                                                    router.push('/scoreboard');
                                                }
                                                setIsMenuOpen(false); 
                                            }} 
                                            style={{ 
                                                background: isActive ? 'rgba(255,215,0,0.08)' : 'transparent', 
                                                border: isActive ? '1px solid var(--primary)' : '1px solid transparent', 
                                                padding: '16px 20px', 
                                                borderRadius: '16px', 
                                                color: isActive ? 'var(--primary)' : '#fff', 
                                                cursor: 'pointer', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '15px',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                textAlign: 'left'
                                            }}
                                            className="nav-btn-hover"
                                        >
                                            <span style={{ opacity: isActive ? 1 : 0.6 }}>{item.icon}</span>
                                            <span style={{ fontWeight: 950, fontSize: '0.9rem', letterSpacing: '2px', textTransform: 'uppercase' }}>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div style={{ flex: 1 }} />

                            {/* Status Footer Box */}
                            <div style={{ padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,215,0,0.1)', background: 'linear-gradient(to bottom, rgba(255,215,0,0.03), transparent)', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 950, color: 'var(--primary)', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: '8px' }}>KESHAV CUP 2026</div>
                                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' }}>REAL-TIME UPDATES ENABLED</div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>
        );
    }

    // 2. ADMIN/CAPTAIN STANDARD LAYOUT (Logo Left, Links/Menu Right)
    return (
        <nav className="glass" style={{ margin: '10px 15px', padding: '8px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: '10px', zIndex: 1000, border: '1px solid rgba(255, 215, 0, 0.15)' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src="/logo.png" alt="Logo" style={{ width: '100%', height: 'auto', filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.3))' }} />
                </div>
                <span className="title-gradient" style={{ fontSize: '1.2rem', fontWeight: 900 }}>KESHAV CUP</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="desktop-only" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                {role === 'admin' && <AdminLinks />}
                {role === 'captain' && <CaptainLinks />}
                {user ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '8px', paddingLeft: '18px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="nav-dropdown-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <UserIcon size={16} color="var(--primary)" />
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                                    {role === 'admin' ? 'ADMINISTRATION' : (user.user_metadata?.team_name || 'USER')}
                                </span>
                            </div>
                            
                            {/* Desktop Hamburger Dropdown for Admin */}
                            {role === 'admin' && (
                                <>
                                    <button 
                                        className="hamburger-trigger"
                                        style={{ 
                                            background: 'rgba(255,255,255,0.05)', 
                                            border: '1px solid rgba(255,255,255,0.1)', 
                                            color: '#fff', 
                                            padding: '8px', 
                                            borderRadius: '10px', 
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <Menu size={20} />
                                    </button>
                                    <div className="nav-dropdown-content" style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        paddingTop: '12px',
                                        zIndex: 100,
                                        display: 'none',
                                        flexDirection: 'column'
                                    }}>
                                        <div style={{
                                            background: '#0a0a0a',
                                            border: '1px solid rgba(255,215,0,0.2)',
                                            borderRadius: '15px',
                                            padding: '8px',
                                            minWidth: '180px',
                                            boxShadow: '0 15px 40px rgba(0,0,0,0.8)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '4px'
                                        }}>
                                            <Link href="/teams" style={{ ...getNavLinkStyle('/teams'), padding: '12px 15px', borderRadius: '10px' }} className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                                                <Users size={18} /> <span>Team Squads</span>
                                            </Link>
                                            <Link href="/auction-history" style={{ ...getNavLinkStyle('/auction-history'), padding: '12px 15px', borderRadius: '10px' }} className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                                                <HistoryIcon size={18} /> <span>History</span>
                                            </Link>
                                            <Link href="/auction/live-cards" style={{ ...getNavLinkStyle('/auction/live-cards'), padding: '12px 15px', borderRadius: '10px' }} className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                                                <Zap size={18} /> <span>Live Reveal</span>
                                            </Link>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 18px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', border: '1px solid rgba(255, 75, 75, 0.4)', color: '#ff4b4b' }}>
                            <LogOut size={18} />
                            <span>LOGOUT</span>
                        </button>
                    </div>
                ) : (
                    <Link href="/login" className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.8rem' }}>LOGIN</Link>
                )}
            </div>

            {/* Mobile Navigation Toggle */}
            <button className="mobile-only" onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ color: 'var(--primary)' }}>
                {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>

            {/* Mobile Menu Overlay for Standard Pages */}
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'rgba(0,0,0,0.98)', backdropFilter: 'blur(20px)', padding: '30px', marginTop: '10px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid var(--border)' }}>
                        {role === 'admin' && <AdminLinks />}
                        {role === 'captain' && <CaptainLinks />}
                        {!user && <PublicLinks />}
                        {user && (
                            <button onClick={handleLogout} className="btn-secondary" style={{ borderColor: '#ff4b4b', color: '#ff4b4b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                <LogOut size={18} /> LOGOUT
                            </button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
            <style jsx>{`
                .nav-dropdown-group:hover .nav-dropdown-content {
                    display: flex !important;
                }
                .dropdown-item:hover {
                    background: rgba(255,215,0,0.05) !important;
                    color: var(--primary) !important;
                }
                @media (max-width: 1024px) {
                    .desktop-only { display: none !important; }
                    .mobile-only { display: flex !important; flex-direction: column; gap: 20px; }
                }
                @media (min-width: 1025px) {
                    .mobile-only { display: none !important; }
                }
            `}</style>
        </nav>
    );
}
