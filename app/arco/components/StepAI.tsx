'use client';

const AI_LEVELS = [
  { value: 'mai_sentito', emoji: '❓', label: 'Non so bene cosa sia' },
  { value: 'sentito_mai_usato', emoji: '👂', label: "Ne ho sentito parlare ma non l'ho mai usata" },
  { value: 'uso_base', emoji: '🔰', label: "L'ho provata qualche volta (es: ChatGPT)" },
  { value: 'uso_regolare', emoji: '⚡', label: 'La uso regolarmente' },
  { value: 'uso_avanzato', emoji: '🧠', label: 'Uso avanzato — la integro nel mio lavoro' },
];

const FREQ = [
  { value: 'mai', label: 'Mai' },
  { value: 'raramente', label: 'Raramente (1-2 volte al mese)' },
  { value: 'settimanale', label: 'Settimanale' },
  { value: 'quotidiano', label: 'Ogni giorno' },
  { value: 'sempre', label: 'Costantemente — è il mio copilota' },
];

const AI_TOOLS = [
  'ChatGPT', 'Google Gemini', 'Claude', 'Microsoft Copilot', 'Siri / Alexa',
  'Midjourney / DALL-E', 'Canva AI', 'Notion AI', 'GitHub Copilot', 'Altro',
];

const CODING = [
  { value: 'nessuna', label: 'Nessuna esperienza' },
  { value: 'base_html', label: "So cos'è HTML/CSS ma niente di più" },
  { value: 'qualche_linguaggio', label: 'Ho provato qualche linguaggio' },
  { value: 'programmatore', label: 'Programmo occasionalmente' },
  { value: 'esperto', label: 'Sono un programmatore esperto' },
];

const AI_USE_CASES = [
  'Scrivere email e comunicazioni',
  'Riassumere documenti o riunioni',
  'Analizzare dati e report',
  'Creare presentazioni',
  'Generare contenuti marketing',
  'Tradurre testi',
  'Scrivere o correggere codice',
  'Cercare informazioni in modo rapido',
  'Brainstorming e generazione idee',
  'Non lo uso per lavoro',
];

interface Props { data: any; onChange: (d: any) => void; }

export default function StepAI({ data, onChange }: Props) {
  const set = (k: string, v: any) => onChange({ ...data, [k]: v });

  const toggleTool = (tool: string) => {
    const current = data.ai_tools_used || [];
    const next = current.includes(tool) ? current.filter((t: string) => t !== tool) : [...current, tool];
    set('ai_tools_used', next);
  };

  const toggleUseCase = (uc: string) => {
    const current = data.ai_use_cases || [];
    const next = current.includes(uc) ? current.filter((u: string) => u !== uc) : [...current, uc];
    set('ai_use_cases', next);
  };

  return (
    <div className="arco-section arco-animate-in">
      <div className="arco-section-number">2</div>
      <h2 className="arco-section-title">La tua esperienza con l&apos;AI</h2>
      <p className="arco-section-desc">Aiutaci a capire il tuo livello attuale. Non ci sono risposte giuste o sbagliate!</p>

      <div className="arco-field">
        <label className="arco-label">Come descriveresti il tuo livello con l&apos;Intelligenza Artificiale? *</label>
        <div className="arco-radio-group">
          {AI_LEVELS.map(o => (
            <div key={o.value} className={`arco-radio-card ${data.ai_knowledge_level === o.value ? 'selected' : ''}`} onClick={() => set('ai_knowledge_level', o.value)}>
              <span className="arco-radio-dot" />
              <span className="arco-radio-emoji">{o.emoji}</span>
              <span>{o.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="arco-field">
        <label className="arco-label">Quali strumenti AI conosci o hai provato? <span className="arco-label-hint">(seleziona tutti)</span></label>
        <div className="arco-chip-group">
          {AI_TOOLS.map(t => (
            <div key={t} className={`arco-chip ${(data.ai_tools_used || []).includes(t) ? 'selected' : ''}`} onClick={() => toggleTool(t)}>
              {t}
            </div>
          ))}
        </div>
      </div>

      <div className="arco-field">
        <label className="arco-label">Con che frequenza usi strumenti di AI? *</label>
        <div className="arco-radio-group">
          {FREQ.map(o => (
            <div key={o.value} className={`arco-radio-card ${data.ai_frequency === o.value ? 'selected' : ''}`} onClick={() => set('ai_frequency', o.value)}>
              <span className="arco-radio-dot" />
              <span>{o.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="arco-field">
        <label className="arco-label">Per cosa la usi (o la useresti)? <span className="arco-label-hint">(seleziona tutte)</span></label>
        <div className="arco-chip-group">
          {AI_USE_CASES.map(uc => (
            <div key={uc} className={`arco-chip ${(data.ai_use_cases || []).includes(uc) ? 'selected' : ''}`} onClick={() => toggleUseCase(uc)}>
              {uc}
            </div>
          ))}
        </div>
      </div>

      <div className="arco-field">
        <label className="arco-label">Se la usi per lavoro, raccontaci come <span className="arco-label-hint">(opzionale)</span></label>
        <textarea className="arco-textarea" placeholder="Es: uso ChatGPT per preparare email commerciali, sintetizzare verbali..." value={data.ai_work_examples || ''} onChange={e => set('ai_work_examples', e.target.value)} />
      </div>

      <div className="arco-field">
        <div className="arco-toggle-row" onClick={() => set('knows_vibe_coding', !data.knows_vibe_coding)} style={{ cursor: 'pointer' }}>
          <span className="arco-toggle-label">Hai mai sentito parlare di &quot;Vibe Coding&quot;?</span>
          <div className={`arco-toggle ${data.knows_vibe_coding ? 'on' : ''}`}><div className="arco-toggle-knob" /></div>
        </div>
      </div>

      <div className="arco-field">
        <label className="arco-label">La tua esperienza con il coding/programmazione *</label>
        <div className="arco-radio-group">
          {CODING.map(o => (
            <div key={o.value} className={`arco-radio-card ${data.coding_experience === o.value ? 'selected' : ''}`} onClick={() => set('coding_experience', o.value)}>
              <span className="arco-radio-dot" />
              <span>{o.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="arco-field">
        <div className="arco-toggle-row" onClick={() => set('interested_in_building_tools', !data.interested_in_building_tools)} style={{ cursor: 'pointer' }}>
          <span className="arco-toggle-label">Ti piacerebbe poter creare strumenti digitali senza saper programmare?</span>
          <div className={`arco-toggle ${data.interested_in_building_tools ? 'on' : ''}`}><div className="arco-toggle-knob" /></div>
        </div>
      </div>
    </div>
  );
}
