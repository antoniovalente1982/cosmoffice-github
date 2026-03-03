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

export default function TransferPage() {
    const [admins, setAdmins] = useState<UserProfile[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [currentUserId, setCurrentUserId] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchLoading, setSearchLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // Confirmation modal state
    const [confirmAction, setConfirmAction] = useState<{
        action: 'transfer' | 'grant' | 'revoke';
        target: UserProfile;
    } | null>(null);
    const [reason, setReason] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Load current admins and history
    useEffect(() => {
        const load = async () => {
            const [adminsRes, historyRes] = await Promise.all([
                fetch('/api/admin/transfer?action=admins'),
                fetch('/api/admin/transfer?action=history'),
            ]);
            const adminsData = await adminsRes.json();
            const historyData = await historyRes.json();

            setAdmins(adminsData.admins || []);
            setCurrentUserId(adminsData.currentUserId || '');
            setTransfers(historyData.transfers || []);
            setLoading(false);
        };
        load();
    }, []);

    // Search users
    useEffect(() => {
        if (!search.trim()) { setUsers([]); return; }
        const timeout = setTimeout(async () => {
            setSearchLoading(true);
            const res = await fetch(`/api/admin/transfer?search=${encodeURIComponent(search)}`);
            const data = await res.json();
            setUsers(data.users || []);
            setSearchLoading(false);
        }, 300);
        return () => clearTimeout(timeout);
    }, [search]);

    const executeAction = async () => {
        if (!confirmAction) return;

        // For transfer, require typing TRANSFER
        if (confirmAction.action === 'transfer' && confirmText !== 'TRANSFER') return;

        setActionLoading(true);
        setFeedback(null);

        try {
            const res = await fetch('/api/admin/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: confirmAction.action,
                    targetUserId: confirmAction.target.id,
                    reason,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setFeedback({ type: 'error', message: data.error });
            } else {
                setFeedback({ type: 'success', message: data.message });

                // Refresh data
                const [adminsRes, historyRes] = await Promise.all([
                    fetch('/api/admin/transfer?action=admins'),
                    fetch('/api/admin/transfer?action=history'),
                ]);
                const adminsData = await adminsRes.json();
                const historyData = await historyRes.json();
                setAdmins(adminsData.admins || []);
                setTransfers(historyData.transfers || []);

                // If transferred, redirect after delay
                if (confirmAction.action === 'transfer') {
                    setTimeout(() => {
                        window.location.href = '/office';
                    }, 2000);
                }
            }
        } catch (err: any) {
            setFeedback({ type: 'error', message: err.message || 'Unexpected error' });
        } finally {
            setActionLoading(false);
            setConfirmAction(null);
            setConfirmText('');
            setReason('');
        }
    };

    const getUserName = (user: UserProfile) =>
        user.display_name || user.full_name || user.email || 'Unknown';

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
                    Trasferisci la proprietà, aggiungi co-admin, o revoca accessi. Ogni azione viene registrata.
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

            {/* Current Admins */}
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
                        <div key={admin.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center gap-3">
                                {admin.avatar_url ? (
                                    <img src={admin.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-400/30" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-300 font-bold text-sm uppercase">
                                        {getUserName(admin)[0]}
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm font-medium text-white flex items-center gap-2">
                                        {getUserName(admin)}
                                        {admin.id === currentUserId && (
                                            <span className="text-[10px] uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">Tu</span>
                                        )}
                                    </p>
                                    <p className="text-xs text-slate-500">{admin.email}</p>
                                </div>
                            </div>
                            {admin.id !== currentUserId && admins.length > 1 && (
                                <button
                                    onClick={() => setConfirmAction({ action: 'revoke', target: admin })}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"
                                >
                                    <ShieldOff className="w-3.5 h-3.5" />
                                    Revoca
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* Add Admin / Transfer */}
            <section className="rounded-2xl border border-white/5 overflow-hidden"
                style={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(20px)' }}>
                <div className="px-6 py-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-cyan-400" />
                        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Aggiungi Admin o Trasferisci</h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Cerca un utente registrato per concedere l'accesso admin o trasferire completamente la proprietà.</p>
                </div>
                <div className="p-6">
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Cerca per email o nome..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 outline-none transition-colors"
                        />
                        {searchLoading && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 animate-spin" />
                        )}
                    </div>

                    {users.length > 0 && (
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                            {users.map((user) => (
                                <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/30 border border-white/5 hover:border-white/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                        {user.avatar_url ? (
                                            <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs uppercase">
                                                {getUserName(user)[0]}
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-sm font-medium text-white">{getUserName(user)}</p>
                                            <p className="text-xs text-slate-500">{user.email}</p>
                                        </div>
                                        {user.is_super_admin && (
                                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!user.is_super_admin && (
                                            <>
                                                <button
                                                    onClick={() => setConfirmAction({ action: 'grant', target: user })}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 transition-all"
                                                >
                                                    <UserPlus className="w-3.5 h-3.5" />
                                                    Co-Admin
                                                </button>
                                                <button
                                                    onClick={() => setConfirmAction({ action: 'transfer', target: user })}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400 border border-amber-500/20 hover:bg-amber-500/10 transition-all"
                                                >
                                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                                    Trasferisci
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {search && !searchLoading && users.length === 0 && (
                        <p className="text-sm text-slate-500 text-center py-8">Nessun utente trovato per "{search}"</p>
                    )}
                </div>
            </section>

            {/* Transfer History */}
            <section className="rounded-2xl border border-white/5 overflow-hidden"
                style={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(20px)' }}>
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full px-6 py-4 border-b border-white/5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-slate-400" />
                        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Storico Trasferimenti</h2>
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
                            className="overflow-hidden"
                        >
                            {transfers.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-8">Nessun trasferimento registrato</p>
                            ) : (
                                <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
                                    {transfers.map((t) => {
                                        const typeInfo = typeLabels[t.transfer_type] || typeLabels.transfer;
                                        const Icon = typeInfo.icon;
                                        return (
                                            <div key={t.id} className="px-6 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.transfer_type === 'transfer' ? 'bg-amber-500/10' :
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
                                                        {t.reason && <span className="text-xs text-slate-600">· {t.reason}</span>}
                                                    </div>
                                                </div>
                                                <span className="text-xs text-slate-600 whitespace-nowrap">
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

            {/* Confirmation Modal */}
            <AnimatePresence>
                {confirmAction && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => { setConfirmAction(null); setConfirmText(''); setReason(''); }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md rounded-2xl border border-white/10 p-6 space-y-5"
                            style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(30px)' }}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${confirmAction.action === 'transfer' ? 'bg-amber-500/20' :
                                        confirmAction.action === 'grant' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                                        }`}>
                                        {confirmAction.action === 'transfer' && <ArrowRightLeft className="w-5 h-5 text-amber-400" />}
                                        {confirmAction.action === 'grant' && <UserPlus className="w-5 h-5 text-emerald-400" />}
                                        {confirmAction.action === 'revoke' && <ShieldOff className="w-5 h-5 text-red-400" />}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">
                                            {confirmAction.action === 'transfer' ? 'Trasferisci Proprietà' :
                                                confirmAction.action === 'grant' ? 'Concedi Accesso Admin' : 'Revoca Accesso Admin'}
                                        </h3>
                                        <p className="text-xs text-slate-500">{getUserName(confirmAction.target)} · {confirmAction.target.email}</p>
                                    </div>
                                </div>
                                <button onClick={() => { setConfirmAction(null); setConfirmText(''); setReason(''); }}
                                    className="text-slate-500 hover:text-slate-300 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Warning for transfer */}
                            {confirmAction.action === 'transfer' && (
                                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                        <div className="text-sm text-amber-200">
                                            <p className="font-semibold mb-1">Attenzione: azione irreversibile</p>
                                            <p className="text-amber-300/70">Perderai l'accesso alla dashboard admin. Solo il nuovo proprietario potrà ripristinarlo.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Reason */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Motivazione (opzionale)</label>
                                <input
                                    type="text"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="es. Cessione aziendale..."
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 outline-none transition-colors"
                                />
                            </div>

                            {/* Safety check for transfer */}
                            {confirmAction.action === 'transfer' && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                        Scrivi <span className="text-amber-400 font-bold">TRANSFER</span> per confermare
                                    </label>
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={(e) => setConfirmText(e.target.value)}
                                        placeholder="TRANSFER"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-500/50 outline-none transition-colors font-mono tracking-widest"
                                    />
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => { setConfirmAction(null); setConfirmText(''); setReason(''); }}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-white/10 hover:bg-white/5 transition-all"
                                >
                                    Annulla
                                </button>
                                <button
                                    onClick={executeAction}
                                    disabled={actionLoading || (confirmAction.action === 'transfer' && confirmText !== 'TRANSFER')}
                                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${confirmAction.action === 'transfer'
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                                        : confirmAction.action === 'grant'
                                            ? 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                                            : 'bg-red-500 text-white hover:bg-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                                        }`}
                                >
                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Conferma
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
