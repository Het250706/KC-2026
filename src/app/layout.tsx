import { Outfit } from "next/font/google";
import "./globals.css";
import ClientLayout from '@/components/ClientLayout';
import type { Metadata } from 'next';

const outfit = Outfit({
  subsets: ["latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Keshav Cup Cricket Auction | Real-Time Bidding",
  description: "The ultimate real-time cricket auction platform. Bid on your favorite players and build your dream team.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={outfit.className}>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
