import { supabase } from './src/lib/supabase';

async function checkSchema() {
    const { data, error } = await supabase.from('matches').select('*').limit(1);
    if (error) {
        console.error('Error fetching matches:', error);
        return;
    }
    if (data && data.length > 0) {
        console.log('Columns in matches table:', Object.keys(data[0]));
    } else {
        console.log('No matches found to check columns.');
    }
}

checkSchema();
