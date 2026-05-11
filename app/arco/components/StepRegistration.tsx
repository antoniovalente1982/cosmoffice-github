'use client';

interface Props { data: any; onChange: (d: any) => void; }

const DEPARTMENTS = [
  'CEO / Direzione Generale',
  'Amministrazione / Finanza',
  'Marketing / Comunicazione',
  'Commerciale / Vendite',
  'Risorse Umane',
  'IT / Sistemi Informativi',
  'Operations / Produzione',
  'Logistica',
  'Legale',
  'Altro',
];

const AGE_RANGES = ['18-25', '26-35', '36-45', '46-55', '56+'];

export default function StepRegistration({ data, onChange }: Props) {
  const set = (k: string, v: any) => onChange({ ...data, [k]: v });

  return (
    <div className="arco-section arco-animate-in">
      <div className="arco-section-number">1</div>
      <h2 className="arco-section-title">Chi sei</h2>
      <p className="arco-section-desc">Iniziamo con qualche dato per conoscerti meglio. I campi contrassegnati con l&apos;asterisco (*) sono obbligatori.</p>

      <div className="arco-field" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label className="arco-label">Nome *</label>
          <input className="arco-input" placeholder="Es: Marco" value={data.first_name || ''} onChange={e => set('first_name', e.target.value)} />
        </div>
        <div>
          <label className="arco-label">Cognome *</label>
          <input className="arco-input" placeholder="Es: Rossi" value={data.last_name || ''} onChange={e => set('last_name', e.target.value)} />
        </div>
      </div>

      <div className="arco-field">
        <label className="arco-label">Email aziendale *</label>
        <input className="arco-input" type="email" placeholder="nome@arcogroup.it" value={data.email || ''} onChange={e => set('email', e.target.value)} />
      </div>

      <div className="arco-field">
        <label className="arco-label">Ruolo <span className="arco-label-hint">(opzionale)</span></label>
        <input className="arco-input" placeholder="Es: Responsabile Marketing" value={data.role_title || ''} onChange={e => set('role_title', e.target.value)} />
      </div>

      <div className="arco-field">
        <label className="arco-label">Reparto *</label>
        <select className="arco-select" value={data.department || ''} onChange={e => set('department', e.target.value)}>
          <option value="">Seleziona...</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="arco-field" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label className="arco-label">Fascia d&apos;età <span className="arco-label-hint">(opzionale)</span></label>
          <select className="arco-select" value={data.age_range || ''} onChange={e => set('age_range', e.target.value)}>
            <option value="">Seleziona...</option>
            {AGE_RANGES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="arco-label">Anni in azienda <span className="arco-label-hint">(opzionale)</span></label>
          <input className="arco-input" type="number" min="0" max="50" placeholder="Es: 5" value={data.years_in_company || ''} onChange={e => set('years_in_company', parseInt(e.target.value) || null)} />
        </div>
      </div>
    </div>
  );
}
