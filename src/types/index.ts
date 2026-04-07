/**
 * KESHAV CUP - Enterprise Type Definitions
 * Strict TypeScript interfaces matching database schema
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum BattingStyle {
    RIGHT_HANDED = 'RIGHT_HANDED',
    LEFT_HANDED = 'LEFT_HANDED',
}

export enum BowlingStyle {
    RIGHT_ARM = 'RIGHT_ARM',
    LEFT_ARM = 'LEFT_ARM',
    NONE = 'NONE',
}

export enum AuctionStatus {
    PENDING = 'pending',
    ACTIVE = 'active',
    SOLD = 'sold',
    UNSOLD = 'unsold',
}

export enum AuctionStateStatus {
    IDLE = 'idle',
    ACTIVE = 'active',
    PAUSED = 'paused',
    SOLD = 'sold',
}

export enum UserRole {
    ADMIN = 'ADMIN',
    CAPTAIN = 'CAPTAIN',
}

// =======================================================
// DATABASE ENTITIES
// =======================================================

export interface Admin {
    id: string;
    email: string;
    role: UserRole;
    created_at: string;
}

export interface Team {
    id: string;
    team_name: string;
    captain_email: string;
    purse_remaining: number;
    players_bought_count: number;
    max_players_allowed: number;
    created_at: string;
}

export interface Player {
    id: string;
    first_name: string;
    last_name: string;
    cricket_skill?: string;
    was_present_kc3?: string;
    photo_url: string;
    batting_style?: BattingStyle;
    bowling_style?: BowlingStyle;
    base_price: number;
    sold_price: number | null;
    sold_to_team_id: string | null;
    auction_status: AuctionStatus;
    created_at: string;
}

export interface AuctionState {
    id: string;
    current_player_id: string | null;
    auction_status: AuctionStateStatus;
    current_highest_bid: number;
    current_highest_bid_team_id: string | null;
    timer_remaining: number;
    bid_increment: number;
    last_updated_at: string;
}

export interface Bid {
    id: string;
    player_id: string;
    team_id: string;
    bid_amount: number;
    created_at: string;
}

export interface Squad {
    id: string;
    team_id: string;
    player_id: string;
    purchase_price: number;
    created_at: string;
}

export interface Match {
    id: string;
    team1_name: string;
    team2_name: string;
    team1_score: number;
    team1_wickets: number;
    team1_overs: string;
    team2_score: number;
    team2_wickets: number;
    team2_overs: string;
    current_innings: 1 | 2;
    batting_team: string;
    match_status: 'live' | 'completed' | 'scheduled';
    toss_winner: string;
    toss_decision: 'bat' | 'bowl';
    venue: string;
    created_at: string;
}

// ============================================================================
// EXTENDED TYPES WITH RELATIONS
// ============================================================================

export interface PlayerWithTeam extends Player {
    team?: Team;
}

export interface BidWithRelations extends Bid {
    player?: Player;
    team?: Team;
}

export interface SquadWithPlayer extends Squad {
    player: Player;
}

export interface AuctionStateWithPlayer extends AuctionState {
    player?: Player;
    leading_team?: Team;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface AdminLoginForm {
    email: string;
    password: string;
}

export interface CaptainLoginForm {
    team_name: string;
    captain_email: string;
    password: string;
}

export interface PlayerCreateForm {
    first_name: string;
    last_name: string;
    photo: File;
    batting_style: BattingStyle;
    bowling_style: BowlingStyle;
    base_price: number;
}

export interface PlayerUpdateForm extends Partial<PlayerCreateForm> {
    id: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface BidResponse {
    success: boolean;
    error?: string;
}

export interface SellPlayerResponse {
    success: boolean;
    error?: string;
}

// ============================================================================
// AUCTION CONTROL TYPES
// ============================================================================

export type AuctionAction =
    | 'start'
    | 'pause'
    | 'resume'
    | 'reset'
    | 'tick'
    | 'sell'
    | 'unsold';

export interface AuctionControlRequest {
    action: AuctionAction;
    player_id?: string;
    timer_remaining?: number;
}

// ============================================================================
// REALTIME SUBSCRIPTION TYPES
// ============================================================================

export interface RealtimePayload<T = any> {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: T;
    old: T;
    errors: any;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// ============================================================================
// CONSTANTS
// ============================================================================

export const ADMIN_PASSWORD = 'baps@1234';
export const CAPTAIN_PASSWORD = '12345678';
export const DEFAULT_PURSE = 100000000; // 10 Crore in paise
export const DEFAULT_MAX_PLAYERS = 8;
export const DEFAULT_TIMER = 30;
export const DEFAULT_BID_INCREMENT = 1000000; // 10 Lakh
export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ============================================================================
// VALIDATION SCHEMAS (for Zod)
// ============================================================================

export const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
