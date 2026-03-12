'use client';

import { useEffect, useState } from 'react';
import { ScrollText, ChevronLeft, ChevronRight, User, AlertTriangle, Clock } from 'lucide-react';

interface AuditLog {
    id: string; action: string; entity_type: string; entity_id: string; metadata: any; ip_address: string; created_at: string;
    workspaces: { name: string } | null;
    actor: { email: string; full_name: string; display_name: string } | null;
}

function ActionBadge({ action }: { action: string }) {
    let color = 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    if (action.includes('ban') || action.includes('kick') || action.includes('delete')) color = 'bg-red-500/20 text-red-300 border-red-500/30';
    else if (action.includes('invite') || action.includes('join') || action.includes('create')) color = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    else if (action.includes('role') || action.includes('update') || action.includes('change')) color = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    else if (action.includes('mute') || action.includes('suspend')) color = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${color}`}>{action}</span>;
}

export default function AuditPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const r = await fetch(`/api/admin/audit?page=${page}&limit=25`);
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const data = await r.json();
                setLogs(data.logs || []);
                setTotalPages(data.totalPages);
                setTotal(data.total);
            } catch (err: any) { setError(err.message); }
            setLoading(false);
        };
        fetchLogs();
    }, [page]);

    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Audit Log</h1>
                <p className="text-sm text-slate-400 mt-1">Storico completo di tutte le azioni nel sistema</p>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />{error}
                </div>
            )}

            <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/5 text-slate-400 text-xs uppercase tracking-wider">
                            <th className="text-left p-3 font-semibold">Data</th>
                            <th className="text-left p-3 font-semibold">Azione</th>
                            <th className="text-left p-3 font-semibold">Attore</th>
                            <th className="text-left p-3 font-semibold">Entità</th>
                            <th className="text-left p-3 font-semibold">Workspace</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className="text-center p-8 text-slate-500">Caricamento...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={5} className="text-center p-8 text-slate-500">
                                <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-30" />Nessun log trovato
                            </td></tr>
                        ) : logs.map(log => (
                            <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                <td className="p-3 text-slate-500 text-xs whitespace-nowrap">
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(log.created_at).toLocaleString('it-IT')}</span>
                                </td>
                                <td className="p-3"><ActionBadge action={log.action} /></td>
                                <td className="p-3 text-slate-300 text-xs">
                                    {log.actor ? (
                                        <span className="flex items-center gap-1"><User className="w-3 h-3 text-slate-500" />{log.actor.display_name || log.actor.full_name || log.actor.email}</span>
                                    ) : '—'}
                                </td>
                                <td className="p-3 text-slate-400 text-xs">
                                    {log.entity_type ? <span>{log.entity_type}{log.entity_id ? ` · ${log.entity_id.slice(0, 8)}…` : ''}</span> : '—'}
                                </td>
                                <td className="p-3 text-slate-500 text-xs">{log.workspaces?.name || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-white/5">
                        <span className="text-xs text-slate-500">{total} eventi totali</span>
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
        </div>
    );
}
