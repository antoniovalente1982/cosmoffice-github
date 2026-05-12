'use client';

const CHANGE_ATTITUDES = [
  { value: 'entusiasta', emoji: '🚀', label: 'Li accolgo con entusiasmo — amo le novità' },
  { value: 'curioso', emoji: '🔍', label: 'Sono curioso/a, ma preferisco capire bene prima' },
  { value: 'adattabile', emoji: '🔄', label: 'Mi adatto se necessario, ma preferisco la routine' },
  { value: 'diffidente', emoji: '😟', label: 'Sono un po\' diffidente — i cambiamenti mi mettono ansia' },
  { value: 'resistente', emoji: '🛑', label: 'Li evito finché posso' },
];

interface Props { data: any; onChange: (d: any) => void; }

export default function StepMindset({ data, onChange }: Props) {
  const set = (k: string, v: any) => onChange({ ...data, [k]: v });

  return (
    <div className="arco-section arco-animate-in">
      <div className="arco-section-number">3</div>
      <h2 className="arco-section-title">Il tuo approccio al cambiamento</h2>
      <p className="arco-section-desc">Capire come affronti le novità ci aiuta a rendere l&apos;evento più utile per te. Tutti i campi sono obbligatori.</p>

      <div className="arco-field">
        <label className="arco-label">Come reagisci di solito ai cambiamenti nel tuo modo di lavorare?</label>
        <div className="arco-radio-group">
          {CHANGE_ATTITUDES.map(o => (
            <div key={o.value} className={`arco-radio-card ${data.change_attitude === o.value ? 'selected' : ''}`} onClick={() => set('change_attitude', o.value)}>
              <span className="arco-radio-dot" />
              <span className="arco-radio-emoji">{o.emoji}</span>
              <span>{o.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="arco-field">
        <label className="arco-label">Quanto ti senti aperto/a all&apos;introduzione dell&apos;AI nel tuo lavoro quotidiano?</label>
        <div className="arco-scale-group">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <div
              key={n}
              className={`arco-scale-btn ${data.change_openness === n ? 'selected' : ''}`}
              onClick={() => set('change_openness', n)}
            >
              {n}
            </div>
          ))}
        </div>
        <div className="arco-scale-labels">
          <span>😰 Per niente</span>
          <span>🤩 Totalmente</span>
        </div>
      </div>

      <div className="arco-field">
        <label className="arco-label">Qual è la tua preoccupazione più grande riguardo all&apos;AI nel lavoro? <span className="arco-label-hint">(scrivi &quot;nessuna&quot; se non ne hai)</span></label>
        <textarea className="arco-textarea" placeholder="Es: paura di essere sostituito, non capire come usarla, perdere il tocco umano..." value={data.change_biggest_fear || ''} onChange={e => set('change_biggest_fear', e.target.value)} />
      </div>
    </div>
  );
}
