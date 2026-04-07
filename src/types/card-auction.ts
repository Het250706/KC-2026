export type SlotStatus = 'pending' | 'active' | 'completed';
export type PlayerSlotStatus = 'unassigned' | 'in_slot' | 'sold';

export interface CardSlot {
    id: string;
    slot_number: number;
    status: SlotStatus;
    created_at: string;
    updated_at: string;
}

export interface SlotPlayer {
    id: string;
    slot_id: string;
    player_id: string;
    card_position: number;
    is_picked: boolean;
    picked_by_team_id: string | null;
    picked_at: string | null;
    player?: {
        first_name: string;
        last_name: string;
        photo_url: string;
        category: string;
    };
    team?: {
        name: string;
    };
    picked_by_team?: {
        name: string;
    };
}

export interface CardAuctionTurn {
    id: string;
    slot_id: string;
    turn_order: number;
    team_id: string;
    team?: {
        name: string;
    };
}

export interface CardAuctionState {
    id: number;
    current_slot_id: string | null;
    current_turn: number;
    is_active: boolean;
    updated_at: string;
}
