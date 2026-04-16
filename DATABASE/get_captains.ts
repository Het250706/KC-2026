import { createClient } from '@supabase/supabase-client';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findCaptains() {
    const names = [
        'Taksh', 'Aksharbhai', 'DARPAN', 'Miten', 'Yogi', 'Vandan', 'Vatsal', 'Shivkumar'
    ];
    
    let query = supabase.from('players').select('id, email, first_name, last_name, team_id');
    const { data, error } = await query;
    
    if (error) {
        console.error(error);
        return;
    }
    
    const results = data.filter(p => names.some(n => p.first_name?.toLowerCase().includes(n.toLowerCase()) || p.last_name?.toLowerCase().includes(n.toLowerCase())));
    console.log(JSON.stringify(results, null, 2));
}

findCaptains();
