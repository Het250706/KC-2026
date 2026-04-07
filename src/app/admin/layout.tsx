'use client';

import { Zap } from 'lucide-react';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="admin-root" style={{ position: 'relative' }}>

            {children}
            <style jsx global>{`
                :root {
                
                    --primary: #FFD700;
                    --primary-glow: rgba(255, 215, 0, 0.4);
                    --border: rgba(255, 255, 255, 0.1);
                    --text-muted: #888;
                }
                body {
                    background: #000;
                    color: #fff;
                }
                .glass {
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(10px);
                    border: 1px solid var(--border);
                }
                .title-gradient {
                    background: linear-gradient(135deg, #fff 0%, var(--primary) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .btn-primary {
                    background: var(--primary);
                    color: #000;
                    border: none;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .btn-primary:hover {
                    box-shadow: 0 0 20px var(--primary-glow);
                    transform: translateY(-2px);
                }
                .btn-secondary {
                    background: transparent;
                    color: #fff;
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
            `}</style>
        </div>
    );
}
