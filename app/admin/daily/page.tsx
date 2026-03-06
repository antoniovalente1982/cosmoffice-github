'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Video, Users, Clock, DollarSign, RefreshCw, AlertTriangle,
    Radio, Mic, Monitor, Zap, Server, Activity,
    TrendingUp, Eye,
} from 'lucide-react';

interface LiveKitOverview {
    livekit: { url: string; region: string };
    live: {
        rooms: number; participants: number;
        videoTracks: number; audioTracks: number; screenShares: number;
    };
    costs: {
        currentPerMinute: number; currentPerHour: number;
        sessionAccumulated: number;
        pricing: { audioPerMin: number; videoPerMin: number; egressPerMin: number; bandwidthPerGB: number; freeBandwidthGB: number };
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

    // Auto-refresh every 10 seconds
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
                            {/* Rooms */}
                            <div className="rounded-xl border border-white/5 p-4 bg-black/20 text-center">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Stanze Attive</p>
                                <p className="text-3xl font-bold text-white">{data.live.rooms}</p>
                            </div>
                            {/* Participants */}
                            <div className="rounded-xl border border-white/5 p-4 bg-black/20 text-center">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Partecipanti</p>
                                <p className="text-3xl font-bold text-white">{data.live.participants}</p>
                            </div>
                            {/* Video Tracks */}
                            <div className="rounded-xl border border-white/5 p-4 bg-black/20 text-center">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1 justify-center">
                                    <Video className="w-3 h-3 text-purple-400" /> Video
                                </p>
                                <p className="text-3xl font-bold text-purple-300">{data.live.videoTracks}</p>
                            </div>
                            {/* Audio Tracks */}
                            <div className="rounded-xl border border-white/5 p-4 bg-black/20 text-center">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1 justify-center">
                                    <Mic className="w-3 h-3 text-emerald-400" /> Audio
                                </p>
                                <p className="text-3xl font-bold text-emerald-300">{data.live.audioTracks}</p>
                            </div>
                            {/* Screen Shares */}
                            <div className="rounded-xl border border-white/5 p-4 bg-black/20 text-center">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1 justify-center">
                                    <Monitor className="w-3 h-3 text-amber-400" /> Screen
                                </p>
                                <p className="text-3xl font-bold text-amber-300">{data.live.screenShares}</p>
                            </div>
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
                                    <p className="text-[10px] text-slate-500 mt-1">{formatCost(data.costs.currentPerMinute)}/min</p>
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
                                    <p className="text-[10px] text-slate-500 mt-1">costo accumulato finora</p>
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
                                        <Server className="w-3 h-3 text-cyan-400" /> Tariffe LiveKit Cloud
                                    </p>
                                    <div className="space-y-1 mt-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400 flex items-center gap-1"><Mic className="w-3 h-3" /> Audio</span>
                                            <span className="text-white font-mono">$0.30 / 1K min</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400 flex items-center gap-1"><Video className="w-3 h-3" /> Video</span>
                                            <span className="text-white font-mono">$2.40 / 1K min</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400 flex items-center gap-1"><Monitor className="w-3 h-3" /> Egress</span>
                                            <span className="text-white font-mono">$6.00 / 1K min</span>
                                        </div>
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
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {[
                                { label: '10 utenti, 4h/giorno', users: 10, hours: 4, days: 22, videoPct: 0.3 },
                                { label: '25 utenti, 6h/giorno', users: 25, hours: 6, days: 22, videoPct: 0.3 },
                                { label: '50 utenti, 8h/giorno', users: 50, hours: 8, days: 22, videoPct: 0.25 },
                                { label: '100 utenti, 8h/giorno', users: 100, hours: 8, days: 22, videoPct: 0.2 },
                            ].map((sim) => {
                                const totalMin = sim.users * sim.hours * 60 * sim.days;
                                const videoMin = totalMin * sim.videoPct;
                                const audioMin = totalMin * (1 - sim.videoPct);
                                const cost = (videoMin * PRICING_DISPLAY.videoPerMin) + (audioMin * PRICING_DISPLAY.audioPerMin);
                                return (
                                    <div key={sim.label} className="rounded-xl border border-white/5 p-4 bg-black/20">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{sim.label}</p>
                                        <p className="text-xl font-bold text-white">{formatCost(cost)}<span className="text-xs text-slate-500">/mese</span></p>
                                        <p className="text-[10px] text-slate-600 mt-1">
                                            {Math.round(totalMin / 1000)}K min totali • {Math.round(sim.videoPct * 100)}% video
                                        </p>
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
                            {data.rooms.length === 0 && (
                                <span className="text-xs text-slate-500 italic">Nessuna stanza attiva al momento</span>
                            )}
                        </div>

                        {data.rooms.length > 0 && (
                            <div className="divide-y divide-white/5">
                                {data.rooms.map(room => (
                                    <div key={room.sid}>
                                        {/* Room row */}
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

                                        {/* Expanded participants */}
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
                                                                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                                                        <Mic className="w-3 h-3 text-emerald-400" />
                                                                    </div>
                                                                )}
                                                                {p.hasVideo && (
                                                                    <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                                                                        <Video className="w-3 h-3 text-purple-400" />
                                                                    </div>
                                                                )}
                                                                {p.hasScreen && (
                                                                    <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
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
                        )}

                        {data.rooms.length === 0 && (
                            <div className="p-12 text-center">
                                <Server className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                                <p className="text-sm text-slate-500">Nessuna stanza attiva</p>
                                <p className="text-[10px] text-slate-600 mt-1">Le stanze vengono create automaticamente quando gli utenti iniziano una chiamata</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// Pricing constants used by the simulator
const PRICING_DISPLAY = {
    audioPerMin: 0.0003,
    videoPerMin: 0.0024,
};
