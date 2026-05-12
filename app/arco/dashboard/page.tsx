'use client';

import { useState, useEffect, useMemo } from 'react';

const LABELS: Record<string, Record<string, string>> = {
  ai_knowledge_level: { mai_sentito: '❓ Non lo conosce', sentito_mai_usato: '👂 Sentito parlare', uso_base: '🔰 Uso base', uso_regolare: '⚡ Uso regolare', uso_avanzato: '🧠 Avanzato' },
  ai_frequency: { mai: 'Mai', raramente: 'Raramente', settimanale: 'Settimanale', quotidiano: 'Quotidiano', sempre: 'Sempre' },
  llm_knowledge: { mai_sentiti: '❌ Mai sentiti', sentiti_non_so: '🤔 Sentiti ma non so', conosco: '✅ So cosa sono' },
  change_attitude: { entusiasta: '🚀 Entusiasta', curioso: '🔍 Curioso', adattabile: '🔄 Adattabile', diffidente: '😟 Diffidente', resistente: '🛑 Resistente' },
};

function countField(responses: any[], field: string) {
  const counts: Record<string, number> = {};
  responses.forEach(r => { const v = r[field]; if (v) counts[v] = (counts[v] || 0) + 1; });
  return counts;
}

function avgField(responses: any[], field: string) {
  const vals = responses.map(r => r[field]).filter(v => typeof v === 'number');
  if (!vals.length) return 0;
  return Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10;
}

function BarChart({ data, labelMap, total }: { data: Record<string, number>; labelMap?: Record<string, string>; total: number }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return <p style={{ color: 'var(--arco-text-dim)', fontSize: '0.9rem' }}>Nessun dato</p>;
  return (
    <div className="arco-bar-chart">
      {entries.map(([key, count]) => (
        <div className="arco-bar-row" key={key}>
          <span className="arco-bar-label">{labelMap?.[key] || key}</span>
          <div className="arco-bar-track"><div className="arco-bar-fill" style={{ width: `${Math.max((count / total) * 100, 12)}%` }}>{Math.round((count / total) * 100)}%</div></div>
          <span className="arco-bar-count">{count}</span>
        </div>
      ))}
    </div>
  );
}

function FreeTextList({ responses, field }: { responses: any[]; field: string }) {
  const texts = responses.map(r => ({ text: r[field], name: `${r.participant?.first_name || ''} ${r.participant?.last_name || ''}`.trim(), role: r.participant?.role_title || '', dept: r.participant?.department || '' })).filter(t => t.text?.trim());
  if (!texts.length) return <p style={{ color: 'var(--arco-text-dim)', fontSize: '0.9rem', padding: '1rem 0' }}>Nessuna risposta ancora</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {texts.map((t, i) => (
        <div key={i} style={{ padding: '1rem 1.25rem', background: 'var(--arco-bg-input)', borderRadius: '12px', border: '1px solid var(--arco-border)' }}>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '0.5rem', color: 'var(--arco-text)' }}>&ldquo;{t.text}&rdquo;</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--arco-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>{(t.name[0] || '?')}</div>
            <span style={{ fontSize: '0.8rem', color: 'var(--arco-accent)', fontWeight: 600 }}>{t.name}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--arco-text-dim)' }}>· {t.role} · {t.dept}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailRow({ label, value, type }: { label: string; value: any; type?: 'text' | 'badge' | 'score' | 'chips' | 'bool' }) {
  if (value === null || value === undefined || value === '') return null;
  const renderValue = () => {
    if (type === 'score') return <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", color: 'var(--arco-accent)' }}>{value}<span style={{ fontSize: '0.8rem', color: 'var(--arco-text-dim)' }}>/10</span></span>;
    if (type === 'badge') return <span className="arco-badge arco-badge-red" style={{ fontSize: '0.85rem', padding: '0.3rem 0.8rem' }}>{value}</span>;
    if (type === 'chips') return <div className="arco-chip-group">{(value as string[]).map((v: string) => <span key={v} className="arco-chip selected" style={{ cursor: 'default', pointerEvents: 'none' }}>{v}</span>)}</div>;
    if (type === 'bool') return <span style={{ fontSize: '1.1rem' }}>{value ? '✅ Sì' : '❌ No'}</span>;
    return <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--arco-text)' }}>{value}</p>;
  };
  return (
    <div style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--arco-border)' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--arco-text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{label}</div>
      {renderValue()}
    </div>
  );
}

function PersonDetail({ participant, response, onBack }: { participant: any; response: any; onBack: () => void }) {
  return (
    <div className="arco-animate-in">
      <button className="arco-btn arco-btn-secondary" onClick={onBack} style={{ marginBottom: '1.5rem' }}>← Torna alla lista</button>
      <div className="arco-section" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--arco-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, color: 'white', flexShrink: 0 }}>{participant.first_name?.[0]}{participant.last_name?.[0]}</div>
        <div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{participant.first_name} {participant.last_name}</h2>
          <p style={{ color: 'var(--arco-text-muted)', fontSize: '0.9rem', margin: '0.25rem 0' }}>{participant.role_title} — {participant.department}</p>
          <p style={{ color: 'var(--arco-text-dim)', fontSize: '0.8rem' }}>{participant.email}</p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            {participant.age_range && <span className="arco-badge arco-badge-red">{participant.age_range} anni</span>}
            {participant.years_in_company && <span className="arco-badge arco-badge-yellow">{participant.years_in_company} anni in azienda</span>}
          </div>
        </div>
      </div>
      {!response ? (
        <div className="arco-section" style={{ textAlign: 'center', padding: '3rem' }}><div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div><p style={{ color: 'var(--arco-text-muted)' }}>Non ha ancora completato il questionario.</p></div>
      ) : (
        <>
          <div className="arco-section">
            <h3 className="arco-section-title">🤖 Esperienza AI</h3>
            <DetailRow label="Livello" value={LABELS.ai_knowledge_level[response.ai_knowledge_level]} type="badge" />
            <DetailRow label="Frequenza utilizzo" value={LABELS.ai_frequency[response.ai_frequency]} type="badge" />
            <DetailRow label="Conoscenza LLM" value={response.llm_knowledge ? LABELS.llm_knowledge[response.llm_knowledge] : null} type="badge" />
            <DetailRow label="Strumenti usati" value={response.ai_tools_used?.length ? response.ai_tools_used : null} type="chips" />
            <DetailRow label="Casi d'uso" value={response.ai_use_cases?.length ? response.ai_use_cases : null} type="chips" />
            <DetailRow label="Come la usa per lavoro" value={response.ai_work_examples} />
          </div>
          <div className="arco-section">
            <h3 className="arco-section-title">🔄 Mindset — Approccio al cambiamento</h3>
            <DetailRow label="Atteggiamento" value={response.change_attitude ? LABELS.change_attitude[response.change_attitude] : null} type="badge" />
            <DetailRow label="Apertura all'AI (1-10)" value={response.change_openness} type="score" />
            <DetailRow label="Preoccupazione principale" value={response.change_biggest_fear} />
          </div>
          <div className="arco-section">
            <h3 className="arco-section-title">💡 Curiosità e aspettative</h3>
            <DetailRow label="Cosa automatizzerebbe" value={response.what_would_automate} />
            <DetailRow label="Attività che ruba più tempo" value={response.biggest_time_waster} />
            <DetailRow label="Superpotere desiderato" value={response.dream_superpower} />
            <DetailRow label="Cosa lo incuriosisce" value={response.event_expectations?.length ? response.event_expectations : null} type="chips" />
            <DetailRow label="Domande" value={response.specific_questions} />
          </div>
        </>
      )}
    </div>
  );
}

type TabKey = 'overview' | 'ai' | 'mindset' | 'freetext' | 'participants';

export default function DashboardPage() {
  const [participants, setParticipants] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabKey>('overview');
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/arco/dashboard?t=' + Date.now(), { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(`Errore API: ${r.status}`); return r.json(); })
      .then(d => { setParticipants(d.participants || []); setResponses(d.responses || []); })
      .catch(e => { console.error(e); setError(e.message); })
      .finally(() => setLoading(false));
  }, []);

  const completed = participants.filter(p => p.survey_completed).length;
  const total = participants.length;
  const rate = total ? Math.round((completed / total) * 100) : 0;

  const deptCounts = useMemo(() => { const c: Record<string, number> = {}; participants.forEach(p => { if (p.department) c[p.department] = (c[p.department] || 0) + 1; }); return c; }, [participants]);

  const TABS: { key: TabKey; icon: string; label: string }[] = [
    { key: 'overview', icon: '📊', label: 'Overview' },
    { key: 'ai', icon: '🤖', label: 'AI' },
    { key: 'mindset', icon: '🔄', label: 'Mindset' },
    { key: 'freetext', icon: '💬', label: 'Risposte' },
    { key: 'participants', icon: '👥', label: 'Persone' },
  ];

  const Header = () => (
    <header className="arco-header">
      <div className="arco-logo-text"><span>A</span>RCO <span>G</span>roup</div>
      <div className="arco-header-subtitle">Dashboard Analytics</div>
    </header>
  );

  if (loading) return (<div className="arco-page"><div className="arco-bg-pattern" /><Header /><div className="arco-container wide" style={{ textAlign: 'center', paddingTop: '4rem' }}><div className="arco-spinner" /><p style={{ color: 'var(--arco-text-muted)', marginTop: '1rem' }}>Caricamento dati...</p></div></div>);
  if (error) return (<div className="arco-page"><div className="arco-bg-pattern" /><Header /><div className="arco-container wide" style={{ textAlign: 'center', paddingTop: '4rem' }}><div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div><h2>Errore</h2><p style={{ color: 'var(--arco-text-muted)' }}>{error}</p><button className="arco-btn arco-btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => window.location.reload()}>🔄 Riprova</button></div></div>);

  if (selectedPerson) {
    const p = participants.find(x => x.id === selectedPerson);
    const r = responses.find(x => x.participant_id === selectedPerson);
    if (!p) { setSelectedPerson(null); return null; }
    return (<div className="arco-page"><div className="arco-bg-pattern" /><Header /><div className="arco-container wide"><PersonDetail participant={p} response={r} onBack={() => setSelectedPerson(null)} /></div></div>);
  }

  return (
    <div className="arco-page">
      <div className="arco-bg-pattern" />
      <Header />
      <div className="arco-container wide">
        <div className="arco-dash-grid arco-animate-in">
          <div className="arco-stat-card"><div className="arco-stat-label">Registrati</div><div className="arco-stat-value">{total}</div><div className="arco-stat-sub">{rate}% completati</div></div>
          <div className="arco-stat-card"><div className="arco-stat-label">Completati</div><div className="arco-stat-value">{completed}</div><div className="arco-stat-sub">su {total} registrati</div></div>
          <div className="arco-stat-card"><div className="arco-stat-label">Tempo medio compilazione</div><div className="arco-stat-value">{avgField(responses, 'completion_time_seconds') ? Math.round(avgField(responses, 'completion_time_seconds') / 60) + '\'' : '—'}</div></div>
        </div>

        <div className="arco-tabs">{TABS.map(t => (<button key={t.key} className={`arco-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}><span className="arco-tab-icon">{t.icon}</span><span className="arco-tab-label">{t.label}</span></button>))}</div>

        {tab === 'overview' && (
          <div className="arco-animate-in">
            <div className="arco-section"><h3 className="arco-section-title">Distribuzione per reparto</h3><BarChart data={deptCounts} total={total || 1} /></div>
            <div className="arco-dash-grid">
              <div className="arco-stat-card"><div className="arco-stat-label">Usa AI per lavoro</div><div className="arco-stat-value">{responses.filter(r => r.ai_work_usage || (r.ai_use_cases && !r.ai_use_cases.includes('Non lo uso per lavoro'))).length}<span style={{ fontSize: '1rem', color: 'var(--arco-text-dim)' }}>/{responses.length}</span></div></div>
            </div>
            <div className="arco-section"><h3 className="arco-section-title">📋 Cosa li incuriosisce di più</h3>{(() => { const e: Record<string, number> = {}; responses.forEach(r => (r.event_expectations || []).forEach((x: string) => { e[x] = (e[x] || 0) + 1; })); return <BarChart data={e} total={responses.length || 1} />; })()}</div>
          </div>
        )}

        {tab === 'ai' && (
          <div className="arco-animate-in">
            <div className="arco-section"><h3 className="arco-section-title">Livello conoscenza AI</h3><BarChart data={countField(responses, 'ai_knowledge_level')} labelMap={LABELS.ai_knowledge_level} total={responses.length || 1} /></div>
            <div className="arco-section"><h3 className="arco-section-title">Conoscenza LLM</h3><BarChart data={countField(responses, 'llm_knowledge')} labelMap={LABELS.llm_knowledge} total={responses.length || 1} /></div>
            <div className="arco-section"><h3 className="arco-section-title">Frequenza utilizzo</h3><BarChart data={countField(responses, 'ai_frequency')} labelMap={LABELS.ai_frequency} total={responses.length || 1} /></div>
            <div className="arco-section"><h3 className="arco-section-title">Strumenti AI conosciuti</h3>{(() => { const t: Record<string, number> = {}; responses.forEach(r => (r.ai_tools_used || []).forEach((x: string) => { t[x] = (t[x] || 0) + 1; })); return <BarChart data={t} total={responses.length || 1} />; })()}</div>
            <div className="arco-section"><h3 className="arco-section-title">Casi d&apos;uso AI</h3>{(() => { const u: Record<string, number> = {}; responses.forEach(r => (r.ai_use_cases || []).forEach((x: string) => { u[x] = (u[x] || 0) + 1; })); return <BarChart data={u} total={responses.length || 1} />; })()}</div>
            <div className="arco-section"><h3 className="arco-section-title">💼 Come usano AI al lavoro</h3><FreeTextList responses={responses} field="ai_work_examples" /></div>
          </div>
        )}

        {tab === 'mindset' && (
          <div className="arco-animate-in">
            <div className="arco-section"><h3 className="arco-section-title">Atteggiamento verso il cambiamento</h3><BarChart data={countField(responses, 'change_attitude')} labelMap={LABELS.change_attitude} total={responses.length || 1} /></div>
            <div className="arco-section">
              <h3 className="arco-section-title">Apertura all&apos;AI (media)</h3>
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div style={{ fontSize: '4rem', fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", color: 'var(--arco-accent)' }}>
                  {avgField(responses, 'change_openness') || '—'}<span style={{ fontSize: '1.2rem', color: 'var(--arco-text-dim)' }}>/10</span>
                </div>
                <p style={{ color: 'var(--arco-text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Punteggio medio di apertura all&apos;introduzione dell&apos;AI</p>
              </div>
              <div className="arco-bar-chart">
                {[1,2,3,4,5,6,7,8,9,10].map(n => {
                  const count = responses.filter(r => r.change_openness === n).length;
                  return count > 0 ? (
                    <div className="arco-bar-row" key={n}>
                      <span className="arco-bar-label">{n}/10</span>
                      <div className="arco-bar-track"><div className="arco-bar-fill" style={{ width: `${Math.max((count / (responses.length || 1)) * 100, 12)}%` }}>{Math.round((count / (responses.length || 1)) * 100)}%</div></div>
                      <span className="arco-bar-count">{count}</span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
            <div className="arco-section"><h3 className="arco-section-title">😰 Preoccupazioni principali</h3><FreeTextList responses={responses} field="change_biggest_fear" /></div>
          </div>
        )}

        {tab === 'freetext' && (
          <div className="arco-animate-in">
            <div className="arco-section"><h3 className="arco-section-title">🤖 Cosa automatizzerebbero</h3><FreeTextList responses={responses} field="what_would_automate" /></div>
            <div className="arco-section"><h3 className="arco-section-title">⏰ Attività che rubano più tempo</h3><FreeTextList responses={responses} field="biggest_time_waster" /></div>
            <div className="arco-section"><h3 className="arco-section-title">🦸 Superpotere desiderato</h3><FreeTextList responses={responses} field="dream_superpower" /></div>
            <div className="arco-section"><h3 className="arco-section-title">❓ Domande</h3><FreeTextList responses={responses} field="specific_questions" /></div>
          </div>
        )}

        {tab === 'participants' && (
          <div className="arco-section arco-animate-in">
            <h3 className="arco-section-title">Partecipanti ({total})</h3>
            <p style={{ color: 'var(--arco-text-dim)', fontSize: '0.85rem', marginBottom: '1rem' }}>Clicca su una persona per vedere le sue risposte</p>
            {participants.map(p => (
              <div className="arco-participant-row" key={p.id} onClick={() => setSelectedPerson(p.id)} style={{ cursor: 'pointer' }}>
                <div className="arco-participant-avatar">{(p.first_name?.[0] || '') + (p.last_name?.[0] || '')}</div>
                <div className="arco-participant-info">
                  <div className="arco-participant-name">{p.first_name} {p.last_name}</div>
                  <div className="arco-participant-role">{p.role_title} — {p.department}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--arco-text-dim)', marginTop: '2px' }}>{p.email}</div>
                </div>
                <span className={`arco-badge ${p.survey_completed ? 'arco-badge-green' : 'arco-badge-yellow'}`}>{p.survey_completed ? '✅ Completato' : '⏳ In attesa'}</span>
              </div>
            ))}
            {!participants.length && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--arco-text-dim)' }}><div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div><p>Nessun partecipante registrato</p></div>}
          </div>
        )}
      </div>
    </div>
  );
}
