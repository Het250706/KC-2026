# 🏆 Keshav Cup 2k26 — Cricket Auction Platform

> An advanced, real-time cricket auction and tournament management system built for BAPS Petlad Yuva. This platform features a high-performance big-screen auction interface, real-time bidding synchronization, and a comprehensive admin command center.

---

## 🌟 Key Features

### 🔨 Live Auction Engine
*   **Big Screen Experience**: 4K optimized dashboard for event projections with smooth animations and sound integration.
*   **Real-time Bidding**: Instantaneous bid synchronization across all devices using Supabase Realtime (WebSockets).
*   **Dynamic Ticker**: Real-time sales ticker and historical bid logs.
*   **Sold/Unsold Management**: Instant player status transitions with team budget updates.

### 💂 Captain Dashboard
*   **Financial Oversight**: Real-time budget tracking and remaining purse calculations.
*   **Squad Development**: Visual team building tools with position-based distribution analysis.
*   **Player Scouting**: Access to the full player pool with performance stats and registration details.

### 🛡️ Admin Command Center
*   **Registry Control**: Manage player signups, verification, and pool injections.
*   **Auction Controller**: Control the flow of the auction, start/stop timers, and finalize sales.
*   **Live Scoring**: Integrated match scoring engine for the actual tournament phase.
*   **Cloud Sync**: Automatic synchronization between Supabase database and Google Sheets.

### 📋 Registration System
*   **Self-Service Portal**: Easy-to-use player registration form with photo uploads.
*   **Automated Verification**: Role-based access control for verify/approve flows.
*   **Supabase Storage**: Secure hosting for player profile images.

---

## 🔄 How It Works: The Full Workflow

To understand the lifecycle of the Keshav Cup web app, here is the journey for each role:

### 1. The Player's Journey (Pre-Auction)
- **Registration**: Players visit `/register` to submit their personal details, cricket stats (Batting/Bowling styles), and a profile photo.
- **Data Sync**: On submission, data is instantly saved to **Supabase** and automatically appended to a **Google Sheet** for the organizing committee's records.
- **Verification**: Admins review the registration at `/admin/registrations` and "Push" the player into the active Auction Pool.

### 2. The Captain's Journey (During Auction)
- **Login**: Captains log in at `/login` to access their private dashboard.
- **Bidding**: When a player is "Up for Auction," captains see the live bid button. Bidding is instantaneous.
- **Budget Tracking**: The dashboard automatically deducts the winning bid from the team's total purse, ensuring no over-spending.
- **Squad View**: Captains can track their growing roster in real-time at `/captain/dashboard`.

### 3. The Admin's Journey (The Controller)
- **Player Management**: Admins select which player to bring to the floor next using the **Player Pool** manager.
- **Auction Control**: Admins start the timer, monitor bids, and finalize the "Sold" or "Unsold" status.
- **Big Screen Management**: Admins ensure the `/auction` display is projected for the audience, showing premium animations for every sale.

### 4. The Audience's Journey (Tournament Phase)
- **Live Scoreboard**: Once the matches start, the `/scoreboard` and `/live-score` routes provide real-time updates on ball-by-ball action.
- **Public Stats**: Anyone can view team squads and auction summaries at `/teams` and `/auction-summary`.

---

## 📊 Process Flow Diagram

```mermaid
graph TD
    A[Player Registers] -->|Auto-Sync| B(Google Sheets / Supabase)
    B --> C{Admin Approval}
    C -->|Approved| D[Player Pool]
    D --> E{Live Auction}
    E -->|Bidding Wars| F[Real-time WebSocket Sync]
    F --> G{Sold?}
    G -->|Yes| H[Team Squad + Budget Deducted]
    G -->|No| I[Unsold Pool]
    H --> J[Tournament Phase: Live Scoring]
---

## 🗺️ Route Map: Where to Go?

| Page | Description | Who is it for? |
| :--- | :--- | :--- |
| `/` | **Home Landing Page** | Everyone |
| `/register` | **Player Enrollment** | Aspiring Players |
| `/login` | **Captain Portal** | Team Owners (Captains) |
| `/admin/login` | **Controller Hub** | Organizing Committee |
| `/auction` | **Big Screen Console** | Audience / Projections |
| `/scoreboard` | **Live Match Scoreboard** | Audience / Fans |
| `/live-score` | **Real-time Scoring Controls**| Match Umpires / Scorers |
| `/teams` | **Squad Details** | General Public |

---

## ⚡ Technical Excellence

- **Latency-Free Bidding**: Engineered with Supabase Realtime for sub-100ms bid synchronization across all client devices.
- **Atomic Transactions**: Bidding logic uses PostgreSQL functions to ensure no two bids can happen at the exact same millisecond, preventing race conditions.
- **Real-time Budgeting**: Team purse balances are calculated server-side in real-time, preventing over-spending during high-pressure bidding wars.
- **Optimized Rendering**: Frontend built with React memoization and Framer Motion for 60fps animations even on lower-end projection hardware.

---

## 💎 Immersive Experience

- **Game-Show Atmosphere**: Integrated sound effects for successful bids, sales, and auction starts.
- **Big Screen Optimization**: The `/auction` display is specifically designed for 4K projectors with high-contrast visuals for maximum visibility in large halls.
- **Dynamic Visual Cues**: Premium glassmorphism UI that reacts to auction states (e.g., pulsing red when a timer is low).

---

## 📈 Tournament Analytics

- **Performance Tracking**: Real-time stats for the tournament phase, including player strike rates, bowling averages, and team standings.
- **Auction History**: A complete log of every bid made during the event for post-auction review and transparency.
- **Budget Distribution**: Visual charts showing team spending patterns and squad balance.

---

## 🖼️ UI Gallery

> *Add your project screenshots here to showcase the premium dark-gold interface!*

| Registration | Big Screen Auction | Captain Dashboard |
| :---: | :---: | :---: |
| ![Registration Placeholder](https://via.placeholder.com/300x200?text=Registration+Form) | ![Auction Placeholder](https://via.placeholder.com/300x200?text=Live+Auction+Screen) | ![Dashboard Placeholder](https://via.placeholder.com/300x200?text=Captain+Dashboard) |

---

## ⚡ Quick Start for Every Role

### 👤 For Players
1. Go to `/register`.
2. Fill out the form truthfully.
3. Wait for the Auction day to see if you get picked!

### 🧑‍✈️ For Captains
1. Log in at `/login` with your credentials.
2. Monitor your **Team Purse** on the dashboard.
3. Click the **BID** button when your target player is live.

### 🛡️ For Admins
1. Log in at `/admin/login`.
2. Manage registrations at `/admin/registrations`.
3. Open the **Auction Controller** to run the live event.
4. Project the `/auction` page onto the big screen.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Database**: [Supabase/PostgreSQL](https://supabase.com/)
- **Realtime**: Supabase Realtime (Postgres Changes/Channels)
- **Authentication**: Supabase Auth (Role-based access control)
- **Styling**: Vanilla CSS + [Framer Motion](https://www.framer.com/motion/)
- **External Integration**: Google Sheets API (v4)
- **Icons**: Lucide React
- **Aesthetics**: Premium Glassmorphism & Dark Mode

---

## 📁 Project Structure

```text
Keshav_Cup/
├── src/
│   ├── app/           # Next.js App Router (Routes & Pages)
│   │   ├── admin/     # Admin-only modules
│   │   ├── auction/   # Performance-optimized Big Screen
│   │   ├── captain/   # Team dashboard & squad views
│   │   ├── register/  # Public enrollment portal
│   │   └── scoreboard/# Live match status views
│   ├── components/    # Reusable UI components
│   ├── lib/           # Supabase client & utility functions
│   └── types/         # TypeScript definitions
├── public/            # Static assets (logos, SFX)
└── *.sql              # Database schemas & migration scripts
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (Latest LTS)
- NPM or PNPM
- A Supabase Project
- Google Cloud Service Account (for Sheets sync)

### 2. Environment Setup
Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Integration
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_worker_email
GOOGLE_PRIVATE_KEY="your_private_key"
GOOGLE_SHEET_ID=your_spreadsheet_id
```

### 3. Database Initialization
Execute the SQL files located in the root directory in the following order inside your Supabase SQL Editor:
1. `supabase_schema.sql` (Initial structure)
2. `setup_roles.sql` (RBAC implementation)
3. `FIX_RLS_POLICIES.sql` (Security hardening)
4. Other feature-specific scripts (as needed for updates)

### 4. Local Development
```bash
npm install
npm run dev
```
The app will be available at `http://localhost:3000`.

---

## 🔒 Security & Deployment

- **RLS (Row Level Security)**: All tables are protected by Supabase RLS policies to ensure captains can't manipulate admin data.
- **Middleware Protections**: Next.js middleware handles route guarding for `/admin` and `/captain` paths.
- **Vercel Optimized**: Designed for seamless deployment on Vercel with ISR/SSR support for analytics.

---

## 🤝 Contribution

This project is specifically tailored for **BAPS Petlad Yuvak Mandal**. Ensure all UI/UX changes align with the "Premium Dark / Gold" aesthetic defined in `globals.css`.

---

## 👨‍💻 Built By

This platform was designed and developed by **Het Patel** for the **BAPS Petlad Yuva** sports ecosystem.

---

© 2026 BAPS Petlad. Built with ❤️ by **Het Patel**.
