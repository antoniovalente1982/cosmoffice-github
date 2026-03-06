'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Video, Users, Clock, DollarSign, RefreshCw, AlertTriangle,
    Radio, Mic, Monitor, Zap, Server, Activity,
    TrendingUp, Eye, Gauge, Package,
} from 'lucide-react';

interface LiveKitOverview {
    livekit: { url: string; region: string };
    plan: {
        name: string; baseCostMonth: number;
        includedMinutes: number; overagePerMin: number;
    };
    live: {
        rooms: number; participants: number;
        videoTracks: number; audioTracks: number; screenShares: number;
    };
    costs: {
        currentPerMinute: number; currentPerHour: number;
        sessionMinutes: number; sessionAccumulated: number;
        connectionPerMin: number; bandwidthPerGB: number;
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

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

function formatCost(dollars: number): string {
    if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
    if (dollars < 1) return `$${dollars.toFixed(3)}`;
    return `$${dollars.toFixed(2)}`;
}

function formatMinutes(min: number): string {
    if (min < 1) return `${Math.round(min * 60)}s`;
    if (min >= 1000) return `${(min / 1000).toFixed(1)}K`;
    return `${Math.round(min)}`;
}

// LiveKit plans data for simulator
const LK_PLANS = {
    build: { name: 'Build (Free)', cost: 0, included: 5_000, overage: 0 },
    ship: { name: 'Ship', cost: 50, included: 150_000, overage: 0.0005 },
    scale: { name: 'Scale', cost: 500, included: 1_500_000, overage: 0.0004 },
};

export default function LiveKitPage() {
    const [data, setData] = useState<LiveKitOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [expandedRoom, setExpandedRoom] = useState<string | null>(null);

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
        <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center">
                            <Zap className="w-4 h-4 text-white" />
                        </div>
                        LiveKit — Monitor
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Monitoraggio in tempo reale WebRTC, stanze e costi
                        {data?.livekit && (
                            <span className="ml-2 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {data.livekit.region}
                            </span>
                        )}
                        {data?.plan && (
                            <span className="ml-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
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
                        <RefreshCw className="w-3 h-3" />
                        Aggiorna
                    </button>
                    <span className="text-[10px] text-slate-500">
                        Ultimo: {lastRefresh.toLocaleTimeString('it-IT')}
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
                    {/* ═══ LIVE STATUS BAR ═══ */}
                    <div className="rounded-2xl border border-cyan-500/20 p-1" style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.05), rgba(99,102,241,0.05))' }}>
                        <div className="flex items-center gap-2 px-4 py-2">
                            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                            <span className="text-xs font-bold text-cyan-300 uppercase tracking-widest">Real Time</span>
                            <span className="text-[10px] text-slate-500 ml-1">Aggiornamento ogni 10s</span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 pt-0">
                            <div className="rounded-xl border border-white/5 p-4 bg-black/20 text-center">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Stanze Attive</p>
                                <p className="text-3xl font-bold text-white">{data.live.rooms}</p>
                            </div>
                            <div className="rounded-xl border border-white/5 p-4 bg-black/20 text-center">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Partecipanti</p>
                                <p className="text-3xl font-bold text-white">{data.live.participants}</p>
                            </div>
                            <div className="rounded-xl border border-white/5 p-4 bg-black/20 text-center">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1 justify-center">
                                    <Video className="w-3 h-3 text-purple-400" /> Video
                                </p>
                                <p className="text-3xl font-bold text-purple-300">{data.live.videoTracks}</p>
                            </div>
                            <div className="rounded-xl border border-white/5 p-4 bg-black/20 text-center">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1 justify-center">
                                    <Mic className="w-3 h-3 text-emerald-400" /> Audio
                                </p>
                                <p className="text-3xl font-bold text-emerald-300">{data.live.audioTracks}</p>
                            </div>
                            <div className="rounded-xl border border-white/5 p-4 bg-black/20 text-center">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1 justify-center">
                                    <Monitor className="w-3 h-3 text-amber-400" /> Screen
                                </p>
                                <p className="text-3xl font-bold text-amber-300">{data.live.screenShares}</p>
                            </div>
                        </div>
                    </div>

                    {/* ═══ PLAN & USAGE ═══ */}
                    <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-indigo-400" />
                                <span className="text-sm font-semibold text-white">
                                    Piano {data.plan.name} — Minuti WebRTC Inclusi
                                </span>
                            </div>
                            <span className="text-xs text-slate-400">
                                {formatMinutes(data.costs.sessionMinutes)} usati / {(data.plan.includedMinutes / 1000).toFixed(0)}K inclusi
                            </span>
                        </div>
                        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${data.costs.sessionMinutes / data.plan.includedMinutes > 0.9
                                        ? 'bg-gradient-to-r from-red-400 to-red-500'
                                        : data.costs.sessionMinutes / data.plan.includedMinutes > 0.7
                                            ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                                            : 'bg-gradient-to-r from-cyan-400 to-indigo-400'
                                    }`}
                                style={{ width: `${Math.min(100, (data.costs.sessionMinutes / data.plan.includedMinutes) * 100)}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <p className="text-[10px] text-slate-500">
                                {((data.costs.sessionMinutes / data.plan.includedMinutes) * 100).toFixed(2)}% utilizzato
                            </p>
                            {data.plan.overagePerMin > 0 ? (
                                <p className="text-[10px] text-slate-500">
                                    Overage: ${(data.plan.overagePerMin * 1000).toFixed(2)} / 1K min extra
                                </p>
                            ) : (
                                <p className="text-[10px] text-red-400/70">
                                    Hard limit — servizio si ferma al superamento
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ═══ COST DASHBOARD ═══ */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Current Burn Rate */}
                        <div className="rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-amber-500/10 to-orange-500/5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                                        <Activity className="w-3 h-3 text-amber-400" /> Burn Rate (ora)
                                    </p>
                                    <p className="text-3xl font-bold text-white">{formatCost(data.costs.currentPerHour)}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">{formatCost(data.costs.currentPerMinute)}/min • {data.live.participants} connessioni</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-amber-400">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                            </div>
                        </div>

                        {/* Session Accumulated */}
                        <div className="rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                                        <DollarSign className="w-3 h-3 text-purple-400" /> Sessioni Attive
                                    </p>
                                    <p className="text-3xl font-bold text-white">{formatCost(data.costs.sessionAccumulated)}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">{formatMinutes(data.costs.sessionMinutes)} connection-min consumati</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-purple-400">
                                    <DollarSign className="w-5 h-5" />
                                </div>
                            </div>
                        </div>

                        {/* Pricing Info */}
                        <div className="rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                                        <Gauge className="w-3 h-3 text-cyan-400" /> Tariffe / Piano
                                    </p>
                                    <div className="space-y-1.5 mt-2">
                                        {Object.entries(LK_PLANS).map(([key, plan]) => (
                                            <div key={key} className={`flex items-center justify-between text-xs px-2 py-1 rounded-lg ${data.plan.name.toLowerCase().includes(key) ? 'bg-cyan-500/10 border border-cyan-500/20' : ''
                                                }`}>
                                                <span className="text-slate-400">{plan.name}</span>
                                                <span className="text-white font-mono text-[10px]">
                                                    ${plan.cost}/mo • {(plan.included / 1000).toFixed(0)}K min
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-cyan-400">
                                    <Zap className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══ COST SIMULATOR ═══ */}
                    <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <Eye className="w-4 h-4 text-amber-400" />
                            Simulazione Costi Mensili
                        </h3>
                        <p className="text-[10px] text-slate-500 mb-4">
                            Costo = base piano + overage sui minuti eccedenti. LiveKit addebita per &quot;connection-minute&quot; (1 partecipante connesso = 1 min).
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {[
                                { label: '10 utenti × 4h/giorno', users: 10, hours: 4, days: 22 },
                                { label: '25 utenti × 6h/giorno', users: 25, hours: 6, days: 22 },
                                { label: '50 utenti × 8h/giorno', users: 50, hours: 8, days: 22 },
                                { label: '100 utenti × 8h/giorno', users: 100, hours: 8, days: 22 },
                            ].map((sim) => {
                                const totalMin = sim.users * sim.hours * 60 * sim.days;
                                // Calculate for each plan
                                const planKey = Object.keys(LK_PLANS).find(k => data.plan.name.toLowerCase().includes(k)) || 'build';
                                const plan = LK_PLANS[planKey as keyof typeof LK_PLANS];
                                const overageMin = Math.max(0, totalMin - plan.included);
                                const overageCost = overageMin * plan.overage;
                                const totalCost = plan.cost + overageCost;
                                const isFree = totalMin <= plan.included;

                                return (
                                    <div key={sim.label} className="rounded-xl border border-white/5 p-4 bg-black/20">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{sim.label}</p>
                                        <p className="text-xl font-bold text-white">
                                            {formatCost(totalCost)}<span className="text-xs text-slate-500">/mese</span>
                                        </p>
                                        <p className="text-[10px] text-slate-600 mt-1">
                                            {(totalMin / 1000).toFixed(0)}K min totali
                                        </p>
                                        {isFree ? (
                                            <p className="text-[10px] text-emerald-400 mt-0.5">✓ Entro i minuti inclusi</p>
                                        ) : (
                                            <p className="text-[10px] text-amber-400 mt-0.5">
                                                + {(overageMin / 1000).toFixed(0)}K min overage
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ═══ ACTIVE ROOMS TABLE ═══ */}
                    <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <Server className="w-4 h-4 text-cyan-400" />
                                Stanze Attive ({data.rooms.length})
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
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                                                        <Users className="w-3 h-3" /> {room.participants.length}
                                                    </span>
                                                    {room.participants.some(p => p.hasVideo) && (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                                            <Video className="w-3 h-3" /> {room.participants.filter(p => p.hasVideo).length}
                                                        </span>
                                                    )}
                                                    {room.participants.some(p => p.hasScreen) && (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                                            <Monitor className="w-3 h-3" /> {room.participants.filter(p => p.hasScreen).length}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-slate-500">
                                                    {expandedRoom === room.sid ? '▲' : '▼'}
                                                </span>
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
                                                                    <p className="text-[10px] text-slate-500">
                                                                        {p.identity.slice(0, 16)}{p.identity.length > 16 ? '…' : ''}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {p.hasAudio && (
                                                                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center" title="Audio">
                                                                        <Mic className="w-3 h-3 text-emerald-400" />
                                                                    </div>
                                                                )}
                                                                {p.hasVideo && (
                                                                    <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center" title="Video">
                                                                        <Video className="w-3 h-3 text-purple-400" />
                                                                    </div>
                                                                )}
                                                                {p.hasScreen && (
                                                                    <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center" title="Screen Share">
                                                                        <Monitor className="w-3 h-3 text-amber-400" />
                                                                    </div>
                                                                )}
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
                                <p className="text-sm text-slate-500">Nessuna stanza attiva</p>
                                <p className="text-[10px] text-slate-600 mt-1">
                                    Le stanze vengono create automaticamente quando gli utenti iniziano una chiamata
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
