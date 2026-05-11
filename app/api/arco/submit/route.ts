import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Use legacy JWT anon key for supabase-js v2 compatibility
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tcbqsmjmhuebfdijiaag.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY_LEGACY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjYnFzbWptaHVlYmZkaWppYWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2ODM3NzcsImV4cCI6MjA4NzI1OTc3N30.qULTHRBQzxIlAY6dklpAKlrVsJBA-KuvxmmtcTEZ5rY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { participant, responses } = body;

    if (!participant?.email) {
      return NextResponse.json({ error: 'Email obbligatoria' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('arco_participants')
      .select('id, survey_completed')
      .eq('email', participant.email.toLowerCase().trim())
      .maybeSingle();

    if (existing?.survey_completed) {
      return NextResponse.json(
        { error: 'Hai già completato il questionario. Grazie!' },
        { status: 409 }
      );
    }

    let participantId: string;

    const cleanParticipant = {
      first_name: participant.first_name?.trim(),
      last_name: participant.last_name?.trim(),
      email: participant.email.toLowerCase().trim(),
      phone: participant.phone?.trim() || null,
      role_title: participant.role_title?.trim(),
      department: participant.department,
      years_in_company: participant.years_in_company || null,
      age_range: participant.age_range || null,
    };

    if (existing) {
      const { error: updateErr } = await supabase
        .from('arco_participants')
        .update({
          ...cleanParticipant,
          survey_completed: true,
          survey_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateErr) throw updateErr;
      participantId = existing.id;
    } else {
      const { data: newP, error: insertErr } = await supabase
        .from('arco_participants')
        .insert({
          ...cleanParticipant,
          survey_completed: true,
          survey_completed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;
      participantId = newP.id;
    }

    const { error: respErr } = await supabase
      .from('arco_survey_responses')
      .insert({
        participant_id: participantId,
        ...responses,
      });

    if (respErr) throw respErr;

    return NextResponse.json({ success: true, participantId });
  } catch (err: any) {
    console.error('Survey submit error:', err);
    return NextResponse.json(
      { error: err.message || 'Errore durante il salvataggio' },
      { status: 500 }
    );
  }
}
