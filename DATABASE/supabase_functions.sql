-- Function to handle the sale of a player atomically
CREATE OR REPLACE FUNCTION sell_player(p_player_id UUID, p_team_id UUID, p_price NUMERIC)
RETURNS VOID AS $$
BEGIN
    -- 1. Update the player table
    UPDATE players
    SET is_sold = TRUE,
        team_id = p_team_id,
        sold_price = p_price
    WHERE id = p_player_id;

    -- 2. Deduct the price from the team's budget
    UPDATE teams
    SET remaining_budget = remaining_budget - p_price
    WHERE id = p_team_id;

    -- 3. Reset the auction state
    UPDATE auction_state
    SET status = 'idle',
        current_player_id = NULL,
        current_highest_bid = 0,
        last_bid_team_id = NULL
    WHERE id = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
