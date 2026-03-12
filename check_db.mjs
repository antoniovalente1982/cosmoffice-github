import { createClient } from '@supabase/supabase-js';

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await supa.from('support_tickets').select('*').limit(1);
console.log('support_tickets columns:', data && data.length > 0 ? Object.keys(data[0]) : "No data or Error", error);
