'use client';

import { useEffect, useState } from 'react';
import { Bug, AlertTriangle, CheckCircle, Clock, ChevronLeft, ChevronRight, User } from 'lucide-react';

interface BugReport {
    id: string; title: string; description: string; severity: string;
    status: string; category: string; admin_notes: string;
    created_at: string; resolved_at: string;
    reporter: { id: string; email: string; display_name: string; avatar_url: string } | null;
    workspace: { id: string; name: string } | null;
}

function SeverityBadge({ severity }: { severity: string }) {
    const c: Record<string, string> = {
        low: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
        medium: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        high: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        critical: 'bg-red-500/20 text-red-300 border-red-500/30 animate-pulse',
    };
    return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${c[severity] || c.medium}`}>{severity}</span>;
}

function StatusBadge({ status }: { status: string }) {
    const c: Record<string, string> = {
        open: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
        in_progress: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        resolved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        closed: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
        wont_fix: 'bg-red-500/20 text-red-300 border-red-500/30',
    };
    return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${c[status] || c.open}`}>{status.replace('_', ' ')}</span>;
}

export default function BugsPage() {
    const [bugs, setBugs] = useState<BugReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [statusFilter, setStatusFilter] = useState('');
    const [severityFilter, setSeverityFilter] = useState('');
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const fetchBugs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '15' });
            if (statusFilter) params.set('status', statusFilter);
            if (severityFilter) params.set('severity', severityFilter);

            const r = await fetch(`/api/admin/bugs?${params}`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            setBugs(data.bugs);
            setTotalPages(data.totalPages);
            setTotal(data.total);
        } catch (err: any) { setError(err.message); }
        setLoading(false);
    };

    useEffect(() => { fetchBugs(); }, [page, statusFilter, severityFilter]);

    const updateBug = async (id: string, status: string) => {
        setUpdatingId(id);
        try {
            const r = await fetch('/api/admin/bugs', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status }),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            await fetchBugs();
        } catch (err: any) { setError(err.message); }
        setUpdatingId(null);
    };

    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Bug Reports</h1>
                <p className="text-sm text-slate-400 mt-1">Segnalazioni dagli utenti</p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Stato:</span>
                    {['', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
                        <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${statusFilter === s
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-black/20 text-slate-400 border-white/5 hover:bg-white/5'}`}>
                            {s ? s.replace('_', ' ') : 'Tutti'}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Gravità:</span>
                    {['', 'critical', 'high', 'medium', 'low'].map(s => (
                        <button key={s} onClick={() => { setSeverityFilter(s); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${severityFilter === s
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-black/20 text-slate-400 border-white/5 hover:bg-white/5'}`}>
                            {s || 'Tutte'}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />{error}
                </div>
            )}

            {/* Bug List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="flex justify-center p-8">
                        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : bugs.length === 0 ? (
                    <div className="text-center p-12 text-slate-500">
                        <Bug className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p>Nessun bug report trovato</p>
                    </div>
                ) : bugs.map(bug => (
                    <div key={bug.id} className="rounded-2xl border border-white/5 p-5 hover:bg-white/[0.02] transition-all"
                        style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <SeverityBadge severity={bug.severity} />
                                    <StatusBadge status={bug.status} />
                                    <span className="text-[10px] text-slate-500 uppercase font-semibold px-2 py-0.5 bg-black/20 rounded-md border border-white/5">
                                        {bug.category}
                                    </span>
                                </div>
                                <h3 className="text-sm font-semibold text-white mb-1">{bug.title}</h3>
                                {bug.description && <p className="text-xs text-slate-400 line-clamp-2">{bug.description}</p>}
                                <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500">
                                    {bug.reporter && (
                                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{bug.reporter.display_name || bug.reporter.email}</span>
                                    )}
                                    {bug.workspace && <span>da {bug.workspace.name}</span>}
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(bug.created_at).toLocaleDateString('it-IT')}</span>
                                </div>
                            </div>

                            {/* Actions */}
                            {bug.status !== 'resolved' && bug.status !== 'closed' && (
                                <div className="flex gap-2 shrink-0">
                                    {bug.status === 'open' && (
                                        <button onClick={() => updateBug(bug.id, 'in_progress')} disabled={updatingId === bug.id}
                                            className="px-3 py-1.5 text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 transition-all disabled:opacity-50">
                                            In Lavorazione
                                        </button>
                                    )}
                                    <button onClick={() => updateBug(bug.id, 'resolved')} disabled={updatingId === bug.id}
                                        className="px-3 py-1.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition-all disabled:opacity-50">
                                        <CheckCircle className="w-3 h-3 inline mr-1" />Risolto
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{total} bug totali</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                            className="p-1.5 rounded-lg bg-black/20 text-slate-400 hover:text-white disabled:opacity-30 transition-all">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-slate-400">{page} / {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                            className="p-1.5 rounded-lg bg-black/20 text-slate-400 hover:text-white disabled:opacity-30 transition-all">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
