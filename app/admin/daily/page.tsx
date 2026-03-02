'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Video, Users, Clock, DollarSign, RefreshCw, AlertTriangle,
    Radio, ChevronLeft, ChevronRight, Zap,
} from 'lucide-react';

interface DailyOverview {
    live: { sessions: number; participants: number };
    monthly: {
        totalSessions: number;
        totalParticipantMinutes: number;
        estimatedCostCents: number;
        estimatedCostFormatted: string;
    };
    rooms: { total: number; maxAllowed: number };
    presenceDetails: Record<string, any[]>;
}

interface Meeting {
    id: string; room: string; startTime: number; duration: number;
    maxParticipants: number; participantMinutes: number;
    participants: Array<{ id: string; user_name: string; join_time: number; duration: number }>;
}

export default function DailyPage() {
    const [overview, setOverview] = useState<DailyOverview | null>(null);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [meetingsLoading, setMeetingsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const fetchOverview = useCallback(async () => {
        try {
            const r = await fetch('/api/admin/daily?section=overview');
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            setOverview(data);
            setLastRefresh(new Date());
            setError(null);
        } catch (err: any) { setError(err.message); }
        setLoading(false);
    }, []);

    const fetchMeetings = async () => {
        setMeetingsLoading(true);
        try {
            const r = await fetch('/api/admin/daily?section=meetings&days=30');
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            setMeetings(data.meetings || []);
        } catch (err: any) { setError(err.message); }
        setMeetingsLoading(false);
    };

    useEffect(() => {
        fetchOverview();
        fetchMeetings();
    }, [fetchOverview]);

    // Auto-refresh every 15 seconds for live data
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchOverview, 15000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchOverview]);

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
                    <h1 className="text-2xl font-bold text-white">Daily.co — Live</h1>
                    <p className="text-sm text-slate-400 mt-1">Monitoraggio in tempo reale videochiamate e costi</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${autoRefresh
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border-white/10'}`}>
                        <Radio className={`w-3 h-3 ${autoRefresh ? 'animate-pulse' : ''}`} />
                        {autoRefresh ? 'Live' : 'Pausa'}
                    </button>
                    <button onClick={() => { fetchOverview(); fetchMeetings(); }}
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

            {overview && (
                <>
                    {/* LIVE Section */}
                    <div className="rounded-2xl border border-cyan-500/20 p-1" style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.05), rgba(168,85,247,0.05))' }}>
                        <div className="flex items-center gap-2 px-4 py-2">
                            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                            <span className="text-xs font-bold text-cyan-300 uppercase tracking-widest">Real Time</span>
                            <span className="text-[10px] text-slate-500 ml-1">Aggiornamento ogni 15s</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 pt-0">
                            <div className="rounded-xl border border-white/5 p-5 bg-black/20">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Sessioni Live</p>
                                <p className="text-4xl font-bold text-white">{overview.live.sessions}</p>
                            </div>
                            <div className="rounded-xl border border-white/5 p-5 bg-black/20">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Partecipanti Attivi</p>
                                <p className="text-4xl font-bold text-white">{overview.live.participants}</p>
                            </div>
                        </div>

                        {/* Live rooms breakdown */}
                        {Object.keys(overview.presenceDetails).length > 0 && (
                            <div className="px-4 pb-4">
                                <div className="rounded-xl border border-white/5 p-4 bg-black/20 space-y-2">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Stanze Attive</p>
                                    {Object.entries(overview.presenceDetails).map(([room, participants]) => (
                                        <div key={room} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                                            <span className="text-sm text-white font-medium truncate max-w-[60%]">{room}</span>
                                            <span className="flex items-center gap-1 text-xs text-cyan-300">
                                                <Users className="w-3 h-3" />
                                                {Array.isArray(participants) ? participants.length : 0}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Monthly Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Sessioni (mese)</p>
                                    <p className="text-3xl font-bold text-white">{overview.monthly.totalSessions}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-purple-400">
                                    <Video className="w-5 h-5" />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Participant-Min</p>
                                    <p className="text-3xl font-bold text-white">{overview.monthly.totalParticipantMinutes}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-cyan-400">
                                    <Clock className="w-5 h-5" />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-amber-500/10 to-amber-500/5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Costo Stimato</p>
                                    <p className="text-3xl font-bold text-white">{overview.monthly.estimatedCostFormatted}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">~$0.004/min (scale plan)</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-amber-400">
                                    <DollarSign className="w-5 h-5" />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Rooms</p>
                                    <p className="text-3xl font-bold text-white">{overview.rooms.total}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Max {overview.rooms.maxAllowed.toLocaleString()}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-emerald-400">
                                    <Zap className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Included Minutes Progress */}
                    <div className="rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold text-white">Participant-Minutes Inclusi</span>
                            <span className="text-xs text-slate-400">
                                {overview.monthly.totalParticipantMinutes} usati / 10.000 max
                            </span>
                        </div>
                        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-cyan-400 to-purple-400"
                                style={{ width: `${Math.min(100, (overview.monthly.totalParticipantMinutes / 10000) * 100)}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2">
                            {((overview.monthly.totalParticipantMinutes / 10000) * 100).toFixed(1)}% utilizzato
                        </p>
                    </div>
                </>
            )}

            {/* Recent Meetings Table */}
            <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Sessioni Recenti (30gg)</h2>
                    <span className="text-xs text-slate-500">{meetings.length} sessioni</span>
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/5 text-slate-400 text-xs uppercase tracking-wider">
                            <th className="text-left p-3 font-semibold">Stanza</th>
                            <th className="text-center p-3 font-semibold">Partecipanti</th>
                            <th className="text-center p-3 font-semibold">Durata</th>
                            <th className="text-center p-3 font-semibold">Part-Min</th>
                            <th className="text-left p-3 font-semibold">Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        {meetingsLoading ? (
                            <tr><td colSpan={5} className="text-center p-6 text-slate-500">Caricamento...</td></tr>
                        ) : meetings.length === 0 ? (
                            <tr><td colSpan={5} className="text-center p-6 text-slate-500">Nessuna sessione trovata</td></tr>
                        ) : meetings.slice(0, 50).map(m => (
                            <tr key={m.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                <td className="p-3">
                                    <span className="text-white font-medium text-xs truncate max-w-[200px] block">{m.room}</span>
                                </td>
                                <td className="p-3 text-center">
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                        {m.maxParticipants}
                                    </span>
                                </td>
                                <td className="p-3 text-center text-slate-400 text-xs">
                                    {m.duration > 3600
                                        ? `${Math.floor(m.duration / 3600)}h ${Math.floor((m.duration % 3600) / 60)}m`
                                        : `${Math.floor(m.duration / 60)}m ${m.duration % 60}s`}
                                </td>
                                <td className="p-3 text-center">
                                    <span className="text-amber-300 font-medium text-xs">{m.participantMinutes}</span>
                                </td>
                                <td className="p-3 text-slate-500 text-xs">
                                    {new Date(m.startTime * 1000).toLocaleString('it-IT')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
