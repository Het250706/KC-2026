-- Slot-Based Surprise Draft System Schema

-- New Draft Order Table
CREATE TABLE IF NOT EXISTS draft_order (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
    position int NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Player Table Updates
ALTER TABLE players ADD COLUMN IF NOT EXISTS slot_number int;
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_selected boolean DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS draft_order_pick int;

-- Draft State Table (Single row)
CREATE TABLE IF NOT EXISTS draft_state (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    current_slot int DEFAULT 1,
    current_turn int DEFAULT 0, -- index in draft_order
    current_team_id uuid REFERENCES teams(id),
    is_reveal_open boolean DEFAULT false,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE draft_order;
ALTER PUBLICATION supabase_realtime ADD TABLE draft_state;

-- Initial State
INSERT INTO draft_state (current_slot, current_turn) 
SELECT 1, 0
WHERE NOT EXISTS (SELECT 1 FROM draft_state);
