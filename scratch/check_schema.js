import { createClient } from '@supabase/supabase-admin'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkSchema() {
  const { data, error } = await supabase
    .from('card_slots')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error fetching card_slots:', error)
  } else {
    console.log('Sample card_slot data:', JSON.stringify(data[0], null, 2))
  }
}

checkSchema()
