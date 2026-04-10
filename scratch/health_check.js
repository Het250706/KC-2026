
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSystem() {
    console.log('--- SYSTEM HEALTH CHECK ---');
    
    const { count: regCount } = await supabase.from('registrations').select('*', { count: 'exact', head: true });
    console.log('Registrations:', regCount);

    const { count: playerCount } = await supabase.from('players').select('*', { count: 'exact', head: true });
    console.log('Players in Pool:', playerCount);

    const { count: teamCount } = await supabase.from('teams').select('*', { count: 'exact', head: true });
    console.log('Teams:', teamCount);

    const { count: slotCount } = await supabase.from('card_slots').select('*', { count: 'exact', head: true });
    console.log('Card Slots:', slotCount);

    const { count: slotPlayerCount } = await supabase.from('slot_players').select('*', { count: 'exact', head: true });
    console.log('Players assigned to slots:', slotPlayerCount);

    console.log('---------------------------');
}

checkSystem();
