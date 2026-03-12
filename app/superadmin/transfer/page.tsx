'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Crown,
    Search,
    UserPlus,
    ArrowRightLeft,
    ShieldOff,
    AlertTriangle,
    Check,
    X,
    History,
    Users,
    ChevronDown,
    Loader2,
    ShieldAlert,
    ArrowRight,
    Mail,
} from 'lucide-react';

type UserProfile = {
    id: string;
    email: string;
    full_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_super_admin: boolean;
};

type Transfer = {
    id: string;
    transfer_type: 'transfer' | 'grant' | 'revoke';
    reason: string | null;
    created_at: string;
    from_user: UserProfile;
    to_user: UserProfile;
};

const getUserName = (user: UserProfile) =>
    user.display_name || user.full_name || user.email || 'Unknown';

// ─── Avatar Component ────────────────────────────
function UserAvatar({ user, size = 'md', ring }: { user: UserProfile; size?: 'sm' | 'md'; ring?: string }) {
    const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
    if (user.avatar_url) {
        return <img src={user.avatar_url} alt="" className={`${sizeClass} rounded-full object-cover ${ring || ''}`} />;
    }
    return (
        <div className={`${sizeClass} rounded-full bg-slate-700/50 flex items-center justify-center text-slate-300 font-bold uppercase ${ring || ''}`}>
            {getUserName(user)[0]}
        </div>
    );
}

export default function TransferPage() {
    const [admins, setAdmins] = useState<UserProfile[]>([]);
    const [currentUserId, setCurrentUserId] = useState('');
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Co-Admin search
    const [coAdminSearch, setCoAdminSearch] = useState('');
    const [coAdminResults, setCoAdminResults] = useState<UserProfile[]>([]);
    const [coAdminSearching, setCoAdminSearching] = useState(false);
    const [grantTarget, setGrantTarget] = useState<UserProfile | null>(null);
    const [grantReason, setGrantReason] = useState('');
    const [grantLoading, setGrantLoading] = useState(false);

    // Danger zone — revoke
    const [revokeTarget, setRevokeTarget] = useState<UserProfile | null>(null);
    const [revokeConfirmText, setRevokeConfirmText] = useState('');
    const [revokeReason, setRevokeReason] = useState('');
    const [revokeLoading, setRevokeLoading] = useState(false);

    // Danger zone — transfer (multi-step)
    const [transferStep, setTransferStep] = useState<0 | 1 | 2 | 3>(0); // 0=closed, 1=search, 2=confirm, 3=final
    const [transferSearch, setTransferSearch] = useState('');
    const [transferResults, setTransferResults] = useState<UserProfile[]>([]);
    const [transferSearching, setTransferSearching] = useState(false);
    const [transferTarget, setTransferTarget] = useState<UserProfile | null>(null);
    const [transferReason, setTransferReason] = useState('');
    const [transferConfirmText, setTransferConfirmText] = useState('');
    const [transferLoading, setTransferLoading] = useState(false);

    // History
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    // ─── Load data ──────────────────────────────────
    const refreshData = async () => {
        const [adminsRes, historyRes] = await Promise.all([
            fetch('/api/admin/transfer?action=admins'),
            fetch('/api/admin/transfer?action=history'),
        ]);
        const adminsData = await adminsRes.json();
        const historyData = await historyRes.json();
        setAdmins(adminsData.admins || []);
        setCurrentUserId(adminsData.currentUserId || '');
        setTransfers(historyData.transfers || []);
    };

    useEffect(() => {
        refreshData().then(() => setLoading(false));
    }, []);

    // ─── Co-Admin Search ────────────────────────────
    useEffect(() => {
        if (!coAdminSearch.trim()) { setCoAdminResults([]); return; }
        const timeout = setTimeout(async () => {
            setCoAdminSearching(true);
            const res = await fetch(`/api/admin/transfer?search=${encodeURIComponent(coAdminSearch)}`);
            const data = await res.json();
            // Filter out existing admins
            setCoAdminResults((data.users || []).filter((u: UserProfile) => !u.is_super_admin));
            setCoAdminSearching(false);
        }, 300);
        return () => clearTimeout(timeout);
    }, [coAdminSearch]);

    // ─── Transfer Search ────────────────────────────
    useEffect(() => {
        if (!transferSearch.trim()) { setTransferResults([]); return; }
        const timeout = setTimeout(async () => {
            setTransferSearching(true);
            const res = await fetch(`/api/admin/transfer?search=${encodeURIComponent(transferSearch)}`);
            const data = await res.json();
            setTransferResults((data.users || []).filter((u: UserProfile) => !u.is_super_admin));
            setTransferSearching(false);
        }, 300);
        return () => clearTimeout(timeout);
    }, [transferSearch]);

    // ─── Actions ────────────────────────────────────
    const showFeedback = (type: 'success' | 'error', message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 5000);
    };

    const handleGrant = async () => {
        if (!grantTarget) return;
        setGrantLoading(true);
        try {
            const res = await fetch('/api/admin/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'grant', targetUserId: grantTarget.id, reason: grantReason }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showFeedback('success', `${getUserName(grantTarget)} è ora un Super Admin`);
            setGrantTarget(null); setGrantReason(''); setCoAdminSearch(''); setCoAdminResults([]);
            await refreshData();
        } catch (err: any) {
            showFeedback('error', err.message);
        } finally { setGrantLoading(false); }
    };

    const handleRevoke = async () => {
        if (!revokeTarget || revokeConfirmText !== 'REVOCA') return;
        setRevokeLoading(true);
        try {
            const res = await fetch('/api/admin/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'revoke', targetUserId: revokeTarget.id, reason: revokeReason }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showFeedback('success', `Accesso admin revocato per ${getUserName(revokeTarget)}`);
            setRevokeTarget(null); setRevokeConfirmText(''); setRevokeReason('');
            await refreshData();
        } catch (err: any) {
            showFeedback('error', err.message);
        } finally { setRevokeLoading(false); }
    };

    const handleTransfer = async () => {
        if (!transferTarget || transferConfirmText !== 'TRANSFER') return;
        setTransferLoading(true);
        try {
            const res = await fetch('/api/admin/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'transfer', targetUserId: transferTarget.id, reason: transferReason }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showFeedback('success', 'Proprietà trasferita. Verrai reindirizzato...');
            setTimeout(() => { window.location.href = '/office'; }, 2500);
        } catch (err: any) {
            showFeedback('error', err.message);
            setTransferLoading(false);
        }
    };

    const resetTransfer = () => {
        setTransferStep(0); setTransferTarget(null); setTransferSearch('');
        setTransferResults([]); setTransferReason(''); setTransferConfirmText('');
    };

    const typeLabels: Record<string, { label: string; color: string; icon: any }> = {
        transfer: { label: 'Trasferimento', color: 'text-amber-400', icon: ArrowRightLeft },
        grant: { label: 'Concessione', color: 'text-emerald-400', icon: UserPlus },
        revoke: { label: 'Revoca', color: 'text-red-400', icon: ShieldOff },
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                        <Crown className="w-5 h-5 text-white" />
                    </div>
                    Gestione Super Admin
                </h1>
                <p className="text-slate-400 mt-2">
                    Gestisci chi ha accesso alla dashboard di amministrazione. Ogni azione viene registrata.
                </p>
            </div>

            {/* Feedback */}
            <AnimatePresence>
                {feedback && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`p-4 rounded-xl border ${feedback.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                            : 'bg-red-500/10 border-red-500/20 text-red-300'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            {feedback.message}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══════════════════════════════════════════════ */}
            {/* SECTION 1: Current Super Admins (read-only)    */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="rounded-2xl border border-white/5 overflow-hidden"
                style={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(20px)' }}>
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-400" />
                        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Super Admin Attuali</h2>
                    </div>
                    <span className="text-xs text-slate-500 bg-slate-800/50 px-2.5 py-1 rounded-full">
                        {admins.length} {admins.length === 1 ? 'admin' : 'admins'}
                    </span>
                </div>
                <div className="divide-y divide-white/5">
                    {admins.map((admin) => (
                        <div key={admin.id} className="px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                            <UserAvatar user={admin} ring="ring-2 ring-amber-400/30" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white flex items-center gap-2">
                                    {getUserName(admin)}
                                    {admin.id === currentUserId && (
                                        <span className="text-[10px] uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">Tu</span>
                                    )}
                                </p>
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <Mail className="w-3 h-3" />{admin.email}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══════════════════════════════════════════════ */}
            {/* SECTION 2: Add Co-Admin (safe zone)            */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="rounded-2xl border border-emerald-500/10 overflow-hidden"
                style={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(20px)' }}>
                <div className="px-6 py-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-emerald-400" />
                        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Aggiungi Co-Admin</h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Cerca un utente registrato e concedigli l'accesso alla dashboard admin. Puoi revocarlo in seguito.
                    </p>
                </div>
                <div className="p-6">
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Cerca per email o nome..."
                            value={coAdminSearch}
                            onChange={(e) => setCoAdminSearch(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/50 outline-none transition-colors"
                        />
                        {coAdminSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 animate-spin" />}
                    </div>

                    {coAdminResults.length > 0 && (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {coAdminResults.map((user) => (
                                <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/30 border border-white/5 hover:border-emerald-500/20 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <UserAvatar user={user} size="sm" />
                                        <div>
                                            <p className="text-sm font-medium text-white">{getUserName(user)}</p>
                                            <p className="text-xs text-slate-500">{user.email}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setGrantTarget(user)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 transition-all"
                                    >
                                        <UserPlus className="w-3.5 h-3.5" />
                                        Aggiungi
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {coAdminSearch && !coAdminSearching && coAdminResults.length === 0 && (
                        <p className="text-sm text-slate-500 text-center py-6">Nessun utente trovato per &quot;{coAdminSearch}&quot;</p>
                    )}
                </div>
            </section>

            {/* ═══════════════════════════════════════════════ */}
            {/* SECTION 3: DANGER ZONE                         */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="rounded-2xl border-2 border-red-500/30 overflow-hidden"
                style={{ background: 'linear-gradient(180deg, rgba(127,29,29,0.08) 0%, rgba(15,23,42,0.4) 100%)', backdropFilter: 'blur(20px)' }}>
                <div className="px-6 py-4 border-b border-red-500/20">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-400" />
                        <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider">Danger Zone</h2>
                    </div>
                    <p className="text-xs text-red-300/50 mt-1">
                        Azioni irreversibili o ad alto rischio. Procedi con estrema cautela.
                    </p>
                </div>

                <div className="divide-y divide-red-500/10">
                    {/* Revoke Admin */}
                    <div className="px-6 py-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <ShieldOff className="w-4 h-4 text-red-400" />
                                    Revoca Accesso Admin
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Rimuovi i privilegi di super admin da un co-admin. Non puoi revocare l'ultimo admin rimasto.
                                </p>
                            </div>
                        </div>

                        {admins.filter(a => a.id !== currentUserId).length === 0 ? (
                            <p className="text-xs text-slate-600 mt-3 italic">Nessun altro admin da revocare.</p>
                        ) : (
                            <div className="mt-4 space-y-2">
                                {admins.filter(a => a.id !== currentUserId).map((admin) => (
                                    <div key={admin.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/30 border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <UserAvatar user={admin} size="sm" ring="ring-1 ring-amber-400/20" />
                                            <div>
                                                <p className="text-sm font-medium text-white">{getUserName(admin)}</p>
                                                <p className="text-xs text-slate-500">{admin.email}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setRevokeTarget(admin)}
                                            disabled={admins.length <= 1}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <ShieldOff className="w-3.5 h-3.5" />
                                            Revoca
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Transfer Ownership */}
                    <div className="px-6 py-5">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <ArrowRightLeft className="w-4 h-4 text-red-400" />
                                    Trasferisci Proprietà
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Cedi completamente il tuo ruolo di super admin a un altro utente. <strong className="text-red-400">Perderai l'accesso alla dashboard.</strong>
                                </p>
                            </div>
                            {transferStep === 0 && (
                                <button
                                    onClick={() => setTransferStep(1)}
                                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50 transition-all"
                                >
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                    Avvia Trasferimento
                                </button>
                            )}
                        </div>

                        {/* Multi-step Transfer Flow */}
                        <AnimatePresence mode="wait">
                            {transferStep >= 1 && (
                                <motion.div
                                    key={`step-${transferStep}`}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-4 overflow-hidden"
                                >
                                    {/* Step indicator */}
                                    <div className="flex items-center gap-2 mb-4">
                                        {[1, 2, 3].map((s) => (
                                            <div key={s} className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${transferStep >= s
                                                    ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                                                    : 'bg-slate-800 text-slate-500 border border-white/10'
                                                    }`}>
                                                    {transferStep > s ? <Check className="w-3.5 h-3.5" /> : s}
                                                </div>
                                                {s < 3 && (
                                                    <div className={`w-8 h-0.5 rounded ${transferStep > s ? 'bg-red-500' : 'bg-slate-700'}`} />
                                                )}
                                            </div>
                                        ))}
                                        <span className="text-[10px] text-slate-500 uppercase tracking-wider ml-2">
                                            {transferStep === 1 ? 'Seleziona utente' : transferStep === 2 ? 'Conferma dati' : 'Verifica finale'}
                                        </span>
                                        <button onClick={resetTransfer} className="ml-auto text-slate-500 hover:text-slate-300 transition-colors">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Step 1: Search & select user */}
                                    {transferStep === 1 && (
                                        <div>
                                            <div className="relative mb-3">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                                <input
                                                    type="text"
                                                    placeholder="Cerca il nuovo proprietario per email o nome..."
                                                    value={transferSearch}
                                                    onChange={(e) => setTransferSearch(e.target.value)}
                                                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-red-500/50 outline-none transition-colors"
                                                    autoFocus
                                                />
                                                {transferSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400 animate-spin" />}
                                            </div>
                                            {transferResults.length > 0 && (
                                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                                    {transferResults.map((user) => (
                                                        <button
                                                            key={user.id}
                                                            onClick={() => { setTransferTarget(user); setTransferStep(2); }}
                                                            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900/30 border border-white/5 hover:border-red-500/30 transition-colors text-left"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <UserAvatar user={user} size="sm" />
                                                                <div>
                                                                    <p className="text-sm font-medium text-white">{getUserName(user)}</p>
                                                                    <p className="text-xs text-slate-500">{user.email}</p>
                                                                </div>
                                                            </div>
                                                            <ArrowRight className="w-4 h-4 text-slate-500" />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {transferSearch && !transferSearching && transferResults.length === 0 && (
                                                <p className="text-sm text-slate-500 text-center py-4">Nessun utente trovato</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Step 2: Confirm details */}
                                    {transferStep === 2 && transferTarget && (
                                        <div className="space-y-4">
                                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                                <div className="flex items-start gap-3">
                                                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                                    <div className="text-sm">
                                                        <p className="font-semibold text-red-300 mb-1">Attenzione: operazione irreversibile</p>
                                                        <p className="text-red-300/60">
                                                            Stai per cedere tutti i tuoi privilegi di Super Admin. Perderai immediatamente l'accesso a questa dashboard.
                                                            Solo il nuovo proprietario potrà restituirti l'accesso.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Transfer summary card */}
                                            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/50 border border-white/5">
                                                <div className="text-center">
                                                    <UserAvatar user={admins.find(a => a.id === currentUserId) || transferTarget} ring="ring-2 ring-red-400/30" />
                                                    <p className="text-[10px] text-red-400 font-semibold mt-1 uppercase">Tu</p>
                                                </div>
                                                <div className="flex-1 flex items-center justify-center">
                                                    <div className="flex items-center gap-2 text-red-400">
                                                        <div className="w-8 h-0.5 bg-red-500/30 rounded" />
                                                        <ArrowRightLeft className="w-5 h-5" />
                                                        <div className="w-8 h-0.5 bg-red-500/30 rounded" />
                                                    </div>
                                                </div>
                                                <div className="text-center">
                                                    <UserAvatar user={transferTarget} ring="ring-2 ring-emerald-400/30" />
                                                    <p className="text-[10px] text-emerald-400 font-semibold mt-1 uppercase">Nuovo</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/30 border border-white/5">
                                                <div>
                                                    <p className="text-xs text-slate-500">Nuovo proprietario</p>
                                                    <p className="text-sm font-medium text-white">{getUserName(transferTarget)}</p>
                                                    <p className="text-xs text-slate-500">{transferTarget.email}</p>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Motivazione (opzionale)</label>
                                                <input
                                                    type="text"
                                                    value={transferReason}
                                                    onChange={(e) => setTransferReason(e.target.value)}
                                                    placeholder="es. Cessione aziendale, cambio ruolo..."
                                                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-red-500/50 outline-none transition-colors"
                                                />
                                            </div>

                                            <div className="flex gap-3">
                                                <button onClick={() => setTransferStep(1)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:bg-white/5 transition-all">
                                                    ← Indietro
                                                </button>
                                                <button onClick={() => setTransferStep(3)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2">
                                                    Procedi <ArrowRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 3: Final confirmation */}
                                    {transferStep === 3 && transferTarget && (
                                        <div className="space-y-4">
                                            <div className="p-4 rounded-xl bg-red-500/15 border-2 border-red-500/30">
                                                <p className="text-sm font-bold text-red-300 text-center mb-2">⚠️ ULTIMO PASSAGGIO</p>
                                                <p className="text-xs text-red-300/60 text-center">
                                                    Scrivi <strong className="text-red-300 font-mono">TRANSFER</strong> per confermare il trasferimento definitivo a <strong className="text-white">{getUserName(transferTarget)}</strong>.
                                                </p>
                                            </div>

                                            <input
                                                type="text"
                                                value={transferConfirmText}
                                                onChange={(e) => setTransferConfirmText(e.target.value.toUpperCase())}
                                                placeholder="Scrivi TRANSFER"
                                                className="w-full bg-slate-900/50 border-2 border-red-500/30 rounded-xl px-4 py-3 text-center text-sm text-slate-100 placeholder:text-slate-600 focus:border-red-500/60 outline-none transition-colors font-mono tracking-[0.3em] uppercase"
                                                autoFocus
                                            />

                                            <div className="flex gap-3">
                                                <button onClick={() => { setTransferStep(2); setTransferConfirmText(''); }} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:bg-white/5 transition-all">
                                                    ← Indietro
                                                </button>
                                                <button
                                                    onClick={handleTransfer}
                                                    disabled={transferLoading || transferConfirmText !== 'TRANSFER'}
                                                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)]"
                                                >
                                                    {transferLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                                        <>
                                                            <AlertTriangle className="w-4 h-4" />
                                                            Trasferisci Ora
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════ */}
            {/* SECTION 4: Transfer History (collapsible)      */}
            {/* ═══════════════════════════════════════════════ */}
            <section className="rounded-2xl border border-white/5 overflow-hidden"
                style={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(20px)' }}>
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-slate-400" />
                        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Storico Operazioni</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{transfers.length} eventi</span>
                        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                    </div>
                </button>
                <AnimatePresence>
                    {showHistory && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-white/5"
                        >
                            {transfers.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-8">Nessuna operazione registrata</p>
                            ) : (
                                <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
                                    {transfers.map((t) => {
                                        const typeInfo = typeLabels[t.transfer_type] || typeLabels.transfer;
                                        const Icon = typeInfo.icon;
                                        return (
                                            <div key={t.id} className="px-6 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${t.transfer_type === 'transfer' ? 'bg-amber-500/10' :
                                                    t.transfer_type === 'grant' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                                                    }`}>
                                                    <Icon className={`w-4 h-4 ${typeInfo.color}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-slate-200">
                                                        <span className="font-medium">{getUserName(t.from_user)}</span>
                                                        <span className="text-slate-500 mx-2">→</span>
                                                        <span className="font-medium">{getUserName(t.to_user)}</span>
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`text-[10px] uppercase tracking-wider font-semibold ${typeInfo.color}`}>{typeInfo.label}</span>
                                                        {t.reason && <span className="text-xs text-slate-600 truncate">· {t.reason}</span>}
                                                    </div>
                                                </div>
                                                <span className="text-xs text-slate-600 whitespace-nowrap shrink-0">
                                                    {new Date(t.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </section>

            {/* ═══════════════════════════════════════════════ */}
            {/* MODALS                                         */}
            {/* ═══════════════════════════════════════════════ */}

            {/* Grant Co-Admin Modal */}
            <AnimatePresence>
                {grantTarget && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => { setGrantTarget(null); setGrantReason(''); }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md rounded-2xl border border-emerald-500/20 p-6 space-y-5"
                            style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(30px)' }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                    <UserPlus className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Aggiungi Co-Admin</h3>
                                    <p className="text-xs text-slate-500">{getUserName(grantTarget)} · {grantTarget.email}</p>
                                </div>
                            </div>

                            <p className="text-sm text-slate-400">
                                <strong className="text-white">{getUserName(grantTarget)}</strong> avrà pieno accesso alla dashboard di amministrazione e potrà gestire l'intera piattaforma.
                            </p>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Motivazione (opzionale)</label>
                                <input
                                    type="text"
                                    value={grantReason}
                                    onChange={(e) => setGrantReason(e.target.value)}
                                    placeholder="es. Co-fondatore, CTO..."
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/50 outline-none"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => { setGrantTarget(null); setGrantReason(''); }} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:bg-white/5 transition-all">
                                    Annulla
                                </button>
                                <button
                                    onClick={handleGrant}
                                    disabled={grantLoading}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                                >
                                    {grantLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Conferma</>}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Revoke Admin Modal */}
            <AnimatePresence>
                {revokeTarget && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => { setRevokeTarget(null); setRevokeConfirmText(''); setRevokeReason(''); }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md rounded-2xl border border-red-500/30 p-6 space-y-5"
                            style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(30px)' }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                                    <ShieldOff className="w-5 h-5 text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Revoca Accesso Admin</h3>
                                    <p className="text-xs text-slate-500">{getUserName(revokeTarget)} · {revokeTarget.email}</p>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                <p className="text-sm text-red-300/70">
                                    <strong className="text-red-300">{getUserName(revokeTarget)}</strong> perderà immediatamente l'accesso alla dashboard admin.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Motivazione (opzionale)</label>
                                <input
                                    type="text"
                                    value={revokeReason}
                                    onChange={(e) => setRevokeReason(e.target.value)}
                                    placeholder="es. Cambio ruolo, fine collaborazione..."
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-red-500/50 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                    Scrivi <span className="text-red-400 font-bold font-mono">REVOCA</span> per confermare
                                </label>
                                <input
                                    type="text"
                                    value={revokeConfirmText}
                                    onChange={(e) => setRevokeConfirmText(e.target.value.toUpperCase())}
                                    placeholder="REVOCA"
                                    className="w-full bg-slate-900/50 border border-red-500/20 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-red-500/50 outline-none font-mono tracking-widest text-center"
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => { setRevokeTarget(null); setRevokeConfirmText(''); setRevokeReason(''); }} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:bg-white/5 transition-all">
                                    Annulla
                                </button>
                                <button
                                    onClick={handleRevoke}
                                    disabled={revokeLoading || revokeConfirmText !== 'REVOCA'}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {revokeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldOff className="w-4 h-4" /> Revoca</>}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
