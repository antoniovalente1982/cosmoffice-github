'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
    Users, UserCheck, Crown, UserPlus, Activity,
    Building2, Pause, Trash2, Zap,
    LayoutGrid,
    TrendingUp, DollarSign, CreditCard,
    Bug, AlertTriangle, Shield, Ban,
    ArrowUpRight, RefreshCw, Sparkles, Rocket,
    ShieldCheck, UserCog, User, Eye,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════ *
 *  Types                                              *
 * ═══════════════════════════════════════════════════ */

interface Stats {
    users: { total: number; unique: number; superAdmins: number; owners: number; admins: number; members: number; guests: number; recentSignups: number; active24h: number };
    workspaces: { total: number; active: number; suspended: number; deleted: number; recentNew: number; active24h: number; planDistribution: Record<string, number>; paidWorkspaces: number };
    revenue: { mrrCents: number; mrrFormatted: string; arrFormatted: string; paidWorkspaces: number };
    monitoring: { openBugs: number; criticalBugs: number; activeBans: number };
}

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
 *  Ring Gauge (SVG donut)                             *
 * ═══════════════════════════════════════════════════ */

function RingGauge({ value, max, label, color, size = 80 }: {
    value: number; max: number; label: string; color: string; size?: number;
}) {
    const r = (size - 8) / 2;
    const circ = 2 * Math.PI * r;
    const pct = max > 0 ? Math.min(value / max, 1) : 0;
    const offset = circ * (1 - pct);

    return (
        <div className="flex flex-col items-center gap-1.5">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="-rotate-90">
                    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={5} />
                    <circle
                        cx={size / 2} cy={size / 2} r={r} fill="none"
                        stroke={color} strokeWidth={5} strokeLinecap="round"
                        strokeDasharray={circ} strokeDashoffset={offset}
                        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-white tabular-nums">{value}</span>
                </div>
            </div>
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider text-center leading-tight">{label}</span>
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
 *  PAGE                                               *
 * ═══════════════════════════════════════════════════ */

export default function AdminOverview() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const loadStats = useCallback((silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        fetch(`/api/admin/stats?t=${Date.now()}`, { cache: 'no-store' })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(data => { setStats(data); setLoading(false); setRefreshing(false); })
            .catch(err => { setError(err.message); setLoading(false); setRefreshing(false); });
    }, []);

    useEffect(() => { loadStats(); }, [loadStats]);

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
                            <p className="mt-1.5 text-xs text-slate-500">{stats.users.active24h} attivi oggi</p>
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

                    {/* MRR */}
                    <GlassCard glow="radial-gradient(circle, #10b981, transparent)">
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">MRR</span>
                            </div>
                            <p className="text-4xl font-extrabold text-white tracking-tighter leading-none">{stats.revenue.mrrFormatted}</p>
                            <p className="mt-1.5 text-xs text-slate-500">ARR {stats.revenue.arrFormatted}</p>
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

                    {/* ── Utenti Detail ── */}
                    <GlassCard className="lg:col-span-4" glow="radial-gradient(circle, #06b6d4 0%, transparent 70%)">
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-1">
                                <Users className="w-4 h-4 text-cyan-400" />
                                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Dettaglio utenti</h2>
                            </div>
                            <div className="divide-y divide-white/[0.04] mt-3">
                                <MetricRow label="Totali" value={stats.users.total} icon={Users} accent="text-cyan-300" />
                                <MetricRow label="Super Admin" value={stats.users.superAdmins} icon={ShieldCheck} accent="text-rose-300" />
                                <MetricRow label="Owner" value={stats.users.owners} icon={Crown} accent="text-amber-300" />
                                <MetricRow label="Admin" value={stats.users.admins} icon={UserCog} accent="text-purple-300" />
                                <MetricRow label="Membri" value={stats.users.members} icon={User} accent="text-cyan-300" />
                                <MetricRow label="Guest" value={stats.users.guests} icon={Eye} accent="text-slate-300" />
                                <MetricRow label="Workspace" value={stats.workspaces.total} icon={Building2} accent="text-purple-300" />
                            </div>
                        </div>
                    </GlassCard>

                    {/* ── Workspace Detail ── */}
                    <GlassCard className="lg:col-span-4" glow="radial-gradient(circle, #a855f7 0%, transparent 70%)">
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-1">
                                <Building2 className="w-4 h-4 text-purple-400" />
                                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Dettaglio workspace</h2>
                            </div>
                            <div className="divide-y divide-white/[0.04] mt-3">
                                <MetricRow label="Totali" value={stats.workspaces.total} icon={Building2} accent="text-purple-300" />
                                <MetricRow label="Attivi" value={stats.workspaces.active} icon={Zap} accent="text-emerald-400" />
                                <MetricRow label="Sospesi" value={stats.workspaces.suspended} icon={Pause} accent="text-amber-300" />
                                <MetricRow label="Eliminati" value={stats.workspaces.deleted} icon={Trash2} accent="text-red-300" />
                                <MetricRow label="Attivi oggi" value={stats.workspaces.active24h} icon={Activity} accent="text-emerald-400" />
                            </div>
                        </div>
                    </GlassCard>

                    {/* ── Attività & Crescita ── */}
                    <GlassCard className="lg:col-span-4" glow="radial-gradient(circle, #3b82f6 0%, transparent 70%)">
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-1">
                                <Activity className="w-4 h-4 text-blue-400" />
                                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Attività & Crescita</h2>
                            </div>
                            <div className="divide-y divide-white/[0.04] mt-3">
                                <MetricRow label="Nuovi utenti (7gg)" value={stats.users.recentSignups} icon={UserPlus} accent="text-emerald-400" />
                                <MetricRow label="Utenti attivi (24h)" value={stats.users.active24h} icon={Activity} accent="text-emerald-400" />
                                <MetricRow label="Workspace attivi (24h)" value={stats.workspaces.active24h} icon={Zap} accent="text-emerald-400" />
                                <MetricRow label="Nuovi workspace (7gg)" value={stats.workspaces.recentNew} icon={Building2} accent="text-blue-300" />
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
                                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/50 mb-2">Monthly Recurring</p>
                                <p className="text-5xl font-black text-white tracking-tighter leading-none">
                                    {stats.revenue.mrrFormatted}
                                </p>
                                <div className="mt-3 flex items-center gap-4 text-xs">
                                    <span className="text-slate-500">ARR <strong className="text-emerald-300">{stats.revenue.arrFormatted}</strong></span>
                                    <span className="text-slate-600">•</span>
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
