'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Users, UserCheck, Crown, UserPlus, Activity,
    Building2, Pause, Trash2, Zap,
    Layers, DoorOpen, LayoutGrid,
    TrendingUp, DollarSign, CreditCard,
    Bug, AlertTriangle, Shield, Ban,
    ArrowUpRight,
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

// ─── Reusable components ─────────────────────────

function MiniStat({ label, value, icon: Icon, accent = 'text-slate-300' }: {
    label: string; value: string | number; icon: any; accent?: string;
}) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <Icon className={`w-4 h-4 ${accent}`} />
            </div>
            <div className="min-w-0">
                <p className={`text-lg font-bold ${accent}`}>{value}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold truncate">{label}</p>
            </div>
        </div>
    );
}

function SectionBlock({ title, icon: Icon, color, children }: {
    title: string; icon: any; color: string; children: React.ReactNode;
}) {
    const borderColors: Record<string, string> = {
        cyan: 'border-cyan-500/15',
        purple: 'border-purple-500/15',
        blue: 'border-blue-500/15',
        emerald: 'border-emerald-500/15',
        amber: 'border-amber-500/15',
    };
    const iconColors: Record<string, string> = {
        cyan: 'text-cyan-400 bg-cyan-500/10',
        purple: 'text-purple-400 bg-purple-500/10',
        blue: 'text-blue-400 bg-blue-500/10',
        emerald: 'text-emerald-400 bg-emerald-500/10',
        amber: 'text-amber-400 bg-amber-500/10',
    };
    return (
        <div className={`rounded-2xl border p-5 space-y-4 ${borderColors[color]}`} style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
            <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColors[color]}`}>
                    <Icon className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h2>
            </div>
            {children}
        </div>
    );
}

function PlanBar({ plan, count, total }: { plan: string; count: number; total: number }) {
    const pct = total > 0 ? (count / total) * 100 : 0;
    const colors: Record<string, { bar: string; badge: string }> = {
        free: { bar: '#64748b', badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
        starter: { bar: '#3b82f6', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
        pro: { bar: '#a855f7', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
        enterprise: { bar: '#f59e0b', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    };
    const c = colors[plan] || colors.free;
    return (
        <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border w-20 text-center ${c.badge}`}>{plan}</span>
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c.bar }} />
            </div>
            <span className="text-sm font-bold text-white w-8 text-right">{count}</span>
            <span className="text-[10px] text-slate-500 w-10 text-right">{pct.toFixed(0)}%</span>
        </div>
    );
}

// ─── Page ────────────────────────────────────────

export default function AdminOverview() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadStats = useCallback(() => {
        fetch(`/api/admin/stats?t=${Date.now()}`, { cache: 'no-store' })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(data => { setStats(data); setLoading(false); })
            .catch(err => { setError(err.message); setLoading(false); });
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

    return (
        <div className="p-8 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <p className="text-sm text-slate-400 mt-1">Panoramica del SaaS Cosmoffice</p>
            </div>

            {/* ─────────────────────────────────────── */}
            {/* BLOCCO 1: UTENTI                       */}
            {/* DB: profiles + workspace_members       */}
            {/* ─────────────────────────────────────── */}
            <SectionBlock title="Utenti" icon={Users} color="cyan">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    <MiniStat label="Registrati" value={stats.users.total} icon={Users} accent="text-cyan-300" />
                    <MiniStat label="Utenti Unici" value={stats.users.unique} icon={UserCheck} accent="text-cyan-300" />
                    <MiniStat label="Proprietari" value={stats.users.owners} icon={Crown} accent="text-amber-300" />
                    <MiniStat label="Nuovi (7gg)" value={stats.users.recentSignups} icon={UserPlus} accent="text-emerald-300" />
                    <MiniStat label="Attivi (24h)" value={stats.users.active24h} icon={Activity} accent="text-emerald-300" />
                </div>
                {stats.users.recentSignups > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <ArrowUpRight className="w-3 h-3" />
                        {stats.users.recentSignups} nuove registrazioni negli ultimi 7 giorni
                    </div>
                )}
            </SectionBlock>

            {/* ─────────────────────────────────────── */}
            {/* BLOCCO 2: WORKSPACE                    */}
            {/* DB: workspaces + workspace_members     */}
            {/* ─────────────────────────────────────── */}
            <SectionBlock title="Workspace" icon={Building2} color="purple">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    <MiniStat label="Totali" value={stats.workspaces.total} icon={Building2} accent="text-purple-300" />
                    <MiniStat label="Attivi" value={stats.workspaces.active} icon={Zap} accent="text-emerald-300" />
                    <MiniStat label="Sospesi" value={stats.workspaces.suspended} icon={Pause} accent="text-amber-300" />
                    <MiniStat label="Eliminati" value={stats.workspaces.deleted} icon={Trash2} accent="text-red-300" />
                    <MiniStat label="Attivi oggi" value={stats.workspaces.active24h} icon={Activity} accent="text-emerald-300" />
                </div>
                {stats.workspaces.recentNew > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-purple-400">
                        <ArrowUpRight className="w-3 h-3" />
                        {stats.workspaces.recentNew} nuovi workspace negli ultimi 7 giorni
                    </div>
                )}

                {/* Distribuzione piani */}
                {totalPlans > 0 && (
                    <div className="pt-3 border-t border-white/5 space-y-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Distribuzione Piani</p>
                        {Object.entries(stats.workspaces.planDistribution).map(([plan, count]) => (
                            <PlanBar key={plan} plan={plan} count={count} total={totalPlans} />
                        ))}
                    </div>
                )}
            </SectionBlock>

            {/* Two-column row for smaller blocks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ─────────────────────────────────────── */}
                {/* BLOCCO 3: SPAZI & STANZE               */}
                {/* DB: spaces + rooms                     */}
                {/* ─────────────────────────────────────── */}
                <SectionBlock title="Spazi & Stanze" icon={Layers} color="blue">
                    <div className="grid grid-cols-3 gap-3">
                        <MiniStat label="Uffici" value={stats.spaces.total} icon={Layers} accent="text-blue-300" />
                        <MiniStat label="Stanze" value={stats.spaces.rooms} icon={DoorOpen} accent="text-blue-300" />
                        <MiniStat label="Media stanze/ufficio" value={stats.spaces.avgRoomsPerSpace} icon={LayoutGrid} accent="text-slate-300" />
                    </div>
                </SectionBlock>

                {/* ─────────────────────────────────────── */}
                {/* BLOCCO 4: REVENUE                      */}
                {/* DB: billing_events + workspaces(plan)  */}
                {/* ─────────────────────────────────────── */}
                <SectionBlock title="Revenue" icon={DollarSign} color="emerald">
                    <div className="grid grid-cols-3 gap-3">
                        <MiniStat label="MRR" value={stats.revenue.mrrFormatted} icon={TrendingUp} accent="text-emerald-300" />
                        <MiniStat label="ARR" value={stats.revenue.arrFormatted} icon={DollarSign} accent="text-emerald-300" />
                        <MiniStat label="Clienti paganti" value={stats.revenue.paidWorkspaces} icon={CreditCard} accent="text-emerald-300" />
                    </div>
                    {stats.revenue.paidWorkspaces === 0 && (
                        <p className="text-[11px] text-slate-500 italic">Nessun workspace con piano a pagamento. Configura un provider nella sezione Pagamenti.</p>
                    )}
                </SectionBlock>
            </div>

            {/* ─────────────────────────────────────── */}
            {/* BLOCCO 5: MONITORAGGIO                 */}
            {/* DB: bug_reports + workspace_bans        */}
            {/* ─────────────────────────────────────── */}
            <SectionBlock title="Monitoraggio" icon={Shield} color="amber">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <MiniStat label="Bug aperti" value={stats.monitoring.openBugs} icon={Bug}
                        accent={stats.monitoring.criticalBugs > 0 ? 'text-red-300' : 'text-amber-300'} />
                    <MiniStat label="Bug critici" value={stats.monitoring.criticalBugs} icon={AlertTriangle}
                        accent={stats.monitoring.criticalBugs > 0 ? 'text-red-300 animate-pulse' : 'text-slate-300'} />
                    <MiniStat label="Ban attivi" value={stats.monitoring.activeBans} icon={Ban}
                        accent={stats.monitoring.activeBans > 0 ? 'text-amber-300' : 'text-emerald-300'} />
                </div>
                {stats.monitoring.criticalBugs > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-red-400">
                        <AlertTriangle className="w-3 h-3" />
                        Attenzione: {stats.monitoring.criticalBugs} bug critici richiedono intervento immediato
                    </div>
                )}
                {stats.monitoring.activeBans === 0 && stats.monitoring.criticalBugs === 0 && stats.monitoring.openBugs === 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <Shield className="w-3 h-3" />
                        Tutto nella norma — nessuna anomalia rilevata
                    </div>
                )}
            </SectionBlock>
        </div>
    );
}
