import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Use legacy JWT anon key for supabase-js v2 compatibility
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tcbqsmjmhuebfdijiaag.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY_LEGACY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjYnFzbWptaHVlYmZkaWppYWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODM3NzcsImV4cCI6MjA4NzI1OTc3N30.qULTHRBQzxIlAY6dklpAKlrVsJBA-KuvxmmtcTEZ5rY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) }
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const { data: participants, error: pErr } = await supabase
      .from('arco_participants')
      .select('*')
      .order('created_at', { ascending: false });

    if (pErr) throw pErr;

    const { data: responses, error: rErr } = await supabase
      .from('arco_survey_responses')
      .select('*, participant:arco_participants(*)')
      .order('created_at', { ascending: false });

    if (rErr) throw rErr;

    return NextResponse.json(
      { participants: participants || [], responses: responses || [] },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err: any) {
    console.error('Dashboard data error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
