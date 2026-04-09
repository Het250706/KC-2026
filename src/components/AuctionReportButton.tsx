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

            // 1. Fetch History Data
            const { data: historyData, error } = await supabase
                .from('slot_players')
                .select('*, player:players(*), picked_by_team:teams(*)')
                .eq('is_picked', true)
                .order('picked_at', { ascending: false });

            if (error || !historyData) throw new Error('Failed to fetch history');

            // 2. Pre-load Images (Premium Feature)
            const playerImages: Record<string, HTMLImageElement> = {};
            const logoImg = new Image();
            
            const loadAllImages = async () => {
                const promises = historyData.map(async (row) => {
                    if (row.player?.photo_url) {
                        return new Promise((resolve) => {
                            const img = new Image();
                            img.crossOrigin = 'Anonymous';
                            img.src = row.player.photo_url;
                            img.onload = () => {
                                playerImages[row.id] = img;
                                resolve(true);
                            };
                            img.onerror = () => resolve(false);
                        });
                    }
                });
                
                // Add Logo Loading
                promises.push(new Promise((resolve) => {
                    logoImg.src = '/logo.png'; // Direct public path
                    logoImg.onload = resolve;
                    logoImg.onerror = resolve;
                }));

                await Promise.all(promises);
            };

            await loadAllImages();

            // 4. Initialize PDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;

            // Header Section
            doc.setFillColor(10, 10, 10);
            doc.rect(0, 0, pageWidth, 45, 'F');
            
            // Logo on both sides
            if (logoImg.complete && logoImg.naturalWidth > 0) {
                const logoDim = 25;
                doc.addImage(logoImg, 'PNG', pageWidth / 2 - 85, 10, logoDim, logoDim);
                doc.addImage(logoImg, 'PNG', pageWidth / 2 + 60, 10, logoDim, logoDim);
            }

            doc.setTextColor(255, 215, 0); // Gold
            doc.setFontSize(28);
            doc.setFont('helvetica', 'bold');
            doc.text('KESHAV CUP 2026', pageWidth / 2, 22, { align: 'center' });
            
            doc.setTextColor(200, 200, 200);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'normal');
            doc.text('OFFICIAL PLAYER SELECTION SUMMARY', pageWidth / 2, 33, { align: 'center' });
            
            doc.setDrawColor(255, 215, 0);
            doc.setLineWidth(1);
            doc.line(20, 39, pageWidth - 20, 39);

            let currentY = 55;

            // Player List Table
            const tableData = historyData.map((row, i) => [
                '', // Placeholder for IMG column
                `${row.player?.first_name} ${row.player?.last_name}`,
                row.picked_by_team?.name?.toUpperCase() || 'UNKNOWN',
                'SOLD',
                row.picked_at ? new Date(row.picked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'
            ]);

            (doc as any).autoTable({
                startY: currentY,
                head: [['IMG', 'PLAYER NAME', 'TEAM NAME', 'STATUS', 'REVEAL TIME']],
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
                    0: { cellWidth: 25, halign: 'center' },
                    1: { halign: 'center', cellWidth: 'auto' },
                    2: { halign: 'center', cellWidth: 45 },
                    3: { halign: 'center', cellWidth: 30 },
                    4: { halign: 'center', cellWidth: 40 }
                },
                styles: { 
                    fontSize: 11, 
                    cellPadding: 8, 
                    valign: 'middle', 
                    fontStyle: 'bold',
                    textColor: [40, 40, 40] 
                },
                margin: { left: 14, right: 14 },
                didDrawCell: (data: any) => {
                    if (data.section === 'body' && data.column.index === 0) {
                        const rowId = historyData[data.row.index].id;
                        const img = playerImages[rowId];
                        if (img) {
                            const dim = 12;
                            const x = data.cell.x + (data.cell.width - dim) / 2;
                            const y = data.cell.y + (data.cell.height - dim) / 2;
                            doc.addImage(img, 'JPEG', x, y, dim, dim);
                        }
                    }
                }
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
