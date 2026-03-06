'use client';

import { useState } from 'react';
import {
    Server, Database, Video, Globe, Zap, ExternalLink, AlertTriangle,
    Check, Users, HardDrive, Shield, Wifi, Cloud, Cpu,
    ChevronDown, ChevronUp, TrendingUp,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// All pricing data is hardcoded from official pricing pages.
// These are NOT fetched in real-time from any API.
// Last verified: 2026-03-06
//
// For real billing data, always check each service's dashboard.
// ═══════════════════════════════════════════════════════════════

interface ServicePlan {
    name: string;
    cost: string;
    features: { label: string; value: string }[];
    isCurrent?: boolean;
    overageInfo?: string;
}

interface ServiceInfo {
    name: string;
    icon: React.ReactNode;
    color: string;      // tailwind color name
    description: string;
    role: string;       // what it does in Cosmoffice
    dashboardUrl: string;
    plans: ServicePlan[];
    currentPlanKey: string;
    lastVerified: string;
    notes?: string[];
}

// ─── SERVICE DATA ────────────────────────────────────────────

const SERVICES: ServiceInfo[] = [
    // ─── VERCEL ──────────────────────────────────────────────
    {
        name: 'Vercel',
        icon: <Globe className="w-5 h-5" />,
        color: 'white',
        description: 'Hosting, CDN, CI/CD, Serverless Functions',
        role: 'Ospita il frontend Next.js, gestisce deploy automatici da GitHub, serve le API routes',
        dashboardUrl: 'https://vercel.com/dashboard',
        currentPlanKey: 'hobby',
        lastVerified: '06/03/2026',
        plans: [
            {
                name: 'Hobby (Free)',
                cost: '$0/mese',
                isCurrent: true,
                features: [
                    { label: 'Bandwidth', value: '100 GB/mese' },
                    { label: 'Serverless Invocations', value: '1M/mese' },
                    { label: 'Edge Requests', value: '1M/mese' },
                    { label: 'CPU Time (Serverless)', value: '4 ore/mese' },
                    { label: 'Build Minutes', value: '100 min/mese' },
                    { label: 'Progetti', value: 'Illimitati' },
                ],
                overageInfo: 'Hard limit — upgrade richiesto al superamento',
            },
            {
                name: 'Pro',
                cost: '$20/mese',
                features: [
                    { label: 'Bandwidth', value: '1 TB/mese, poi $0.15/GB' },
                    { label: 'Serverless Invocations', value: '10M/mese, poi $0.40/1M' },
                    { label: 'Edge Requests', value: '10M/mese, poi $2/1M' },
                    { label: 'CPU Time (Serverless)', value: '40 ore/mese' },
                    { label: 'Build Minutes', value: '6000 min/mese' },
                    { label: 'Team Members', value: 'Illimitati ($20/membro)' },
                ],
            },
            {
                name: 'Enterprise',
                cost: 'Custom',
                features: [
                    { label: 'SLA', value: '99.99% uptime' },
                    { label: 'Support', value: 'Dedicato' },
                    { label: 'Limiti', value: 'Custom' },
                ],
            },
        ],
        notes: [
            'Piano Hobby: solo uso personale/non commerciale',
            'Per uso commerciale/SaaS serve almeno il piano Pro',
        ],
    },

    // ─── SUPABASE ────────────────────────────────────────────
    {
        name: 'Supabase',
        icon: <Database className="w-5 h-5" />,
        color: 'emerald',
        description: 'Database PostgreSQL, Auth, Storage, Realtime',
        role: 'Database utenti/stanze/workspace, autenticazione, storage avatar, realtime per notifiche',
        dashboardUrl: 'https://supabase.com/dashboard',
        currentPlanKey: 'free',
        lastVerified: '06/03/2026',
        plans: [
            {
                name: 'Free',
                cost: '$0/mese',
                isCurrent: true,
                features: [
                    { label: 'Database', value: '500 MB' },
                    { label: 'Bandwidth', value: '5 GB/mese' },
                    { label: 'Storage', value: '1 GB' },
                    { label: 'Auth MAUs', value: '50,000' },
                    { label: 'Edge Functions', value: '500K invocazioni/mese' },
                    { label: 'Progetti attivi', value: '2' },
                    { label: 'Inattività', value: 'Pausa dopo 1 settimana' },
                ],
                overageInfo: 'Hard limit — progetto in pausa se inattivo',
            },
            {
                name: 'Pro',
                cost: '$25/mese',
                features: [
                    { label: 'Database', value: '8 GB, poi $0.125/GB' },
                    { label: 'Bandwidth', value: '250 GB, poi $0.09/GB' },
                    { label: 'Storage', value: '100 GB, poi $0.021/GB' },
                    { label: 'Auth MAUs', value: '100K, poi $0.00325/MAU' },
                    { label: 'Edge Functions', value: '2M invocazioni/mese' },
                    { label: 'Backup', value: 'Giornaliero (7 giorni)' },
                    { label: 'No pausa', value: '✓ Sempre attivo' },
                ],
            },
            {
                name: 'Team',
                cost: '$599/mese',
                features: [
                    { label: 'Tutto Pro +', value: 'SOC2, HIPAA compliance' },
                    { label: 'Support', value: 'Prioritario' },
                    { label: 'PITR', value: 'Incluso' },
                    { label: 'Membri team', value: 'Illimitati' },
                ],
            },
        ],
        notes: [
            'Il piano Free pausa i progetti dopo 1 settimana di inattività',
            'Per produzione serve almeno il piano Pro ($25/mese)',
            'Realtime (WebSocket) incluso in tutti i piani con limiti variabili',
        ],
    },

    // ─── LIVEKIT ─────────────────────────────────────────────
    {
        name: 'LiveKit',
        icon: <Video className="w-5 h-5" />,
        color: 'cyan',
        description: 'WebRTC — Videochiamate, audio, screen sharing',
        role: 'Gestisce tutte le chiamate audio/video e condivisione schermo tra utenti',
        dashboardUrl: 'https://cloud.livekit.io',
        currentPlanKey: 'build',
        lastVerified: '06/03/2026',
        plans: [
            {
                name: 'Build (Free)',
                cost: '$0/mese',
                isCurrent: true,
                features: [
                    { label: 'WebRTC minutes', value: '5,000 minutes included' },
                    { label: 'Connessioni simultanee', value: '100' },
                    { label: 'Bandwidth downstream', value: '$0.12/GB' },
                ],
                overageInfo: 'Hard limit — servizio si ferma al superamento',
            },
            {
                name: 'Ship',
                cost: '$50/mese',
                features: [
                    { label: 'WebRTC minutes', value: '150,000 minutes included' },
                    { label: 'Overage', value: 'then $0.0005 per min' },
                    { label: 'Connessioni simultanee', value: '1,000' },
                    { label: 'Bandwidth downstream', value: '$0.12/GB' },
                ],
            },
            {
                name: 'Scale',
                cost: '$500/mese',
                features: [
                    { label: 'WebRTC minutes', value: '1,500,000 minutes included' },
                    { label: 'Overage', value: 'then $0.0004 per min' },
                    { label: 'Connessioni simultanee', value: '5,000' },
                    { label: 'Analytics API', value: '✓ Inclusa' },
                    { label: 'Bandwidth downstream', value: '$0.12/GB' },
                ],
            },
        ],
        notes: [
            '1 connection-minute = 1 partecipante connesso per 1 minuto',
            'Non distingue audio/video/screen — tutto uguale',
            '10 secondi di connessione = fatturato come 1 minuto',
            'Monitor real-time disponibile in Admin → LiveKit',
        ],
    },

    // ─── PARTYKIT ────────────────────────────────────────────
    {
        name: 'PartyKit',
        icon: <Wifi className="w-5 h-5" />,
        color: 'amber',
        description: 'WebSocket real-time — Sincronizzazione avatar/posizioni',
        role: 'Sincronizza in tempo reale posizioni avatar, stati utenti, whiteboard, chat tra tutti i client',
        dashboardUrl: 'https://partykit.io/dashboard',
        currentPlanKey: 'free',
        lastVerified: '06/03/2026',
        plans: [
            {
                name: 'Free',
                cost: '$0/mese',
                isCurrent: true,
                features: [
                    { label: 'Connessioni per room', value: '100 (senza hibernation)' },
                    { label: 'Con hibernation', value: 'Fino a 32,000/room' },
                    { label: 'Storage', value: 'Cancellato giornalmente' },
                    { label: 'Deploy', value: 'Edge globale' },
                ],
                overageInfo: 'Dati storage cancellati ogni giorno — no persistenza',
            },
            {
                name: 'Cloud-Prem (Cloudflare)',
                cost: 'Costi Cloudflare Workers',
                features: [
                    { label: 'Deploy', value: 'Sul tuo account Cloudflare' },
                    { label: 'Storage', value: 'Persistente (Durable Objects)' },
                    { label: 'Connessioni', value: 'Limiti Cloudflare Workers' },
                    { label: 'Costi', value: 'Solo Cloudflare Workers pricing' },
                ],
            },
        ],
        notes: [
            'PartyKit è stato acquisito da Cloudflare nel 2024',
            'Per produzione: considera deploy su Cloudflare Workers (cloud-prem)',
            'Storage free viene cancellato ogni giorno — OK per dati transitori come posizioni',
        ],
    },
];

// ─── SCALING SCENARIOS ───────────────────────────────────────

const SCALING_SCENARIOS = [
    {
        label: '🧪 Test / MVP',
        users: '1-10',
        costs: [
            { service: 'Vercel', plan: 'Hobby', cost: '$0' },
            { service: 'Supabase', plan: 'Free', cost: '$0' },
            { service: 'LiveKit', plan: 'Build', cost: '$0' },
            { service: 'PartyKit', plan: 'Free', cost: '$0' },
        ],
        total: '$0/mese',
        notes: 'Attuale configurazione. Funziona per test e demo.',
    },
    {
        label: '🚀 Startup',
        users: '10-50',
        costs: [
            { service: 'Vercel', plan: 'Pro', cost: '$20' },
            { service: 'Supabase', plan: 'Pro', cost: '$25' },
            { service: 'LiveKit', plan: 'Ship', cost: '$50' },
            { service: 'PartyKit', plan: 'Free/CF', cost: '$0-5' },
        ],
        total: '~$95-100/mese',
        notes: 'Per un team reale in produzione quotidiana.',
    },
    {
        label: '📈 Crescita',
        users: '50-200',
        costs: [
            { service: 'Vercel', plan: 'Pro', cost: '$20+' },
            { service: 'Supabase', plan: 'Pro', cost: '$25-50' },
            { service: 'LiveKit', plan: 'Scale', cost: '$500' },
            { service: 'PartyKit', plan: 'Cloudflare', cost: '$5-25' },
        ],
        total: '~$550-600/mese',
        notes: 'Analytics API LiveKit disponibile. Monitoring avanzato.',
    },
    {
        label: '🏢 Enterprise',
        users: '200+',
        costs: [
            { service: 'Vercel', plan: 'Enterprise', cost: 'Custom' },
            { service: 'Supabase', plan: 'Team', cost: '$599' },
            { service: 'LiveKit', plan: 'Enterprise', cost: 'Custom' },
            { service: 'PartyKit', plan: 'Cloudflare', cost: 'Custom' },
        ],
        total: 'Custom',
        notes: 'SLA, support dedicato, compliance (SOC2/HIPAA).',
    },
];

// ─── COMPONENT ───────────────────────────────────────────────

export default function InfrastructurePage() {
    const [expandedService, setExpandedService] = useState<string | null>(null);

    const totalMonthlyCost = SERVICES.reduce((sum, s) => {
        const current = s.plans.find(p => p.isCurrent);
        const cost = current?.cost.match(/\$(\d+)/)?.[1];
        return sum + (cost ? parseInt(cost) : 0);
    }, 0);

    return (
        <div className="p-8 space-y-6 max-w-[1400px]">
            {/* ═══ HEADER ═══ */}
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                        <Server className="w-4 h-4 text-white" />
                    </div>
                    Infrastruttura & Costi
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                    Tutti i servizi esterni necessari per Cosmoffice — piani, limiti e costi di scaling
                </p>
            </div>

            {/* ═══ DISCLAIMER ═══ */}
            <div className="rounded-2xl border border-amber-500/30 p-4 flex items-start gap-3" style={{ background: 'rgba(245, 158, 11, 0.06)' }}>
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold text-amber-300">Tariffe da siti ufficiali — non dati in tempo reale</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                        I prezzi mostrati sono copiati dalle pagine pricing ufficiali e potrebbero non essere aggiornati.
                        Per i <strong className="text-white">costi reali e consumi effettivi</strong>, accedi alla dashboard di ogni servizio.
                    </p>
                </div>
            </div>

            {/* ═══ CURRENT COST SUMMARY ═══ */}
            <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        Costo Attuale Mensile (piani correnti)
                    </h2>
                    <span className="text-2xl font-bold text-emerald-300">
                        {totalMonthlyCost === 0 ? '$0 — Tutto gratis' : `$${totalMonthlyCost}/mese`}
                    </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {SERVICES.map(service => {
                        const current = service.plans.find(p => p.isCurrent);
                        return (
                            <div key={service.name} className="rounded-xl border border-white/5 p-3 bg-black/20 text-center">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <span className={`text-${service.color}-400`}>{service.icon}</span>
                                    <span className="text-xs font-semibold text-white">{service.name}</span>
                                </div>
                                <p className="text-lg font-bold text-white">{current?.cost}</p>
                                <p className="text-[10px] text-slate-500">{current?.name}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ═══ SERVICE CARDS ═══ */}
            {SERVICES.map(service => (
                <div key={service.name} className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                    {/* Header */}
                    <button
                        onClick={() => setExpandedService(expandedService === service.name ? null : service.name)}
                        className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors text-left"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl bg-${service.color}-500/10 border border-${service.color}-500/20 flex items-center justify-center text-${service.color}-400`}>
                                {service.icon}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold text-white">{service.name}</h3>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                        {service.plans.find(p => p.isCurrent)?.name}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400">{service.description}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-white">
                                {service.plans.find(p => p.isCurrent)?.cost}
                            </span>
                            {expandedService === service.name
                                ? <ChevronUp className="w-4 h-4 text-slate-500" />
                                : <ChevronDown className="w-4 h-4 text-slate-500" />
                            }
                        </div>
                    </button>

                    {/* Expanded Content */}
                    {expandedService === service.name && (
                        <div className="border-t border-white/5">
                            {/* Role */}
                            <div className="px-5 py-3 bg-white/[0.02] border-b border-white/5">
                                <p className="text-xs text-slate-400">
                                    <strong className="text-white">Ruolo in Cosmoffice:</strong> {service.role}
                                </p>
                            </div>

                            {/* Plans Grid */}
                            <div className={`grid grid-cols-1 md:grid-cols-${service.plans.length} gap-0 divide-x divide-white/5`}>
                                {service.plans.map(plan => (
                                    <div key={plan.name} className={`p-5 relative ${plan.isCurrent ? `bg-${service.color}-500/5` : ''}`}>
                                        {plan.isCurrent && (
                                            <div className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold bg-${service.color}-500/20 text-${service.color}-300 border border-${service.color}-500/30 flex items-center gap-1`}>
                                                <Check className="w-3 h-3" /> ATTIVO
                                            </div>
                                        )}
                                        <h4 className={`text-base font-bold ${plan.isCurrent ? `text-${service.color}-300` : 'text-white'}`}>
                                            {plan.name}
                                        </h4>
                                        <p className="text-xl font-bold text-white mt-1">{plan.cost}</p>

                                        <div className="space-y-1.5 mt-3">
                                            {plan.features.map((f, i) => (
                                                <div key={i} className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-400">{f.label}</span>
                                                    <span className="text-white font-mono text-[11px] text-right">{f.value}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {plan.overageInfo && (
                                            <p className="text-[10px] text-red-400/70 italic mt-2">
                                                ⚠️ {plan.overageInfo}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Notes + Dashboard Link */}
                            <div className="px-5 py-3 bg-white/[0.02] border-t border-white/5 flex items-center justify-between flex-wrap gap-2">
                                <div className="space-y-0.5">
                                    {service.notes?.map((note, i) => (
                                        <p key={i} className="text-[10px] text-slate-500">• {note}</p>
                                    ))}
                                    <p className="text-[10px] text-slate-600 italic mt-1">
                                        Tariffe verificate il {service.lastVerified}
                                    </p>
                                </div>
                                <a href={service.dashboardUrl} target="_blank" rel="noopener noreferrer"
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-${service.color}-500/20 text-${service.color}-300 border border-${service.color}-500/30 hover:bg-${service.color}-500/30 transition-all shrink-0`}>
                                    <ExternalLink className="w-3 h-3" /> Apri Dashboard
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {/* ═══ SCALING SCENARIOS ═══ */}
            <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                <div className="p-5 border-b border-white/5">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-purple-400" />
                        Scenari di Scaling — Quanto costa crescere?
                    </h2>
                    <p className="text-[10px] text-slate-500 mt-1">
                        Stime approssimative basate sui piani consigliati per ogni livello di utilizzo
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-0 divide-x divide-white/5">
                    {SCALING_SCENARIOS.map(scenario => (
                        <div key={scenario.label} className="p-5">
                            <p className="text-sm font-bold text-white mb-0.5">{scenario.label}</p>
                            <p className="text-[10px] text-slate-500 mb-3">{scenario.users} utenti attivi</p>

                            <div className="space-y-1.5 mb-3">
                                {scenario.costs.map(c => (
                                    <div key={c.service} className="flex items-center justify-between text-xs">
                                        <span className="text-slate-400">{c.service} <span className="text-slate-600">({c.plan})</span></span>
                                        <span className="text-white font-mono text-[11px]">{c.cost}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-white/5 pt-2 mt-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-400">Totale</span>
                                    <span className="text-lg font-bold text-white">{scenario.total}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">{scenario.notes}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ═══ FOOTER NOTE ═══ */}
            <div className="text-center py-4">
                <p className="text-[10px] text-slate-600">
                    Tutte le tariffe sono copiate dai siti ufficiali e potrebbero cambiare. Verifica sempre sulla dashboard di ogni servizio.
                </p>
            </div>
        </div>
    );
}
