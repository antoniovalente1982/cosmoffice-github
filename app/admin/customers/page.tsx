'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Building2, Users, ChevronLeft, ChevronRight, AlertTriangle,
    Pause, Play, Trash2, RotateCcw, MoreVertical, X, Check, Loader2,
    UserX, UserCheck, Mail, ChevronDown, Crown, Square, CheckSquare,
    ClipboardList, Save, Calendar,
} from 'lucide-react';
import { createClient } from '../../../utils/supabase/client';

interface Owner {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    isSuperAdmin: boolean;
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
    memberUserIds: string[];
    suspendedMembers: number;
    status: 'active' | 'suspended' | 'deleted';
    suspendedAt: string | null;
    deletedAt: string | null;
    createdAt: string;
    lastActivity: number;
    activeSpaces: number;
    owner: Owner | null;
}

interface OwnerGroup {
    owner: Owner;
    workspaces: Workspace[];
    totalMembers: number;
    uniqueMembers: number;
    activeWs: number;
    suspendedWs: number;
    deletedWs: number;
    bestPlan: string;
}

const planRank: Record<string, number> = { free: 0, team_10: 1, team_25: 2, team_50: 3, enterprise: 4 };
const PLAN_LABELS: Record<string, string> = { free: 'Free', team_10: 'Team 10', team_25: 'Team 25', team_50: 'Team 50', enterprise: 'Enterprise' };
const PLAN_OPTIONS = [
    { value: 'free', label: 'Free', maxPeople: 3, maxSpaces: 1, maxRooms: 5 },
    { value: 'team_10', label: 'Team 10', maxPeople: 10, maxSpaces: 3, maxRooms: 15 },
    { value: 'team_25', label: 'Team 25', maxPeople: 25, maxSpaces: 5, maxRooms: 25 },
    { value: 'team_50', label: 'Team 50', maxPeople: 50, maxSpaces: 10, maxRooms: 50 },
    { value: 'enterprise', label: 'Enterprise', maxPeople: 999, maxSpaces: 999, maxRooms: 999 },
];

function PlanBadge({ plan }: { plan: string }) {
    const c: Record<string, string> = {
        free: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
        team_10: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
        team_25: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        team_50: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        enterprise: 'bg-red-500/20 text-red-300 border-red-500/30',
    };
    return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${c[plan] || c.free}`}>{PLAN_LABELS[plan] || plan}</span>;
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

function OwnerStatusBadge({ suspended, deleted }: { suspended: boolean; deleted: boolean }) {
    if (deleted) return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-red-500/20 text-red-300 border-red-500/30">Eliminato</span>;
    if (suspended) return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-amber-500/20 text-amber-300 border-amber-500/30">Sospeso</span>;
    return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Attivo</span>;
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
    const [summary, setSummary] = useState<{ uniqueUsers: number; totalOwners: number; workspacesActive: number; workspacesSuspended: number; workspacesDeleted: number } | null>(null);

    // Expanded owners
    const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set());

    // Bulk selection
    const [selectedWs, setSelectedWs] = useState<Set<string>>(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);
    const bulkIdsRef = useRef<string[]>([]);

    // Action menu & confirmation
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{
        action: string;
        workspaceId: string;
        workspaceName: string;
        ownerId?: string;
        ownerName?: string;
        label: string;
        description: string;
        danger: boolean;
        confirmWord?: string;
    } | null>(null);
    const [confirmText, setConfirmText] = useState('');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Plan editing inline
    const [editPlanWsId, setEditPlanWsId] = useState<string | null>(null);
    const [editPlanValue, setEditPlanValue] = useState('free');
    const [editPlanExpiry, setEditPlanExpiry] = useState('');
    const [editPlanNotes, setEditPlanNotes] = useState('');
    const [savingPlan, setSavingPlan] = useState(false);

    const startPlanEdit = (ws: Workspace) => {
        setEditPlanWsId(ws.id);
        setEditPlanValue(ws.plan);
        setEditPlanExpiry('');
        setEditPlanNotes('');
        setActionMenuId(null);
    };

    const savePlanEdit = async () => {
        if (!editPlanWsId) return;
        setSavingPlan(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const planDef = PLAN_OPTIONS.find(p => p.value === editPlanValue);
        const { error } = await supabase.from('workspaces').update({
            plan: editPlanValue,
            max_members: planDef?.maxPeople || 3,
            max_spaces: planDef?.maxSpaces || 1,
            max_rooms_per_space: planDef?.maxRooms || 5,
            max_guests: planDef?.maxPeople || 0,
            plan_expires_at: editPlanExpiry || null,
            plan_notes: editPlanNotes || null,
            plan_activated_by: user?.id,
            plan_activated_at: new Date().toISOString(),
        }).eq('id', editPlanWsId);
        if (error) { showFeedback('error', error.message); }
        else { showFeedback('success', 'Piano aggiornato ✅'); setEditPlanWsId(null); fetchData(); }
        setSavingPlan(false);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '50' }); // Fetch more for grouping
            if (search) params.set('search', search);
            if (planFilter) params.set('plan', planFilter);
            if (statusFilter) params.set('status', statusFilter);

            const r = await fetch(`/api/admin/workspaces?${params}`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            setWorkspaces(data.workspaces);
            setTotalPages(data.totalPages);
            setTotal(data.total);
            if (data.summary) setSummary(data.summary);
        } catch (err: any) { setError(err.message); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [page, planFilter, statusFilter]);

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

    // ─── Group by owner ─────────────────────────────
    const ownerGroups = useMemo<OwnerGroup[]>(() => {
        const map = new Map<string, OwnerGroup>();
        const noOwner: Workspace[] = [];

        workspaces.forEach(ws => {
            if (!ws.owner) { noOwner.push(ws); return; }
            const key = ws.owner.id;
            if (!map.has(key)) {
                map.set(key, {
                    owner: ws.owner,
                    workspaces: [],
                    totalMembers: 0,
                    uniqueMembers: 0,
                    activeWs: 0, suspendedWs: 0, deletedWs: 0,
                    bestPlan: 'free',
                });
            }
            const group = map.get(key)!;
            group.workspaces.push(ws);
            group.totalMembers += ws.totalMembers;
            if (ws.status === 'active') group.activeWs++;
            else if (ws.status === 'suspended') group.suspendedWs++;
            else group.deletedWs++;
            if ((planRank[ws.plan] || 0) > (planRank[group.bestPlan] || 0)) {
                group.bestPlan = ws.plan;
            }
        });

        // Compute unique members per owner
        const groups = Array.from(map.values());
        groups.forEach(group => {
            const uniqueIds = new Set<string>();
            group.workspaces.forEach(ws => {
                (ws.memberUserIds || []).forEach(uid => uniqueIds.add(uid));
            });
            group.uniqueMembers = uniqueIds.size;
            group.totalMembers = group.workspaces.reduce((s, w) => s + w.totalMembers, 0);
        });
        // Sort: most workspaces first
        groups.sort((a, b) => b.workspaces.length - a.workspaces.length);

        // Add "no owner" group if any
        if (noOwner.length > 0) {
            groups.push({
                owner: { id: '__none__', email: '', name: 'Senza Proprietario', avatarUrl: null, isSuperAdmin: false, suspended: false, deleted: false },
                workspaces: noOwner,
                totalMembers: noOwner.reduce((s, w) => s + w.totalMembers, 0),
                uniqueMembers: new Set(noOwner.flatMap(w => w.memberUserIds || [])).size,
                activeWs: noOwner.filter(w => w.status === 'active').length,
                suspendedWs: noOwner.filter(w => w.status === 'suspended').length,
                deletedWs: noOwner.filter(w => w.status === 'deleted').length,
                bestPlan: 'free',
            });
        }

        return groups;
    }, [workspaces]);

    const toggleOwner = (ownerId: string) => {
        setExpandedOwners(prev => {
            const next = new Set(prev);
            if (next.has(ownerId)) next.delete(ownerId);
            else next.add(ownerId);
            return next;
        });
    };

    const toggleSelectWs = (id: string) => {
        setSelectedWs(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAllVisible = () => {
        const allIds = workspaces.filter(w => w.status !== 'deleted').map(w => w.id);
        setSelectedWs(new Set(allIds));
        // Expand all owners so user can see what's selected
        setExpandedOwners(new Set(ownerGroups.map(g => g.owner.id)));
    };

    const deselectAll = () => setSelectedWs(new Set());

    const executeBulkAction = async (action: 'bulk_delete' | 'bulk_suspend' | 'bulk_reactivate') => {
        if (selectedWs.size === 0) return;
        setBulkLoading(true);
        try {
            const res = await fetch('/api/admin/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, workspaceIds: Array.from(selectedWs) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            const msgs: Record<string, string> = {
                bulk_delete: `${selectedWs.size} workspace eliminati definitivamente`,
                bulk_suspend: `${selectedWs.size} workspace sospesi`,
                bulk_reactivate: `${selectedWs.size} workspace riattivati`,
            };
            showFeedback('success', msgs[action]);
            setSelectedWs(new Set());
            await fetchData();
        } catch (err: any) {
            showFeedback('error', err.message);
        } finally {
            setBulkLoading(false);
        }
    };

    // ─── Actions ────────────────────────────────────
    const showFeedback = (type: 'success' | 'error', message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    const executeAction = async () => {
        if (!confirmAction) return;
        if (confirmAction.confirmWord && confirmText !== confirmAction.confirmWord) return;

        // Route bulk actions
        if (confirmAction.action === 'bulk_delete' || confirmAction.action === 'bulk_suspend' || confirmAction.action === 'bulk_reactivate') {
            const action = confirmAction.action as 'bulk_delete' | 'bulk_suspend' | 'bulk_reactivate';
            const wsIds = bulkIdsRef.current;
            console.log('[BULK] Executing', action, 'with IDs:', wsIds);

            if (wsIds.length === 0) {
                console.warn('[BULK] No IDs to process!');
                showFeedback('error', 'Nessun workspace selezionato');
                setConfirmAction(null);
                setConfirmText('');
                return;
            }

            setConfirmAction(null);
            setConfirmText('');
            setBulkLoading(true);
            try {
                const res = await fetch('/api/admin/workspaces', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action, workspaceIds: wsIds }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                const msgs: Record<string, string> = {
                    bulk_delete: `${wsIds.length} workspace eliminati definitivamente`,
                    bulk_suspend: `${wsIds.length} workspace sospesi`,
                    bulk_reactivate: `${wsIds.length} workspace riattivati`,
                };
                showFeedback('success', msgs[action]);
                setSelectedWs(new Set());
                await fetchData();
            } catch (err: any) {
                showFeedback('error', err.message);
            } finally {
                setBulkLoading(false);
            }
            return;
        }

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
            setConfirmText('');
            await fetchData();
        } catch (err: any) {
            showFeedback('error', err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const openConfirm = (params: typeof confirmAction) => {
        setActionMenuId(null);
        setConfirmText('');
        // Capture bulk IDs in ref at this exact moment
        if (params?.action === 'bulk_delete' || params?.action === 'bulk_suspend' || params?.action === 'bulk_reactivate') {
            if (params.ownerId) {
                const ownerGroup = ownerGroups.find(g => g.owner.id === params.ownerId);
                bulkIdsRef.current = ownerGroup ? ownerGroup.workspaces.map(w => w.id) : [];
            } else {
                bulkIdsRef.current = Array.from(selectedWs);
            }
            console.log('[BULK] IDs captured in ref:', bulkIdsRef.current);
        }
        setConfirmAction(params);
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Clienti</h1>
                <p className="text-sm text-slate-400 mt-1">Gestisci proprietari, workspace e stati del SaaS</p>
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

                <div className="flex items-center gap-2">
                    {['', 'free', 'team_10', 'team_25', 'team_50', 'enterprise'].map(p => (
                        <button key={p} onClick={() => { setPlanFilter(p); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${planFilter === p
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                                : 'bg-black/20 text-slate-400 border-white/5 hover:bg-white/5'
                                }`}>
                            {PLAN_LABELS[p] || 'Tutti'}
                        </button>
                    ))}
                </div>

                <div className="w-px h-6 bg-white/10" />

                <div className="flex items-center gap-2">
                    {[
                        { value: '', label: 'Tutti' },
                        { value: 'active', label: '🟢 Attivi' },
                        { value: 'suspended', label: '🟡 Sospesi' },
                        { value: 'deleted', label: '🔴 Eliminati' },
                    ].map(s => (
                        <button key={s.value} onClick={() => { setStatusFilter(s.value); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${statusFilter === s.value
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                                : 'bg-black/20 text-slate-400 border-white/5 hover:bg-white/5'
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

            {/* Summary Stats Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-white/5 p-4" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <Users className="w-4 h-4 text-cyan-400" />
                            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Utenti Unici</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{summary.uniqueUsers}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{summary.totalOwners} proprietari</p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/10 p-4" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <Building2 className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Workspace Attivi</span>
                        </div>
                        <p className="text-2xl font-bold text-emerald-300">{summary.workspacesActive}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">su {total} totali</p>
                    </div>
                    <div className="rounded-xl border border-amber-500/10 p-4" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <Pause className="w-4 h-4 text-amber-400" />
                            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Workspace Sospesi</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-300">{summary.workspacesSuspended}</p>
                    </div>
                </div>
            )}

            {/* Owner Groups */}
            <div className="space-y-3">
                {ownerGroups.length === 0 && !loading && (
                    <div className="text-center py-12 text-slate-500 text-sm">Nessun risultato trovato</div>
                )}

                {ownerGroups.map(group => {
                    const isExpanded = expandedOwners.has(group.owner.id);
                    const isNoOwner = group.owner.id === '__none__';

                    return (
                        <div key={group.owner.id}
                            className="rounded-2xl border border-white/5"
                            style={{ background: 'rgba(15, 23, 42, 0.5)' }}>

                            {/* Owner Row (header) */}
                            <button
                                onClick={() => toggleOwner(group.owner.id)}
                                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors text-left"
                            >
                                {/* Avatar */}
                                <div className="relative shrink-0">
                                    {isNoOwner ? (
                                        <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-500">
                                            <Users className="w-5 h-5" />
                                        </div>
                                    ) : group.owner.avatarUrl ? (
                                        <img src={group.owner.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-white font-bold text-sm uppercase ring-2 ring-white/10">
                                            {group.owner.name[0]}
                                        </div>
                                    )}
                                    {!isNoOwner && (
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${group.owner.deleted ? 'bg-red-500' : group.owner.suspended ? 'bg-amber-500' : 'bg-emerald-400'}`} />
                                    )}
                                </div>

                                {/* Owner info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-white truncate">{group.owner.name}</p>
                                        {group.owner.isSuperAdmin && (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-amber-500/20 text-amber-300 border-amber-400/40" style={{ textShadow: '0 0 8px rgba(251,191,36,0.3)' }}>
                                                <Crown className="w-3 h-3 inline mr-0.5 -mt-0.5" />Super Admin
                                            </span>
                                        )}
                                        {!isNoOwner && <OwnerStatusBadge suspended={group.owner.suspended} deleted={group.owner.deleted} />}
                                    </div>
                                    {!isNoOwner && (
                                        <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                            <Mail className="w-3 h-3 shrink-0" />{group.owner.email}
                                        </p>
                                    )}
                                </div>

                                {/* Metrics */}
                                <div className="hidden md:flex items-center gap-4 shrink-0">
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                                        <span className="text-white font-medium">{group.workspaces.length}</span>
                                        <span className="text-slate-600">ws</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <Users className="w-3.5 h-3.5 text-purple-400" />
                                        <span className="text-white font-medium">{group.uniqueMembers}</span>
                                        <span className="text-slate-600">utenti unici</span>
                                    </div>
                                    <PlanBadge plan={group.bestPlan} />
                                    {group.suspendedWs > 0 && (
                                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                            {group.suspendedWs} sospesi
                                        </span>
                                    )}
                                    {group.deletedWs > 0 && (
                                        <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                                            {group.deletedWs} eliminati
                                        </span>
                                    )}
                                </div>

                                {/* Owner actions — hidden for Super Admins (managed in Gestione Super Admin) */}
                                {!isNoOwner && !group.owner.isSuperAdmin && (
                                    <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === `owner-${group.owner.id}` ? null : `owner-${group.owner.id}`); }}
                                            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                        {actionMenuId === `owner-${group.owner.id}` && (
                                            <div className="absolute right-0 top-full mt-1 w-56 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-30 py-1 text-left">
                                                <p className="px-3 py-1.5 text-[10px] text-slate-500 uppercase font-bold tracking-wider">Gestione Owner</p>
                                                {!group.owner.suspended ? (
                                                    <button onClick={() => openConfirm({
                                                        action: 'suspend_owner', workspaceId: group.workspaces[0]?.id || '', ownerId: group.owner.id,
                                                        ownerName: group.owner.name, workspaceName: group.owner.name,
                                                        label: 'Sospendi Owner', description: `Sospenderai l'account di ${group.owner.name}. Non potrà accedere alla piattaforma.`, danger: true, confirmWord: 'SOSPENDI',
                                                    })} className="w-full px-3 py-2 text-left text-xs text-amber-400 hover:bg-white/5 flex items-center gap-2">
                                                        <Pause className="w-3.5 h-3.5" /> Sospendi Owner
                                                    </button>
                                                ) : (
                                                    <button onClick={() => openConfirm({
                                                        action: 'reactivate_owner', workspaceId: group.workspaces[0]?.id || '', ownerId: group.owner.id,
                                                        ownerName: group.owner.name, workspaceName: group.owner.name,
                                                        label: 'Riattiva Owner', description: `Riattiverai l'account di ${group.owner.name}. Potrà nuovamente accedere.`, danger: false,
                                                    })} className="w-full px-3 py-2 text-left text-xs text-emerald-400 hover:bg-white/5 flex items-center gap-2">
                                                        <Play className="w-3.5 h-3.5" /> Riattiva Owner
                                                    </button>
                                                )}
                                                <div className="border-t border-white/5 my-1" />
                                                <button onClick={() => openConfirm({
                                                    action: 'bulk_delete', workspaceId: '', workspaceName: `tutti i workspace di ${group.owner.name}`,
                                                    label: `Elimina tutti i workspace di ${group.owner.name}`,
                                                    description: `Eliminerai definitivamente tutti i ${group.workspaces.length} workspace di ${group.owner.name} dal database. L'account owner rimarrà nel sistema per lo storico. Questa azione è IRREVERSIBILE.`,
                                                    danger: true, confirmWord: 'ELIMINA',
                                                    ownerId: group.owner.id,
                                                })} className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-white/5 flex items-center gap-2">
                                                    <Trash2 className="w-3.5 h-3.5" /> Elimina Workspace
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Expand toggle */}
                                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Mobile metrics (visible on small screens) */}
                            <div className="flex md:hidden items-center gap-3 px-5 pb-3 -mt-1">
                                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                    <Building2 className="w-3 h-3" /> {group.workspaces.length} ws
                                </div>
                                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                    <Users className="w-3 h-3" /> {group.uniqueMembers} utenti unici
                                </div>
                                <PlanBadge plan={group.bestPlan} />
                            </div>

                            {/* Expanded workspace list */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
                                        animate={{ height: 'auto', opacity: 1, overflow: 'visible', transitionEnd: { overflow: 'visible' } }}
                                        exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                                        transition={{ duration: 0.2 }}
                                        className="border-t border-white/5"
                                    >
                                        <div className="divide-y divide-white/5">
                                            {/* Select all row */}
                                            {(() => {
                                                const allIds = group.workspaces.map(w => w.id);
                                                const allSelected = allIds.length > 0 && allIds.every(id => selectedWs.has(id));
                                                return (
                                                    <div className="flex items-center gap-3 px-5 py-2 bg-white/[0.02]">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (allSelected) {
                                                                    setSelectedWs(prev => {
                                                                        const next = new Set(prev);
                                                                        allIds.forEach(id => next.delete(id));
                                                                        return next;
                                                                    });
                                                                } else {
                                                                    setSelectedWs(prev => {
                                                                        const next = new Set(prev);
                                                                        allIds.forEach(id => next.add(id));
                                                                        return next;
                                                                    });
                                                                }
                                                            }}
                                                            className="shrink-0"
                                                        >
                                                            {allSelected
                                                                ? <CheckSquare className="w-4 h-4 text-cyan-400" />
                                                                : <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                                                            }
                                                        </button>
                                                        <span className="text-[11px] text-slate-500 font-medium">
                                                            {allSelected ? 'Deseleziona tutti' : `Seleziona tutti (${allIds.length})`}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                            {group.workspaces.map(ws => (
                                                <div key={ws.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors ${ws.status === 'deleted' ? 'opacity-40' : ''}`}>
                                                    {/* Checkbox */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleSelectWs(ws.id); }}
                                                        className="shrink-0"
                                                    >
                                                        {selectedWs.has(ws.id)
                                                            ? <CheckSquare className="w-4 h-4 text-cyan-400" />
                                                            : <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                                                        }
                                                    </button>

                                                    {/* Icon */}
                                                    <div className="shrink-0">
                                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-cyan-400">
                                                            <Building2 className="w-4 h-4" />
                                                        </div>
                                                    </div>

                                                    {/* Workspace info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-white truncate">{ws.name}</p>
                                                        <p className="text-[10px] text-slate-500 truncate">/{ws.slug}</p>
                                                    </div>

                                                    {/* Usage bar */}
                                                    <div className="hidden sm:flex items-center gap-2 shrink-0" style={{ minWidth: 120 }}>
                                                        <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                                                            <div style={{
                                                                width: `${Math.min(100, (ws.totalMembers / Math.max(ws.maxMembers, 1)) * 100)}%`,
                                                                height: '100%', borderRadius: 3,
                                                                background: ws.totalMembers >= ws.maxMembers ? '#ef4444' : ws.totalMembers >= ws.maxMembers * 0.8 ? '#f59e0b' : '#22c55e',
                                                            }} />
                                                        </div>
                                                        <span className="text-[11px] text-slate-400 font-mono shrink-0">{ws.totalMembers}/{ws.maxMembers}</span>
                                                    </div>

                                                    {/* Spaces count */}
                                                    {ws.activeSpaces > 0 && (
                                                        <span className="text-[10px] text-slate-500 shrink-0">
                                                            {ws.activeSpaces} uffici
                                                        </span>
                                                    )}

                                                    {/* Created */}
                                                    <span className="hidden lg:block text-xs text-slate-500 shrink-0 w-20">
                                                        {new Date(ws.createdAt).toLocaleDateString('it-IT')}
                                                    </span>

                                                    {/* Status — only show if not active */}
                                                    {ws.status !== 'active' && <StatusBadge status={ws.status} />}

                                                    {/* Empty workspace badge */}
                                                    {ws.activeSpaces === 0 && ws.status === 'active' && (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-red-500/20 text-red-300 border-red-500/30 animate-pulse">
                                                            Vuoto
                                                        </span>
                                                    )}

                                                    {/* Actions */}
                                                    <div className="relative shrink-0">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === ws.id ? null : ws.id); }}
                                                            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
                                                        >
                                                            <MoreVertical className="w-4 h-4" />
                                                        </button>

                                                        {actionMenuId === ws.id && (
                                                            <div className="absolute right-0 top-full mt-1 w-52 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-30 py-1 text-left"
                                                                onClick={e => e.stopPropagation()}>
                                                                <p className="px-3 py-1.5 text-[10px] text-slate-500 uppercase font-bold tracking-wider">Piano</p>
                                                                <button onClick={() => startPlanEdit(ws)} className="w-full px-3 py-2 text-left text-xs text-cyan-400 hover:bg-white/5 flex items-center gap-2">
                                                                    <ClipboardList className="w-3.5 h-3.5" /> Cambia Piano
                                                                </button>
                                                                <div className="border-t border-white/5 my-1" />
                                                                <p className="px-3 py-1.5 text-[10px] text-slate-500 uppercase font-bold tracking-wider">Workspace</p>
                                                                {ws.status === 'active' && (
                                                                    <>
                                                                        <button onClick={() => openConfirm({
                                                                            action: 'suspend_workspace', workspaceId: ws.id, workspaceName: ws.name,
                                                                            label: 'Sospendi Workspace', description: `Il workspace "${ws.name}" sarà sospeso. Tutti i membri non potranno accedervi.`, danger: true, confirmWord: 'SOSPENDI',
                                                                        })} className="w-full px-3 py-2 text-left text-xs text-amber-400 hover:bg-white/5 flex items-center gap-2">
                                                                            <Pause className="w-3.5 h-3.5" /> Sospendi
                                                                        </button>
                                                                        <button onClick={() => openConfirm({
                                                                            action: 'delete_workspace', workspaceId: ws.id, workspaceName: ws.name,
                                                                            label: 'Elimina Workspace', description: `Il workspace "${ws.name}" sarà eliminato. L'owner riceverà una notifica.`, danger: true, confirmWord: 'ELIMINA',
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
                                                                            label: 'Elimina Workspace', description: `Il workspace "${ws.name}" sarà eliminato definitivamente dal database. Questa azione è IRREVERSIBILE.`, danger: true, confirmWord: 'ELIMINA',
                                                                        })} className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-white/5 flex items-center gap-2">
                                                                            <Trash2 className="w-3.5 h-3.5" /> Elimina Definitivamente
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {ws.status === 'deleted' && (
                                                                    <button onClick={() => openConfirm({
                                                                        action: 'delete_workspace', workspaceId: ws.id, workspaceName: ws.name,
                                                                        label: 'Elimina dal Database', description: `Il workspace "${ws.name}" (già eliminato dall'utente) sarà rimosso definitivamente dal database. Questa azione è IRREVERSIBILE.`, danger: true, confirmWord: 'ELIMINA',
                                                                    })} className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-white/5 flex items-center gap-2">
                                                                        <Trash2 className="w-3.5 h-3.5" /> Elimina dal DB
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Inline Plan Editor */}
                                                    {editPlanWsId === ws.id && (
                                                        <div className="col-span-full mt-2 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10" onClick={e => e.stopPropagation()}>
                                                            <div className="flex items-center gap-3 flex-wrap">
                                                                <select value={editPlanValue} onChange={e => setEditPlanValue(e.target.value)}
                                                                    className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white outline-none">
                                                                    {PLAN_OPTIONS.map(p => <option key={p.value} value={p.value} style={{ background: '#0f172a' }}>{p.label} (max {p.maxPeople})</option>)}
                                                                </select>
                                                                <input type="date" value={editPlanExpiry} onChange={e => setEditPlanExpiry(e.target.value)}
                                                                    placeholder="Scadenza" className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white outline-none" />
                                                                <input type="text" value={editPlanNotes} onChange={e => setEditPlanNotes(e.target.value)}
                                                                    placeholder="Note (es: Bonifico ricevuto...)" className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white outline-none placeholder:text-slate-600" />
                                                                <button onClick={savePlanEdit} disabled={savingPlan}
                                                                    className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-purple-500 hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5">
                                                                    <Save className="w-3.5 h-3.5" />{savingPlan ? 'Salvo...' : 'Salva'}
                                                                </button>
                                                                <button onClick={() => setEditPlanWsId(null)} className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white border border-white/10">
                                                                    Annulla
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between py-2">
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
            )}
            {/* Floating Bulk Action Bar */}
            <AnimatePresence>
                {selectedWs.size > 0 && (
                    <motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-6 py-3 rounded-2xl border border-cyan-500/20 shadow-2xl"
                        style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(20px)' }}
                    >
                        <span className="text-sm font-medium text-white">
                            <span className="text-cyan-400 font-bold">{selectedWs.size}</span> workspace selezionati
                        </span>

                        <div className="w-px h-5 bg-white/10" />

                        <button onClick={selectAllVisible}
                            className="text-xs text-slate-400 hover:text-white transition-colors">
                            Seleziona tutti
                        </button>
                        <button onClick={deselectAll}
                            className="text-xs text-slate-400 hover:text-white transition-colors">
                            Deseleziona
                        </button>

                        <div className="w-px h-5 bg-white/10" />

                        <button
                            onClick={() => openConfirm({
                                action: 'bulk_reactivate', workspaceId: '', workspaceName: `${selectedWs.size} workspace`,
                                label: `Riattiva ${selectedWs.size} Workspace`,
                                description: `Riattiverai ${selectedWs.size} workspace contemporaneamente. Tutti i membri verranno sbloccati.`,
                                danger: false,
                            })}
                            disabled={bulkLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all disabled:opacity-40"
                        >
                            <Play className="w-3.5 h-3.5" /> Riattiva
                        </button>

                        <button
                            onClick={() => openConfirm({
                                action: 'bulk_suspend', workspaceId: '', workspaceName: `${selectedWs.size} workspace`,
                                label: `Sospendi ${selectedWs.size} Workspace`,
                                description: `Sospenderai ${selectedWs.size} workspace contemporaneamente. Tutti i membri verranno bloccati.`,
                                danger: true, confirmWord: 'SOSPENDI',
                            })}
                            disabled={bulkLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all disabled:opacity-40"
                        >
                            <Pause className="w-3.5 h-3.5" /> Sospendi
                        </button>

                        <button
                            onClick={() => openConfirm({
                                action: 'bulk_delete', workspaceId: '', workspaceName: `${selectedWs.size} workspace`,
                                label: `Elimina ${selectedWs.size} Workspace`,
                                description: `Eliminerai definitivamente ${selectedWs.size} workspace dal database. Questa azione è IRREVERSIBILE.`,
                                danger: true, confirmWord: 'ELIMINA',
                            })}
                            disabled={bulkLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-40"
                        >
                            {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Elimina
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirmation Modal */}
            <AnimatePresence>
                {confirmAction && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => { setConfirmAction(null); setConfirmText(''); }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-full max-w-md rounded-2xl border p-6 space-y-4 ${confirmAction.danger ? 'border-red-500/30' : 'border-emerald-500/20'}`}
                            style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(30px)' }}
                        >
                            <div className="flex items-start justify-between">
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
                                <button onClick={() => { setConfirmAction(null); setConfirmText(''); }} className="text-slate-500 hover:text-slate-300">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {confirmAction.danger ? (
                                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                        <p className="text-xs text-red-300/80">{confirmAction.description}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-300">{confirmAction.description}</p>
                            )}

                            <p className="text-xs text-slate-500 italic flex items-center gap-1.5">
                                <Mail className="w-3 h-3" /> L'owner riceverà una notifica automatica.
                            </p>

                            {confirmAction.confirmWord && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                        Scrivi <span className="text-red-400 font-bold font-mono">{confirmAction.confirmWord}</span> per confermare
                                    </label>
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                                        placeholder={confirmAction.confirmWord}
                                        className="w-full bg-slate-900/50 border-2 border-red-500/20 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-red-500/50 outline-none transition-colors font-mono tracking-widest text-center uppercase"
                                        autoFocus
                                    />
                                </div>
                            )}

                            <div className="flex gap-3 pt-1">
                                <button onClick={() => { setConfirmAction(null); setConfirmText(''); }} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:bg-white/5 transition-all">
                                    Annulla
                                </button>
                                <button
                                    onClick={executeAction}
                                    disabled={actionLoading || (!!confirmAction.confirmWord && confirmText !== confirmAction.confirmWord)}
                                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${confirmAction.danger
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
