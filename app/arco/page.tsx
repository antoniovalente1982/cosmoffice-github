'use client';

import { useState, useRef } from 'react';
import StepRegistration from './components/StepRegistration';
import StepAI from './components/StepAI';
import StepVision from './components/StepVision';

const STEP_NAMES = ['Chi sei', 'AI', 'Curiosità'];

export default function ArcoSurveyPage() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const startTime = useRef(Date.now());

  const totalSteps = 3;
  const progress = ((step + 1) / totalSteps) * 100;

  const canNext = () => {
    if (step === 0) return data.first_name?.trim() && data.last_name?.trim() && data.email?.trim() && data.department && data.role_title?.trim() && data.age_range && data.years_in_company !== null && data.years_in_company !== undefined;
    if (step === 1) return data.ai_knowledge_level && data.ai_frequency && data.ai_tools_used?.length > 0 && data.ai_use_cases?.length > 0 && data.ai_work_examples?.trim() && data.llm_knowledge;
    if (step === 2) return data.what_would_automate?.trim() && data.biggest_time_waster?.trim() && data.dream_superpower?.trim() && data.event_expectations?.length > 0 && data.specific_questions?.trim() && typeof data.excitement_level === 'number';
    return true;
  };

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const elapsed = Math.round((Date.now() - startTime.current) / 1000);
      const { first_name, last_name, email, phone, role_title, department, years_in_company, age_range, ...responses } = data;
      const res = await fetch('/api/arco/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant: { first_name, last_name, email, phone, role_title, department, years_in_company, age_range },
          responses: { ...responses, completion_time_seconds: elapsed },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Errore');
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return (
    <div className="arco-page">
      <div className="arco-bg-pattern" />
      <header className="arco-header">
        <div className="arco-logo-text"><span>A</span>RCO <span>G</span>roup</div>
      </header>
      <div className="arco-container">
        <div className="arco-section arco-success arco-animate-in">
          <div className="arco-success-icon">✅</div>
          <h2>Grazie mille!</h2>
          <p>Le tue risposte sono state registrate con successo. Grazie! ✨</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="arco-page">
      <div className="arco-bg-pattern" />
      <header className="arco-header">
        <div className="arco-logo-text"><span>A</span>RCO <span>G</span>roup</div>
        <div className="arco-header-subtitle">Questionario pre-incontro</div>
      </header>

      <div className="arco-container">
        <div className="arco-progress-wrap">
          <div className="arco-progress-bar"><div className="arco-progress-fill" style={{ width: `${progress}%` }} /></div>
          <div className="arco-progress-label">
            <span>{STEP_NAMES[step]}</span>
            <span>{step + 1} / {totalSteps}</span>
          </div>
        </div>

        {step === 0 && <StepRegistration data={data} onChange={setData} />}
        {step === 1 && <StepAI data={data} onChange={setData} />}
        {step === 2 && <StepVision data={data} onChange={setData} />}

        {error && <p style={{ color: '#DC2626', textAlign: 'center', padding: '0.75rem', background: '#FEF2F2', borderRadius: '12px', fontSize: '0.9rem', margin: '0 0 1rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between' }}>
          {step > 0 && <button className="arco-btn arco-btn-secondary" onClick={() => setStep(s => s - 1)}>← Indietro</button>}
          <div style={{ marginLeft: 'auto' }}>
            {step < totalSteps - 1 ? (
              <button className="arco-btn arco-btn-primary" disabled={!canNext()} onClick={() => { setStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                Avanti →
              </button>
            ) : (
              <button className="arco-btn arco-btn-primary arco-btn-block" disabled={!canNext() || submitting} onClick={submit}>
                {submitting ? '⏳ Invio in corso...' : '✨ Invia le risposte'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
