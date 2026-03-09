'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    ArrowUpCircle, Clock, CheckCircle, XCircle, Users, Building2,
    Loader2, RefreshCw, Inbox
} from 'lucide-react';

interface UpgradeRequest {
    id: string;
    user_id: string;
    workspace_id: string | null;
    request_type: 'seats' | 'workspace';
    message: string | null;
    status: 'pending' | 'resolved' | 'dismissed';
    created_at: string;
    // joined data
    user_email?: string;
    user_name?: string;
    user_phone?: string;
    user_company?: string;
    user_role?: string;
    workspace_name?: string;
    current_seats?: number;
    used_seats?: number;
}

export default function UpgradeRequestsPage() {
    const [requests, setRequests] = useState<UpgradeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
    const [processing, setProcessing] = useState<string | null>(null);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        const res = await fetch('/api/admin/upgrade-requests');
        const data = await res.json();
        setRequests(data.requests || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const updateStatus = async (id: string, newStatus: 'resolved' | 'dismissed') => {
        setProcessing(id);
        await fetch('/api/admin/upgrade-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_status', requestId: id, status: newStatus }),
        });
        await fetchRequests();
        setProcessing(null);
    };

    const filtered = requests.filter(r => filter === 'all' || r.status === filter);
    const pendingCount = requests.filter(r => r.status === 'pending').length;

    return (
        <div className="min-h-screen p-8" style={{ background: '#0a0e1a' }}>
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <ArrowUpCircle className="w-7 h-7 text-amber-400" />
                            Richieste Upgrade
                            {pendingCount > 0 && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    {pendingCount}
                                </span>
                            )}
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">Richieste di accessi aggiuntivi o workspace</p>
                    </div>
                    <button onClick={fetchRequests} className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                    </button>
                </div>

                {/* Filters */}
                <div className="flex gap-2 mb-6">
                    {(['pending', 'all', 'resolved'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${filter === f
                                ? 'bg-white/10 text-white border border-white/20'
                                : 'text-slate-500 hover:text-slate-300 border border-transparent'
                                }`}>
                            {f === 'pending' ? `⏳ In attesa (${pendingCount})` : f === 'all' ? '📋 Tutte' : '✅ Risolte'}
                        </button>
                    ))}
                </div>

                {/* Requests List */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <Inbox className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">
                            {filter === 'pending' ? 'Nessuna richiesta in attesa' : 'Nessuna richiesta'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(r => (
                            <div key={r.id}
                                className="rounded-2xl border p-5"
                                style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    borderColor: r.status === 'pending' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255,255,255,0.06)',
                                }}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            {r.request_type === 'seats' ? (
                                                <Users className="w-4 h-4 text-cyan-400" />
                                            ) : (
                                                <Building2 className="w-4 h-4 text-violet-400" />
                                            )}
                                            <span className="text-sm font-bold text-white">
                                                {r.request_type === 'seats' ? 'Più accessi' : 'Nuovo workspace'}
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${r.status === 'pending'
                                                ? 'text-amber-400 bg-amber-500/15 border border-amber-500/20'
                                                : r.status === 'resolved'
                                                    ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/20'
                                                    : 'text-slate-500 bg-slate-500/15 border border-slate-500/20'
                                                }`}>
                                                {r.status === 'pending' ? 'In attesa' : r.status === 'resolved' ? 'Risolta' : 'Ignorata'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 mb-1">
                                            <span className="text-slate-300 font-medium">{r.user_name || r.user_email || r.user_id.slice(0, 8)}</span>
                                            {r.user_role && (
                                                <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-white/5 text-slate-500">
                                                    {r.user_role}
                                                </span>
                                            )}
                                            {r.workspace_name && (
                                                <> — workspace: <span className="text-cyan-400">{r.workspace_name}</span></>
                                            )}
                                        </p>
                                        <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                                            {r.user_email && (
                                                <span>📧 {r.user_email}</span>
                                            )}
                                            {r.user_phone && (
                                                <span className="text-emerald-400">📞 {r.user_phone}</span>
                                            )}
                                            {r.user_company && (
                                                <span>🏢 {r.user_company}</span>
                                            )}
                                        </div>
                                        {r.current_seats !== undefined && (
                                            <p className="text-[11px] text-slate-500">
                                                Accessi attuali: {r.used_seats ?? '?'}/{r.current_seats}
                                            </p>
                                        )}
                                        {r.message && (
                                            <p className="text-xs text-slate-400 mt-2 italic bg-black/20 px-3 py-2 rounded-xl">
                                                &quot;{r.message}&quot;
                                            </p>
                                        )}
                                        <p className="text-[10px] text-slate-600 mt-2">
                                            {new Date(r.created_at).toLocaleString('it-IT')}
                                        </p>
                                    </div>

                                    {r.status === 'pending' && (
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                onClick={() => updateStatus(r.id, 'resolved')}
                                                disabled={processing === r.id}
                                                className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all disabled:opacity-50"
                                            >
                                                {processing === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle className="w-3 h-3 inline mr-1" />Risolvi</>}
                                            </button>
                                            <button
                                                onClick={() => updateStatus(r.id, 'dismissed')}
                                                disabled={processing === r.id}
                                                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 border border-white/10 hover:bg-white/5 transition-all disabled:opacity-50"
                                            >
                                                <XCircle className="w-3 h-3 inline mr-1" />Ignora
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
