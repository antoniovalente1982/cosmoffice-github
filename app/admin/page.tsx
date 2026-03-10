'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
    Users, Crown, Activity, Building2, Zap, LayoutGrid, TrendingUp, DollarSign,
    Bug, AlertTriangle, Shield, Ban, ArrowUpRight, ArrowDownRight, RefreshCw, Sparkles, Rocket,
    ShieldCheck, UserCog, User, Eye, Calendar, ChevronDown, UserPlus, Receipt,
    Headphones, CircleDot, Clock, CheckCircle2, XCircle, AlertCircleIcon,
    Server, Globe, CreditCard, Banknote, BarChart3, Target, Gauge,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════════ */

interface Stats {
    users: { total: number; unique: number; superAdmins: number; owners: number; admins: number; members: number; guests: number; recentSignups: number; activeInPeriod: number; registeredInPeriod: number };
    workspaces: { total: number; active: number; suspended: number; deleted: number; recentNew: number; activeInPeriod: number; existedInPeriod: number; planDistribution: Record<string, number>; paidWorkspaces: number; totalSpaces: number; totalSeatsAllocated: number; totalSeatsUsed: number };
    revenue: { totalCents: number; totalFormatted: string; paidWorkspaces: number; mrr: number; mrrFormatted: string; arr: number; arrFormatted: string; thisMonth: number; thisMonthFormatted: string; lastMonth: number; lastMonthFormatted: string; totalPayments: number; recentPayments: any[] };
    tickets: { open: number; in_progress: number; resolved: number; closed: number; total: number };
    recentTickets: any[];
    monitoring: { openBugs: number; criticalBugs: number; activeBans: number };
    dateRange: { from: string; to: string } | null;
}

type PresetKey = 'today' | '7d' | '30d' | '90d' | 'year' | 'all';

/* ═══════════════════════════════════════════════════════════════
 *  DATE HELPERS
 * ═══════════════════════════════════════════════════════════════ */

function toISODate(d: Date): string { return d.toISOString().split('T')[0]; }

function getPresetRange(preset: PresetKey): { from: string; to: string } | null {
    const today = new Date();
    const to = toISODate(today);
    switch (preset) {
        case 'today': return { from: to, to };
        case '7d': { const d = new Date(today); d.setDate(d.getDate() - 7); return { from: toISODate(d), to }; }
        case '30d': { const d = new Date(today); d.setDate(d.getDate() - 30); return { from: toISODate(d), to }; }
        case '90d': { const d = new Date(today); d.setDate(d.getDate() - 90); return { from: toISODate(d), to }; }
        case 'year': { const d = new Date(today); d.setFullYear(d.getFullYear() - 1); return { from: toISODate(d), to }; }
        case 'all': return null;
    }
}

const presets: { key: PresetKey; label: string }[] = [
    { key: 'today', label: 'Oggi' }, { key: '7d', label: '7gg' }, { key: '30d', label: '30gg' },
    { key: '90d', label: '90gg' }, { key: 'year', label: 'Anno' }, { key: 'all', label: 'Tutti' },
];

/* ═══════════════════════════════════════════════════════════════
 *  ANIMATED BACKGROUND
 * ═══════════════════════════════════════════════════════════════ */

function NASABackground() {
    const stars = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
        id: i, x: Math.random() * 100, y: Math.random() * 100,
        size: Math.random() * 2 + 0.5, delay: Math.random() * 5, duration: Math.random() * 3 + 2,
    })), []);

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {/* Grid lines */}
            <div className="absolute inset-0 opacity-[0.02]"
                style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
            {/* Radial glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-[0.04]"
                style={{ background: 'radial-gradient(ellipse, #06b6d4, transparent 70%)' }} />
            {/* Stars */}
            {stars.map(s => (
                <div key={s.id} className="absolute rounded-full bg-white"
                    style={{
                        left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, opacity: 0,
                        animation: `starPulse ${s.duration}s ${s.delay}s ease-in-out infinite`
                    }} />
            ))}
            <style jsx>{`
                @keyframes starPulse { 0%, 100% { opacity: 0.05; } 50% { opacity: 0.6; } }
                @keyframes slideIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes countUp { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
                @keyframes glowPulse { 0%, 100% { opacity: 0.06; } 50% { opacity: 0.12; } }
                @keyframes barFill { from { width: 0; } }
                @keyframes orbitalSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
 *  REUSABLE COMPONENTS
 * ═══════════════════════════════════════════════════════════════ */

function GlassCard({ children, className = '', glow, delay = 0 }: {
    children: React.ReactNode; className?: string; glow?: string; delay?: number;
}) {
    return (
        <div className={`relative group rounded-2xl border border-white/[0.06] overflow-hidden transition-all duration-500 hover:border-white/[0.14] hover:shadow-lg ${className}`}
            style={{ background: 'rgba(8,12,28,0.7)', backdropFilter: 'blur(24px)', animation: `slideIn 0.4s ${delay}ms ease-out both` }}>
            {glow && (
                <div className="absolute -top-20 -right-20 w-44 h-44 rounded-full blur-3xl pointer-events-none transition-opacity duration-700"
                    style={{ background: glow, animation: 'glowPulse 4s ease-in-out infinite' }} />
            )}
            {children}
        </div>
    );
}

function HeroKPI({ icon: Icon, label, value, subtitle, color, accentBg, change, delay = 0 }: {
    icon: any; label: string; value: string | number; subtitle: string; color: string; accentBg: string; change?: number; delay?: number;
}) {
    const isPositive = change && change > 0;
    return (
        <GlassCard glow={accentBg} delay={delay}>
            <div className="p-5 h-full flex flex-col">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color.replace('text-', 'bg-').replace('400', '500/15')}`}>
                            <Icon className={`w-4 h-4 ${color}`} />
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${color} opacity-80`}>{label}</span>
                    </div>
                    {change !== undefined && change !== 0 && (
                        <span className={`flex items-center gap-0.5 text-[10px] font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {isPositive ? '+' : ''}{typeof change === 'number' ? change : change}
                        </span>
                    )}
                </div>
                <p className="text-3xl font-black text-white tracking-tighter leading-none" style={{ animation: `countUp 0.5s ${delay + 200}ms ease-out both` }}>{value}</p>
                <p className="mt-2 text-[11px] text-slate-500">{subtitle}</p>
            </div>
        </GlassCard>
    );
}

function MiniStat({ icon: Icon, label, value, color = 'text-slate-300' }: {
    icon: any; label: string; value: string | number; color?: string;
}) {
    return (
        <div className="flex items-center justify-between py-2 group/row">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color.replace('text-', 'bg-').replace('300', '500/10').replace('400', '500/10')}`}>
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <span className="text-[12px] text-slate-400">{label}</span>
            </div>
            <span className={`text-[12px] font-bold tabular-nums ${color}`}>{value}</span>
        </div>
    );
}

function ProgressBar({ value, max, color = 'bg-cyan-500', label }: {
    value: number; max: number; color?: string; label?: string;
}) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div className="space-y-1">
            {label && (
                <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">{label}</span>
                    <span className="text-white font-bold tabular-nums">{value}/{max}</span>
                </div>
            )}
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all`}
                    style={{ width: `${pct}%`, animation: 'barFill 1s ease-out' }} />
            </div>
        </div>
    );
}

function StatusDot({ status }: { status: 'ok' | 'warn' | 'critical' }) {
    const colors = { ok: 'bg-emerald-400', warn: 'bg-amber-400', critical: 'bg-red-400' };
    return (
        <span className="relative flex h-2.5 w-2.5">
            {status !== 'ok' && <span className={`absolute inline-flex h-full w-full rounded-full ${colors[status]} opacity-75 animate-ping`} />}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colors[status]}`} />
        </span>
    );
}

/* ═══════════════════════════════════════════════════════════════
 *  DATE RANGE PICKER
 * ═══════════════════════════════════════════════════════════════ */

function DateRangePicker({ activePreset, customFrom, customTo, onPresetChange, onCustomChange, maxDate }: {
    activePreset: PresetKey; customFrom: string; customTo: string;
    onPresetChange: (key: PresetKey) => void; onCustomChange: (from: string, to: string) => void; maxDate: string;
}) {
    const [showCustom, setShowCustom] = useState(false);
    const [localFrom, setLocalFrom] = useState(customFrom);
    const [localTo, setLocalTo] = useState(customTo);
    const canApply = !!(localFrom && localTo && localFrom <= localTo);
    const isApplied = showCustom && customFrom === localFrom && customTo === localTo && localFrom !== '' && localTo !== '';

    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl border border-white/[0.06]"
                style={{ background: 'rgba(8,12,28,0.6)', backdropFilter: 'blur(12px)' }}>
                {presets.map(p => (
                    <button key={p.key} onClick={() => { onPresetChange(p.key); setShowCustom(false); }}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activePreset === p.key && !showCustom
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                            : 'text-slate-500 hover:text-slate-300 border border-transparent'
                            }`}>{p.label}</button>
                ))}
            </div>
            <button onClick={() => setShowCustom(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${showCustom
                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/25' : 'text-slate-500 hover:text-slate-300 border-white/[0.06]'
                    }`} style={{ backdropFilter: 'blur(12px)', background: showCustom ? undefined : 'rgba(8,12,28,0.6)' }}>
                <Calendar className="w-3.5 h-3.5" /> Custom <ChevronDown className={`w-3 h-3 transition-transform ${showCustom ? 'rotate-180' : ''}`} />
            </button>
            {showCustom && (
                <div className="flex items-center gap-2 p-2 rounded-xl border border-purple-500/20" style={{ background: 'rgba(8,12,28,0.8)', backdropFilter: 'blur(16px)' }}>
                    <label className="text-[10px] text-slate-500 font-medium uppercase">Da</label>
                    <input type="date" value={localFrom} max={maxDate} onChange={e => setLocalFrom(e.target.value)}
                        className="px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white outline-none focus:border-purple-500/40" style={{ colorScheme: 'dark' }} />
                    <label className="text-[10px] text-slate-500 font-medium uppercase">A</label>
                    <input type="date" value={localTo} max={maxDate} onChange={e => setLocalTo(e.target.value)}
                        className="px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white outline-none focus:border-purple-500/40" style={{ colorScheme: 'dark' }} />
                    <button onClick={() => { if (canApply) onCustomChange(localFrom, localTo); }} disabled={!canApply || isApplied}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${isApplied
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : canApply
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30' : 'bg-white/[0.03] text-slate-600 border border-white/[0.06] cursor-not-allowed'
                            }`}>{isApplied ? '✓' : 'Applica'}</button>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
 *  🚀 NASA MISSION CONTROL — MAIN PAGE
 * ═══════════════════════════════════════════════════════════════ */

export default function AdminOverview() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [activePreset, setActivePreset] = useState<PresetKey>('all');
    const [customFrom, setCustomFrom] = useState(() => toISODate(new Date()));
    const [customTo, setCustomTo] = useState(() => toISODate(new Date()));
    const [isCustom, setIsCustom] = useState(false);
    const [clock, setClock] = useState(new Date());

    // Live clock
    useEffect(() => {
        const t = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const loadStats = useCallback((silent = false) => {
        if (!silent) setLoading(true); else setRefreshing(true);
        let url = `/api/admin/stats?t=${Date.now()}`;
        if (isCustom && customFrom && customTo) {
            url += `&from=${customFrom}&to=${customTo}`;
        } else if (activePreset !== 'all') {
            const range = getPresetRange(activePreset);
            if (range) url += `&from=${range.from}&to=${range.to}`;
        }
        fetch(url, { cache: 'no-store' })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(data => { setStats(data); setLoading(false); setRefreshing(false); })
            .catch(err => { setError(err.message); setLoading(false); setRefreshing(false); });
    }, [activePreset, isCustom, customFrom, customTo]);

    useEffect(() => { loadStats(); }, [loadStats]);

    const isFiltered = activePreset !== 'all' || isCustom;

    /* ─── Loading ─── */
    if (loading) {
        return (
            <div className="relative min-h-[80vh] flex flex-col items-center justify-center gap-4">
                <NASABackground />
                <div className="relative w-20 h-20">
                    <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" style={{ animation: 'orbitalSpin 3s linear infinite' }}>
                        <div className="absolute -top-1 left-1/2 w-2 h-2 rounded-full bg-cyan-400" />
                    </div>
                    <div className="absolute inset-3 rounded-full border-2 border-purple-500/20" style={{ animation: 'orbitalSpin 2s linear infinite reverse' }}>
                        <div className="absolute -top-1 left-1/2 w-2 h-2 rounded-full bg-purple-400" />
                    </div>
                    <Rocket className="absolute inset-0 m-auto w-6 h-6 text-cyan-400" />
                </div>
                <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] font-medium animate-pulse">Inizializzazione Mission Control…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8"><div className="p-6 bg-red-500/10 border border-red-500/25 rounded-2xl text-red-300 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" /><span className="text-sm">Errore: {error}</span>
            </div></div>
        );
    }

    if (!stats) return null;

    const s = stats;
    const monitorOk = s.monitoring.criticalBugs === 0 && s.monitoring.openBugs === 0 && s.monitoring.activeBans === 0;
    const ticketsActive = s.tickets.open + s.tickets.in_progress;
    const seatsPct = s.workspaces.totalSeatsAllocated > 0 ? Math.round((s.workspaces.totalSeatsUsed / s.workspaces.totalSeatsAllocated) * 100) : 0;
    const revenueChange = s.revenue.lastMonth > 0
        ? Math.round(((s.revenue.thisMonth - s.revenue.lastMonth) / s.revenue.lastMonth) * 100) : 0;

    return (
        <div className="relative min-h-screen">
            <NASABackground />

            <div className="relative z-10 p-4 lg:p-6 space-y-4 max-w-[1600px] mx-auto">

                {/* ═══════════════════════════════════════════
                    HEADER
                ═══════════════════════════════════════════ */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                                    <Rocket className="w-5 h-5 text-white" />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#080c1c]" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                                    Mission Control
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 uppercase tracking-widest">Live</span>
                                </h1>
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-[0.2em]">Cosmoffice Command Center</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Live Clock */}
                            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.06] text-xs tabular-nums"
                                style={{ background: 'rgba(8,12,28,0.6)', backdropFilter: 'blur(12px)' }}>
                                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                                <span className="text-slate-400">{clock.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                <span className="text-white font-bold">{clock.toLocaleTimeString('it-IT')}</span>
                            </div>
                            {/* System Status */}
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.06]"
                                style={{ background: 'rgba(8,12,28,0.6)', backdropFilter: 'blur(12px)' }}>
                                <StatusDot status={monitorOk ? (ticketsActive > 0 ? 'warn' : 'ok') : 'critical'} />
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${monitorOk ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {monitorOk ? 'Operativo' : 'Attenzione'}
                                </span>
                            </div>
                            {/* Refresh */}
                            <button onClick={() => loadStats(true)} disabled={refreshing}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.06] text-xs font-medium text-slate-400 hover:text-white hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all disabled:opacity-40"
                                style={{ backdropFilter: 'blur(12px)', background: 'rgba(8,12,28,0.6)' }}>
                                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>
                    <DateRangePicker activePreset={activePreset} customFrom={customFrom} customTo={customTo} maxDate={toISODate(new Date())}
                        onPresetChange={k => { setActivePreset(k); setIsCustom(false); }} onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); setIsCustom(true); }} />
                </div>

                {/* ═══════════════════════════════════════════
                    HERO KPIs — 6 cards
                ═══════════════════════════════════════════ */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <HeroKPI icon={Users} label="Utenti" value={isFiltered ? s.users.registeredInPeriod : s.users.total}
                        subtitle={isFiltered ? `registrati · ${s.users.total} totali` : `${s.users.unique} unici · ${s.users.activeInPeriod} attivi`}
                        color="text-cyan-400" accentBg="radial-gradient(circle,#06b6d4,transparent)" change={s.users.recentSignups} delay={0} />

                    <HeroKPI icon={Building2} label="Workspace" value={isFiltered ? s.workspaces.recentNew : s.workspaces.active}
                        subtitle={isFiltered ? `nuovi · ${s.workspaces.total} totali` : `${s.workspaces.total} totali · ${s.workspaces.totalSpaces} uffici`}
                        color="text-purple-400" accentBg="radial-gradient(circle,#a855f7,transparent)" change={s.workspaces.recentNew} delay={50} />

                    <HeroKPI icon={Crown} label="Owner" value={s.users.owners}
                        subtitle={`${s.workspaces.paidWorkspaces} paganti · ${s.users.admins} admin`}
                        color="text-amber-400" accentBg="radial-gradient(circle,#f59e0b,transparent)" delay={100} />

                    <HeroKPI icon={TrendingUp} label="MRR" value={s.revenue.mrrFormatted}
                        subtitle={`ARR: ${s.revenue.arrFormatted}`}
                        color="text-emerald-400" accentBg="radial-gradient(circle,#10b981,transparent)" delay={150} />

                    <HeroKPI icon={CreditCard} label="Incassato" value={s.revenue.thisMonthFormatted}
                        subtitle={`Mese prec: ${s.revenue.lastMonthFormatted}`}
                        color="text-green-400" accentBg="radial-gradient(circle,#22c55e,transparent)" change={revenueChange} delay={200} />

                    <HeroKPI icon={Headphones} label="Ticket" value={ticketsActive}
                        subtitle={`${s.tickets.open} aperti · ${s.tickets.in_progress} in corso`}
                        color={ticketsActive > 0 ? 'text-amber-400' : 'text-emerald-400'}
                        accentBg={ticketsActive > 0 ? 'radial-gradient(circle,#f59e0b,transparent)' : 'radial-gradient(circle,#10b981,transparent)'} delay={250} />
                </div>

                {/* ═══════════════════════════════════════════
                    MAIN GRID — Bento Layout (12 cols)
                ═══════════════════════════════════════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

                    {/* ── LEFT: Utenti + Ruoli ── (4 cols) */}
                    <GlassCard className="lg:col-span-3" glow="radial-gradient(circle,#06b6d4 0%,transparent 70%)" delay={300}>
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Users className="w-4 h-4 text-cyan-400" />
                                <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Composizione Utenti</h2>
                            </div>
                            {/* Ring visual */}
                            <div className="flex items-center justify-center mb-4">
                                <div className="relative w-28 h-28">
                                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                        {(() => {
                                            const total = s.users.total || 1;
                                            const segments = [
                                                { count: s.users.owners, color: '#f59e0b' },
                                                { count: s.users.admins, color: '#a855f7' },
                                                { count: s.users.members, color: '#06b6d4' },
                                                { count: s.users.guests, color: '#64748b' },
                                            ];
                                            let offset = 0;
                                            return segments.map((seg, i) => {
                                                const pct = (seg.count / total) * 100;
                                                const dashArray = `${pct * 2.51} ${251 - pct * 2.51}`;
                                                const el = <circle key={i} cx="50" cy="50" r="40" fill="none" stroke={seg.color} strokeWidth="8"
                                                    strokeDasharray={dashArray} strokeDashoffset={-offset * 2.51} strokeLinecap="round" opacity={0.8} />;
                                                offset += pct;
                                                return el;
                                            });
                                        })()}
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-2xl font-black text-white tabular-nums">{s.users.total}</span>
                                        <span className="text-[8px] text-slate-500 uppercase tracking-widest">totali</span>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-0.5">
                                <MiniStat icon={ShieldCheck} label="Super Admin" value={s.users.superAdmins} color="text-rose-300" />
                                <MiniStat icon={Crown} label="Owner" value={s.users.owners} color="text-amber-300" />
                                <MiniStat icon={UserCog} label="Admin" value={s.users.admins} color="text-purple-300" />
                                <MiniStat icon={User} label="Membri" value={s.users.members} color="text-cyan-300" />
                                <MiniStat icon={Eye} label="Guest" value={s.users.guests} color="text-slate-400" />
                            </div>
                        </div>
                    </GlassCard>

                    {/* ── CENTER: Revenue + Financial ── (5 cols) */}
                    <GlassCard className="lg:col-span-5" glow="radial-gradient(circle,#10b981 0%,transparent 70%)" delay={350}>
                        <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-emerald-400" />
                                    <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Financial Overview</h2>
                                </div>
                                <span className="text-[9px] text-slate-600 tabular-nums">{s.revenue.totalPayments} transazioni</span>
                            </div>

                            {/* Big MRR/ARR row */}
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/15 text-center">
                                    <p className="text-[8px] text-emerald-400/60 uppercase tracking-widest font-bold mb-1">MRR</p>
                                    <p className="text-xl font-black text-white tracking-tighter">{s.revenue.mrrFormatted}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/15 text-center">
                                    <p className="text-[8px] text-blue-400/60 uppercase tracking-widest font-bold mb-1">ARR</p>
                                    <p className="text-xl font-black text-white tracking-tighter">{s.revenue.arrFormatted}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/15 text-center">
                                    <p className="text-[8px] text-purple-400/60 uppercase tracking-widest font-bold mb-1">Questo mese</p>
                                    <p className="text-xl font-black text-white tracking-tighter">{s.revenue.thisMonthFormatted}</p>
                                    {revenueChange !== 0 && (
                                        <p className={`text-[9px] font-bold mt-1 ${revenueChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {revenueChange > 0 ? '↑' : '↓'} {Math.abs(revenueChange)}% vs mese prec
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Recent payments */}
                            <div className="space-y-1">
                                <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mb-2">Ultimi Pagamenti</p>
                                {s.revenue.recentPayments.length === 0 ? (
                                    <p className="text-[11px] text-slate-600 italic">Nessun pagamento registrato</p>
                                ) : s.revenue.recentPayments.map((p: any) => (
                                    <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${p.type === 'refund' ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                                            <Banknote className={`w-3 h-3 ${p.type === 'refund' ? 'text-red-400' : 'text-emerald-400'}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] text-slate-300 truncate">{p.workspace_name || p.owner_name}</p>
                                        </div>
                                        <span className="text-[10px] text-slate-600 tabular-nums">{new Date(p.payment_date).toLocaleDateString('it-IT')}</span>
                                        <span className={`text-[11px] font-bold tabular-nums ${p.type === 'refund' ? 'text-red-400' : 'text-emerald-400'}`}>
                                            {p.type === 'refund' ? '−' : '+'}€{(Math.abs(p.amount_cents) / 100).toFixed(2)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </GlassCard>

                    {/* ── RIGHT: Workspace Status + Capacity ── (4 cols) */}
                    <GlassCard className="lg:col-span-4" glow="radial-gradient(circle,#a855f7 0%,transparent 70%)" delay={400}>
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Server className="w-4 h-4 text-purple-400" />
                                <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Infrastruttura</h2>
                            </div>

                            {/* Workspace status grid */}
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/15 text-center">
                                    <p className="text-2xl font-black text-emerald-400 tabular-nums">{s.workspaces.active}</p>
                                    <p className="text-[8px] text-emerald-400/60 uppercase tracking-widest font-bold">Attivi</p>
                                </div>
                                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/15 text-center">
                                    <p className="text-2xl font-black text-amber-400 tabular-nums">{s.workspaces.suspended}</p>
                                    <p className="text-[8px] text-amber-400/60 uppercase tracking-widest font-bold">Sospesi</p>
                                </div>
                            </div>

                            {/* Metrics */}
                            <div className="space-y-2 mb-4">
                                <ProgressBar value={s.workspaces.totalSeatsUsed} max={s.workspaces.totalSeatsAllocated}
                                    label="Occupazione Accessi" color={seatsPct > 80 ? 'bg-red-500' : seatsPct > 50 ? 'bg-amber-500' : 'bg-cyan-500'} />
                            </div>

                            <div className="space-y-0.5">
                                <MiniStat icon={Globe} label="Uffici totali" value={s.workspaces.totalSpaces} color="text-purple-300" />
                                <MiniStat icon={LayoutGrid} label="Piani Premium" value={s.workspaces.paidWorkspaces} color="text-amber-300" />
                                <MiniStat icon={Zap} label="Attivi (24h)" value={s.workspaces.activeInPeriod} color="text-emerald-400" />
                                <MiniStat icon={Building2} label="Nuovi (7gg)" value={s.workspaces.recentNew} color="text-blue-300" />
                            </div>
                        </div>
                    </GlassCard>
                </div>

                {/* ═══════════════════════════════════════════
                    BOTTOM ROW — Support + Plans + Monitor
                ═══════════════════════════════════════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

                    {/* ── Support Tickets ── (5 cols) */}
                    <GlassCard className="lg:col-span-5" glow="radial-gradient(circle,#f59e0b 0%,transparent 70%)" delay={450}>
                        <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Headphones className="w-4 h-4 text-amber-400" />
                                    <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Centro Assistenza</h2>
                                </div>
                                <span className="text-[9px] text-slate-600 tabular-nums">{s.tickets.total} totali</span>
                            </div>

                            {/* Ticket stats row */}
                            <div className="grid grid-cols-4 gap-2 mb-4">
                                {[
                                    { l: 'Aperti', v: s.tickets.open, c: 'text-red-400', bg: 'bg-red-500/10 border-red-500/15' },
                                    { l: 'In Corso', v: s.tickets.in_progress, c: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/15' },
                                    { l: 'Risolti', v: s.tickets.resolved, c: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/15' },
                                    { l: 'Chiusi', v: s.tickets.closed, c: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/15' },
                                ].map(t => (
                                    <div key={t.l} className={`p-2 rounded-xl border text-center ${t.bg}`}>
                                        <p className={`text-lg font-black tabular-nums ${t.c}`}>{t.v}</p>
                                        <p className="text-[7px] text-slate-500 uppercase tracking-widest font-bold">{t.l}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Recent tickets */}
                            {s.recentTickets.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mb-2">Ticket Attivi</p>
                                    {s.recentTickets.map((t: any) => (
                                        <div key={t.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                                            <StatusDot status={t.priority === 'high' || t.priority === 'critical' ? 'critical' : t.status === 'open' ? 'warn' : 'ok'} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] text-slate-300 truncate">{t.subject}</p>
                                                <p className="text-[9px] text-slate-600">{t.workspace_name}</p>
                                            </div>
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${t.status === 'open' ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-300'}`}>
                                                {t.status === 'open' ? 'Aperto' : 'In Corso'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {s.recentTickets.length === 0 && ticketsActive === 0 && (
                                <div className="flex flex-col items-center py-4 gap-2">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-400/50" />
                                    <p className="text-[11px] text-emerald-400/60">Nessun ticket aperto</p>
                                </div>
                            )}
                        </div>
                    </GlassCard>

                    {/* ── Plan Distribution ── (4 cols) */}
                    <GlassCard className="lg:col-span-4" glow="radial-gradient(circle,#6366f1 0%,transparent 70%)" delay={500}>
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <BarChart3 className="w-4 h-4 text-indigo-400" />
                                <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Distribuzione Piani</h2>
                            </div>

                            {/* Visual bars */}
                            <div className="space-y-3">
                                {Object.entries(s.workspaces.planDistribution).map(([plan, count]) => {
                                    const total = s.workspaces.total || 1;
                                    const pct = Math.round((count / total) * 100);
                                    const isPremium = plan === 'premium';
                                    return (
                                        <div key={plan} className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${isPremium ? 'bg-amber-400' : 'bg-slate-400'}`} />
                                                    <span className={`text-xs font-bold uppercase tracking-wider ${isPremium ? 'text-amber-300' : 'text-slate-400'}`}>{plan}</span>
                                                </div>
                                                <span className="text-xs font-bold text-white tabular-nums">{count} <span className="text-slate-600">({pct}%)</span></span>
                                            </div>
                                            <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                                                <div className={`h-full rounded-full ${isPremium ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-slate-500 to-slate-600'}`}
                                                    style={{ width: `${pct}%`, animation: 'barFill 1.2s ease-out' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-4 pt-3 border-t border-white/[0.05]">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">Conversione Premium</span>
                                    <span className="text-sm font-black text-amber-300 tabular-nums">
                                        {s.workspaces.total > 0 ? Math.round((s.workspaces.paidWorkspaces / s.workspaces.total) * 100) : 0}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </GlassCard>

                    {/* ── System Monitor ── (3 cols) */}
                    <GlassCard className="lg:col-span-3" glow={monitorOk
                        ? 'radial-gradient(circle,#10b981 0%,transparent 70%)'
                        : 'radial-gradient(circle,#ef4444 0%,transparent 70%)'
                    } delay={550}>
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Gauge className="w-4 h-4" style={{ color: monitorOk ? '#34d399' : '#f87171' }} />
                                <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">System Health</h2>
                            </div>

                            {monitorOk ? (
                                <div className="flex flex-col items-center justify-center py-6 gap-3">
                                    <div className="relative">
                                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                            <Shield className="w-8 h-8 text-emerald-400" />
                                        </div>
                                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                            <CheckCircle2 className="w-3 h-3 text-white" />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-emerald-400">Tutti i sistemi OK</p>
                                        <p className="text-[10px] text-slate-600 mt-1">Nessun bug, ban o anomalia</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-0.5">
                                    <MiniStat icon={Bug} label="Bug Aperti" value={s.monitoring.openBugs}
                                        color={s.monitoring.openBugs > 0 ? 'text-amber-300' : 'text-emerald-400'} />
                                    <MiniStat icon={AlertTriangle} label="Bug Critici" value={s.monitoring.criticalBugs}
                                        color={s.monitoring.criticalBugs > 0 ? 'text-red-400' : 'text-emerald-400'} />
                                    <MiniStat icon={Ban} label="Ban Attivi" value={s.monitoring.activeBans}
                                        color={s.monitoring.activeBans > 0 ? 'text-amber-300' : 'text-emerald-400'} />
                                </div>
                            )}
                        </div>
                    </GlassCard>
                </div>

            </div>
        </div>
    );
}
