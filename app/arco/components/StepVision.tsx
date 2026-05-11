'use client';

const VISION_OPTIONS = [
  { value: 'grande_opportunita', emoji: '🌟', label: 'Una grande opportunità per tutti' },
  { value: 'opportunita', emoji: '👍', label: 'Un\'opportunità, con le giuste competenze' },
  { value: 'neutro', emoji: '⚖️', label: 'Dipende da come verrà gestita' },
  { value: 'minaccia', emoji: '⚠️', label: 'Un potenziale rischio per il mio lavoro' },
  { value: 'grande_minaccia', emoji: '🔴', label: 'Una minaccia seria — ho paura di essere sostituito' },
];

const EXPECTATIONS = [
  'Capire cosa sia davvero l\'AI',
  'Imparare ad usare strumenti AI pratici',
  'Superare la paura del cambiamento',
  'Trovare motivazione e ispirazione',
  'Scoprire come automatizzare il mio lavoro',
  'Networking con i colleghi',
  'Capire il Vibe Coding',
  'Avere una visione del futuro',
  'Imparare tecniche di coaching personale',
  'Divertirmi e staccare dalla routine',
];

interface Props { data: any; onChange: (d: any) => void; }

export default function StepVision({ data, onChange }: Props) {
  const set = (k: string, v: any) => onChange({ ...data, [k]: v });

  const toggleExp = (exp: string) => {
    const current = data.event_expectations || [];
    const next = current.includes(exp) ? current.filter((e: string) => e !== exp) : [...current, exp];
    set('event_expectations', next);
  };

  return (
    <div className="arco-section arco-animate-in">
      <div className="arco-section-number">4</div>
      <h2 className="arco-section-title">Visione del futuro e aspettative</h2>
      <p className="arco-section-desc">Ultima sezione! Le tue risposte ci aiuteranno a creare un&apos;esperienza su misura per te e il team.</p>

      <div className="arco-field">
        <label className="arco-label">L&apos;AI nel tuo settore è... *</label>
        <div className="arco-radio-group">
          {VISION_OPTIONS.map(o => (
            <label key={o.value} className={`arco-radio-card ${data.ai_opportunity_or_threat === o.value ? 'selected' : ''}`}>
              <input type="radio" name="ai_vision" value={o.value} onChange={() => set('ai_opportunity_or_threat', o.value)} />
              <span className="arco-radio-dot" />
              <span className="arco-radio-emoji">{o.emoji}</span>
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="arco-field">
        <label className="arco-label">Se potessi automatizzare una cosa del tuo lavoro, quale sarebbe?</label>
        <textarea className="arco-textarea" placeholder="es: report settimanali, rispondere alle email, analisi dati..." value={data.what_would_automate || ''} onChange={e => set('what_would_automate', e.target.value)} />
      </div>

      <div className="arco-field">
        <label className="arco-label">Qual è l&apos;attività che ti ruba più tempo durante la giornata?</label>
        <textarea className="arco-textarea" placeholder="es: riunioni, gestione email, compilare fogli Excel..." value={data.biggest_time_waster || ''} onChange={e => set('biggest_time_waster', e.target.value)} />
      </div>

      <div className="arco-field">
        <label className="arco-label">Se l&apos;AI potesse darti un superpotere lavorativo, quale vorresti? 🦸</label>
        <textarea className="arco-textarea" placeholder="Sogna in grande! es: capire al volo cosa pensano i clienti, creare presentazioni in 2 minuti..." value={data.dream_superpower || ''} onChange={e => set('dream_superpower', e.target.value)} />
      </div>

      <div className="arco-field">
        <label className="arco-label">Cosa ti aspetti dal workshop? <span className="arco-label-hint">(seleziona tutte le opzioni che vuoi)</span></label>
        <div className="arco-chip-group">
          {EXPECTATIONS.map(exp => (
            <div key={exp} className={`arco-chip ${(data.event_expectations || []).includes(exp) ? 'selected' : ''}`} onClick={() => toggleExp(exp)}>
              {exp}
            </div>
          ))}
        </div>
      </div>

      <div className="arco-field">
        <label className="arco-label">Hai domande specifiche per Antonio? <span className="arco-label-hint">(opzionale)</span></label>
        <textarea className="arco-textarea" placeholder="Qualsiasi curiosità, dubbio o tema che vorresti affrontare..." value={data.specific_questions || ''} onChange={e => set('specific_questions', e.target.value)} />
      </div>

      <div className="arco-field">
        <label className="arco-label">Quanto sei entusiasta per questo workshop? *</label>
        <div className="arco-slider-wrap">
          <div className="arco-slider-value">{data.excitement_level || 5}</div>
          <input type="range" className="arco-slider" min="1" max="10" value={data.excitement_level || 5} onChange={e => set('excitement_level', parseInt(e.target.value))} />
          <div className="arco-slider-labels">
            <span>1 — Meh...</span>
            <span>10 — Non vedo l&apos;ora! 🔥</span>
          </div>
        </div>
      </div>
    </div>
  );
}
