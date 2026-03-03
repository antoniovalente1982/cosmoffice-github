'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Building2, Users, ChevronLeft, ChevronRight, AlertTriangle,
    Pause, Play, Trash2, RotateCcw, MoreVertical, X, Check, Loader2,
    UserX, UserCheck, Mail,
} from 'lucide-react';

interface Owner {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    suspended: boolean;
    deleted: boolean;
}

interface Workspace {
    id: string;
    name: string;
    slug: string;
    plan: string;
    maxMembers: number;
    totalMembers: number;
    suspendedMembers: number;
    status: 'active' | 'suspended' | 'deleted';
    suspendedAt: string | null;
    deletedAt: string | null;
    createdAt: string;
    lastActivity: number;
    owner: Owner | null;
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

function StatusBadge({ status }: { status: 'active' | 'suspended' | 'deleted' }) {
    const styles = {
        active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        suspended: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        deleted: 'bg-red-500/20 text-red-300 border-red-500/30',
    };
    const labels = { active: 'Attivo', suspended: 'Sospeso', deleted: 'Eliminato' };
    return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${styles[status]}`}>{labels[status]}</span>;
}

function OwnerStatusDot({ suspended, deleted }: { suspended: boolean; deleted: boolean }) {
    if (deleted) return <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Eliminato" />;
    if (suspended) return <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Sospeso" />;
    return <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Attivo" />;
}

export default function CustomersPage() {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [planFilter, setPlanFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    // Action menu
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Confirmation modal
    const [confirmAction, setConfirmAction] = useState<{
        action: string;
        workspaceId: string;
        workspaceName: string;
        ownerId?: string;
        ownerName?: string;
        label: string;
        description: string;
        danger: boolean;
    } | null>(null);

    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '15' });
            if (search) params.set('search', search);
            if (planFilter) params.set('plan', planFilter);
            if (statusFilter) params.set('status', statusFilter);

            const r = await fetch(`/api/admin/workspaces?${params}`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            setWorkspaces(data.workspaces);
            setTotalPages(data.totalPages);
            setTotal(data.total);
        } catch (err: any) { setError(err.message); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [page, planFilter, statusFilter]);

    // Close action menu on outside click
    useEffect(() => {
        const handleClick = () => setActionMenuId(null);
        if (actionMenuId) {
            document.addEventListener('click', handleClick);
            return () => document.removeEventListener('click', handleClick);
        }
    }, [actionMenuId]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchData();
    };

    const showFeedback = (type: 'success' | 'error', message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    const executeAction = async () => {
        if (!confirmAction) return;
        setActionLoading(true);
        try {
            const body: any = { action: confirmAction.action, workspaceId: confirmAction.workspaceId };
            if (confirmAction.action === 'suspend_owner' || confirmAction.action === 'reactivate_owner') {
                body.data = { ownerId: confirmAction.ownerId };
            }
            const res = await fetch('/api/admin/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            showFeedback('success', `${confirmAction.label} completato`);
            setConfirmAction(null);
            await fetchData();
        } catch (err: any) {
            showFeedback('error', err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const openConfirm = (params: typeof confirmAction) => {
        setActionMenuId(null);
        setConfirmAction(params);
    };

    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Clienti</h1>
                <p className="text-sm text-slate-400 mt-1">Gestisci workspace, proprietari e stati del SaaS</p>
            </div>

            {/* Feedback */}
            <AnimatePresence>
                {feedback && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className={`p-3 rounded-xl border text-sm ${feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
                        <div className="flex items-center gap-2">
                            {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            {feedback.message}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Cerca workspace o owner..."
                            className="w-full pl-10 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                        />
                    </div>
                </form>

                {/* Plan filter */}
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

                {/* Separator */}
                <div className="w-px h-6 bg-white/10"></div>

                {/* Status filter */}
                <div className="flex items-center gap-2">
                    {[
                        { value: '', label: 'Tutti', color: '' },
                        { value: 'active', label: '🟢 Attivi', color: 'text-emerald-300' },
                        { value: 'suspended', label: '🟡 Sospesi', color: 'text-amber-300' },
                        { value: 'deleted', label: '🔴 Eliminati', color: 'text-red-300' },
                    ].map(s => (
                        <button key={s.value} onClick={() => { setStatusFilter(s.value); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${statusFilter === s.value
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                                : `bg-black/20 ${s.color || 'text-slate-400'} border-white/5 hover:bg-white/5`
                                }`}>
                            {s.label}
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
                            <th className="text-left p-4 font-semibold">Owner</th>
                            <th className="text-left p-4 font-semibold">Workspace</th>
                            <th className="text-left p-4 font-semibold">Piano</th>
                            <th className="text-center p-4 font-semibold">Members</th>
                            <th className="text-left p-4 font-semibold">Creato</th>
                            <th className="text-center p-4 font-semibold">Stato</th>
                            <th className="text-center p-4 font-semibold w-12">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="text-center p-8 text-slate-500">Caricamento...</td></tr>
                        ) : workspaces.length === 0 ? (
                            <tr><td colSpan={7} className="text-center p-8 text-slate-500">Nessun workspace trovato</td></tr>
                        ) : workspaces.map(ws => (
                            <tr key={ws.id} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${ws.status === 'deleted' ? 'opacity-50' : ''}`}>
                                {/* Owner */}
                                <td className="p-4">
                                    {ws.owner ? (
                                        <div className="flex items-center gap-2.5">
                                            <div className="relative shrink-0">
                                                {ws.owner.avatarUrl ? (
                                                    <img src={ws.owner.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs uppercase">
                                                        {ws.owner.name[0]}
                                                    </div>
                                                )}
                                                <div className="absolute -bottom-0.5 -right-0.5">
                                                    <OwnerStatusDot suspended={ws.owner.suspended} deleted={ws.owner.deleted} />
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-white truncate">{ws.owner.name}</p>
                                                <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                                                    <Mail className="w-2.5 h-2.5 shrink-0" />{ws.owner.email}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-600 italic">N/A</span>
                                    )}
                                </td>

                                {/* Workspace */}
                                <td className="p-4">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                                            <Building2 className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium text-white truncate">{ws.name}</p>
                                            <p className="text-[10px] text-slate-500 truncate">/{ws.slug}</p>
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

                                <td className="p-4 text-center">
                                    <StatusBadge status={ws.status} />
                                </td>

                                {/* Actions */}
                                <td className="p-4 text-center">
                                    <div className="relative">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === ws.id ? null : ws.id); }}
                                            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>

                                        {actionMenuId === ws.id && (
                                            <div className="absolute right-0 top-full mt-1 w-56 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-30 py-1 text-left"
                                                onClick={(e) => e.stopPropagation()}>

                                                {/* Owner actions */}
                                                {ws.owner && (
                                                    <>
                                                        <p className="px-3 py-1.5 text-[10px] text-slate-500 uppercase font-bold tracking-wider">Owner</p>
                                                        {!ws.owner.suspended ? (
                                                            <button onClick={() => openConfirm({
                                                                action: 'suspend_owner', workspaceId: ws.id, ownerId: ws.owner!.id,
                                                                ownerName: ws.owner!.name, workspaceName: ws.name,
                                                                label: 'Sospendi Owner', description: `Sospenderai l'account di ${ws.owner!.name}. Non potrà accedere alla piattaforma.`, danger: true,
                                                            })} className="w-full px-3 py-2 text-left text-xs text-amber-400 hover:bg-white/5 flex items-center gap-2">
                                                                <UserX className="w-3.5 h-3.5" /> Sospendi Owner
                                                            </button>
                                                        ) : (
                                                            <button onClick={() => openConfirm({
                                                                action: 'reactivate_owner', workspaceId: ws.id, ownerId: ws.owner!.id,
                                                                ownerName: ws.owner!.name, workspaceName: ws.name,
                                                                label: 'Riattiva Owner', description: `Riattiverai l'account di ${ws.owner!.name}.`, danger: false,
                                                            })} className="w-full px-3 py-2 text-left text-xs text-emerald-400 hover:bg-white/5 flex items-center gap-2">
                                                                <UserCheck className="w-3.5 h-3.5" /> Riattiva Owner
                                                            </button>
                                                        )}
                                                        <div className="my-1 border-t border-white/5" />
                                                    </>
                                                )}

                                                {/* Workspace actions */}
                                                <p className="px-3 py-1.5 text-[10px] text-slate-500 uppercase font-bold tracking-wider">Workspace</p>
                                                {ws.status === 'active' && (
                                                    <>
                                                        <button onClick={() => openConfirm({
                                                            action: 'suspend_workspace', workspaceId: ws.id, workspaceName: ws.name,
                                                            label: 'Sospendi Workspace', description: `Il workspace "${ws.name}" sarà sospeso. Tutti i membri non potranno accedervi.`, danger: true,
                                                        })} className="w-full px-3 py-2 text-left text-xs text-amber-400 hover:bg-white/5 flex items-center gap-2">
                                                            <Pause className="w-3.5 h-3.5" /> Sospendi
                                                        </button>
                                                        <button onClick={() => openConfirm({
                                                            action: 'delete_workspace', workspaceId: ws.id, workspaceName: ws.name,
                                                            label: 'Elimina Workspace', description: `Il workspace "${ws.name}" sarà eliminato. L'owner riceverà una notifica.`, danger: true,
                                                        })} className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-white/5 flex items-center gap-2">
                                                            <Trash2 className="w-3.5 h-3.5" /> Elimina
                                                        </button>
                                                    </>
                                                )}
                                                {ws.status === 'suspended' && (
                                                    <>
                                                        <button onClick={() => openConfirm({
                                                            action: 'reactivate_workspace', workspaceId: ws.id, workspaceName: ws.name,
                                                            label: 'Riattiva Workspace', description: `Il workspace "${ws.name}" sarà riattivato e tutti i membri sbloccati.`, danger: false,
                                                        })} className="w-full px-3 py-2 text-left text-xs text-emerald-400 hover:bg-white/5 flex items-center gap-2">
                                                            <Play className="w-3.5 h-3.5" /> Riattiva
                                                        </button>
                                                        <button onClick={() => openConfirm({
                                                            action: 'delete_workspace', workspaceId: ws.id, workspaceName: ws.name,
                                                            label: 'Elimina Workspace', description: `Il workspace "${ws.name}" sarà eliminato definitivamente.`, danger: true,
                                                        })} className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-white/5 flex items-center gap-2">
                                                            <Trash2 className="w-3.5 h-3.5" /> Elimina
                                                        </button>
                                                    </>
                                                )}
                                                {ws.status === 'deleted' && (
                                                    <button onClick={() => openConfirm({
                                                        action: 'restore_workspace', workspaceId: ws.id, workspaceName: ws.name,
                                                        label: 'Ripristina Workspace', description: `Il workspace "${ws.name}" sarà ripristinato con tutti i suoi dati.`, danger: false,
                                                    })} className="w-full px-3 py-2 text-left text-xs text-emerald-400 hover:bg-white/5 flex items-center gap-2">
                                                        <RotateCcw className="w-3.5 h-3.5" /> Ripristina
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
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

            {/* Confirmation Modal */}
            <AnimatePresence>
                {confirmAction && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => setConfirmAction(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-full max-w-sm rounded-2xl border p-6 space-y-4 ${confirmAction.danger ? 'border-red-500/30' : 'border-emerald-500/20'}`}
                            style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(30px)' }}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${confirmAction.danger ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}>
                                    {confirmAction.danger
                                        ? <AlertTriangle className="w-5 h-5 text-red-400" />
                                        : <Check className="w-5 h-5 text-emerald-400" />
                                    }
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">{confirmAction.label}</h3>
                                    <p className="text-[11px] text-slate-500">{confirmAction.workspaceName}</p>
                                </div>
                            </div>

                            <p className="text-sm text-slate-300">{confirmAction.description}</p>

                            <p className="text-xs text-slate-500 italic">L'owner riceverà una notifica automatica.</p>

                            <div className="flex gap-3 pt-1">
                                <button onClick={() => setConfirmAction(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:bg-white/5 transition-all">
                                    Annulla
                                </button>
                                <button
                                    onClick={executeAction}
                                    disabled={actionLoading}
                                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2 ${confirmAction.danger
                                        ? 'bg-red-500 hover:bg-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                                        : 'bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                                        }`}
                                >
                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Conferma</>}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
