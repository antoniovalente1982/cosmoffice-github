'use client';

import { useEffect, useState } from 'react';
import { Shield, ShieldAlert, ShieldX, Clock, Globe, AlertTriangle, User } from 'lucide-react';
import { useT } from '../../../lib/i18n';

interface SecurityOverview {
    failedLogins24h: number;
    activeBans: number;
    suspendedUsers: number;
    recentLogins: Array<{
        id: string; user_id: string; email: string; event_type: string;
        ip_address: string; country: string; city: string; success: boolean; created_at: string;
    }>;
}

function EventBadge({ type, success }: { type: string; success?: boolean }) {
    const styles: Record<string, string> = {
        login: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        logout: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
        failed_login: 'bg-red-500/20 text-red-300 border-red-500/30',
        password_reset: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        signup: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    };
    return (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${styles[type] || styles.login}`}>
            {type.replace('_', ' ')}
        </span>
    );
}

export default function SecurityPage() {
    const [overview, setOverview] = useState<SecurityOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'logins' | 'bans'>('overview');
    const { t } = useT();

    useEffect(() => {
        fetch('/api/admin/security?section=overview')
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(data => { setOverview(data); setLoading(false); })
            .catch(err => { setError(err.message); setLoading(false); });
    }, []);

    if (loading) return <div className="p-8 flex justify-center"><div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>;

    if (error) return (
        <div className="p-8">
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
                <AlertTriangle className="w-4 h-4 inline mr-2" />{error}
            </div>
        </div>
    );

    if (!overview) return null;

    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">{t('sa.security.title')}</h1>
                <p className="text-sm text-slate-400 mt-1">{t('sa.security.subtitle')}</p>
            </div>

            {/* Security KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`rounded-2xl border p-5 bg-gradient-to-br ${overview.failedLogins24h > 10
                    ? 'from-red-500/20 to-red-500/5 border-red-500/20' : 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20'}`}>
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Login Falliti (24h)</p>
                            <p className="text-3xl font-bold text-white mt-1">{overview.failedLogins24h}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center">
                            <ShieldAlert className={`w-5 h-5 ${overview.failedLogins24h > 10 ? 'text-red-400' : 'text-emerald-400'}`} />
                        </div>
                    </div>
                </div>

                <div className={`rounded-2xl border p-5 bg-gradient-to-br ${overview.activeBans > 0
                    ? 'from-amber-500/20 to-amber-500/5 border-amber-500/20' : 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20'}`}>
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ban Attivi</p>
                            <p className="text-3xl font-bold text-white mt-1">{overview.activeBans}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center">
                            <ShieldX className="w-5 h-5 text-amber-400" />
                        </div>
                    </div>
                </div>

                <div className={`rounded-2xl border p-5 bg-gradient-to-br ${overview.suspendedUsers > 0
                    ? 'from-red-500/20 to-red-500/5 border-red-500/20' : 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20'}`}>
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Utenti Sospesi</p>
                            <p className="text-3xl font-bold text-white mt-1">{overview.suspendedUsers}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-emerald-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Login Events */}
            <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                <div className="p-4 border-b border-white/5">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Ultimi Accessi</h2>
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/5 text-slate-400 text-xs uppercase tracking-wider">
                            <th className="text-left p-3 font-semibold">Utente</th>
                            <th className="text-left p-3 font-semibold">Tipo</th>
                            <th className="text-left p-3 font-semibold">IP</th>
                            <th className="text-left p-3 font-semibold">Posizione</th>
                            <th className="text-left p-3 font-semibold">Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        {overview.recentLogins.length === 0 ? (
                            <tr><td colSpan={5} className="text-center p-6 text-slate-500">Nessun evento registrato</td></tr>
                        ) : overview.recentLogins.map(ev => (
                            <tr key={ev.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                <td className="p-3">
                                    <div className="flex items-center gap-2">
                                        <User className="w-3.5 h-3.5 text-slate-500" />
                                        <span className="text-slate-300 text-xs truncate max-w-[180px]">{ev.email || '—'}</span>
                                    </div>
                                </td>
                                <td className="p-3"><EventBadge type={ev.event_type} success={ev.success} /></td>
                                <td className="p-3 text-slate-500 text-xs font-mono">{ev.ip_address || '—'}</td>
                                <td className="p-3 text-slate-400 text-xs">
                                    {ev.city || ev.country ? (
                                        <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{[ev.city, ev.country].filter(Boolean).join(', ')}</span>
                                    ) : '—'}
                                </td>
                                <td className="p-3 text-slate-500 text-xs">
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(ev.created_at).toLocaleString('it-IT')}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
