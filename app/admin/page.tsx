'use client';

import { useEffect, useState } from 'react';
import {
    Users, Building2, DoorOpen, Bug, AlertTriangle,
    TrendingUp, Shield, Activity, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

interface Stats {
    totalUsers: number;
    totalWorkspaces: number;
    totalRooms: number;
    activeUsers24h: number;
    activeWorkspaces24h: number;
    openBugs: number;
    criticalBugs: number;
    mrrCents: number;
    mrrFormatted: string;
    recentSignups: number;
    planDistribution: Record<string, number>;
}

function StatCard({ label, value, icon: Icon, trend, trendLabel, color, alert }: {
    label: string; value: string | number; icon: any; trend?: 'up' | 'down';
    trendLabel?: string; color: string; alert?: boolean;
}) {
    const colors: Record<string, string> = {
        cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20 text-cyan-400',
        purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/20 text-purple-400',
        emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
        amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-400',
        red: 'from-red-500/20 to-red-500/5 border-red-500/20 text-red-400',
        blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-400',
    };

    return (
        <div className={`relative rounded-2xl border bg-gradient-to-br p-5 transition-all hover:scale-[1.02] ${colors[color]} ${alert ? 'animate-pulse' : ''}`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
                    <p className="text-3xl font-bold text-white">{value}</p>
                    {trendLabel && (
                        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {trendLabel}
                        </div>
                    )}
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-black/20`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
        </div>
    );
}

function PlanBadge({ plan }: { plan: string }) {
    const colors: Record<string, string> = {
        free: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
        starter: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        pro: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        enterprise: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    };
    return (
        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${colors[plan] || colors.free}`}>
            {plan}
        </span>
    );
}

export default function AdminOverview() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/admin/stats')
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(data => { setStats(data); setLoading(false); })
            .catch(err => { setError(err.message); setLoading(false); });
    }, []);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-screen">
                <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8">
                <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300">
                    <AlertTriangle className="w-5 h-5 inline mr-2" />
                    Errore: {error}
                </div>
            </div>
        );
    }

    if (!stats) return null;

    const planColors: Record<string, string> = {
        free: '#64748b', starter: '#3b82f6', pro: '#a855f7', enterprise: '#f59e0b',
    };

    const totalPlanWorkspaces = Object.values(stats.planDistribution).reduce((a, b) => a + b, 0);

    return (
        <div className="p-8 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <p className="text-sm text-slate-400 mt-1">Panoramica del SaaS Cosmoffice</p>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Utenti Totali"
                    value={stats.totalUsers}
                    icon={Users}
                    color="cyan"
                    trendLabel={`${stats.recentSignups} nuovi (7gg)`}
                    trend="up"
                />
                <StatCard
                    label="Workspace"
                    value={stats.totalWorkspaces}
                    icon={Building2}
                    color="purple"
                    trendLabel={`${stats.activeWorkspaces24h} attivi oggi`}
                    trend="up"
                />
                <StatCard
                    label="Utenti Attivi (24h)"
                    value={stats.activeUsers24h}
                    icon={Activity}
                    color="emerald"
                />
                <StatCard
                    label="Stanze"
                    value={stats.totalRooms}
                    icon={DoorOpen}
                    color="blue"
                />
            </div>

            {/* Second row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                    label="MRR"
                    value={stats.mrrFormatted}
                    icon={TrendingUp}
                    color="emerald"
                />
                <StatCard
                    label="Bug Aperti"
                    value={stats.openBugs}
                    icon={Bug}
                    color={stats.criticalBugs > 0 ? 'red' : 'amber'}
                    alert={stats.criticalBugs > 0}
                    trendLabel={stats.criticalBugs > 0 ? `${stats.criticalBugs} critici!` : undefined}
                    trend={stats.criticalBugs > 0 ? 'down' : undefined}
                />
                <StatCard
                    label="Sicurezza"
                    value="OK"
                    icon={Shield}
                    color="emerald"
                />
            </div>

            {/* Plan Distribution */}
            <div className="rounded-2xl border border-white/5 p-6" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                <h2 className="text-lg font-bold text-white mb-4">Distribuzione Piani</h2>
                <div className="space-y-3">
                    {Object.entries(stats.planDistribution).map(([plan, count]) => {
                        const pct = totalPlanWorkspaces > 0 ? (count / totalPlanWorkspaces) * 100 : 0;
                        return (
                            <div key={plan} className="flex items-center gap-4">
                                <PlanBadge plan={plan} />
                                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${pct}%`, background: planColors[plan] || '#64748b' }}
                                    />
                                </div>
                                <span className="text-sm font-bold text-white w-12 text-right">{count}</span>
                                <span className="text-xs text-slate-500 w-12 text-right">{pct.toFixed(0)}%</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
