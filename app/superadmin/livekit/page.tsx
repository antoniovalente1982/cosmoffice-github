'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Video, Users, DollarSign, RefreshCw, AlertTriangle,
    Radio, Mic, Monitor, Zap, Server, Activity,
    TrendingUp, Eye, Gauge, Package, Info, ExternalLink,
    Check, ShieldAlert, Clock,
} from 'lucide-react';
import { useT } from '../../../lib/i18n';

// ─── Types ───────────────────────────────────────────────────
interface PlanInfo {
    key: string; name: string; baseCostMonth: number;
    includedMinutes: number; overagePerMin: number;
    maxConcurrent: number; isCurrent: boolean;
}

interface LiveKitOverview {
    livekit: { url: string; region: string };
    plan: {
        key: string; name: string; baseCostMonth: number;
        includedMinutes: number; overagePerMin: number;
        maxConcurrent: number;
    };
    allPlans: PlanInfo[];
    live: {
        rooms: number; participants: number;
        videoTracks: number; audioTracks: number; screenShares: number;
    };
    costs: {
        burnRatePerMin: number; burnRatePerHour: number;
        currentSessionMinutes: number;
    };
    dataSources: {
        realtime: string[]; estimated: string[];
        configured: string[]; notAvailable: string[];
    };
    rooms: Array<{
        name: string; sid: string; numParticipants: number; numPublishers: number;
        createdAt: number; activeDurationSec: number; metadata: string;
        participants: Array<{
            identity: string; name: string; joinedAt: number;
            isPublishing: boolean; trackCount: number;
            hasVideo: boolean; hasAudio: boolean; hasScreen: boolean;
        }>;
    }>;
}

// ─── Helpers ─────────────────────────────────────────────────
function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

function formatCost(dollars: number): string {
    if (dollars === 0) return '$0';
    if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
    if (dollars < 1) return `$${dollars.toFixed(3)}`;
    return `$${dollars.toFixed(2)}`;
}

function formatNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
}

// ─── Component ───────────────────────────────────────────────
export default function LiveKitPage() {
    const [data, setData] = useState<LiveKitOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
    const [showSources, setShowSources] = useState(false);
    const { t } = useT();

    const fetchData = useCallback(async () => {
        try {
            const r = await fetch('/api/admin/livekit?section=overview');
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const json = await r.json();
            setData(json);
            setLastRefresh(new Date());
            setError(null);
        } catch (err: any) { setError(err.message); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchData]);

    if (loading) return (
        <div className="p-8 flex justify-center min-h-screen items-center">
            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="p-8 space-y-6 max-w-[1400px]">
            {/* ═══ HEADER ═══ */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center">
                            <Zap className="w-4 h-4 text-white" />
                        </div>
                        LiveKit — {t('sa.livekit.title')}
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                        {t('sa.livekit.subtitle')}
                        {data?.livekit && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {data.livekit.region}
                            </span>
                        )}
                        {data?.plan && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Piano: {data.plan.name}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${autoRefresh
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border-white/10'}`}>
                        <Radio className={`w-3 h-3 ${autoRefresh ? 'animate-pulse' : ''}`} />
                        {autoRefresh ? 'Live' : 'Pausa'}
                    </button>
                    <button onClick={fetchData}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all">
                        <RefreshCw className="w-3 h-3" /> {t('sa.livekit.refreshBtn')}
                    </button>
                    <a href="https://cloud.livekit.io" target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-white transition-all">
                        <ExternalLink className="w-3 h-3" /> {t('sa.livekit.dashboard')}
                    </a>
                    <span className="text-[10px] text-slate-500">
                        {lastRefresh.toLocaleTimeString('it-IT')}
                    </span>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />{error}
                </div>
            )}

            {data && (
                <>
                    {/* ═══ LIVE STATUS ═══ */}
                    <div className="rounded-2xl border border-cyan-500/20 p-1" style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.05), rgba(99,102,241,0.05))' }}>
                        <div className="flex items-center gap-2 px-4 py-2">
                            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                            <span className="text-xs font-bold text-cyan-300 uppercase tracking-widest">{t('sa.livekit.realtime')}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                {t('sa.livekit.realData')}
                            </span>
                            <span className="text-[10px] text-slate-500 ml-auto">ogni 10s</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 pt-0">
                            <StatCard label="Stanze Attive" value={data.live.rooms} />
                            <StatCard label="Partecipanti" value={data.live.participants} />
                            <StatCard label="Video" value={data.live.videoTracks} icon={<Video className="w-3 h-3 text-purple-400" />} color="purple" />
                            <StatCard label="Audio" value={data.live.audioTracks} icon={<Mic className="w-3 h-3 text-emerald-400" />} color="emerald" />
                            <StatCard label="Screen" value={data.live.screenShares} icon={<Monitor className="w-3 h-3 text-amber-400" />} color="amber" />
                        </div>
                    </div>

                    {/* ═══ CONCURRENCY BAR ═══ */}
                    <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-cyan-400" />
                                <span className="text-sm font-semibold text-white">{t('sa.livekit.simultaneousConn')}</span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    {t('sa.livekit.realtimeTag')}
                                </span>
                            </div>
                            <span className="text-xs text-slate-400">
                                {data.live.participants} / {formatNum(data.plan.maxConcurrent)} max
                            </span>
                        </div>
                        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${data.live.participants / data.plan.maxConcurrent > 0.9 ? 'bg-gradient-to-r from-red-400 to-red-500'
                                    : data.live.participants / data.plan.maxConcurrent > 0.7 ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                                        : 'bg-gradient-to-r from-cyan-400 to-indigo-400'
                                    }`}
                                style={{ width: `${Math.min(100, (data.live.participants / data.plan.maxConcurrent) * 100)}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1.5">
                            Limite piano {data.plan.name}: max {formatNum(data.plan.maxConcurrent)} connessioni simultanee
                        </p>
                    </div>

                    {/* ═══ DISCLAIMER ═══ */}
                    <div className="rounded-2xl border border-amber-500/30 p-4 flex items-start gap-3" style={{ background: 'rgba(245, 158, 11, 0.06)' }}>
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-amber-300">{t('sa.livekit.approxEstimates')}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                                I costi mostrati qui sotto sono <strong className="text-amber-300/80">stime calcolate</strong> basate sulle sessioni attive e le tariffe pubblicate.
                                I <strong className="text-white">costi reali e il consumo mensile effettivo</strong> vanno visualizzati sulla dashboard ufficiale:
                            </p>
                            <a href="https://cloud.livekit.io" target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all">
                                <ExternalLink className="w-3 h-3" /> {t('sa.livekit.openCloud')}
                            </a>
                        </div>
                    </div>

                    {/* ═══ COST ESTIMATES ═══ */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-amber-500/10 to-orange-500/5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                                        <Activity className="w-3 h-3 text-amber-400" /> {t('sa.livekit.burnRate')}
                                        <span className="px-1 py-0.5 rounded text-[8px] bg-amber-500/20 text-amber-400 border border-amber-500/30">{t('sa.livekit.estimated')}</span>
                                    </p>
                                    <p className="text-3xl font-bold text-white">{formatCost(data.costs.burnRatePerHour)}<span className="text-sm text-slate-500">{t('sa.livekit.perHour')}</span></p>
                                    <p className="text-[10px] text-slate-500 mt-1">{formatCost(data.costs.burnRatePerMin)}/min • {data.live.participants} connessioni attive</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-amber-400">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                                        <Clock className="w-3 h-3 text-purple-400" /> {t('sa.livekit.sessionsNow')}
                                        <span className="px-1 py-0.5 rounded text-[8px] bg-amber-500/20 text-amber-400 border border-amber-500/30">{t('sa.livekit.estimated')}</span>
                                    </p>
                                    <p className="text-3xl font-bold text-white">{data.costs.currentSessionMinutes}<span className="text-sm text-slate-500"> min</span></p>
                                    <p className="text-[10px] text-slate-500 mt-1">{t('sa.livekit.connMinLabel')}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-purple-400">
                                    <DollarSign className="w-5 h-5" />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-red-500/10 to-red-500/5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                                        <ShieldAlert className="w-3 h-3 text-red-400" /> {t('sa.livekit.monthlyConsumption')}
                                    </p>
                                    <p className="text-lg font-bold text-red-300">{t('sa.livekit.notAvailable')}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">
                                        Richiede piano Scale ($500/mo) + Analytics API
                                    </p>
                                    <a href="https://cloud.livekit.io" target="_blank" rel="noopener noreferrer"
                                        className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-1">
                                        Vedi su cloud.livekit.io <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-red-400">
                                    <Gauge className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══ ALL PLANS COMPARISON ═══ */}
                    <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <Package className="w-4 h-4 text-indigo-400" />
                                {t('sa.livekit.plans')}
                            </h2>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-500/20 text-slate-400 border border-white/10">
                                {t('sa.livekit.verifiedRates')}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-x divide-white/5">
                            {data.allPlans.map(plan => (
                                <div key={plan.key} className={`p-5 relative ${plan.isCurrent ? 'bg-cyan-500/5' : ''}`}>
                                    {plan.isCurrent && (
                                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                                            <Check className="w-3 h-3" /> {t('sa.livekit.activeTag')}
                                        </div>
                                    )}
                                    <h3 className={`text-lg font-bold ${plan.isCurrent ? 'text-cyan-300' : 'text-white'}`}>
                                        {plan.name}
                                    </h3>
                                    <p className="text-2xl font-bold text-white mt-1">
                                        {plan.baseCostMonth === 0 ? 'Gratis' : `$${plan.baseCostMonth}`}
                                        {plan.baseCostMonth > 0 && <span className="text-sm text-slate-500">{t('sa.livekit.perMonth')}</span>}
                                    </p>
                                    <div className="space-y-2 mt-4">
                                        <PlanRow label="Franchigia" value={`${plan.includedMinutes.toLocaleString('en-US')} minutes included`} />
                                        <PlanRow label="Connessioni max" value={formatNum(plan.maxConcurrent)} />
                                        {plan.overagePerMin > 0 ? (
                                            <PlanRow label="Overage" value={`then $${plan.overagePerMin} per min`} />
                                        ) : (
                                            <div>
                                                <PlanRow label="Overage" value="Hard limit ⛔" />
                                                <p className="text-[10px] text-red-400/70 italic mt-0.5">
                                                    {t('sa.livekit.hardLimitMsg')}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ═══ COST SIMULATOR ═══ */}
                    <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                        <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                            <Eye className="w-4 h-4 text-amber-400" />
                            {t('sa.livekit.monthlySimulation')}
                            <span className="px-1 py-0.5 rounded text-[8px] bg-amber-500/20 text-amber-400 border border-amber-500/30">{t('sa.livekit.calculated')}</span>
                        </h3>
                        <p className="text-[10px] text-slate-500 mb-4">
                            Basato sul tuo piano ({data.plan.name}). LiveKit addebita per &quot;connection-minute&quot;: 1 utente connesso = 1 min. Una connessione di 10s è fatturata come 1 min.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {[
                                { label: '10 users × 4h/day', users: 10, hours: 4, days: 22 },
                                { label: '25 users × 6h/day', users: 25, hours: 6, days: 22 },
                                { label: '50 users × 8h/day', users: 50, hours: 8, days: 22 },
                                { label: '100 users × 8h/day', users: 100, hours: 8, days: 22 },
                            ].map((sim) => {
                                const totalMin = sim.users * sim.hours * 60 * sim.days;
                                const overageMin = Math.max(0, totalMin - data.plan.includedMinutes);
                                const overageCost = overageMin * data.plan.overagePerMin;
                                const totalCost = data.plan.baseCostMonth + overageCost;
                                const isIncluded = totalMin <= data.plan.includedMinutes;
                                const isOverLimit = data.plan.overagePerMin === 0 && totalMin > data.plan.includedMinutes;

                                return (
                                    <div key={sim.label} className={`rounded-xl border p-4 bg-black/20 ${isOverLimit ? 'border-red-500/30' : 'border-white/5'
                                        }`}>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{sim.label}</p>
                                        {isOverLimit ? (
                                            <>
                                                <p className="text-lg font-bold text-red-400">⛔ Superato</p>
                                                <p className="text-[10px] text-red-400/70 mt-1">
                                                    {formatNum(totalMin)} min → supera {formatNum(data.plan.includedMinutes)} inclusi
                                                </p>
                                                <p className="text-[10px] text-slate-500 mt-0.5">{t('sa.livekit.needsHigherPlan')}</p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-xl font-bold text-white">
                                                    {formatCost(totalCost)}<span className="text-xs text-slate-500">{t('sa.livekit.perMonth')}</span>
                                                </p>
                                                <p className="text-[10px] text-slate-600 mt-1">{formatNum(totalMin)} min totali</p>
                                                {isIncluded ? (
                                                    <p className="text-[10px] text-emerald-400 mt-0.5">{t('sa.livekit.includedInPlan')}</p>
                                                ) : (
                                                    <p className="text-[10px] text-amber-400 mt-0.5">+ {formatNum(overageMin)} min overage</p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ═══ ACTIVE ROOMS ═══ */}
                    <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <Server className="w-4 h-4 text-cyan-400" />
                                Stanze Attive ({data.rooms.length})
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    {t('sa.livekit.realtimeTag')}
                                </span>
                            </h2>
                        </div>
                        {data.rooms.length > 0 ? (
                            <div className="divide-y divide-white/5">
                                {data.rooms.map(room => (
                                    <div key={room.sid}>
                                        <button
                                            onClick={() => setExpandedRoom(expandedRoom === room.sid ? null : room.sid)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors text-left"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                                                    <Video className="w-4 h-4 text-cyan-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm text-white font-semibold truncate max-w-[300px]">{room.name}</p>
                                                    <p className="text-[10px] text-slate-500">
                                                        SID: {room.sid.slice(0, 12)}… • Attiva da {formatDuration(room.activeDurationSec)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-1.5">
                                                    <Badge icon={<Users className="w-3 h-3" />} value={room.participants.length} color="cyan" />
                                                    {room.participants.some(p => p.hasVideo) && (
                                                        <Badge icon={<Video className="w-3 h-3" />} value={room.participants.filter(p => p.hasVideo).length} color="purple" />
                                                    )}
                                                    {room.participants.some(p => p.hasScreen) && (
                                                        <Badge icon={<Monitor className="w-3 h-3" />} value={room.participants.filter(p => p.hasScreen).length} color="amber" />
                                                    )}
                                                </div>
                                                <span className="text-xs text-slate-500">{expandedRoom === room.sid ? '▲' : '▼'}</span>
                                            </div>
                                        </button>
                                        {expandedRoom === room.sid && room.participants.length > 0 && (
                                            <div className="px-4 pb-4">
                                                <div className="rounded-xl border border-white/5 bg-black/20 divide-y divide-white/5">
                                                    {room.participants.map(p => (
                                                        <div key={p.identity} className="flex items-center justify-between px-4 py-2.5">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                                                    {(p.name || '?')[0].toUpperCase()}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs text-white font-medium truncate">{p.name}</p>
                                                                    <p className="text-[10px] text-slate-500">{p.identity.slice(0, 20)}{p.identity.length > 20 ? '…' : ''}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {p.hasAudio && <TrackDot color="emerald" icon={<Mic className="w-3 h-3" />} title="Audio" />}
                                                                {p.hasVideo && <TrackDot color="purple" icon={<Video className="w-3 h-3" />} title="Video" />}
                                                                {p.hasScreen && <TrackDot color="amber" icon={<Monitor className="w-3 h-3" />} title="Screen" />}
                                                                <span className="text-[10px] text-slate-500 ml-2">
                                                                    {formatDuration(Math.floor((Date.now() - p.joinedAt) / 1000))}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-12 text-center">
                                <Server className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                                <p className="text-sm text-slate-500">{t('sa.livekit.noActiveRoomsMsg')}</p>
                                <p className="text-[10px] text-slate-600 mt-1">{t('sa.livekit.roomsCreatedMsg')}</p>
                            </div>
                        )}
                    </div>

                    {/* ═══ DATA SOURCES TRANSPARENCY ═══ */}
                    <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                        <button
                            onClick={() => setShowSources(!showSources)}
                            className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                        >
                            <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                <Info className="w-4 h-4 text-slate-400" />
                                {t('sa.livekit.transparency')}
                            </h2>
                            <span className="text-xs text-slate-500">{showSources ? '▲ Chiudi' : t('sa.livekit.expand')}</span>
                        </button>
                        {showSources && data.dataSources && (
                            <div className="p-4 pt-0 space-y-4">
                                <SourceBlock
                                    title="✅ Dati Real-Time (da LiveKit Server SDK)"
                                    desc="Questi dati vengono letti direttamente dal tuo server LiveKit ogni 10 secondi."
                                    items={data.dataSources.realtime}
                                    color="emerald"
                                />
                                <SourceBlock
                                    title="⚠️ Dati Stimati (calcolati dal codice)"
                                    desc="Calcolati basandosi sui dati real-time e le tariffe configurate."
                                    items={data.dataSources.estimated}
                                    color="amber"
                                />
                                <SourceBlock
                                    title="{t('sa.livekit.configuredData')}"
                                    desc="{t('sa.livekit.configuredDesc')}"
                                    items={data.dataSources.configured}
                                    color="indigo"
                                />
                                <SourceBlock
                                    title="❌ Dati Non Disponibili"
                                    desc="{t('sa.livekit.noApiData')}"
                                    items={data.dataSources.notAvailable}
                                    color="red"
                                />
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: number; icon?: React.ReactNode; color?: string }) {
    const textColor = color ? `text-${color}-300` : 'text-white';
    return (
        <div className="rounded-xl border border-white/5 p-4 bg-black/20 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1 justify-center">
                {icon} {label}
            </p>
            <p className={`text-3xl font-bold ${textColor}`}>{value}</p>
        </div>
    );
}

function Badge({ icon, value, color }: { icon: React.ReactNode; value: number; color: string }) {
    return (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold bg-${color}-500/20 text-${color}-300 border border-${color}-500/30 flex items-center gap-1`}>
            {icon} {value}
        </span>
    );
}

function TrackDot({ color, icon, title }: { color: string; icon: React.ReactNode; title: string }) {
    return (
        <div className={`w-5 h-5 rounded-full bg-${color}-500/20 flex items-center justify-center text-${color}-400`} title={title}>
            {icon}
        </div>
    );
}

function PlanRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{label}</span>
            <span className="text-white font-mono text-[11px]">{value}</span>
        </div>
    );
}

function SourceBlock({ title, desc, items, color }: { title: string; desc: string; items: string[]; color: string }) {
    return (
        <div className={`rounded-xl border border-${color}-500/20 p-4 bg-${color}-500/5`}>
            <p className="text-xs font-bold text-white mb-0.5">{title}</p>
            <p className="text-[10px] text-slate-400 mb-2">{desc}</p>
            <ul className="space-y-0.5">
                {items.map((item, i) => (
                    <li key={i} className="text-[10px] text-slate-500 pl-2 border-l border-white/10">
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
}
