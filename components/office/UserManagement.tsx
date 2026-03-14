'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Users, Crown, Shield, User, Star, Loader2,
    UserMinus, AlertTriangle, ArrowUpRight, ChevronDown,
    Search, MailPlus
} from 'lucide-react';
import { Button } from '../ui/button';
import { handleError } from '@/lib/errorHandler';

const supabase = createClient();

type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest';

interface Member {
    user_id: string;
    role: WorkspaceRole;
    joined_at: string;
    profile: {
        full_name: string | null;
        display_name: string | null;
        avatar_url: string | null;
        email: string | null;
        status: string;
    } | null;
}

const ROLE_CONFIG: Record<WorkspaceRole, { icon: typeof Crown; label: string; color: string; bgColor: string }> = {
    owner: { icon: Crown, label: 'Owner', color: 'text-amber-400', bgColor: 'bg-amber-500/15' },
    admin: { icon: Shield, label: 'Admin', color: 'text-cyan-400', bgColor: 'bg-cyan-500/15' },
    member: { icon: User, label: 'Membro', color: 'text-slate-300', bgColor: 'bg-slate-500/15' },
    guest: { icon: Star, label: 'Ospite', color: 'text-purple-400', bgColor: 'bg-purple-500/15' },
};

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
    owner: 3,
    admin: 2,
    member: 1,
    guest: 0,
};

const ROLE_ORDER: WorkspaceRole[] = ['owner', 'admin', 'member', 'guest'];

interface UserManagementProps {
    workspaceId: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function UserManagement({ workspaceId, isOpen, onClose }: UserManagementProps) {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [myRole, setMyRole] = useState<WorkspaceRole | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [removingUserId, setRemovingUserId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedRole, setExpandedRole] = useState<WorkspaceRole | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);

        // Fetch members with profiles
        const { data: membersData } = await supabase
            .from('workspace_members')
            .select(`
                user_id,
                role,
                joined_at,
                profiles:user_id (
                    full_name,
                    display_name,
                    avatar_url,
                    email,
                    status
                )
            `)
            .eq('workspace_id', workspaceId)
            .is('removed_at', null)
            .order('joined_at', { ascending: true });

        if (membersData) {
            const formatted = (membersData as any[]).map(m => ({
                user_id: m.user_id,
                role: m.role as WorkspaceRole,
                joined_at: m.joined_at,
                profile: m.profiles || null,
            }));
            setMembers(formatted);

            const me = formatted.find(m => m.user_id === user.id);
            setMyRole(me?.role || null);
        }

        setLoading(false);
    }, [workspaceId]);

    useEffect(() => {
        if (isOpen) fetchData();
    }, [isOpen, fetchData]);

    // Poll for updates every 30s while panel is open
    useEffect(() => {
        if (!workspaceId || !isOpen) return;
        const intervalId = setInterval(fetchData, 30000);
        return () => { clearInterval(intervalId); };
    }, [workspaceId, isOpen, fetchData]);

    const getName = (m: Member) =>
        m.profile?.display_name || m.profile?.full_name || m.profile?.email || 'Utente';

    const getInitials = (m: Member) => {
        const name = getName(m);
        return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const canRemoveMember = (targetRole: WorkspaceRole) => {
        if (!myRole) return false;
        return ROLE_HIERARCHY[myRole] > ROLE_HIERARCHY[targetRole];
    };

    const handleRemove = async (userId: string, userName: string) => {
        if (!confirm(`Sei sicuro di voler rimuovere ${userName} dal workspace?`)) return;
        setRemovingUserId(userId);
        try {
            const { data, error } = await supabase.rpc('kick_workspace_member', {
                p_workspace_id: workspaceId,
                p_target_user_id: userId,
            });
            if (error) {
                handleError(error, 'UserManagement.handleRemove', 'warning');
            } else {
                const result = data as any;
                if (result?.success) {
                    setMembers(prev => prev.filter(m => m.user_id !== userId));
                } else {
                    handleError(result?.error || 'Errore sconosciuto', 'UserManagement.handleRemove', 'warning');
                }
            }
        } catch (err: any) {
            handleError(err, 'UserManagement.handleRemove', 'warning');
        }
        setRemovingUserId(null);
    };

    // Filter members
    const filteredMembers = members.filter(m => {
        if (!searchQuery) return true;
        const name = getName(m).toLowerCase();
        const email = (m.profile?.email || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        return name.includes(q) || email.includes(q);
    });

    // Group by role
    const grouped = ROLE_ORDER.map(role => ({
        role,
        config: ROLE_CONFIG[role],
        members: filteredMembers.filter(m => m.role === role),
    })).filter(g => g.members.length > 0);

    const usedSeats = members.length;

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center"
                onClick={onClose}
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                {/* Modal */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-lg max-h-[85vh] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
                    style={{ background: 'rgba(15, 23, 42, 0.97)' }}
                >
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                                <Users className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Gestione Utenti</h2>
                                <p className="text-xs text-slate-500">Gestisci i membri del tuo workspace</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Totale Utenti */}
                    <div className="px-6 py-4 border-b border-white/5 shrink-0">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Utenti Registrati</span>
                            <span className="text-sm font-bold text-cyan-400">
                                {usedSeats}
                            </span>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="px-6 py-3 border-b border-white/5 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Cerca utenti..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/30 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Members List */}
                    <div className="flex-1 overflow-y-auto px-6 py-3 space-y-3">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                            </div>
                        ) : (
                            grouped.map(({ role, config, members: groupMembers }) => {
                                const RIcon = config.icon;
                                const isExpanded = expandedRole === role || expandedRole === null;

                                return (
                                    <div key={role}>
                                        <button
                                            onClick={() => setExpandedRole(expandedRole === role ? null : role)}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                        >
                                            <RIcon className={`w-3.5 h-3.5 ${config.color}`} />
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${config.color}`}>
                                                {config.label}
                                            </span>
                                            <span className="text-[10px] text-slate-600 ml-1">
                                                ({groupMembers.length})
                                            </span>
                                            <ChevronDown className={`w-3 h-3 text-slate-600 ml-auto transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                                        </button>

                                        <AnimatePresence initial={false}>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="space-y-0.5 py-1">
                                                        {groupMembers.map(m => {
                                                            const isMe = m.user_id === currentUserId;
                                                            const canRemove = !isMe && canRemoveMember(m.role);
                                                            const isRemoving = removingUserId === m.user_id;

                                                            return (
                                                                <div
                                                                    key={m.user_id}
                                                                    className={`group flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${isMe ? 'bg-cyan-500/5 border border-cyan-500/10' : 'hover:bg-white/5'}`}
                                                                >
                                                                    {/* Avatar */}
                                                                    {m.profile?.avatar_url ? (
                                                                        <img
                                                                            src={m.profile.avatar_url}
                                                                            alt={getName(m)}
                                                                            className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10 shrink-0"
                                                                        />
                                                                    ) : (
                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${config.bgColor} ${config.color}`}>
                                                                            {getInitials(m)}
                                                                        </div>
                                                                    )}

                                                                    {/* Info */}
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-xs font-semibold text-slate-200 truncate">
                                                                            {getName(m)}
                                                                            {isMe && <span className="text-cyan-400 ml-1">(Tu)</span>}
                                                                        </p>
                                                                        <p className="text-[10px] text-slate-500 truncate">
                                                                            {m.profile?.email || 'Nessuna email'}
                                                                        </p>
                                                                    </div>

                                                                    {/* Role badge */}
                                                                    <div className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider shrink-0 ${config.bgColor} ${config.color}`}>
                                                                        {config.label}
                                                                    </div>

                                                                    {/* Remove button */}
                                                                    {canRemove && (
                                                                        <button
                                                                            onClick={() => handleRemove(m.user_id, getName(m))}
                                                                            disabled={isRemoving}
                                                                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all shrink-0"
                                                                            title={`Rimuovi ${getName(m)}`}
                                                                        >
                                                                            {isRemoving ? (
                                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                            ) : (
                                                                                <UserMinus className="w-3.5 h-3.5" />
                                                                            )}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })
                        )}

                        {!loading && filteredMembers.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                                <Users className="w-8 h-8 mb-3 opacity-30" />
                                <p className="text-xs">Nessun utente trovato</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-white/5 shrink-0 flex items-center justify-between">
                        <p className="text-[10px] text-slate-600">
                            Nessun limite membri registrati.
                        </p>
                        {(myRole === 'owner' || myRole === 'admin') && (
                            <button
                                onClick={onClose}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
                            >
                                <MailPlus className="w-3.5 h-3.5" />
                                Chiudi per Invitare
                            </button>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
