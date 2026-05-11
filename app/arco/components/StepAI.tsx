'use client';

const AI_LEVELS = [
  { value: 'mai_sentito', emoji: '❓', label: 'Non so cosa sia' },
  { value: 'sentito_mai_usato', emoji: '👂', label: 'Ne ho sentito parlare ma non l\'ho mai usata' },
  { value: 'uso_base', emoji: '🔰', label: 'L\'ho provata qualche volta (es: ChatGPT)' },
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
  { value: 'base_html', label: 'So cos\'è HTML/CSS ma niente di più' },
  { value: 'qualche_linguaggio', label: 'Ho provato qualche linguaggio' },
  { value: 'programmatore', label: 'Programmo occasionalmente' },
  { value: 'esperto', label: 'Sono un programmatore esperto' },
];

interface Props { data: any; onChange: (d: any) => void; }

export default function StepAI({ data, onChange }: Props) {
  const set = (k: string, v: any) => onChange({ ...data, [k]: v });

  const toggleTool = (tool: string) => {
    const current = data.ai_tools_used || [];
    const next = current.includes(tool) ? current.filter((t: string) => t !== tool) : [...current, tool];
    set('ai_tools_used', next);
  };

  const toggleWorkUsage = () => set('ai_work_usage', !data.ai_work_usage);

  return (
    <div className="arco-section arco-animate-in">
      <div className="arco-section-number">3</div>
      <h2 className="arco-section-title">Tu e l&apos;Intelligenza Artificiale</h2>
      <p className="arco-section-desc">Aiutaci a capire il tuo livello attuale con l&apos;AI. Zero giudizi — ogni livello è il punto di partenza perfetto!</p>

      <div className="arco-field">
        <label className="arco-label">Qual è il tuo livello di conoscenza dell&apos;AI? *</label>
        <div className="arco-radio-group">
          {AI_LEVELS.map(o => (
            <label key={o.value} className={`arco-radio-card ${data.ai_knowledge_level === o.value ? 'selected' : ''}`}>
              <input type="radio" name="ai_level" value={o.value} onChange={() => set('ai_knowledge_level', o.value)} />
              <span className="arco-radio-dot" />
              <span className="arco-radio-emoji">{o.emoji}</span>
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="arco-field">
        <label className="arco-label">Quali strumenti AI hai usato? <span className="arco-label-hint">(seleziona tutti quelli che conosci)</span></label>
        <div className="arco-chip-group">
          {AI_TOOLS.map(t => (
            <label key={t} className={`arco-chip ${(data.ai_tools_used || []).includes(t) ? 'selected' : ''}`} onClick={() => toggleTool(t)}>
              <input type="checkbox" />
              {t}
            </label>
          ))}
        </div>
      </div>

      <div className="arco-field">
        <label className="arco-label">Con che frequenza usi strumenti di AI? *</label>
        <div className="arco-radio-group">
          {FREQ.map(o => (
            <label key={o.value} className={`arco-radio-card ${data.ai_frequency === o.value ? 'selected' : ''}`}>
              <input type="radio" name="ai_freq" value={o.value} onChange={() => set('ai_frequency', o.value)} />
              <span className="arco-radio-dot" />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="arco-field">
        <div className="arco-toggle-row" onClick={toggleWorkUsage} style={{ cursor: 'pointer' }}>
          <span className="arco-toggle-label">Usi l&apos;AI per il tuo lavoro?</span>
          <div className={`arco-toggle ${data.ai_work_usage ? 'on' : ''}`}><div className="arco-toggle-knob" /></div>
        </div>
        {data.ai_work_usage && (
          <textarea className="arco-textarea" placeholder="Raccontaci come la usi nel lavoro..." value={data.ai_work_examples || ''} onChange={e => set('ai_work_examples', e.target.value)} style={{ marginTop: '0.5rem' }} />
        )}
      </div>

      <div className="arco-field">
        <label className="arco-label">Hai mai sentito parlare di &quot;Vibe Coding&quot;? (creare software parlando con l&apos;AI)</label>
        <div className="arco-toggle-row" onClick={() => set('knows_vibe_coding', !data.knows_vibe_coding)} style={{ cursor: 'pointer' }}>
          <span className="arco-toggle-label">Sì, ne ho sentito parlare</span>
          <div className={`arco-toggle ${data.knows_vibe_coding ? 'on' : ''}`}><div className="arco-toggle-knob" /></div>
        </div>
      </div>

      <div className="arco-field">
        <label className="arco-label">La tua esperienza con il coding/programmazione *</label>
        <div className="arco-radio-group">
          {CODING.map(o => (
            <label key={o.value} className={`arco-radio-card ${data.coding_experience === o.value ? 'selected' : ''}`}>
              <input type="radio" name="coding" value={o.value} onChange={() => set('coding_experience', o.value)} />
              <span className="arco-radio-dot" />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="arco-field">
        <div className="arco-toggle-row" onClick={() => set('interested_in_building_tools', !data.interested_in_building_tools)} style={{ cursor: 'pointer' }}>
          <span className="arco-toggle-label">Ti piacerebbe poter creare i tuoi strumenti digitali senza saper programmare?</span>
          <div className={`arco-toggle ${data.interested_in_building_tools ? 'on' : ''}`}><div className="arco-toggle-knob" /></div>
        </div>
      </div>
    </div>
  );
}
