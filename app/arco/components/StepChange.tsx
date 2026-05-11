'use client';

const CHANGE_OPTIONS = [
  { value: 'entusiasta', emoji: '🚀', label: 'Entusiasta — Non vedo l\'ora!' },
  { value: 'curioso', emoji: '🤔', label: 'Curioso — Aperto a scoprire' },
  { value: 'neutro', emoji: '😐', label: 'Neutro — Dipende dal contesto' },
  { value: 'preoccupato', emoji: '😟', label: 'Preoccupato — Mi genera ansia' },
  { value: 'resistente', emoji: '🛑', label: 'Resistente — Preferisco la stabilità' },
];

const PAST_EXP = [
  { value: 'molto_positiva', emoji: '🌟', label: 'Molto positiva' },
  { value: 'positiva', emoji: '👍', label: 'Positiva' },
  { value: 'neutra', emoji: '➖', label: 'Neutra' },
  { value: 'negativa', emoji: '👎', label: 'Negativa' },
  { value: 'molto_negativa', emoji: '💔', label: 'Molto negativa' },
];

interface Props { data: any; onChange: (d: any) => void; }

export default function StepChange({ data, onChange }: Props) {
  const set = (k: string, v: any) => onChange({ ...data, [k]: v });

  return (
    <div className="arco-section arco-animate-in">
      <div className="arco-section-number">2</div>
      <h2 className="arco-section-title">Il tuo rapporto con il cambiamento</h2>
      <p className="arco-section-desc">Non ci sono risposte giuste o sbagliate. Vogliamo capire come vivi il cambiamento per rendere il workshop il più utile possibile per te.</p>

      <div className="arco-field">
        <label className="arco-label">Quando pensi al &quot;cambiamento&quot; in ambito lavorativo, come ti senti? *</label>
        <div className="arco-radio-group">
          {CHANGE_OPTIONS.map(o => (
            <label key={o.value} className={`arco-radio-card ${data.change_attitude === o.value ? 'selected' : ''}`}>
              <input type="radio" name="change_attitude" value={o.value} onChange={() => set('change_attitude', o.value)} />
              <span className="arco-radio-dot" />
              <span className="arco-radio-emoji">{o.emoji}</span>
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="arco-field">
        <label className="arco-label">Qual è la tua paura più grande legata al cambiamento?</label>
        <textarea className="arco-textarea" placeholder="Scrivi liberamente... es: perdere il controllo, non essere all'altezza, cambiare abitudini..." value={data.change_biggest_fear || ''} onChange={e => set('change_biggest_fear', e.target.value)} />
      </div>

      <div className="arco-field">
        <label className="arco-label">Come sono state le tue esperienze passate con i cambiamenti aziendali? *</label>
        <div className="arco-radio-group">
          {PAST_EXP.map(o => (
            <label key={o.value} className={`arco-radio-card ${data.change_past_experience === o.value ? 'selected' : ''}`}>
              <input type="radio" name="change_past_experience" value={o.value} onChange={() => set('change_past_experience', o.value)} />
              <span className="arco-radio-dot" />
              <span className="arco-radio-emoji">{o.emoji}</span>
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="arco-field">
        <label className="arco-label">Quanto ti senti aperto a provare cose nuove? *</label>
        <div className="arco-slider-wrap">
          <div className="arco-slider-value">{data.change_openness || 5}</div>
          <input type="range" className="arco-slider" min="1" max="10" value={data.change_openness || 5} onChange={e => set('change_openness', parseInt(e.target.value))} />
          <div className="arco-slider-labels">
            <span>1 — Per niente</span>
            <span>10 — Totalmente</span>
          </div>
        </div>
      </div>
    </div>
  );
}
