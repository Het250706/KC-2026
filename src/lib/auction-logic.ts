export const BIDDING_STAGES = [
    5, 10, 15, 20, 25, 50, 75, 100, 125, 175,
    225, 275, 325, 425, 525, 625, 750, 875, 1000, 1150,
    1300, 1450, 1600, 1800, 2000, 2500, 3125, 3750, 4375, 5000
];

export const TEAM_PURSE_LIMIT = 5000;
export const MAX_SQUAD_SIZE = 9;

export function getNextBid(currentBid: number): number {
    if (currentBid === 0) return BIDDING_STAGES[0];

    const currentIndex = BIDDING_STAGES.indexOf(currentBid);
    if (currentIndex === -1) {
        // Find the first stage higher than current bid
        const next = BIDDING_STAGES.find(stage => stage > currentBid);
        return next || BIDDING_STAGES[BIDDING_STAGES.length - 1];
    }

    if (currentIndex < BIDDING_STAGES.length - 1) {
        return BIDDING_STAGES[currentIndex + 1];
    }

    return currentBid; // Already at max
}

export function getPurplePushp(bid: number): number | null {
    const map: Record<number, number> = {
        625: 1,
        1300: 2,
        2000: 3,
        2500: 4,
        3125: 5,
        3750: 6,
        4375: 7,
        5000: 8
    };
    return map[bid] || null;
}
