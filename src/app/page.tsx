'use client';

import Link from 'next/link';
import { Trophy, Shield, Users, Zap, ArrowRight, Star, ExternalLink, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';

export default function HomePage() {
  return (
    <>
      <main style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
        {/* Hero Section */}
        <div className="container-responsive" style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
          {/* Animated Background */}
          <div style={{ position: 'absolute', inset: 0, opacity: 0.1, overflow: 'hidden' }}>
            <div style={{
              position: 'absolute',
              top: '20%',
              left: '10%',
              width: 'clamp(200px, 40vw, 300px)',
              height: 'clamp(200px, 40vw, 300px)',
              background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)',
              filter: 'blur(60px)',
              animation: 'float 8s ease-in-out infinite'
            }} />
            <div style={{
              position: 'absolute',
              bottom: '20%',
              right: '10%',
              width: 'clamp(250px, 50vw, 400px)',
              height: 'clamp(250px, 50vw, 400px)',
              background: 'radial-gradient(circle, #ff6b00 0%, transparent 70%)',
              filter: 'blur(80px)',
              animation: 'float 10s ease-in-out infinite reverse'
            }} />
          </div>

          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '900px', width: '100%' }}>
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1 }}
              style={{
                width: '100%',
                maxWidth: '430px',
                margin: '0 auto 40px',
                position: 'relative'
              }}
            >
              <img 
                src="/logo.png" 
                alt="Keshav Cup - 2026" 
                style={{
                  width: '100%',
                  height: 'auto',
                  filter: 'drop-shadow(0 0 40px rgba(255,215,0,0.15))'
                }}
              />
            </motion.div>
 
             {/* Title */}
             <motion.div
               initial={{ opacity: 0, y: 30 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.3, duration: 0.8 }}
             >
               <h1 className="text-responsive-h1" style={{
                 fontSize: 'clamp(2.5rem, 10vw, 5.5rem)',
                 fontWeight: 950,
                 marginBottom: '20px',
                 letterSpacing: '-2px',
                 lineHeight: 1.1
               }}>
                 <span className="title-gradient">Keshav Cup - 2026</span>
               </h1>
               <p style={{
                 fontSize: 'clamp(0.9rem, 1.5vw, 1.2rem)',
                 color: 'var(--text-muted)',
                 marginBottom: '10px',
                 fontWeight: 700,
                 letterSpacing: '5px'
               }}>
                 PREMIUM CRICKET AUCTION
               </p>
               <p style={{
                 fontSize: 'clamp(1rem, 2vw, 1.3rem)',
                 color: 'var(--primary)',
                 fontWeight: 900,
                 marginBottom: '40px',
                 letterSpacing: '1px'
               }}>
                 JAY SWAMINARAYAN
               </p>
             </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="flex-stack"
              style={{
                display: 'flex',
                gap: '15px',
                justifyContent: 'center',
                marginBottom: '60px'
              }}
            >
              <Link href="/login" className="btn-primary" style={{
                padding: '16px 32px',
                fontSize: '1rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                width: '240px'
              }}>
                <Users size={20} />
                CAPTAIN LOGIN
                <ArrowRight size={18} />
              </Link>

              <Link href="/register" className="btn-primary" style={{
                padding: '16px 32px',
                fontSize: '1rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                width: '240px',
                background: 'linear-gradient(135deg, #00c853, #1b5e20)',
                color: '#fff',
                boxShadow: '0 4px 15px rgba(0, 200, 83, 0.3)'
              }}>
                <UserPlus size={20} />
                REGISTRATION
              </Link>

              <Link href="/admin/login" className="btn-secondary" style={{
                padding: '16px 32px',
                fontSize: '1rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                border: '2px solid var(--primary)',
                width: '240px'
              }}>
                <Shield size={20} />
                ADMIN PORTAL
              </Link>
            </motion.div>

            {/* Features */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.8 }}
              className="grid-stack"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '15px',
                maxWidth: '800px',
                margin: '0 auto'
              }}
            >
              {[
                { icon: Zap, title: 'Real-Time', desc: 'Live WebSocket sync' },
                { icon: Shield, title: 'Keshav Cup', desc: 'Secure & Reliable' },
                { icon: Star, title: 'Compliant', desc: 'Atomic transactions' },
              ].map((feature, i) => (
                <div key={i} className="glass" style={{
                  padding: '20px',
                  borderRadius: '16px',
                  textAlign: 'center',
                  border: '1px solid rgba(255, 215, 0, 0.1)',
                  transition: 'all 0.3s ease'
                }}>
                  <feature.icon size={28} color="var(--primary)" style={{ marginBottom: '10px' }} />
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '5px' }}>{feature.title}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{feature.desc}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </main>
      <style jsx>{`
                @keyframes float {
                    0%, 100% { transform: translate(0, 0); }
                    50% { transform: translate(30px, -30px); }
                }
                .glass:hover {
                    transform: translateY(-5px);
                    border-color: var(--primary);
                }
            `}</style>
    </>
  );
}
