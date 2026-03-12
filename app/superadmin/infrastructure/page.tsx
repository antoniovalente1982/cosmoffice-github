'use client';

import { useState, useMemo } from 'react';
import {
    Server, Database, Video, Globe, Zap, ExternalLink, AlertTriangle,
    Check, Users, Wifi, Cpu, ChevronDown, ChevronUp, TrendingUp,
    Sliders, Calculator, Mail,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// PRICING DATA — from official pricing pages
// Last verified: 2026-03-06
// NOT fetched in real-time. For real costs → each service dashboard.
// ═══════════════════════════════════════════════════════════════

// ─── VERCEL ──────────────────────────────────────────────────
const VERCEL_PLANS = [
    {
        key: 'hobby', name: 'Hobby (Free)', cost: 0,
        bandwidth: 100, // GB
        serverlessInvocations: 1_000_000,
        edgeRequests: 1_000_000,
        cpuHours: 4,
        hardLimit: true,
        overage: {} as Record<string, number>,
    },
    {
        key: 'pro', name: 'Pro', cost: 20,
        bandwidth: 1000, // 1 TB
        serverlessInvocations: 10_000_000,
        edgeRequests: 10_000_000,
        cpuHours: 40,
        hardLimit: false,
        overage: { bandwidthPerGB: 0.15, serverlessPerM: 0.40, edgePerM: 2.00 },
    },
    {
        key: 'enterprise', name: 'Enterprise', cost: -1, // custom
        bandwidth: Infinity,
        serverlessInvocations: Infinity,
        edgeRequests: Infinity,
        cpuHours: Infinity,
        hardLimit: false,
        overage: {},
    },
];

// ─── SUPABASE ────────────────────────────────────────────────
const SUPABASE_PLANS = [
    {
        key: 'free', name: 'Free', cost: 0,
        dbSize: 500, // MB
        bandwidth: 5, // GB
        storage: 1, // GB
        maus: 50_000,
        edgeFunctions: 500_000,
        projects: 2,
        pauseOnInactive: true,
        overage: {} as Record<string, number>,
    },
    {
        key: 'pro', name: 'Pro', cost: 25,
        dbSize: 8000, // 8 GB in MB
        bandwidth: 250,
        storage: 100,
        maus: 100_000,
        edgeFunctions: 2_000_000,
        projects: 100,
        pauseOnInactive: false,
        overage: { dbPerGB: 0.125, bandwidthPerGB: 0.09, storagePerGB: 0.021, mauPer: 0.00325 },
    },
    {
        key: 'team', name: 'Team', cost: 599,
        dbSize: 8000,
        bandwidth: 250,
        storage: 100,
        maus: 100_000,
        edgeFunctions: 2_000_000,
        projects: 100,
        pauseOnInactive: false,
        overage: { dbPerGB: 0.125, bandwidthPerGB: 0.09, storagePerGB: 0.021, mauPer: 0.00325 },
    },
];

// ─── LIVEKIT ─────────────────────────────────────────────────
const LIVEKIT_PLANS = [
    {
        key: 'build', name: 'Build (Free)', cost: 0,
        includedMinutes: 5_000,
        overagePerMin: 0, // hard limit
        maxConcurrent: 100,
        hasAnalytics: false,
    },
    {
        key: 'ship', name: 'Ship', cost: 50,
        includedMinutes: 150_000,
        overagePerMin: 0.0005,
        maxConcurrent: 1_000,
        hasAnalytics: false,
    },
    {
        key: 'scale', name: 'Scale', cost: 500,
        includedMinutes: 1_500_000,
        overagePerMin: 0.0004,
        maxConcurrent: 5_000,
        hasAnalytics: true,
    },
];

// ─── PARTYKIT ────────────────────────────────────────────────
const PARTYKIT_PLANS = [
    {
        key: 'free', name: 'Free', cost: 0,
        connectionsPerRoom: 100,
        withHibernation: 32_000,
        persistentStorage: false,
    },
    {
        key: 'cloudflare', name: 'Cloud-Prem (Cloudflare)', cost: 5,
        connectionsPerRoom: 32_000,
        withHibernation: 32_000,
        persistentStorage: true,
    },
];

// ─── RESEND ──────────────────────────────────────────────────
const RESEND_PLANS = [
    {
        key: 'free', name: 'Free', cost: 0,
        emailsPerMonth: 3_000,
        dailyLimit: 100,
        domains: 1,
        dataRetention: '1 giorno',
        overagePerK: 0, // hard limit
    },
    {
        key: 'pro', name: 'Pro', cost: 20,
        emailsPerMonth: 50_000,
        dailyLimit: Infinity,
        domains: 10,
        dataRetention: '3 giorni',
        overagePerK: 0.90,
    },
    {
        key: 'scale', name: 'Scale', cost: 90,
        emailsPerMonth: 100_000,
        dailyLimit: Infinity,
        domains: 1_000,
        dataRetention: '7 giorni',
        overagePerK: 0.90,
    },
];

// ─── HELPER ──────────────────────────────────────────────────
function formatCost(n: number): string {
    if (n === 0) return '$0';
    if (n < 0.01) return `$${n.toFixed(4)}`;
    if (n < 1) return `$${n.toFixed(2)}`;
    return `$${Math.round(n).toLocaleString('en-US')}`;
}

// ═══ MAIN COMPONENT ═════════════════════════════════════════

export default function InfrastructurePage() {
    // Simulator inputs
    const [users, setUsers] = useState(10);
    const [hoursPerDay, setHoursPerDay] = useState(6);
    const [workDays, setWorkDays] = useState(22);
    const [videoPct, setVideoPct] = useState(30); // % time in video call
    const [expandedService, setExpandedService] = useState<string | null>(null);

    // ─── COST CALCULATIONS ──────────────────────────────────
    const costs = useMemo(() => {
        const totalHoursMonth = users * hoursPerDay * workDays;
        const totalMinutesMonth = totalHoursMonth * 60;

        // LiveKit: connection-minutes = utenti × ore × 60 × %video × giorni
        // Only participants in calls consume LiveKit minutes
        const livekitMinutes = Math.round(totalMinutesMonth * (videoPct / 100));

        // Supabase: ~1 MAU per user, DB grows ~1MB/user/month, bandwidth ~50MB/user/month
        const supabaseMAUs = users;
        const supabaseDBMB = users * 2; // ~2MB per user (profiles, rooms, messages etc)
        const supabaseBandwidthGB = (users * 50) / 1024; // ~50MB per user per month in API calls
        const supabaseStorageGB = (users * 5) / 1024; // ~5MB per user (avatars etc)

        // Vercel: ~500 API requests/user/day, ~1MB bandwidth/user/day
        const vercelBandwidthGB = (users * 2 * workDays) / 1024; // ~2MB per user per day
        const vercelServerlessInvocations = users * 500 * workDays;

        // PartyKit: connected users = concurrent websocket connections
        const partykitConcurrent = users;

        // Calculate per-plan costs
        function calcLiveKit(plan: typeof LIVEKIT_PLANS[0]) {
            if (users > plan.maxConcurrent) return { cost: -1, note: `Max ${plan.maxConcurrent} connessioni` };
            if (plan.overagePerMin === 0 && livekitMinutes > plan.includedMinutes) {
                return { cost: -1, note: `Supera ${plan.includedMinutes.toLocaleString()} min inclusi` };
            }
            const overageMin = Math.max(0, livekitMinutes - plan.includedMinutes);
            const overageCost = overageMin * plan.overagePerMin;
            return { cost: plan.cost + overageCost, note: overageMin > 0 ? `+${overageMin.toLocaleString()} min overage` : 'Incluso' };
        }

        function calcSupabase(plan: typeof SUPABASE_PLANS[0]) {
            if (plan.key === 'free' && supabaseMAUs > plan.maus) return { cost: -1, note: `Max ${plan.maus.toLocaleString()} MAU` };
            if (plan.key === 'free' && supabaseDBMB > plan.dbSize) return { cost: -1, note: `Max ${plan.dbSize}MB DB` };
            let extra = 0;
            if (plan.overage.mauPer && supabaseMAUs > plan.maus) {
                extra += (supabaseMAUs - plan.maus) * plan.overage.mauPer;
            }
            if (plan.overage.bandwidthPerGB && supabaseBandwidthGB > plan.bandwidth) {
                extra += (supabaseBandwidthGB - plan.bandwidth) * plan.overage.bandwidthPerGB;
            }
            return { cost: plan.cost + extra, note: extra > 0 ? `+overage` : 'Incluso' };
        }

        function calcVercel(plan: typeof VERCEL_PLANS[0]) {
            if (plan.hardLimit && vercelBandwidthGB > plan.bandwidth) return { cost: -1, note: `Max ${plan.bandwidth}GB bandwidth` };
            let extra = 0;
            if (plan.overage.bandwidthPerGB && vercelBandwidthGB > plan.bandwidth) {
                extra += (vercelBandwidthGB - plan.bandwidth) * plan.overage.bandwidthPerGB;
            }
            if (plan.overage.serverlessPerM && vercelServerlessInvocations > plan.serverlessInvocations) {
                extra += ((vercelServerlessInvocations - plan.serverlessInvocations) / 1_000_000) * plan.overage.serverlessPerM;
            }
            return { cost: plan.cost === -1 ? -1 : plan.cost + extra, note: extra > 0 ? `+overage` : 'Incluso' };
        }

        function calcPartyKit(plan: typeof PARTYKIT_PLANS[0]) {
            if (partykitConcurrent > plan.connectionsPerRoom) return { cost: -1, note: `Max ${plan.connectionsPerRoom}/room` };
            return { cost: plan.cost, note: 'Incluso' };
        }

        // Resend: ~5 transactional emails per user per month (invites, notifications, password resets)
        const resendEmails = users * 5;

        function calcResend(plan: typeof RESEND_PLANS[0]) {
            if (plan.overagePerK === 0 && resendEmails > plan.emailsPerMonth) {
                return { cost: -1, note: `Max ${plan.emailsPerMonth.toLocaleString()} email/mese` };
            }
            const overage = Math.max(0, resendEmails - plan.emailsPerMonth);
            const overageCost = overage > 0 ? (overage / 1000) * plan.overagePerK : 0;
            return { cost: plan.cost + overageCost, note: overage > 0 ? `+${overage.toLocaleString()} email overage` : 'Incluso' };
        }

        return {
            livekitMinutes,
            supabaseMAUs,
            vercelBandwidthGB: Math.round(vercelBandwidthGB * 10) / 10,
            partykitConcurrent,
            resendEmails,
            livekit: LIVEKIT_PLANS.map(p => ({ plan: p, ...calcLiveKit(p) })),
            supabase: SUPABASE_PLANS.map(p => ({ plan: p, ...calcSupabase(p) })),
            vercel: VERCEL_PLANS.map(p => ({ plan: p, ...calcVercel(p) })),
            partykit: PARTYKIT_PLANS.map(p => ({ plan: p, ...calcPartyKit(p) })),
            resend: RESEND_PLANS.map(p => ({ plan: p, ...calcResend(p) })),
        };
    }, [users, hoursPerDay, workDays, videoPct]);

    // Best combo (cheapest working plan per service)
    const bestCombo = useMemo(() => {
        const best = (arr: { cost: number; note: string; plan: { name: string; cost: number } }[]) =>
            arr.find(p => p.cost >= 0) || arr[arr.length - 1];
        const lk = best(costs.livekit);
        const sb = best(costs.supabase);
        const vc = best(costs.vercel);
        const pk = best(costs.partykit);
        const rs = best(costs.resend);
        const total = [lk, sb, vc, pk, rs].reduce((s, p) => s + Math.max(0, p.cost), 0);
        return { livekit: lk, supabase: sb, vercel: vc, partykit: pk, resend: rs, total };
    }, [costs]);

    const perUserCost = users > 0 ? bestCombo.total / users : 0;

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
                    Tutti i servizi esterni, piani, limiti, e simulatore costi per scalare Cosmoffice
                </p>
            </div>

            {/* ═══ DISCLAIMER ═══ */}
            <div className="rounded-2xl border border-amber-500/30 p-4 flex items-start gap-3" style={{ background: 'rgba(245, 158, 11, 0.06)' }}>
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold text-amber-300">Stime approssimative</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Tariffe copiate dai siti ufficiali il 06/03/2026. I <strong className="text-white">costi reali</strong> vanno verificati nella dashboard di ogni servizio.
                    </p>
                </div>
            </div>

            {/* ═══ INTERACTIVE SIMULATOR ═══ */}
            <div className="rounded-2xl border border-purple-500/20 p-1" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.05), rgba(236,72,153,0.05))' }}>
                <div className="flex items-center gap-2 px-4 py-2">
                    <Calculator className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-purple-300 uppercase tracking-widest">Simulatore Costi</span>
                </div>

                {/* Sliders */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 pt-0">
                    <SliderInput label="Utenti attivi" value={users} min={1} max={500} step={1} unit="" onChange={setUsers}
                        icon={<Users className="w-3.5 h-3.5 text-purple-400" />} />
                    <SliderInput label="Ore/giorno per utente" value={hoursPerDay} min={1} max={12} step={1} unit="h" onChange={setHoursPerDay}
                        icon={<Cpu className="w-3.5 h-3.5 text-cyan-400" />} />
                    <SliderInput label="Giorni lavorativi/mese" value={workDays} min={10} max={30} step={1} unit="gg" onChange={setWorkDays}
                        icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />} />
                    <SliderInput label="% tempo in video call" value={videoPct} min={0} max={100} step={5} unit="%" onChange={setVideoPct}
                        icon={<Video className="w-3.5 h-3.5 text-amber-400" />} />
                </div>

                {/* Result Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 pt-0">
                    <div className="md:col-span-1 rounded-xl border border-purple-500/20 p-4 bg-black/20 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Costo Totale Mensile</p>
                        <p className="text-3xl font-bold text-white">
                            {bestCombo.total < 0 ? 'N/D' : formatCost(bestCombo.total)}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">piani minimi necessari</p>
                    </div>
                    <div className="rounded-xl border border-white/5 p-4 bg-black/20 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Costo per Utente</p>
                        <p className="text-3xl font-bold text-emerald-300">
                            {perUserCost < 0 ? 'N/D' : formatCost(perUserCost)}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">/utente/mese</p>
                    </div>
                    <div className="rounded-xl border border-white/5 p-4 bg-black/20 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">LiveKit Minutes</p>
                        <p className="text-3xl font-bold text-cyan-300">
                            {costs.livekitMinutes.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">connection-min/mese</p>
                    </div>
                </div>

                {/* Per-service breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 pt-0">
                    <ServiceCostCard
                        name="LiveKit" color="cyan" icon={<Video className="w-4 h-4" />}
                        planName={bestCombo.livekit.plan.name}
                        cost={bestCombo.livekit.cost}
                        note={bestCombo.livekit.note}
                        url="https://cloud.livekit.io"
                    />
                    <ServiceCostCard
                        name="Supabase" color="emerald" icon={<Database className="w-4 h-4" />}
                        planName={bestCombo.supabase.plan.name}
                        cost={bestCombo.supabase.cost}
                        note={bestCombo.supabase.note}
                        url="https://supabase.com/dashboard"
                    />
                    <ServiceCostCard
                        name="Vercel" color="white" icon={<Globe className="w-4 h-4" />}
                        planName={bestCombo.vercel.plan.name}
                        cost={bestCombo.vercel.cost}
                        note={bestCombo.vercel.note}
                        url="https://vercel.com/dashboard"
                    />
                    <ServiceCostCard
                        name="PartyKit" color="amber" icon={<Wifi className="w-4 h-4" />}
                        planName={bestCombo.partykit.plan.name}
                        cost={bestCombo.partykit.cost}
                        note={bestCombo.partykit.note}
                        url="https://partykit.io/dashboard"
                    />
                    <ServiceCostCard
                        name="Resend" color="purple" icon={<Mail className="w-4 h-4" />}
                        planName={bestCombo.resend.plan.name}
                        cost={bestCombo.resend.cost}
                        note={bestCombo.resend.note}
                        url="https://resend.com/overview"
                    />
                </div>
            </div>

            {/* ═══ DETAILED SERVICE SECTIONS ═══ */}
            {/* ─── 1. LIVEKIT ─────────────────────────────────── */}
            <ServiceSection
                name="LiveKit" color="cyan" icon={<Video className="w-5 h-5" />}
                description="WebRTC — Videochiamate, audio, screen sharing"
                role="Gestisce tutte le chiamate audio/video e condivisione schermo. Addebita per connection-minute (1 utente connesso = 1 min). Non distingue audio/video/screen."
                dashboardUrl="https://cloud.livekit.io"
                lastVerified="06/03/2026"
                expanded={expandedService === 'livekit'}
                onToggle={() => setExpandedService(expandedService === 'livekit' ? null : 'livekit')}
                simResults={costs.livekit}
                notes={[
                    '1 connection-minute = 1 partecipante connesso per 1 minuto',
                    'Non distingue tra audio, video o screen share — stessa tariffa',
                    '10 secondi di connessione = fatturato come 1 minuto (arrotondamento)',
                    'Quota si resetta il 1° di ogni mese. Non si accumula.',
                    'Build: hard limit — il servizio si ferma. Ship/Scale: overage fatturato.',
                ]}
                renderPlan={(plan, result) => {
                    const p = plan as typeof LIVEKIT_PLANS[0];
                    return (
                        <div className="space-y-1.5">
                            <PlanRow label="Franchigia" value={`${p.includedMinutes.toLocaleString()} minutes included`} />
                            <PlanRow label="Overage" value={p.overagePerMin === 0 ? 'Hard limit ⛔ (si ferma)' : `then $${p.overagePerMin} per min`} />
                            <PlanRow label="Max connessioni" value={p.maxConcurrent.toLocaleString()} />
                            <PlanRow label="Analytics API" value={p.hasAnalytics ? '✓ Inclusa' : '✗ Non disponibile'} />
                            <PlanRow label="Bandwidth downstream" value="$0.12/GB" />
                            <SimResult result={result} simMinutes={costs.livekitMinutes} label="min stimati" />
                        </div>
                    );
                }}
            />

            {/* ─── 2. SUPABASE ────────────────────────────────── */}
            <ServiceSection
                name="Supabase" color="emerald" icon={<Database className="w-5 h-5" />}
                description="Database PostgreSQL, Auth, Storage, Realtime"
                role="Database utenti, stanze, workspace, messaggi. Autenticazione (login/signup). Storage per avatar. Realtime per notifiche e sincronizzazione."
                dashboardUrl="https://supabase.com/dashboard"
                lastVerified="06/03/2026"
                expanded={expandedService === 'supabase'}
                onToggle={() => setExpandedService(expandedService === 'supabase' ? null : 'supabase')}
                simResults={costs.supabase}
                notes={[
                    'Piano Free: progetto in pausa dopo 1 settimana di inattività',
                    'Per produzione serve almeno Pro ($25/mese) — sempre attivo',
                    'Max 2 progetti attivi su Free, 100 su Pro',
                    'Realtime WebSocket incluso in tutti i piani con limiti variabili',
                    'Pro include $10 di compute credits',
                ]}
                renderPlan={(plan, result) => {
                    const p = plan as typeof SUPABASE_PLANS[0];
                    return (
                        <div className="space-y-1.5">
                            <PlanRow label="Database" value={p.dbSize >= 1000 ? `${p.dbSize / 1000} GB` : `${p.dbSize} MB`} />
                            <PlanRow label="Bandwidth" value={`${p.bandwidth} GB/mese`} />
                            <PlanRow label="Storage" value={`${p.storage} GB`} />
                            <PlanRow label="Auth MAUs" value={p.maus.toLocaleString()} />
                            <PlanRow label="Edge Functions" value={`${(p.edgeFunctions / 1000).toLocaleString()}K invocazioni`} />
                            <PlanRow label="Progetti" value={String(p.projects)} />
                            <PlanRow label="Pausa inattività" value={p.pauseOnInactive ? '⚠️ Dopo 1 settimana' : '✓ Mai'} />
                            {p.overage.dbPerGB && (
                                <div className="border-t border-white/5 pt-1 mt-1">
                                    <p className="text-[9px] text-slate-500 font-semibold uppercase mb-1">Overage</p>
                                    <PlanRow label="DB extra" value={`$${p.overage.dbPerGB}/GB`} />
                                    <PlanRow label="Bandwidth extra" value={`$${p.overage.bandwidthPerGB}/GB`} />
                                    <PlanRow label="Storage extra" value={`$${p.overage.storagePerGB}/GB`} />
                                    <PlanRow label="MAU extra" value={`$${p.overage.mauPer}/MAU`} />
                                </div>
                            )}
                            <SimResult result={result} simMinutes={costs.supabaseMAUs} label="MAU stimati" />
                        </div>
                    );
                }}
            />

            {/* ─── 3. VERCEL ──────────────────────────────────── */}
            <ServiceSection
                name="Vercel" color="slate" icon={<Globe className="w-5 h-5" />}
                description="Hosting, CDN globale, CI/CD, Serverless Functions"
                role="Ospita il frontend Next.js, deploy automatici da GitHub, serve le API routes come serverless functions, CDN globale per assets statici."
                dashboardUrl="https://vercel.com/dashboard"
                lastVerified="06/03/2026"
                expanded={expandedService === 'vercel'}
                onToggle={() => setExpandedService(expandedService === 'vercel' ? null : 'vercel')}
                simResults={costs.vercel}
                notes={[
                    'Piano Hobby: solo uso personale/non commerciale',
                    'Per SaaS commerciale serve almeno Pro ($20/mese)',
                    'Pro include $20 di crediti uso (nuovo modello 2025)',
                    'Deploy automatici da Git push',
                ]}
                renderPlan={(plan, result) => {
                    const p = plan as typeof VERCEL_PLANS[0];
                    return (
                        <div className="space-y-1.5">
                            <PlanRow label="Bandwidth" value={p.bandwidth === Infinity ? 'Custom' : `${p.bandwidth >= 1000 ? `${p.bandwidth / 1000} TB` : `${p.bandwidth} GB`}/mese`} />
                            <PlanRow label="Serverless inv." value={p.serverlessInvocations === Infinity ? 'Custom' : `${(p.serverlessInvocations / 1_000_000).toFixed(0)}M/mese`} />
                            <PlanRow label="Edge requests" value={p.edgeRequests === Infinity ? 'Custom' : `${(p.edgeRequests / 1_000_000).toFixed(0)}M/mese`} />
                            <PlanRow label="CPU time" value={p.cpuHours === Infinity ? 'Custom' : `${p.cpuHours} ore/mese`} />
                            <PlanRow label="Limite" value={p.hardLimit ? 'Hard limit ⛔' : p.cost === -1 ? 'SLA 99.99%' : 'Overage fatturato'} />
                            {Object.keys(p.overage).length > 0 && (
                                <div className="border-t border-white/5 pt-1 mt-1">
                                    <p className="text-[9px] text-slate-500 font-semibold uppercase mb-1">Overage</p>
                                    {p.overage.bandwidthPerGB && <PlanRow label="Bandwidth extra" value={`$${p.overage.bandwidthPerGB}/GB`} />}
                                    {p.overage.serverlessPerM && <PlanRow label="Serverless extra" value={`$${p.overage.serverlessPerM}/1M inv.`} />}
                                    {p.overage.edgePerM && <PlanRow label="Edge extra" value={`$${p.overage.edgePerM}/1M req.`} />}
                                </div>
                            )}
                            <SimResult result={result} simMinutes={costs.vercelBandwidthGB} label="GB bandwidth stimati" />
                        </div>
                    );
                }}
            />

            {/* ─── 4. PARTYKIT ────────────────────────────────── */}
            <ServiceSection
                name="PartyKit" color="amber" icon={<Wifi className="w-5 h-5" />}
                description="WebSocket real-time — Sincronizzazione avatar e collaborazione"
                role="Sincronizza in tempo reale: posizioni avatar, stati utenti, whiteboard, chat. Ogni utente mantiene una connessione WebSocket persistente."
                dashboardUrl="https://partykit.io/dashboard"
                lastVerified="06/03/2026"
                expanded={expandedService === 'partykit'}
                onToggle={() => setExpandedService(expandedService === 'partykit' ? null : 'partykit')}
                simResults={costs.partykit}
                notes={[
                    'PartyKit acquisito da Cloudflare nel 2024',
                    'Free: storage cancellato giornalmente — OK per dati transitori (posizioni)',
                    'Cloud-Prem: deploy sul tuo Cloudflare con storage persistente (Durable Objects)',
                    'Ogni utente = 1 connessione WebSocket persistente',
                ]}
                renderPlan={(plan, result) => {
                    const p = plan as typeof PARTYKIT_PLANS[0];
                    return (
                        <div className="space-y-1.5">
                            <PlanRow label="Conn. per room" value={p.connectionsPerRoom.toLocaleString()} />
                            <PlanRow label="Con hibernation" value={`${p.withHibernation.toLocaleString()}/room`} />
                            <PlanRow label="Storage persistente" value={p.persistentStorage ? '✓ Sì (Durable Objects)' : '✗ Cancellato ogni giorno'} />
                            <PlanRow label="Deploy" value="Edge globale" />
                            <SimResult result={result} simMinutes={costs.partykitConcurrent} label="connessioni simultanee" />
                        </div>
                    );
                }}
            />

            {/* ─── 5. RESEND ──────────────────────────────────── */}
            <ServiceSection
                name="Resend" color="purple" icon={<Mail className="w-5 h-5" />}
                description="Email transazionali — Inviti, notifiche, reset password"
                role="Invia email transazionali: inviti workspace, notifiche di sistema, reset password, conferme. Dominio top-level con DKIM/SPF verificato."
                dashboardUrl="https://resend.com/overview"
                lastVerified="07/03/2026"
                expanded={expandedService === 'resend'}
                onToggle={() => setExpandedService(expandedService === 'resend' ? null : 'resend')}
                simResults={costs.resend}
                notes={[
                    'Free: limite giornaliero 100 email/giorno — NON adatto a produzione',
                    'Pro ($20): nessun limite giornaliero, 50K email/mese incluse',
                    'Overage: $0.90 per 1.000 email aggiuntive (uguale su Pro e Scale)',
                    'Supporta dominio verificato con DKIM + SPF (setup in DNS)',
                    'IP dedicato disponibile da $30/mese (consigliato oltre 500 email/giorno)',
                ]}
                renderPlan={(plan, result) => {
                    const p = plan as typeof RESEND_PLANS[0];
                    return (
                        <div className="space-y-1.5">
                            <PlanRow label="Email/mese" value={p.emailsPerMonth.toLocaleString()} />
                            <PlanRow label="Limite giornaliero" value={p.dailyLimit === Infinity ? 'Nessuno ✓' : `${p.dailyLimit} email/giorno`} />
                            <PlanRow label="Domini" value={String(p.domains)} />
                            <PlanRow label="Data retention" value={p.dataRetention} />
                            <PlanRow label="Overage" value={p.overagePerK === 0 ? 'Hard limit ⛔' : `$${p.overagePerK}/1K email`} />
                            <SimResult result={result} simMinutes={costs.resendEmails} label="email/mese stimate" />
                        </div>
                    );
                }}
            />

            {/* ═══ FOOTER ═══ */}
            <div className="text-center py-4">
                <p className="text-[10px] text-slate-600">
                    Tariffe copiate dai siti ufficiali (verificate 06/03/2026). Potrebbero cambiare — verifica sempre sulle dashboard.
                </p>
            </div>
        </div>
    );
}

// ═══ SUB-COMPONENTS ═════════════════════════════════════════

function SliderInput({ label, value, min, max, step, unit, onChange, icon }: {
    label: string; value: number; min: number; max: number; step: number; unit: string;
    onChange: (v: number) => void; icon: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-white/5 p-3 bg-black/20">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    {icon} {label}
                </span>
                <span className="text-sm font-bold text-white">{value}{unit}</span>
            </div>
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-slate-700 cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(168,85,247,0.5)]"
            />
            <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
                <span>{min}{unit}</span>
                <span>{max}{unit}</span>
            </div>
        </div>
    );
}

function ServiceCostCard({ name, color, icon, planName, cost, note, url }: {
    name: string; color: string; icon: React.ReactNode;
    planName: string; cost: number; note: string; url: string;
}) {
    const isOverLimit = cost < 0;
    return (
        <div className={`rounded-xl border p-3 bg-black/20 ${isOverLimit ? 'border-red-500/30' : 'border-white/5'}`}>
            <div className="flex items-center gap-2 mb-1">
                <span className={`text-${color}-400`}>{icon}</span>
                <span className="text-xs font-semibold text-white">{name}</span>
            </div>
            {isOverLimit ? (
                <p className="text-sm font-bold text-red-400">⛔ {note}</p>
            ) : (
                <>
                    <p className="text-lg font-bold text-white">{formatCost(cost)}<span className="text-[10px] text-slate-500">/mese</span></p>
                    <p className="text-[10px] text-slate-500">{planName} • {note}</p>
                </>
            )}
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-cyan-400/60 hover:text-cyan-300 flex items-center gap-0.5 mt-1">
                Dashboard <ExternalLink className="w-2 h-2" />
            </a>
        </div>
    );
}

function ServiceSection({ name, color, icon, description, role, dashboardUrl, lastVerified, expanded, onToggle, simResults, notes, renderPlan }: {
    name: string; color: string; icon: React.ReactNode; description: string; role: string;
    dashboardUrl: string; lastVerified: string; expanded: boolean; onToggle: () => void;
    simResults: Array<{ plan: any; cost: number; note: string }>;
    notes: string[];
    renderPlan: (plan: any, result: { cost: number; note: string }) => React.ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
            <button onClick={onToggle} className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors text-left">
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center text-${color}-400`}>
                        {icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-white">{name}</h3>
                        </div>
                        <p className="text-xs text-slate-400">{description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-white/5">
                    <div className="px-5 py-3 bg-white/[0.02] border-b border-white/5">
                        <p className="text-xs text-slate-400"><strong className="text-white">Ruolo in Cosmoffice:</strong> {role}</p>
                    </div>
                    <div className={`grid grid-cols-1 md:grid-cols-${simResults.length} gap-0 divide-y md:divide-y-0 md:divide-x divide-white/5`}>
                        {simResults.map(({ plan, cost, note }) => (
                            <div key={plan.key} className={`p-5 ${cost >= 0 && simResults.findIndex(r => r.cost >= 0) === simResults.indexOf({ plan, cost, note }) ? '' : ''}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-base font-bold text-white">{plan.name}</h4>
                                    {cost < 0 ? (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">NON BASTA</span>
                                    ) : cost === simResults.find(r => r.cost >= 0)?.cost ? (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                            <Check className="w-3 h-3" /> CONSIGLIATO
                                        </span>
                                    ) : null}
                                </div>
                                <p className="text-xl font-bold text-white mb-3">
                                    {plan.cost === -1 ? 'Custom' : plan.cost === 0 ? 'Gratis' : `$${plan.cost}/mese`}
                                </p>
                                {renderPlan(plan, { cost, note })}
                            </div>
                        ))}
                    </div>
                    <div className="px-5 py-3 bg-white/[0.02] border-t border-white/5 flex items-start justify-between flex-wrap gap-2">
                        <div className="space-y-0.5">
                            {notes.map((n, i) => <p key={i} className="text-[10px] text-slate-500">• {n}</p>)}
                            <p className="text-[10px] text-slate-600 italic mt-1">Tariffe verificate il {lastVerified}</p>
                        </div>
                        <a href={dashboardUrl} target="_blank" rel="noopener noreferrer"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-${color}-500/20 text-${color}-300 border border-${color}-500/30 hover:bg-${color}-500/30 transition-all shrink-0`}>
                            <ExternalLink className="w-3 h-3" /> Apri Dashboard
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}

function PlanRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{label}</span>
            <span className="text-white font-mono text-[11px] text-right max-w-[200px]">{value}</span>
        </div>
    );
}

function SimResult({ result, simMinutes, label }: { result: { cost: number; note: string }; simMinutes: number; label: string }) {
    return (
        <div className="border-t border-white/5 pt-2 mt-2">
            <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1">
                    <Sliders className="w-3 h-3" /> Simulazione
                </span>
                <span className="text-[10px] text-slate-500">{typeof simMinutes === 'number' ? simMinutes.toLocaleString() : simMinutes} {label}</span>
            </div>
            {result.cost < 0 ? (
                <p className="text-xs font-semibold text-red-400 mt-1">⛔ {result.note}</p>
            ) : (
                <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-emerald-400 font-semibold">{formatCost(result.cost)}/mese</span>
                    <span className="text-[10px] text-slate-500">{result.note}</span>
                </div>
            )}
        </div>
    );
}
