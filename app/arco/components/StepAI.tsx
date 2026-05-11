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
  'Midjourney / DALL-E', 'Canva AI', 'Notion AI', 'Altro',
];

const AI_USE_CASES = [
  'Scrivere email e comunicazioni',
  'Riassumere documenti o riunioni',
  'Analizzare dati e report',
  'Creare presentazioni',
  'Generare contenuti marketing',
  'Tradurre testi',
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
      <p className="arco-section-desc">Aiutaci a capire il tuo livello attuale. I campi con l&apos;asterisco (*) sono obbligatori.</p>

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
        <label className="arco-label">Quali strumenti AI conosci o hai provato? <span className="arco-label-hint">(opzionale, seleziona tutti)</span></label>
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
        <label className="arco-label">Per cosa la usi (o la useresti)? <span className="arco-label-hint">(opzionale, seleziona tutte)</span></label>
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
        <label className="arco-label">Hai mai sentito parlare di &quot;LLM&quot; (Large Language Models)? <span className="arco-label-hint">(opzionale)</span></label>
        <div className="arco-radio-group">
          {[
            { value: 'mai_sentiti', label: 'No, mai sentiti nominare' },
            { value: 'sentiti_non_so', label: 'Li ho sentiti ma non so bene cosa siano' },
            { value: 'conosco', label: 'Sì, so a grandi linee come funzionano' },
          ].map(o => (
            <div key={o.value} className={`arco-radio-card ${data.llm_knowledge === o.value ? 'selected' : ''}`} onClick={() => set('llm_knowledge', o.value)}>
              <span className="arco-radio-dot" />
              <span>{o.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
