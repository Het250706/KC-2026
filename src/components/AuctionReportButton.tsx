'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Download, Loader2, FileText } from 'lucide-react';

declare global {
    interface Window {
        jspdf: any;
    }
}



export default function AuctionReportButton() {
    const [loading, setLoading] = useState(false);

    const loadScripts = async () => {
        if (window.jspdf) return;

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => {
                const autoTableScript = document.createElement('script');
                autoTableScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js';
                autoTableScript.onload = resolve;
                autoTableScript.onerror = reject;
                document.head.appendChild(autoTableScript);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    const generatePDF = async () => {
        setLoading(true);
        try {
            await loadScripts();

            // 1. Fetch Data
            const [teamsRes, playersRes] = await Promise.all([
                supabase.from('teams').select('*').order('name'),
                supabase.from('players').select('*').eq('auction_status', 'sold')
            ]);

            if (!teamsRes.data || !playersRes.data) {
                throw new Error('Failed to fetch auction data');
            }

            const teams = teamsRes.data;
            const players = playersRes.data;

            // 2. Group Players by Team
            const teamGroups: Record<string, any[]> = {};
            const teamTotals: Record<string, number> = {};
            
            teams.forEach(team => {
                const teamPlayers = players
                    .filter(p => (p.team_id === team.id || p.sold_to_team_id === team.id))
                    .sort((a, b) => {
                        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
                        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
                        return nameA.localeCompare(nameB);
                    });
                
                teamGroups[team.id] = teamPlayers;
                teamTotals[team.id] = teamPlayers.reduce((sum, p) => sum + (p.sold_price || 0), 0);
            });

            // 3. Sort Teams (Alphabetical)
            const sortedTeams = [...teams].sort((a, b) => {
                return a.name.localeCompare(b.name);
            });

            // 4. Initialize PDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;

            // Header Section
            // Dark Background for Header
            doc.setFillColor(10, 10, 10);
            doc.rect(0, 0, pageWidth, 45, 'F');
            
            // Logo/Title
            doc.setTextColor(255, 215, 0); // Gold
            doc.setFontSize(28);
            doc.setFont('helvetica', 'bold');
            doc.text('KESHAV CUP 2026', pageWidth / 2, 22, { align: 'center' });
            
            doc.setTextColor(200, 200, 200);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text('OFFICIAL PLAYER SELECTION & AUCTION SUMMARY', pageWidth / 2, 32, { align: 'center' });
            
            // Border Line
            doc.setDrawColor(255, 215, 0);
            doc.setLineWidth(1);
            doc.line(20, 38, pageWidth - 20, 38);

            let currentY = 55;

            // 5. Add Teams and Players
            sortedTeams.forEach((team, index) => {
                const teamPlayers = teamGroups[team.id];
                if (teamPlayers.length === 0) return; // Skip teams with no players
                
                // Page Break Check
                if (currentY > 220) {
                    doc.addPage();
                    currentY = 20;
                }

                // Team Banner
                doc.setFillColor(240, 240, 240);
                doc.rect(14, currentY, pageWidth - 28, 12, 'F');
                
                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(0.5);
                doc.line(14, currentY, 14, currentY + 12); // Accent line
                
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text(`${team.name.toUpperCase()}`, 18, currentY + 8.5);
                
                doc.setFontSize(9);
                doc.setTextColor(80, 80, 80);
                doc.text(`Total Players: ${teamPlayers.length}`, pageWidth - 18, currentY + 8, { align: 'right' });

                currentY += 16;

                // Player List Table
                const tableData = teamPlayers.map((p, i) => [
                    (i + 1).toString(),
                    `${p.first_name} ${p.last_name}`,
                    p.cricket_skill || p.category || 'Player'
                ]);

                (doc as any).autoTable({
                    startY: currentY,
                    head: [['#', 'PLAYER NAME', 'CATEGORY / SKILL']],
                    body: tableData,
                    theme: 'grid',
                    headStyles: { 
                        fillColor: [30, 30, 30], 
                        textColor: [255, 215, 0], 
                        fontStyle: 'bold',
                        fontSize: 10,
                        halign: 'center'
                    },
                    columnStyles: {
                        0: { halign: 'center', cellWidth: 15 },
                        1: { fontStyle: 'bold', halign: 'center', cellWidth: 'auto', fontSize: 11 },
                        2: { halign: 'center', cellWidth: 60 }
                    },
                    styles: { fontSize: 9, cellPadding: 5 },
                    margin: { left: 14, right: 14 },
                    didDrawPage: (data: any) => {
                        currentY = data.cursor.y;
                    }
                });

                currentY += 15;
            });

            // 6. Final Footer
            if (currentY > 250) {
                doc.addPage();
                currentY = 20;
            }
            
            doc.setDrawColor(200, 200, 200);
            doc.line(14, currentY, pageWidth - 14, currentY);

            // Page Numbers
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(
                    `Keshav Cup 2026 - Official Auction Document | ${new Date().toLocaleDateString()} | Page ${i} of ${pageCount}`,
                    pageWidth / 2,
                    doc.internal.pageSize.height - 10,
                    { align: 'center' }
                );
            }

            // Save PDF
            doc.save(`Keshav_Cup_2026_Auction_Results_${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error: any) {
            console.error('PDF Generation Error:', error);
            alert('Error generating PDF: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={generatePDF}
            disabled={loading}
            className="glass"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 24px',
                borderRadius: '15px',
                background: 'rgba(255, 215, 0, 0.1)',
                border: '1px solid var(--primary)',
                color: 'var(--primary)',
                fontWeight: 900,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 0 20px rgba(255, 215, 0, 0.1)'
            }}
        >
            {loading ? (
                <Loader2 className="animate-spin" size={20} />
            ) : (
                <FileText size={20} />
            )}
            {loading ? 'GENERATING PDF...' : 'DOWNLOAD PLAYER SELECTION RESULTS PDF'}
        </button>
    );
}
