import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Use anon key since RLS allows public SELECT and service role in new format
// may have compatibility issues with supabase-js v2
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

    return NextResponse.json({ participants: participants || [], responses: responses || [] });
  } catch (err: any) {
    console.error('Dashboard data error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
