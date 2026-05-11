'use client';

const DEPARTMENTS = [
  'CEO / Direzione Generale',
  'Top Management',
  'Middle Management',
  'TELCO',
  'Formazione',
  'No Profit',
  'HR',
  'Finance & Administration',
  'Controllo di Gestione',
  'Area Commerciale',
  'Social Media / Marketing',
  'Altro',
];

const AGE_RANGES = ['18-25', '26-35', '36-45', '46-55', '56-65', '65+'];

interface Props {
  data: any;
  onChange: (d: any) => void;
}

export default function StepRegistration({ data, onChange }: Props) {
  const set = (key: string, val: any) => onChange({ ...data, [key]: val });

  return (
    <div className="arco-section arco-animate-in">
      <div className="arco-section-number">1</div>
      <h2 className="arco-section-title">Chi sei</h2>
      <p className="arco-section-desc">Raccontaci un po' di te per personalizzare l'esperienza del workshop.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="arco-field">
          <label className="arco-label">Nome *</label>
          <input className="arco-input" placeholder="Il tuo nome" value={data.first_name || ''} onChange={e => set('first_name', e.target.value)} />
        </div>
        <div className="arco-field">
          <label className="arco-label">Cognome *</label>
          <input className="arco-input" placeholder="Il tuo cognome" value={data.last_name || ''} onChange={e => set('last_name', e.target.value)} />
        </div>
      </div>

      <div className="arco-field">
        <label className="arco-label">Email aziendale *</label>
        <input className="arco-input" type="email" placeholder="nome@arcogroup.it" value={data.email || ''} onChange={e => set('email', e.target.value)} />
      </div>

      <div className="arco-field">
        <label className="arco-label">Telefono <span className="arco-label-hint">(opzionale)</span></label>
        <input className="arco-input" type="tel" placeholder="+39 ..." value={data.phone || ''} onChange={e => set('phone', e.target.value)} />
      </div>

      <div className="arco-field">
        <label className="arco-label">Il tuo ruolo in azienda *</label>
        <input className="arco-input" placeholder="es: Account Manager, Direttore Vendite..." value={data.role_title || ''} onChange={e => set('role_title', e.target.value)} />
      </div>

      <div className="arco-field">
        <label className="arco-label">Reparto / Area *</label>
        <select className="arco-select" value={data.department || ''} onChange={e => set('department', e.target.value)}>
          <option value="">Seleziona il tuo reparto</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="arco-field">
          <label className="arco-label">Anni in azienda</label>
          <input className="arco-input" type="number" min="0" max="50" placeholder="es: 5" value={data.years_in_company || ''} onChange={e => set('years_in_company', parseInt(e.target.value) || null)} />
        </div>
        <div className="arco-field">
          <label className="arco-label">Fascia d'età</label>
          <select className="arco-select" value={data.age_range || ''} onChange={e => set('age_range', e.target.value)}>
            <option value="">Seleziona</option>
            {AGE_RANGES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
