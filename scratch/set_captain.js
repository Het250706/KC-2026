
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function setCaptain() {
    console.log('Searching for Shivkumar Mukesh bhai patel...');
    const { data, error } = await supabase
        .from('players')
        .select('id, first_name, last_name')
        .ilike('first_name', '%Shivkumar%')
        .ilike('last_name', '%Mukesh%');

    if (error) {
        console.error('Error searching player:', error);
        return;
    }

    if (data && data.length > 0) {
        const player = data[0];
        console.log(`Found player: ${player.first_name} ${player.last_name} (${player.id})`);
        
        const { error: updateError } = await supabase
            .from('players')
            .update({ is_captain: true })
            .eq('id', player.id);

        if (updateError) {
            console.error('Error updating player:', updateError);
        } else {
            console.log('Successfully marked as Captain!');
        }
    } else {
        console.log('Player not found.');
    }
}

setCaptain();
