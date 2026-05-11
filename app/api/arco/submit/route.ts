import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { participant, responses } = body;

    const { data: existing } = await supabase
      .from('arco_participants')
      .select('id, survey_completed')
      .eq('email', participant.email)
      .maybeSingle();

    if (existing?.survey_completed) {
      return NextResponse.json(
        { error: 'Hai già completato il questionario. Grazie!' },
        { status: 409 }
      );
    }

    let participantId: string;

    if (existing) {
      const { error: updateErr } = await supabase
        .from('arco_participants')
        .update({
          ...participant,
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
          ...participant,
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
