'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    BarChart3, Clock, Users, Activity, TrendingUp,
    Building2, RefreshCw, Calendar, Loader2, AlertCircle
} from 'lucide-react';
import { useT } from '../../../lib/i18n';

interface AnalyticsData {
    totalEvents: number;
    uniqueUsers: number;
    roomUtilization: { room_id: string; count: number; percentage: number }[];
    hourlyActivity: number[];
    dailyActiveUsers: { date: string; count: number }[];
    collaborationPairs: { user_a: string; user_b: string; coPresenceScore: number }[];
    periodDays: number;
}

export default function AnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [days, setDays] = useState(7);
    const [roomNames, setRoomNames] = useState<Record<string, string>>({});
    const [userNames, setUserNames] = useState<Record<string, string>>({});
    const { t } = useT();

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/admin/presence-analytics?days=${days}`);
            const json = await res.json();
            if (json.error) {
                setError(json.error);
            } else {
                setData(json);

                // Resolve room names
                if (json.roomUtilization?.length > 0) {
                    const { createClient } = await import('../../../utils/supabase/client');
                    const supabase = createClient();
                    const roomIds = json.roomUtilization.map((r: any) => r.room_id);
                    const { data: rooms } = await supabase
                        .from('rooms')
                        .select('id, name')
                        .in('id', roomIds);
                    if (rooms) {
                        const map: Record<string, string> = {};
                        rooms.forEach((r: any) => { map[r.id] = r.name; });
                        setRoomNames(map);
                    }
                }

                // Resolve user names for collaboration pairs
                if (json.collaborationPairs?.length > 0) {
                    const { createClient } = await import('../../../utils/supabase/client');
                    const supabase = createClient();
                    const userIds = new Set<string>();
                    json.collaborationPairs.forEach((p: any) => {
                        userIds.add(p.user_a);
                        userIds.add(p.user_b);
                    });
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, display_name')
                        .in('id', Array.from(userIds));
                    if (profiles) {
                        const map: Record<string, string> = {};
                        profiles.forEach((p: any) => {
                            map[p.id] = p.display_name || p.full_name || p.id.slice(0, 8);
                        });
                        setUserNames(map);
                    }
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    const maxHourly = data ? Math.max(...data.hourlyActivity, 1) : 1;
    const maxDAU = data?.dailyActiveUsers?.length ? Math.max(...data.dailyActiveUsers.map(d => d.count), 1) : 1;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                        <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">{t('sa.analytics.title')}</h1>
                        <p className="text-xs text-slate-500">{t('sa.analytics.subtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {[7, 14, 30].map(d => (
                        <button key={d} onClick={() => setDays(d)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                days === d
                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                    : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent'
                            }`}
                        >
                            {d}g
                        </button>
                    ))}
                    <button onClick={fetchAnalytics}
                        className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <div>
                        <p className="text-sm font-bold">{t('common.error')}</p>
                        <p className="text-xs text-red-400/70">{error}</p>
                    </div>
                </div>
            )}

            {loading && !data ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                </div>
            ) : data ? (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-4 gap-4">
                        {[
                            { label: 'Eventi Presenza', value: data.totalEvents.toLocaleString('it-IT'), icon: Activity, color: '#3b82f6', glow: 'rgba(59,130,246,0.2)' },
                            { label: 'Utenti Unici', value: data.uniqueUsers.toString(), icon: Users, color: '#8b5cf6', glow: 'rgba(139,92,246,0.2)' },
                            { label: 'Stanze Monitorate', value: data.roomUtilization.length.toString(), icon: Building2, color: '#10b981', glow: 'rgba(16,185,129,0.2)' },
                            { label: 'Periodo', value: `${data.periodDays} giorni`, icon: Calendar, color: '#f59e0b', glow: 'rgba(245,158,11,0.2)' },
                        ].map(kpi => (
                            <div key={kpi.label}
                                className="relative p-4 rounded-2xl border border-white/5 overflow-hidden"
                                style={{ background: 'rgba(15, 23, 42, 0.5)' }}
                            >
                                <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-20 blur-2xl"
                                    style={{ background: kpi.glow }} />
                                <kpi.icon className="w-5 h-5 mb-2" style={{ color: kpi.color }} />
                                <p className="text-2xl font-black text-white">{kpi.value}</p>
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-1">{kpi.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Hourly Activity */}
                        <div className="p-5 rounded-2xl border border-white/5" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                            <div className="flex items-center gap-2 mb-4">
                                <Clock className="w-4 h-4 text-blue-400" />
                                <h3 className="text-sm font-bold text-white">Attività Oraria</h3>
                            </div>
                            <div className="flex items-end gap-[3px] h-32">
                                {data.hourlyActivity.map((count, hour) => (
                                    <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                                        <div
                                            className="w-full rounded-t-sm transition-all hover:opacity-80"
                                            style={{
                                                height: `${Math.max(2, (count / maxHourly) * 100)}%`,
                                                background: hour >= 9 && hour <= 18
                                                    ? 'linear-gradient(to top, #3b82f6, #6366f1)'
                                                    : 'rgba(255,255,255,0.06)',
                                                minHeight: 2,
                                            }}
                                            title={`${hour}:00 — ${count} eventi`}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between mt-1">
                                <span className="text-[8px] text-slate-600">0</span>
                                <span className="text-[8px] text-slate-600">6</span>
                                <span className="text-[8px] text-slate-600">12</span>
                                <span className="text-[8px] text-slate-600">18</span>
                                <span className="text-[8px] text-slate-600">23</span>
                            </div>
                        </div>

                        {/* DAU Chart */}
                        <div className="p-5 rounded-2xl border border-white/5" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                <h3 className="text-sm font-bold text-white">Utenti Attivi Giornalieri</h3>
                            </div>
                            {data.dailyActiveUsers.length > 0 ? (
                                <div className="flex items-end gap-1 h-32">
                                    {data.dailyActiveUsers.map((day) => (
                                        <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                                            <div
                                                className="w-full rounded-t-sm transition-all hover:opacity-80"
                                                style={{
                                                    height: `${Math.max(4, (day.count / maxDAU) * 100)}%`,
                                                    background: 'linear-gradient(to top, #10b981, #14b8a6)',
                                                    minHeight: 4,
                                                }}
                                                title={`${day.date} — ${day.count} {t('sa.analytics.usersTooltip')}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-32 text-slate-600 text-xs">
                                    {t('sa.analytics.noData')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Row */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Room Utilization */}
                        <div className="p-5 rounded-2xl border border-white/5" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                            <div className="flex items-center gap-2 mb-4">
                                <Building2 className="w-4 h-4 text-purple-400" />
                                <h3 className="text-sm font-bold text-white">Utilizzo Stanze</h3>
                            </div>
                            {data.roomUtilization.length > 0 ? (
                                <div className="space-y-2.5 max-h-52 overflow-y-auto">
                                    {data.roomUtilization.slice(0, 10).map((room, idx) => (
                                        <div key={room.room_id} className="flex items-center gap-3">
                                            <span className="text-[10px] font-bold text-slate-600 w-4 text-right">{idx + 1}</span>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-semibold text-white truncate max-w-[160px]">
                                                        {roomNames[room.room_id] || room.room_id.slice(0, 12)}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400">{room.percentage}%</span>
                                                </div>
                                                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                                    <div className="h-full rounded-full transition-all"
                                                        style={{
                                                            width: `${room.percentage}%`,
                                                            background: `hsl(${260 - idx * 20}, 70%, 60%)`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-32 text-slate-600 text-xs">
                                    {t('sa.analytics.noData2')}
                                </div>
                            )}
                        </div>

                        {/* Collaboration Graph */}
                        <div className="p-5 rounded-2xl border border-white/5" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                            <div className="flex items-center gap-2 mb-4">
                                <Users className="w-4 h-4 text-cyan-400" />
                                <h3 className="text-sm font-bold text-white">Collaborazione</h3>
                                <span className="text-[9px] text-slate-600 ml-auto">Co-presenza nelle stanze</span>
                            </div>
                            {data.collaborationPairs.length > 0 ? (
                                <div className="space-y-2 max-h-52 overflow-y-auto">
                                    {data.collaborationPairs.slice(0, 10).map((pair, idx) => {
                                        const maxScore = data.collaborationPairs[0]?.coPresenceScore || 1;
                                        const pct = Math.round((pair.coPresenceScore / maxScore) * 100);
                                        return (
                                            <div key={idx} className="flex items-center gap-3">
                                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                    <span className="text-xs text-slate-300 font-medium truncate">
                                                        {userNames[pair.user_a] || pair.user_a.slice(0, 8)}
                                                    </span>
                                                    <span className="text-[10px] text-slate-600">↔</span>
                                                    <span className="text-xs text-slate-300 font-medium truncate">
                                                        {userNames[pair.user_b] || pair.user_b.slice(0, 8)}
                                                    </span>
                                                </div>
                                                <div className="w-20 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-bold w-8 text-right">
                                                    {pair.coPresenceScore}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-32 text-slate-600 text-xs">
                                    {t('sa.analytics.noData2')}
                                </div>
                            )}
                        </div>
                    </div>

                    {data.totalEvents === 0 && (
                        <div className="text-center py-8 rounded-2xl border border-dashed border-white/10">
                            <BarChart3 className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-500">{t('sa.analytics.noEventsYet')}</p>
                            <p className="text-xs text-slate-600 mt-1">
                                I dati appariranno automaticamente quando gli utenti navigano nell&apos;ufficio virtuale
                            </p>
                        </div>
                    )}
                </>
            ) : null}
        </div>
    );
}
