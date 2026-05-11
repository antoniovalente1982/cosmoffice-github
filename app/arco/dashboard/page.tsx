'use client';

import { useState, useEffect, useMemo } from 'react';

const LABELS: Record<string, Record<string, string>> = {
  change_attitude: { entusiasta: '🚀 Entusiasta', curioso: '🤔 Curioso', neutro: '😐 Neutro', preoccupato: '😟 Preoccupato', resistente: '🛑 Resistente' },
  ai_knowledge_level: { mai_sentito: '❓ Non lo conosce', sentito_mai_usato: '👂 Sentito parlare', uso_base: '🔰 Uso base', uso_regolare: '⚡ Uso regolare', uso_avanzato: '🧠 Avanzato' },
  ai_frequency: { mai: 'Mai', raramente: 'Raramente', settimanale: 'Settimanale', quotidiano: 'Quotidiano', sempre: 'Sempre' },
  ai_opportunity_or_threat: { grande_opportunita: '🌟 Grande opportunità', opportunita: '👍 Opportunità', neutro: '⚖️ Neutro', minaccia: '⚠️ Minaccia', grande_minaccia: '🔴 Grande minaccia' },
  coding_experience: { nessuna: 'Nessuna', base_html: 'HTML base', qualche_linguaggio: 'Qualche linguaggio', programmatore: 'Programmatore', esperto: 'Esperto' },
  change_past_experience: { molto_positiva: '🌟 Molto positiva', positiva: '👍 Positiva', neutra: '➖ Neutra', negativa: '👎 Negativa', molto_negativa: '💔 Molto negativa' },
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
          <div className="arco-bar-track">
            <div className="arco-bar-fill" style={{ width: `${Math.max((count / total) * 100, 12)}%` }}>
              {Math.round((count / total) * 100)}%
            </div>
          </div>
          <span className="arco-bar-count">{count}</span>
        </div>
      ))}
    </div>
  );
}

function ToolsChart({ responses }: { responses: any[] }) {
  const toolCounts: Record<string, number> = {};
  responses.forEach(r => (r.ai_tools_used || []).forEach((t: string) => { toolCounts[t] = (toolCounts[t] || 0) + 1; }));
  return <BarChart data={toolCounts} total={responses.length || 1} />;
}

function FreeTextList({ responses, field }: { responses: any[]; field: string }) {
  const texts = responses
    .map(r => ({
      text: r[field],
      name: `${r.participant?.first_name || ''} ${r.participant?.last_name || ''}`.trim(),
      role: r.participant?.role_title || '',
      dept: r.participant?.department || '',
    }))
    .filter(t => t.text?.trim());

  if (!texts.length) return <p style={{ color: 'var(--arco-text-dim)', fontSize: '0.9rem', padding: '1rem 0' }}>Nessuna risposta ancora</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {texts.map((t, i) => (
        <div key={i} style={{ padding: '1rem 1.25rem', background: 'var(--arco-bg-input)', borderRadius: '12px', border: '1px solid var(--arco-border)', transition: 'all 0.2s' }}>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '0.5rem', color: 'var(--arco-text)' }}>&ldquo;{t.text}&rdquo;</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--arco-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
              {(t.name[0] || '?')}
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--arco-red-light)', fontWeight: 600 }}>{t.name}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--arco-text-dim)' }}>· {t.role} · {t.dept}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

type TabKey = 'overview' | 'change' | 'ai' | 'vision' | 'participants' | 'freetext';

export default function DashboardPage() {
  const [participants, setParticipants] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabKey>('overview');

  useEffect(() => {
    fetch('/api/arco/dashboard')
      .then(r => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      })
      .then(d => {
        setParticipants(d.participants || []);
        setResponses(d.responses || []);
      })
      .catch(e => {
        console.error(e);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const completed = participants.filter(p => p.survey_completed).length;
  const total = participants.length;
  const rate = total ? Math.round((completed / total) * 100) : 0;

  const deptCounts = useMemo(() => {
    const c: Record<string, number> = {};
    participants.forEach(p => { c[p.department] = (c[p.department] || 0) + 1; });
    return c;
  }, [participants]);

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'change', label: '🔄 Cambiamento' },
    { key: 'ai', label: '🤖 AI' },
    { key: 'vision', label: '🔮 Visione' },
    { key: 'freetext', label: '💬 Risposte' },
    { key: 'participants', label: '👥 Persone' },
  ];

  if (loading) return (
    <>
      <header className="arco-header">
        <div className="arco-logo-text"><span>A</span>RCO <span>G</span>roup</div>
        <div className="arco-header-subtitle">Dashboard Analytics</div>
      </header>
      <div className="arco-container wide" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div className="arco-spinner" />
        <p style={{ color: 'var(--arco-text-muted)', marginTop: '1rem' }}>Caricamento dati...</p>
      </div>
    </>
  );

  if (error) return (
    <>
      <header className="arco-header">
        <div className="arco-logo-text"><span>A</span>RCO <span>G</span>roup</div>
        <div className="arco-header-subtitle">Dashboard Analytics</div>
      </header>
      <div className="arco-container wide" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h2 style={{ marginBottom: '0.5rem' }}>Errore di connessione</h2>
        <p style={{ color: 'var(--arco-text-muted)' }}>{error}</p>
        <button className="arco-btn arco-btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => window.location.reload()}>🔄 Riprova</button>
      </div>
    </>
  );

  return (
    <>
      <header className="arco-header">
        <div className="arco-logo-text"><span>A</span>RCO <span>G</span>roup</div>
        <div className="arco-header-subtitle">Dashboard Analytics — Workshop Sardegna</div>
        <div className="arco-header-event">🔄 Ultimo aggiornamento: {new Date().toLocaleString('it-IT')}</div>
      </header>

      <div className="arco-container wide">
        {/* KPI Cards */}
        <div className="arco-dash-grid arco-animate-in">
          <div className="arco-stat-card">
            <div className="arco-stat-label">Registrati</div>
            <div className="arco-stat-value">{total}</div>
            <div className="arco-stat-sub">su ~30-35 previsti</div>
          </div>
          <div className="arco-stat-card">
            <div className="arco-stat-label">Completati</div>
            <div className="arco-stat-value">{completed}</div>
            <div className="arco-stat-sub">{rate}% completion</div>
          </div>
          <div className="arco-stat-card">
            <div className="arco-stat-label">Apertura cambiamento</div>
            <div className="arco-stat-value">{avgField(responses, 'change_openness') || '—'}</div>
            <div className="arco-stat-sub">media /10</div>
          </div>
          <div className="arco-stat-card">
            <div className="arco-stat-label">Entusiasmo</div>
            <div className="arco-stat-value">{avgField(responses, 'excitement_level') || '—'}</div>
            <div className="arco-stat-sub">media /10</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="arco-tabs" style={{ overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.key} className={`arco-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="arco-animate-in">
            <div className="arco-section">
              <h3 className="arco-section-title">Distribuzione per reparto</h3>
              <BarChart data={deptCounts} total={total || 1} />
            </div>
            <div className="arco-dash-grid">
              <div className="arco-stat-card">
                <div className="arco-stat-label">Conosce Vibe Coding</div>
                <div className="arco-stat-value">{responses.filter(r => r.knows_vibe_coding).length}<span style={{ fontSize: '1rem', color: 'var(--arco-text-dim)' }}>/{responses.length}</span></div>
              </div>
              <div className="arco-stat-card">
                <div className="arco-stat-label">Usa AI per lavoro</div>
                <div className="arco-stat-value">{responses.filter(r => r.ai_work_usage).length}<span style={{ fontSize: '1rem', color: 'var(--arco-text-dim)' }}>/{responses.length}</span></div>
              </div>
              <div className="arco-stat-card">
                <div className="arco-stat-label">Vuole creare tool</div>
                <div className="arco-stat-value">{responses.filter(r => r.interested_in_building_tools).length}<span style={{ fontSize: '1rem', color: 'var(--arco-text-dim)' }}>/{responses.length}</span></div>
              </div>
              <div className="arco-stat-card">
                <div className="arco-stat-label">Tempo medio</div>
                <div className="arco-stat-value">{avgField(responses, 'completion_time_seconds') ? Math.round(avgField(responses, 'completion_time_seconds') / 60) + '\'' : '—'}</div>
              </div>
            </div>
          </div>
        )}

        {/* CAMBIAMENTO */}
        {tab === 'change' && (
          <div className="arco-animate-in">
            <div className="arco-section">
              <h3 className="arco-section-title">Attitudine al cambiamento</h3>
              <BarChart data={countField(responses, 'change_attitude')} labelMap={LABELS.change_attitude} total={responses.length || 1} />
            </div>
            <div className="arco-section">
              <h3 className="arco-section-title">Esperienze passate</h3>
              <BarChart data={countField(responses, 'change_past_experience')} labelMap={LABELS.change_past_experience} total={responses.length || 1} />
            </div>
            <div className="arco-section">
              <h3 className="arco-section-title">😰 Paure legate al cambiamento</h3>
              <FreeTextList responses={responses} field="change_biggest_fear" />
            </div>
          </div>
        )}

        {/* AI */}
        {tab === 'ai' && (
          <div className="arco-animate-in">
            <div className="arco-section">
              <h3 className="arco-section-title">Livello conoscenza AI</h3>
              <BarChart data={countField(responses, 'ai_knowledge_level')} labelMap={LABELS.ai_knowledge_level} total={responses.length || 1} />
            </div>
            <div className="arco-section">
              <h3 className="arco-section-title">Frequenza utilizzo</h3>
              <BarChart data={countField(responses, 'ai_frequency')} labelMap={LABELS.ai_frequency} total={responses.length || 1} />
            </div>
            <div className="arco-section">
              <h3 className="arco-section-title">Strumenti AI utilizzati</h3>
              <ToolsChart responses={responses} />
            </div>
            <div className="arco-section">
              <h3 className="arco-section-title">Esperienza coding</h3>
              <BarChart data={countField(responses, 'coding_experience')} labelMap={LABELS.coding_experience} total={responses.length || 1} />
            </div>
            <div className="arco-section">
              <h3 className="arco-section-title">💼 Come usano AI al lavoro</h3>
              <FreeTextList responses={responses} field="ai_work_examples" />
            </div>
          </div>
        )}

        {/* VISIONE */}
        {tab === 'vision' && (
          <div className="arco-animate-in">
            <div className="arco-section">
              <h3 className="arco-section-title">AI: Opportunità o Minaccia?</h3>
              <BarChart data={countField(responses, 'ai_opportunity_or_threat')} labelMap={LABELS.ai_opportunity_or_threat} total={responses.length || 1} />
            </div>
            <div className="arco-section">
              <h3 className="arco-section-title">📋 Aspettative dal workshop</h3>
              {(() => {
                const expCounts: Record<string, number> = {};
                responses.forEach(r => (r.event_expectations || []).forEach((e: string) => { expCounts[e] = (expCounts[e] || 0) + 1; }));
                return <BarChart data={expCounts} total={responses.length || 1} />;
              })()}
            </div>
          </div>
        )}

        {/* RISPOSTE LIBERE */}
        {tab === 'freetext' && (
          <div className="arco-animate-in">
            <div className="arco-section">
              <h3 className="arco-section-title">🤖 Cosa automatizzerebbero</h3>
              <FreeTextList responses={responses} field="what_would_automate" />
            </div>
            <div className="arco-section">
              <h3 className="arco-section-title">⏰ Attività che rubano più tempo</h3>
              <FreeTextList responses={responses} field="biggest_time_waster" />
            </div>
            <div className="arco-section">
              <h3 className="arco-section-title">🦸 Superpotere desiderato</h3>
              <FreeTextList responses={responses} field="dream_superpower" />
            </div>
            <div className="arco-section">
              <h3 className="arco-section-title">❓ Domande per Antonio</h3>
              <FreeTextList responses={responses} field="specific_questions" />
            </div>
          </div>
        )}

        {/* PARTECIPANTI */}
        {tab === 'participants' && (
          <div className="arco-section arco-animate-in">
            <h3 className="arco-section-title">Lista partecipanti ({total})</h3>
            <div style={{ marginTop: '1rem' }}>
              {participants.map(p => (
                <div className="arco-participant-row" key={p.id}>
                  <div className="arco-participant-avatar">{(p.first_name?.[0] || '') + (p.last_name?.[0] || '')}</div>
                  <div className="arco-participant-info">
                    <div className="arco-participant-name">{p.first_name} {p.last_name}</div>
                    <div className="arco-participant-role">{p.role_title} — {p.department}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--arco-text-dim)', marginTop: '2px' }}>{p.email}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`arco-badge ${p.survey_completed ? 'arco-badge-green' : 'arco-badge-yellow'}`}>
                      {p.survey_completed ? '✅ Completato' : '⏳ In attesa'}
                    </span>
                    {p.age_range && <div style={{ fontSize: '0.7rem', color: 'var(--arco-text-dim)', marginTop: '4px' }}>{p.age_range} anni</div>}
                  </div>
                </div>
              ))}
              {!participants.length && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--arco-text-dim)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                  <p>Nessun partecipante ancora registrato</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Condividi il link del questionario per iniziare!</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
