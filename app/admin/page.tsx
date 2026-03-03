'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
    Users, Crown, Activity,
    Building2, Pause, Trash2, Zap,
    LayoutGrid,
    TrendingUp, DollarSign,
    Bug, AlertTriangle, Shield, Ban,
    ArrowUpRight, RefreshCw, Sparkles, Rocket,
    ShieldCheck, UserCog, User, Eye,
    Calendar, ChevronDown, UserPlus,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════ *
 *  Types                                              *
 * ═══════════════════════════════════════════════════ */

interface Stats {
    users: { total: number; unique: number; superAdmins: number; owners: number; admins: number; members: number; guests: number; recentSignups: number; activeInPeriod: number };
    workspaces: { total: number; active: number; suspended: number; deleted: number; recentNew: number; activeInPeriod: number; planDistribution: Record<string, number>; paidWorkspaces: number };
    revenue: { totalCents: number; totalFormatted: string; paidWorkspaces: number };
    monitoring: { openBugs: number; criticalBugs: number; activeBans: number };
    dateRange: { from: string; to: string } | null;
}

type PresetKey = 'today' | '7d' | '30d' | '90d' | 'year' | 'all';

/* ═══════════════════════════════════════════════════ *
 *  Date helpers                                       *
 * ═══════════════════════════════════════════════════ */

function toISODate(d: Date): string {
    return d.toISOString().split('T')[0];
}

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
    { key: 'today', label: 'Oggi' },
    { key: '7d', label: '7gg' },
    { key: '30d', label: '30gg' },
    { key: '90d', label: '90gg' },
    { key: 'year', label: 'Anno' },
    { key: 'all', label: 'Tutti' },
];

/* ═══════════════════════════════════════════════════ *
 *  Animated Starfield Background (CSS-only)           *
 * ═══════════════════════════════════════════════════ */

function Starfield() {
    const stars = useMemo(() =>
        Array.from({ length: 60 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 2 + 0.5,
            delay: Math.random() * 4,
            duration: Math.random() * 3 + 2,
        }))
        , []);

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {stars.map(s => (
                <div
                    key={s.id}
                    className="absolute rounded-full bg-white"
                    style={{
                        left: `${s.x}%`,
                        top: `${s.y}%`,
                        width: s.size,
                        height: s.size,
                        opacity: 0,
                        animation: `starTwinkle ${s.duration}s ${s.delay}s ease-in-out infinite`,
                    }}
                />
            ))}
            <style jsx>{`
                @keyframes starTwinkle {
                    0%, 100% { opacity: 0.1; }
                    50% { opacity: 0.7; }
                }
            `}</style>
        </div>
    );
}

/* ═══════════════════════════════════════════════════ *
 *  Glassmorphic Card                                  *
 * ═══════════════════════════════════════════════════ */

function GlassCard({ children, className = '', glow, span }: {
    children: React.ReactNode; className?: string; glow?: string; span?: string;
}) {
    return (
        <div className={`relative group rounded-[20px] border border-white/[0.06] overflow-hidden transition-all duration-500 hover:border-white/[0.12] ${span || ''} ${className}`}
            style={{ background: 'rgba(12,17,35,0.6)', backdropFilter: 'blur(24px)' }}>
            {glow && (
                <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-[0.07] blur-3xl transition-opacity duration-700 group-hover:opacity-[0.14] pointer-events-none"
                    style={{ background: glow }} />
            )}
            {children}
        </div>
    );
}

/* ═══════════════════════════════════════════════════ *
 *  Plan Pill                                          *
 * ═══════════════════════════════════════════════════ */

const planStyles: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    free: { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-300', dot: 'bg-slate-400' },
    starter: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-300', dot: 'bg-blue-400' },
    pro: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-300', dot: 'bg-purple-400' },
    enterprise: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-300', dot: 'bg-amber-400' },
};

function PlanPill({ plan, count, total }: { plan: string; count: number; total: number }) {
    const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
    const s = planStyles[plan] || planStyles.free;
    return (
        <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${s.bg} ${s.border}`}>
            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            <span className={`text-xs font-bold uppercase tracking-wider flex-1 ${s.text}`}>{plan}</span>
            <span className="text-xs font-bold text-white/80 tabular-nums">{count}</span>
            <span className="text-[10px] text-slate-600 tabular-nums">{pct}%</span>
        </div>
    );
}

/* ═══════════════════════════════════════════════════ *
 *  Metric Row                                         *
 * ═══════════════════════════════════════════════════ */

function MetricRow({ label, value, icon: Icon, accent = 'text-slate-300', alert }: {
    label: string; value: string | number; icon: any; accent?: string; alert?: boolean;
}) {
    return (
        <div className="flex items-center justify-between py-2.5 group/row">
            <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${alert ? 'bg-red-500/10' : 'bg-white/[0.03]'
                    }`}>
                    <Icon className={`w-4 h-4 ${alert ? 'text-red-400' : accent}`} />
                </div>
                <span className="text-[13px] text-slate-400">{label}</span>
            </div>
            <div className="flex items-center gap-2">
                {alert && (
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                    </span>
                )}
                <span className={`text-[13px] font-bold tabular-nums ${alert ? 'text-red-400' : accent}`}>{value}</span>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════ *
 *  Date Range Picker                                  *
 * ═══════════════════════════════════════════════════ */

function DateRangePicker({ activePreset, customFrom, customTo, onPresetChange, onCustomChange }: {
    activePreset: PresetKey;
    customFrom: string;
    customTo: string;
    onPresetChange: (key: PresetKey) => void;
    onCustomChange: (from: string, to: string) => void;
}) {
    const [showCustom, setShowCustom] = useState(false);

    return (
        <div className="flex flex-wrap items-center gap-2">
            {/* Preset pills */}
            <div className="flex items-center gap-1 p-1 rounded-xl border border-white/[0.06]"
                style={{ background: 'rgba(12,17,35,0.5)', backdropFilter: 'blur(12px)' }}>
                {presets.map(p => (
                    <button
                        key={p.key}
                        onClick={() => { onPresetChange(p.key); setShowCustom(false); }}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${activePreset === p.key && !showCustom
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                            : 'text-slate-500 hover:text-slate-300 border border-transparent'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Custom date button */}
            <button
                onClick={() => setShowCustom(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold uppercase tracking-wider transition-all ${showCustom
                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/25 shadow-[0_0_8px_rgba(168,85,247,0.15)]'
                    : 'text-slate-500 hover:text-slate-300 border-white/[0.06] hover:border-white/[0.12]'
                    }`}
                style={{ backdropFilter: 'blur(12px)', background: showCustom ? undefined : 'rgba(12,17,35,0.5)' }}
            >
                <Calendar className="w-3.5 h-3.5" />
                Custom
                <ChevronDown className={`w-3 h-3 transition-transform ${showCustom ? 'rotate-180' : ''}`} />
            </button>

            {/* Custom date inputs */}
            {showCustom && (
                <div className="flex items-center gap-2 p-2 rounded-xl border border-purple-500/20 animate-in fade-in slide-in-from-top-1"
                    style={{ background: 'rgba(12,17,35,0.7)', backdropFilter: 'blur(16px)' }}>
                    <label className="text-[10px] text-slate-500 font-medium uppercase">Da</label>
                    <input
                        type="date"
                        value={customFrom}
                        onChange={e => onCustomChange(e.target.value, customTo)}
                        className="px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white outline-none focus:border-purple-500/40 transition-colors"
                        style={{ colorScheme: 'dark' }}
                    />
                    <label className="text-[10px] text-slate-500 font-medium uppercase">A</label>
                    <input
                        type="date"
                        value={customTo}
                        onChange={e => onCustomChange(customFrom, e.target.value)}
                        className="px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white outline-none focus:border-purple-500/40 transition-colors"
                        style={{ colorScheme: 'dark' }}
                    />
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════ *
 *  PAGE                                               *
 * ═══════════════════════════════════════════════════ */

export default function AdminOverview() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // Date range state
    const [activePreset, setActivePreset] = useState<PresetKey>('all');
    const [customFrom, setCustomFrom] = useState(() => toISODate(new Date()));
    const [customTo, setCustomTo] = useState(() => toISODate(new Date()));
    const [isCustom, setIsCustom] = useState(false);

    const loadStats = useCallback((silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);

        // Build URL with optional date range
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

    // Get the active range label for display
    const rangeLabel = useMemo(() => {
        if (isCustom && customFrom && customTo) {
            return `${customFrom} → ${customTo}`;
        }
        const p = presets.find(p => p.key === activePreset);
        return p ? p.label : '';
    }, [activePreset, isCustom, customFrom, customTo]);

    const isFiltered = activePreset !== 'all' || isCustom;

    /* ─── Loading ─── */
    if (loading) {
        return (
            <div className="relative min-h-[80vh] flex flex-col items-center justify-center gap-4">
                <Starfield />
                <div className="w-12 h-12 rounded-full border-[3px] border-cyan-500/30 border-t-cyan-400 animate-spin" />
                <p className="text-xs text-slate-600 uppercase tracking-widest font-medium animate-pulse">Caricamento metriche…</p>
            </div>
        );
    }

    /* ─── Error ─── */
    if (error) {
        return (
            <div className="p-8">
                <div className="p-6 bg-red-500/10 border border-red-500/25 rounded-2xl text-red-300 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span className="text-sm">Errore: {error}</span>
                </div>
            </div>
        );
    }

    if (!stats) return null;

    const totalPlans = Object.values(stats.workspaces.planDistribution).reduce((a, b) => a + b, 0);
    const monitorOk = stats.monitoring.criticalBugs === 0 && stats.monitoring.openBugs === 0 && stats.monitoring.activeBans === 0;

    return (
        <div className="relative min-h-screen">
            <Starfield />

            <div className="relative z-10 p-6 lg:p-8 space-y-5 max-w-[1440px] mx-auto">

                {/* ═══ Header ═══ */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                                <Rocket className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white tracking-tight">Mission Control</h1>
                                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-widest">Cosmoffice Dashboard</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {isFiltered && (
                                <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                                    {rangeLabel}
                                </span>
                            )}
                            <button
                                onClick={() => loadStats(true)}
                                disabled={refreshing}
                                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/[0.06] text-xs font-medium text-slate-400 hover:text-white hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all disabled:opacity-40"
                                style={{ backdropFilter: 'blur(12px)', background: 'rgba(12,17,35,0.5)' }}
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                                Aggiorna
                            </button>
                        </div>
                    </div>

                    {/* ═══ Date Range Picker ═══ */}
                    <DateRangePicker
                        activePreset={activePreset}
                        customFrom={customFrom}
                        customTo={customTo}
                        onPresetChange={(key) => {
                            setActivePreset(key);
                            setIsCustom(false);
                        }}
                        onCustomChange={(from, to) => {
                            setCustomFrom(from);
                            setCustomTo(to);
                            setIsCustom(true);
                        }}
                    />
                </div>

                {/* ═══ Top Hero Row — 4 big KPIs ═══ */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Users */}
                    <GlassCard glow="radial-gradient(circle, #06b6d4, transparent)">
                        <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-cyan-400" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/70">Utenti</span>
                                </div>
                                {stats.users.recentSignups > 0 && (
                                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                                        <ArrowUpRight className="w-3 h-3" />+{stats.users.recentSignups}
                                    </span>
                                )}
                            </div>
                            <p className="text-4xl font-extrabold text-white tracking-tighter leading-none">{stats.users.total}</p>
                            <p className="mt-1.5 text-xs text-slate-500">{stats.users.activeInPeriod} attivi {isFiltered ? 'nel periodo' : 'oggi'}</p>
                        </div>
                    </GlassCard>

                    {/* Workspaces */}
                    <GlassCard glow="radial-gradient(circle, #a855f7, transparent)">
                        <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-purple-400" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400/70">Workspace</span>
                                </div>
                                {stats.workspaces.recentNew > 0 && (
                                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                                        <ArrowUpRight className="w-3 h-3" />+{stats.workspaces.recentNew}
                                    </span>
                                )}
                            </div>
                            <p className="text-4xl font-extrabold text-white tracking-tighter leading-none">{stats.workspaces.active}</p>
                            <p className="mt-1.5 text-xs text-slate-500">{stats.workspaces.total} totali</p>
                        </div>
                    </GlassCard>

                    {/* Revenue */}
                    <GlassCard glow="radial-gradient(circle, #10b981, transparent)">
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">
                                    {isFiltered ? 'Revenue periodo' : 'MRR'}
                                </span>
                            </div>
                            <p className="text-4xl font-extrabold text-white tracking-tighter leading-none">{stats.revenue.totalFormatted}</p>
                            <p className="mt-1.5 text-xs text-slate-500">{stats.revenue.paidWorkspaces} paganti</p>
                        </div>
                    </GlassCard>

                    {/* Health */}
                    <GlassCard glow={monitorOk
                        ? 'radial-gradient(circle, #10b981, transparent)'
                        : 'radial-gradient(circle, #ef4444, transparent)'
                    }>
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Shield className="w-4 h-4" style={{ color: monitorOk ? '#34d399' : '#f87171' }} />
                                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: monitorOk ? 'rgba(52,211,153,0.7)' : 'rgba(248,113,113,0.7)' }}>
                                    Status
                                </span>
                            </div>
                            {monitorOk ? (
                                <>
                                    <p className="text-4xl font-extrabold text-emerald-400 tracking-tighter leading-none flex items-center gap-2">
                                        OK <Sparkles className="w-5 h-5" />
                                    </p>
                                    <p className="mt-1.5 text-xs text-slate-500">Nessuna anomalia</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-4xl font-extrabold text-red-400 tracking-tighter leading-none">
                                        {stats.monitoring.openBugs + stats.monitoring.criticalBugs + stats.monitoring.activeBans}
                                    </p>
                                    <p className="mt-1.5 text-xs text-red-400/60">
                                        {stats.monitoring.criticalBugs > 0 && `${stats.monitoring.criticalBugs} critici · `}
                                        issues attive
                                    </p>
                                </>
                            )}
                        </div>
                    </GlassCard>
                </div>

                {/* ═══ Bento Grid ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                    {/* ── Utenti Detail — big total + role breakdown ── */}
                    <GlassCard className="lg:col-span-4" glow="radial-gradient(circle, #06b6d4 0%, transparent 70%)">
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Users className="w-4 h-4 text-cyan-400" />
                                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Dettaglio utenti</h2>
                            </div>
                            {/* Big prominent total */}
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.06]">
                                <div className="px-4 py-2 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/15">
                                    <p className="text-3xl font-black text-white tracking-tighter leading-none tabular-nums">
                                        {stats.users.total}
                                    </p>
                                </div>
                                <span className="text-sm text-slate-400 font-bold uppercase tracking-wider">utenti<br />totali</span>
                            </div>
                            {/* Role breakdown */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between py-1.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center">
                                            <ShieldCheck className="w-3.5 h-3.5 text-rose-300" />
                                        </div>
                                        <span className="text-[12px] text-slate-400">Super Admin</span>
                                    </div>
                                    <span className="text-sm font-bold text-rose-300 tabular-nums">{stats.users.superAdmins}</span>
                                </div>
                                <div className="flex items-center justify-between py-1.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                            <Crown className="w-3.5 h-3.5 text-amber-300" />
                                        </div>
                                        <span className="text-[12px] text-slate-400">Owner</span>
                                    </div>
                                    <span className="text-sm font-bold text-amber-300 tabular-nums">{stats.users.owners}</span>
                                </div>
                                <div className="flex items-center justify-between py-1.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                            <UserCog className="w-3.5 h-3.5 text-purple-300" />
                                        </div>
                                        <span className="text-[12px] text-slate-400">Admin</span>
                                    </div>
                                    <span className="text-sm font-bold text-purple-300 tabular-nums">{stats.users.admins}</span>
                                </div>
                                <div className="flex items-center justify-between py-1.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                                            <User className="w-3.5 h-3.5 text-cyan-300" />
                                        </div>
                                        <span className="text-[12px] text-slate-400">Membri</span>
                                    </div>
                                    <span className="text-sm font-bold text-cyan-300 tabular-nums">{stats.users.members}</span>
                                </div>
                                <div className="flex items-center justify-between py-1.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-lg bg-slate-500/10 flex items-center justify-center">
                                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                                        </div>
                                        <span className="text-[12px] text-slate-400">Guest</span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-300 tabular-nums">{stats.users.guests}</span>
                                </div>
                            </div>
                        </div>
                    </GlassCard>

                    {/* ── Workspace Detail ── */}
                    <GlassCard className="lg:col-span-4" glow="radial-gradient(circle, #a855f7 0%, transparent 70%)">
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Building2 className="w-4 h-4 text-purple-400" />
                                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Dettaglio workspace</h2>
                            </div>
                            {/* Big prominent total */}
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.06]">
                                <div className="px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/15">
                                    <p className="text-3xl font-black text-white tracking-tighter leading-none tabular-nums">
                                        {stats.workspaces.total}
                                    </p>
                                </div>
                                <span className="text-sm text-slate-400 font-bold uppercase tracking-wider">workspace<br />totali</span>
                            </div>
                            <div className="divide-y divide-white/[0.04]">
                                <MetricRow label="Attivi" value={stats.workspaces.active} icon={Zap} accent="text-emerald-400" />
                                <MetricRow label="Sospesi" value={stats.workspaces.suspended} icon={Pause} accent="text-amber-300" />
                                <MetricRow label="Eliminati" value={stats.workspaces.deleted} icon={Trash2} accent="text-red-300" />
                                <MetricRow label={isFiltered ? 'Attivi nel periodo' : 'Attivi oggi'} value={stats.workspaces.activeInPeriod} icon={Activity} accent="text-emerald-400" />
                            </div>
                        </div>
                    </GlassCard>

                    {/* ── Attività & Crescita ── */}
                    <GlassCard className="lg:col-span-4" glow="radial-gradient(circle, #3b82f6 0%, transparent 70%)">
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-1">
                                <Activity className="w-4 h-4 text-blue-400" />
                                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                                    Attività {isFiltered ? 'nel periodo' : '& Crescita'}
                                </h2>
                            </div>
                            <div className="divide-y divide-white/[0.04] mt-3">
                                <MetricRow label={isFiltered ? 'Nuove registrazioni' : 'Nuovi utenti (7gg)'} value={stats.users.recentSignups} icon={UserPlus} accent="text-emerald-400" />
                                <MetricRow label={isFiltered ? 'Utenti attivi' : 'Utenti attivi (24h)'} value={stats.users.activeInPeriod} icon={Activity} accent="text-emerald-400" />
                                <MetricRow label={isFiltered ? 'Workspace attivi' : 'Workspace attivi (24h)'} value={stats.workspaces.activeInPeriod} icon={Zap} accent="text-emerald-400" />
                                <MetricRow label={isFiltered ? 'Nuovi workspace' : 'Nuovi workspace (7gg)'} value={stats.workspaces.recentNew} icon={Building2} accent="text-blue-300" />
                            </div>
                        </div>
                    </GlassCard>

                    {/* ── Plan Distribution ── */}
                    <GlassCard className="lg:col-span-5" glow="radial-gradient(circle, #6366f1 0%, transparent 70%)">
                        <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <LayoutGrid className="w-4 h-4 text-indigo-400" />
                                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Piani</h2>
                                </div>
                                <span className="text-xs text-slate-600 tabular-nums">{totalPlans} totali</span>
                            </div>
                            <div className="space-y-2">
                                {Object.entries(stats.workspaces.planDistribution).map(([plan, count]) => (
                                    <PlanPill key={plan} plan={plan} count={count} total={totalPlans} />
                                ))}
                            </div>
                            <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Paganti</span>
                                <span className="text-sm font-bold text-purple-300 tabular-nums">
                                    {stats.workspaces.paidWorkspaces}<span className="text-slate-600">/{totalPlans}</span>
                                </span>
                            </div>
                        </div>
                    </GlassCard>

                    {/* ── Revenue ── */}
                    <GlassCard className="lg:col-span-4" glow="radial-gradient(circle, #10b981 0%, transparent 70%)">
                        <div className="p-5 flex flex-col h-full">
                            <div className="flex items-center gap-2 mb-5">
                                <DollarSign className="w-4 h-4 text-emerald-400" />
                                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Revenue</h2>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center text-center py-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/50 mb-2">
                                    {isFiltered ? 'Totale nel periodo' : 'Mese corrente'}
                                </p>
                                <p className="text-5xl font-black text-white tracking-tighter leading-none">
                                    {stats.revenue.totalFormatted}
                                </p>
                                <div className="mt-3 flex items-center gap-4 text-xs">
                                    <span className="text-slate-500"><strong className="text-white">{stats.revenue.paidWorkspaces}</strong> paganti</span>
                                </div>
                            </div>
                            {stats.revenue.paidWorkspaces === 0 && (
                                <p className="text-[11px] text-slate-600 italic text-center pt-3 border-t border-white/[0.04]">
                                    Nessun piano a pagamento configurato
                                </p>
                            )}
                        </div>
                    </GlassCard>

                    {/* ── Monitoring ── */}
                    <GlassCard className="lg:col-span-3" glow={monitorOk
                        ? 'radial-gradient(circle, #10b981 0%, transparent 70%)'
                        : 'radial-gradient(circle, #f59e0b 0%, transparent 70%)'
                    }>
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Shield className="w-4 h-4 text-amber-400" />
                                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Monitor</h2>
                            </div>
                            {monitorOk ? (
                                <div className="flex flex-col items-center justify-center py-6 gap-3">
                                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                        <Shield className="w-7 h-7 text-emerald-400" />
                                    </div>
                                    <p className="text-sm font-medium text-emerald-400">Tutto nella norma</p>
                                    <p className="text-[10px] text-slate-600">Nessun bug o ban attivo</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/[0.04]">
                                    <MetricRow label="Bug aperti" value={stats.monitoring.openBugs} icon={Bug}
                                        accent={stats.monitoring.openBugs > 0 ? 'text-amber-300' : 'text-slate-400'} />
                                    <MetricRow label="Bug critici" value={stats.monitoring.criticalBugs} icon={AlertTriangle}
                                        accent="text-red-400" alert={stats.monitoring.criticalBugs > 0} />
                                    <MetricRow label="Ban attivi" value={stats.monitoring.activeBans} icon={Ban}
                                        accent={stats.monitoring.activeBans > 0 ? 'text-amber-300' : 'text-emerald-400'} />
                                </div>
                            )}
                        </div>
                    </GlassCard>
                </div>
            </div>
        </div>
    );
}
