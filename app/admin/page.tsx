'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Users, UserCheck, Crown, UserPlus, Activity,
    Building2, Pause, Trash2, Zap,
    Layers, DoorOpen, LayoutGrid,
    TrendingUp, DollarSign, CreditCard,
    Bug, AlertTriangle, Shield, Ban,
    ArrowUpRight, RefreshCw, Clock,
} from 'lucide-react';

interface Stats {
    users: {
        total: number;
        unique: number;
        owners: number;
        recentSignups: number;
        active24h: number;
    };
    workspaces: {
        total: number;
        active: number;
        suspended: number;
        deleted: number;
        recentNew: number;
        active24h: number;
        planDistribution: Record<string, number>;
        paidWorkspaces: number;
    };
    spaces: {
        total: number;
        rooms: number;
        avgRoomsPerSpace: number;
    };
    revenue: {
        mrrCents: number;
        mrrFormatted: string;
        arrFormatted: string;
        paidWorkspaces: number;
    };
    monitoring: {
        openBugs: number;
        criticalBugs: number;
        activeBans: number;
    };
}

/* ───── Hero KPI Card ───── */
function HeroCard({ label, value, sub, icon: Icon, gradient, delay = 0 }: {
    label: string; value: string | number; sub?: string;
    icon: any; gradient: string; delay?: number;
}) {
    return (
        <div
            className="group relative overflow-hidden rounded-2xl p-5 border border-white/[0.06] transition-all duration-500 hover:border-white/[0.12] hover:scale-[1.02]"
            style={{
                background: 'rgba(15,23,42,0.55)',
                backdropFilter: 'blur(12px)',
                animationDelay: `${delay}ms`,
            }}
        >
            {/* Gradient glow behind icon */}
            <div
                className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-35"
                style={{ background: gradient }}
            />
            <div className="relative z-10 flex items-start justify-between">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                        {label}
                    </p>
                    <p className="text-3xl font-extrabold text-white tracking-tight leading-none">
                        {value}
                    </p>
                    {sub && (
                        <p className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                            {sub}
                        </p>
                    )}
                </div>
                <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                    <Icon className="w-5 h-5 text-white/60" />
                </div>
            </div>
        </div>
    );
}

/* ───── Stat Row (compact inline metric) ───── */
function StatRow({ label, value, icon: Icon, accent = 'text-slate-300', badge }: {
    label: string; value: string | number; icon: any; accent?: string; badge?: string;
}) {
    return (
        <div className="flex items-center justify-between py-2 px-1 group/row">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <Icon className={`w-3.5 h-3.5 ${accent}`} />
                </div>
                <span className="text-sm text-slate-400 truncate">{label}</span>
            </div>
            <div className="flex items-center gap-2">
                {badge && (
                    <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/5 text-slate-500 border border-white/5">
                        {badge}
                    </span>
                )}
                <span className={`text-sm font-bold tabular-nums ${accent}`}>{value}</span>
            </div>
        </div>
    );
}

/* ───── Panel (section card) ───── */
function Panel({ title, icon: Icon, accent, children, className = '' }: {
    title: string; icon: any; accent: string; children: React.ReactNode; className?: string;
}) {
    return (
        <div
            className={`rounded-2xl border border-white/[0.06] overflow-hidden ${className}`}
            style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(12px)' }}
        >
            <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent}`}>
                    <Icon className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h2>
            </div>
            <div className="px-5 pb-5">
                {children}
            </div>
        </div>
    );
}

/* ───── Plan Distribution Bar ───── */
function PlanBar({ plan, count, total }: { plan: string; count: number; total: number }) {
    const pct = total > 0 ? (count / total) * 100 : 0;
    const config: Record<string, { bar: string; text: string }> = {
        free: { bar: 'from-slate-500/80 to-slate-600/40', text: 'text-slate-300' },
        starter: { bar: 'from-blue-500/80 to-blue-600/40', text: 'text-blue-300' },
        pro: { bar: 'from-purple-500/80 to-purple-600/40', text: 'text-purple-300' },
        enterprise: { bar: 'from-amber-500/80 to-amber-600/40', text: 'text-amber-300' },
    };
    const c = config[plan] || config.free;
    return (
        <div className="flex items-center gap-3">
            <span className={`text-[10px] font-bold uppercase tracking-widest w-20 ${c.text}`}>
                {plan}
            </span>
            <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full bg-gradient-to-r ${c.bar} transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-xs font-bold text-white/80 tabular-nums w-7 text-right">{count}</span>
            <span className="text-[10px] text-slate-600 tabular-nums w-9 text-right">{pct.toFixed(0)}%</span>
        </div>
    );
}

/* ───── Status Dot Indicator ───── */
function StatusDot({ color, pulse }: { color: string; pulse?: boolean }) {
    return (
        <span className="relative flex h-2.5 w-2.5">
            {pulse && (
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${color}`} />
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`} />
        </span>
    );
}

/* ═══════════════════════════════════════════════════ */
/*  PAGE                                               */
/* ═══════════════════════════════════════════════════ */

export default function AdminOverview() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    const loadStats = useCallback((silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        fetch(`/api/admin/stats?t=${Date.now()}`, { cache: 'no-store' })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(data => { setStats(data); setLoading(false); setRefreshing(false); setLastRefresh(new Date()); })
            .catch(err => { setError(err.message); setLoading(false); setRefreshing(false); });
    }, []);

    useEffect(() => { loadStats(); }, [loadStats]);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8">
                <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300">
                    <AlertTriangle className="w-5 h-5 inline mr-2" />Errore: {error}
                </div>
            </div>
        );
    }

    if (!stats) return null;

    const totalPlans = Object.values(stats.workspaces.planDistribution).reduce((a, b) => a + b, 0);
    const monitorOk = stats.monitoring.criticalBugs === 0 && stats.monitoring.openBugs === 0 && stats.monitoring.activeBans === 0;

    return (
        <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">

            {/* ── Header ── */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Panoramica in tempo reale</p>
                </div>
                <div className="flex items-center gap-3">
                    {lastRefresh && (
                        <span className="text-[10px] text-slate-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {lastRefresh.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <button
                        onClick={() => loadStats(true)}
                        disabled={refreshing}
                        className="p-2 rounded-xl border border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-white hover:border-white/[0.12] transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* ── Hero KPIs ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <HeroCard
                    label="Utenti totali"
                    value={stats.users.total}
                    sub={stats.users.recentSignups > 0 ? `${stats.users.recentSignups} nuovi (7gg)` : undefined}
                    icon={Users}
                    gradient="linear-gradient(135deg, #06b6d4, #3b82f6)"
                    delay={0}
                />
                <HeroCard
                    label="Workspace attivi"
                    value={stats.workspaces.active}
                    sub={stats.workspaces.recentNew > 0 ? `${stats.workspaces.recentNew} nuovi (7gg)` : undefined}
                    icon={Building2}
                    gradient="linear-gradient(135deg, #a855f7, #6366f1)"
                    delay={50}
                />
                <HeroCard
                    label="MRR"
                    value={stats.revenue.mrrFormatted}
                    sub={`ARR ${stats.revenue.arrFormatted}`}
                    icon={TrendingUp}
                    gradient="linear-gradient(135deg, #10b981, #059669)"
                    delay={100}
                />
                <HeroCard
                    label="Attivi oggi"
                    value={stats.users.active24h}
                    sub={`${stats.workspaces.active24h} workspace attivi`}
                    icon={Activity}
                    gradient="linear-gradient(135deg, #f59e0b, #f97316)"
                    delay={150}
                />
            </div>

            {/* ── Bento Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Col 1: Users + Monitoring */}
                <div className="space-y-4">
                    <Panel title="Utenti" icon={Users} accent="bg-cyan-500/10 text-cyan-400">
                        <div className="divide-y divide-white/[0.04]">
                            <StatRow label="Registrati" value={stats.users.total} icon={Users} accent="text-cyan-300" />
                            <StatRow label="Utenti unici" value={stats.users.unique} icon={UserCheck} accent="text-cyan-300" />
                            <StatRow label="Proprietari" value={stats.users.owners} icon={Crown} accent="text-amber-300" />
                            <StatRow label="Nuovi (7gg)" value={stats.users.recentSignups} icon={UserPlus} accent="text-emerald-400" />
                            <StatRow label="Attivi (24h)" value={stats.users.active24h} icon={Activity} accent="text-emerald-400" />
                        </div>
                    </Panel>

                    <Panel title="Monitoraggio" icon={Shield} accent="bg-amber-500/10 text-amber-400">
                        {monitorOk ? (
                            <div className="flex items-center gap-2 py-3 px-1">
                                <StatusDot color="bg-emerald-400" />
                                <span className="text-sm text-emerald-400 font-medium">Tutto nella norma</span>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/[0.04]">
                                <StatRow
                                    label="Bug aperti"
                                    value={stats.monitoring.openBugs}
                                    icon={Bug}
                                    accent={stats.monitoring.openBugs > 0 ? 'text-amber-300' : 'text-slate-400'}
                                />
                                {stats.monitoring.criticalBugs > 0 && (
                                    <div className="flex items-center justify-between py-2 px-1">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/10">
                                                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                            </div>
                                            <span className="text-sm text-red-400 font-medium">Bug critici</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <StatusDot color="bg-red-500" pulse />
                                            <span className="text-sm font-bold text-red-400 tabular-nums">{stats.monitoring.criticalBugs}</span>
                                        </div>
                                    </div>
                                )}
                                <StatRow
                                    label="Ban attivi"
                                    value={stats.monitoring.activeBans}
                                    icon={Ban}
                                    accent={stats.monitoring.activeBans > 0 ? 'text-amber-300' : 'text-emerald-400'}
                                />
                            </div>
                        )}
                    </Panel>
                </div>

                {/* Col 2: Workspaces + Plan dist */}
                <div className="space-y-4">
                    <Panel title="Workspace" icon={Building2} accent="bg-purple-500/10 text-purple-400">
                        <div className="divide-y divide-white/[0.04]">
                            <StatRow label="Totali" value={stats.workspaces.total} icon={Building2} accent="text-purple-300" />
                            <StatRow label="Attivi" value={stats.workspaces.active} icon={Zap} accent="text-emerald-400" />
                            <StatRow label="Sospesi" value={stats.workspaces.suspended} icon={Pause} accent="text-amber-300" />
                            <StatRow label="Eliminati" value={stats.workspaces.deleted} icon={Trash2} accent="text-red-300" />
                            <StatRow label="Attivi oggi" value={stats.workspaces.active24h} icon={Activity} accent="text-emerald-400" />
                        </div>
                    </Panel>

                    {totalPlans > 0 && (
                        <Panel title="Distribuzione piani" icon={LayoutGrid} accent="bg-indigo-500/10 text-indigo-400">
                            <div className="space-y-2.5 pt-1">
                                {Object.entries(stats.workspaces.planDistribution).map(([plan, count]) => (
                                    <PlanBar key={plan} plan={plan} count={count} total={totalPlans} />
                                ))}
                            </div>
                            <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Paganti</span>
                                <span className="text-sm font-bold text-purple-300 tabular-nums">
                                    {stats.workspaces.paidWorkspaces} / {totalPlans}
                                </span>
                            </div>
                        </Panel>
                    )}
                </div>

                {/* Col 3: Spaces + Revenue */}
                <div className="space-y-4">
                    <Panel title="Spazi & Stanze" icon={Layers} accent="bg-blue-500/10 text-blue-400">
                        <div className="divide-y divide-white/[0.04]">
                            <StatRow label="Uffici" value={stats.spaces.total} icon={Layers} accent="text-blue-300" />
                            <StatRow label="Stanze attive" value={stats.spaces.rooms} icon={DoorOpen} accent="text-blue-300" />
                            <StatRow label="Media stanze/ufficio" value={stats.spaces.avgRoomsPerSpace} icon={LayoutGrid} accent="text-slate-300" />
                        </div>
                    </Panel>

                    <Panel title="Revenue" icon={DollarSign} accent="bg-emerald-500/10 text-emerald-400">
                        {/* Big MRR display */}
                        <div className="py-3 text-center">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-1">Monthly Recurring Revenue</p>
                            <p className="text-4xl font-extrabold text-white tracking-tight">{stats.revenue.mrrFormatted}</p>
                            <p className="text-sm text-emerald-400/70 mt-1">ARR {stats.revenue.arrFormatted}</p>
                        </div>
                        <div className="pt-3 border-t border-white/[0.04] divide-y divide-white/[0.04]">
                            <StatRow label="Clienti paganti" value={stats.revenue.paidWorkspaces} icon={CreditCard} accent="text-emerald-300" />
                        </div>
                        {stats.revenue.paidWorkspaces === 0 && (
                            <p className="mt-3 text-[11px] text-slate-600 italic">
                                Nessun workspace con piano a pagamento.
                            </p>
                        )}
                    </Panel>
                </div>
            </div>
        </div>
    );
}
