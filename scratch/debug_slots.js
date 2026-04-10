
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSlots() {
    const { data: slots } = await supabase
        .from('card_slots')
        .select('*, slot_players(player:players(*))');

    console.log('--- SLOT DEBUG ---');
    slots?.forEach((s, i) => {
        console.log(`Slot ${i} (${s.id}):`);
        console.log(`  Status: ${s.status}`);
        const cats = s.slot_players?.map((sp) => sp.player?.category);
        console.log(`  Player Categories:`, cats);
    });
    console.log('------------------');
}

debugSlots();
