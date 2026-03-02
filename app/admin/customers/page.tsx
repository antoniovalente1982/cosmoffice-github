'use client';

import { useEffect, useState } from 'react';
import { Search, Building2, Users, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

interface Workspace {
    id: string;
    name: string;
    slug: string;
    plan: string;
    maxMembers: number;
    totalMembers: number;
    suspendedMembers: number;
    createdAt: string;
    lastActivity: number;
}

function PlanBadge({ plan }: { plan: string }) {
    const c: Record<string, string> = {
        free: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
        starter: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        pro: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        enterprise: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    };
    return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${c[plan] || c.free}`}>{plan}</span>;
}

export default function CustomersPage() {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [planFilter, setPlanFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '15' });
            if (search) params.set('search', search);
            if (planFilter) params.set('plan', planFilter);

            const r = await fetch(`/api/admin/workspaces?${params}`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            setWorkspaces(data.workspaces);
            setTotalPages(data.totalPages);
            setTotal(data.total);
        } catch (err: any) { setError(err.message); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [page, planFilter]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchData();
    };

    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Clienti</h1>
                <p className="text-sm text-slate-400 mt-1">Gestisci workspace e clienti del SaaS</p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Cerca workspace..."
                            className="w-full pl-10 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                        />
                    </div>
                </form>

                <div className="flex items-center gap-2">
                    {['', 'free', 'starter', 'pro', 'enterprise'].map(p => (
                        <button key={p} onClick={() => { setPlanFilter(p); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${planFilter === p
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                                : 'bg-black/20 text-slate-400 border-white/5 hover:bg-white/5'
                                }`}>
                            {p || 'Tutti'}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />{error}
                </div>
            )}

            {/* Table */}
            <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/5 text-slate-400 text-xs uppercase tracking-wider">
                            <th className="text-left p-4 font-semibold">Workspace</th>
                            <th className="text-left p-4 font-semibold">Piano</th>
                            <th className="text-center p-4 font-semibold">Members</th>
                            <th className="text-left p-4 font-semibold">Creato</th>
                            <th className="text-left p-4 font-semibold">Ultima Attività</th>
                            <th className="text-center p-4 font-semibold">Stato</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="text-center p-8 text-slate-500">Caricamento...</td></tr>
                        ) : workspaces.length === 0 ? (
                            <tr><td colSpan={6} className="text-center p-8 text-slate-500">Nessun workspace trovato</td></tr>
                        ) : workspaces.map(ws => (
                            <tr key={ws.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-cyan-400">
                                            <Building2 className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">{ws.name}</p>
                                            <p className="text-[11px] text-slate-500">/{ws.slug}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4"><PlanBadge plan={ws.plan} /></td>
                                <td className="p-4 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        <Users className="w-3.5 h-3.5 text-slate-500" />
                                        <span className="text-white font-medium">{ws.totalMembers}</span>
                                        <span className="text-slate-600">/ {ws.maxMembers}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-slate-400 text-xs">
                                    {new Date(ws.createdAt).toLocaleDateString('it-IT')}
                                </td>
                                <td className="p-4 text-slate-400 text-xs">
                                    {ws.lastActivity > 0 ? new Date(ws.lastActivity).toLocaleDateString('it-IT') : '—'}
                                </td>
                                <td className="p-4 text-center">
                                    {ws.suspendedMembers > 0 ? (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                                            {ws.suspendedMembers} sospesi
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                            Attivo
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Pagination */}
                <div className="flex items-center justify-between p-4 border-t border-white/5">
                    <span className="text-xs text-slate-500">{total} workspace totali</span>
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
            </div>
        </div>
    );
}
