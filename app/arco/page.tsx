'use client';

import { useState, useRef } from 'react';
import StepRegistration from './components/StepRegistration';
import StepChange from './components/StepChange';
import StepAI from './components/StepAI';
import StepVision from './components/StepVision';

const STEPS = ['Registrazione', 'Cambiamento', 'AI & Tech', 'Visione & Aspettative'];

export default function ArcoSurveyPage() {
  const [step, setStep] = useState(0);
  const [participant, setParticipant] = useState<any>({});
  const [responses, setResponses] = useState<any>({ change_openness: 5, excitement_level: 5 });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const startTime = useRef(Date.now());

  const progress = ((step + 1) / STEPS.length) * 100;

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!participant.first_name?.trim()) return 'Inserisci il tuo nome';
      if (!participant.last_name?.trim()) return 'Inserisci il tuo cognome';
      if (!participant.email?.trim() || !participant.email.includes('@')) return 'Inserisci un\'email valida';
      if (!participant.role_title?.trim()) return 'Inserisci il tuo ruolo';
      if (!participant.department) return 'Seleziona il tuo reparto';
    }
    if (step === 1) {
      if (!responses.change_attitude) return 'Seleziona come ti senti riguardo al cambiamento';
      if (!responses.change_past_experience) return 'Seleziona la tua esperienza passata';
    }
    if (step === 2) {
      if (!responses.ai_knowledge_level) return 'Seleziona il tuo livello di conoscenza AI';
      if (!responses.ai_frequency) return 'Seleziona la frequenza di utilizzo';
      if (!responses.coding_experience) return 'Seleziona la tua esperienza con il coding';
    }
    if (step === 3) {
      if (!responses.ai_opportunity_or_threat) return 'Seleziona la tua visione dell\'AI';
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const prev = () => { setError(''); if (step > 0) setStep(step - 1); };

  const submit = async () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setSubmitting(true);

    const elapsed = Math.round((Date.now() - startTime.current) / 1000);

    try {
      const res = await fetch('/api/arco/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant,
          responses: { ...responses, completion_time_seconds: elapsed },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true);
    } catch (e: any) {
      setError(e.message || 'Errore durante il salvataggio');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <>
        <header className="arco-header">
          <div className="arco-logo-text"><span>A</span>RCO <span>G</span>roup</div>
        </header>
        <div className="arco-container">
          <div className="arco-success arco-animate-in">
            <div className="arco-success-icon">✅</div>
            <h2>Grazie, {participant.first_name}! 🎉</h2>
            <p>Il tuo questionario è stato inviato con successo. Le tue risposte ci aiuteranno a creare un&apos;esperienza incredibile per il workshop in Sardegna.</p>
            <p style={{ marginTop: '1.5rem', color: 'var(--arco-red-light)' }}>Ci vediamo a fine giugno! 🏝️</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="arco-header">
        <div className="arco-logo-text"><span>A</span>RCO <span>G</span>roup</div>
        <div className="arco-header-subtitle">Workshop Sardegna — Giugno 2026</div>
        <div className="arco-header-event">
          🏝️ Crescita Personale &amp; AI — Il tuo superpotere
        </div>
      </header>

      <div className="arco-container">
        {/* Progress */}
        <div className="arco-progress-wrap">
          <div className="arco-progress-bar">
            <div className="arco-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="arco-progress-label">
            <span>Step {step + 1} di {STEPS.length}</span>
            <span>{STEPS[step]}</span>
          </div>
        </div>

        {/* Steps */}
        {step === 0 && <StepRegistration data={participant} onChange={setParticipant} />}
        {step === 1 && <StepChange data={responses} onChange={setResponses} />}
        {step === 2 && <StepAI data={responses} onChange={setResponses} />}
        {step === 3 && <StepVision data={responses} onChange={setResponses} />}

        {/* Error */}
        {error && (
          <div style={{ padding: '0.85rem 1rem', background: 'rgba(227,30,36,0.1)', border: '1px solid rgba(227,30,36,0.3)', borderRadius: '10px', color: 'var(--arco-red-light)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
          {step > 0 ? (
            <button className="arco-btn arco-btn-secondary" onClick={prev}>← Indietro</button>
          ) : <div />}

          {step < STEPS.length - 1 ? (
            <button className="arco-btn arco-btn-primary" onClick={next}>Avanti →</button>
          ) : (
            <button className="arco-btn arco-btn-primary" onClick={submit} disabled={submitting}>
              {submitting ? '⏳ Invio in corso...' : '🚀 Invia questionario'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
