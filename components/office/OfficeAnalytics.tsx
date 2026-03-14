'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart3, TrendingUp, Users, DoorOpen,
    Link2, UserPlus, ArrowUpRight, Loader2, RefreshCw,
} from 'lucide-react';
import { Card } from '../ui/card';

interface AnalyticsData {
    totalMembers: number;
    roleCounts: Record<string, number>;
    recentJoins: number;
    totalRooms: number;
    activeInvites: number;
    generatedAt: string;
}

interface OfficeAnalyticsProps {
    workspaceId: string;
}

export function OfficeAnalytics({ workspaceId }: OfficeAnalyticsProps) {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`/api/workspaces/analytics?workspaceId=${workspaceId}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const json = await res.json();
            setData(json);
        } catch {
            setError('Errore nel caricamento');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAnalytics(); }, [workspaceId]);

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center gap-2 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Caricamento analytics...</span>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6 text-center text-slate-500">
                <p className="text-sm">{error || 'Nessun dato disponibile'}</p>
                <button onClick={fetchAnalytics} className="mt-2 text-xs text-cyan-400 hover:underline">
                    Riprova
                </button>
            </div>
        );
    }

    const stats = [
        { label: 'Membri Totali', value: data.totalMembers, icon: Users, color: 'text-primary-400', bg: 'from-primary-500/20 to-blue-500/20' },
        { label: 'Stanze', value: data.totalRooms, icon: DoorOpen, color: 'text-emerald-400', bg: 'from-emerald-500/20 to-green-500/20' },
        { label: 'Nuovi (30gg)', value: data.recentJoins, icon: UserPlus, color: 'text-purple-400', bg: 'from-purple-500/20 to-pink-500/20' },
        { label: 'Inviti Attivi', value: data.activeInvites, icon: Link2, color: 'text-amber-400', bg: 'from-amber-500/20 to-orange-500/20' },
    ];

    const roleLabels: Record<string, string> = {
        owner: 'Owner',
        admin: 'Admin',
        member: 'Membri',
        guest: 'Ospiti',
    };
    const roleColors: Record<string, string> = {
        owner: 'bg-amber-500',
        admin: 'bg-cyan-500',
        member: 'bg-emerald-500',
        guest: 'bg-purple-500',
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-primary-400" />
                    Workspace Insights
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchAnalytics}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        title="Aggiorna dati"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                        Live
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stats.map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                    >
                        <Card className="p-4 bg-slate-800/20 border-slate-700/50 hover:bg-slate-800/40 transition-colors">
                            <div className="flex items-start justify-between">
                                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.bg}`}>
                                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                                </div>
                                {stat.value > 0 && (
                                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                                        <ArrowUpRight className="w-3 h-3" />
                                    </span>
                                )}
                            </div>
                            <div className="mt-3">
                                <p className="text-2xl font-bold text-slate-100">{stat.value}</p>
                                <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Role Distribution */}
            <Card className="p-5 bg-slate-800/30 border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">
                    Distribuzione Ruoli
                </h3>
                <div className="space-y-3">
                    {Object.entries(data.roleCounts).map(([role, count]) => {
                        const pct = data.totalMembers > 0 ? Math.round((count / data.totalMembers) * 100) : 0;
                        return (
                            <div key={role} className="flex items-center gap-3">
                                <span className="text-xs text-slate-300 w-16 font-medium">{roleLabels[role] || role}</span>
                                <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                        className={`h-full rounded-full ${roleColors[role] || 'bg-slate-500'}`}
                                    />
                                </div>
                                <span className="text-xs text-slate-500 w-8 text-right">{count}</span>
                                <span className="text-[10px] text-slate-600 w-8 text-right">{pct}%</span>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* Footer */}
            <p className="text-[10px] text-slate-600 text-right">
                Ultimo aggiornamento: {new Date(data.generatedAt).toLocaleTimeString()}
            </p>
        </div>
    );
}
