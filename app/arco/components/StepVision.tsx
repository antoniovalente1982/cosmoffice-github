'use client';

const EXPECTATIONS = [
  "Capire cosa sia davvero l'AI",
  'Imparare ad usare strumenti AI pratici',
  'Trovare ispirazione e nuove idee',
  'Scoprire come automatizzare attività ripetitive',
  'Avere una visione del futuro',
  'Confrontarmi con i colleghi',
  'Divertirmi e staccare dalla routine',
  'Nessuna in particolare'
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
      <div className="arco-section-number">3</div>
      <h2 className="arco-section-title">Ultime curiosità</h2>
      <p className="arco-section-desc">Quasi finito! Queste risposte ci aiuteranno a personalizzare l&apos;evento. Tutti i campi sono obbligatori.</p>

      <div className="arco-field">
        <label className="arco-label">Se potessi automatizzare una cosa del tuo lavoro, quale sarebbe?</label>
        <textarea className="arco-textarea" placeholder="Es: report settimanali, rispondere alle email, analisi dati..." value={data.what_would_automate || ''} onChange={e => set('what_would_automate', e.target.value)} />
      </div>

      <div className="arco-field">
        <label className="arco-label">Qual è l&apos;attività che ti ruba più tempo durante la giornata?</label>
        <textarea className="arco-textarea" placeholder="Es: riunioni, gestione email, compilare fogli Excel..." value={data.biggest_time_waster || ''} onChange={e => set('biggest_time_waster', e.target.value)} />
      </div>

      <div className="arco-field">
        <label className="arco-label">Se l&apos;AI potesse darti un superpotere lavorativo, quale vorresti? 🦸</label>
        <textarea className="arco-textarea" placeholder="Sogna in grande! Es: capire al volo cosa pensano i clienti, creare presentazioni in 2 minuti..." value={data.dream_superpower || ''} onChange={e => set('dream_superpower', e.target.value)} />
      </div>

      <div className="arco-field">
        <label className="arco-label">Cosa ti incuriosisce di più? <span className="arco-label-hint">(seleziona tutte)</span></label>
        <div className="arco-chip-group">
          {EXPECTATIONS.map(exp => (
            <div key={exp} className={`arco-chip ${(data.event_expectations || []).includes(exp) ? 'selected' : ''}`} onClick={() => toggleExp(exp)}>
              {exp}
            </div>
          ))}
        </div>
      </div>

      <div className="arco-field">
        <label className="arco-label">C&apos;è qualcosa in particolare che vorresti chiedere o approfondire? <span className="arco-label-hint">(scrivi &quot;nessuna&quot; se non ne hai)</span></label>
        <textarea className="arco-textarea" placeholder="Qualsiasi curiosità o domanda..." value={data.specific_questions || ''} onChange={e => set('specific_questions', e.target.value)} />
      </div>

      <div className="arco-field">
        <label className="arco-label">Quanto sei curioso su questi temi?</label>
        <div className="arco-slider-wrap">
          <div className="arco-slider-value">{data.excitement_level || 5}</div>
          <input type="range" className="arco-slider" min="1" max="10" value={data.excitement_level || 5} onChange={e => set('excitement_level', parseInt(e.target.value))} />
          <div className="arco-slider-labels">
            <span>1 — Poco</span>
            <span>10 — Tantissimo! 🔥</span>
          </div>
        </div>
      </div>
    </div>
  );
}
