'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAvatarStore } from '../../stores/avatarStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Shield, User, Star, ChevronDown, Users, UserX, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';

const supabase = createClient();

type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest';

interface WorkspaceMember {
    user_id: string;
    role: WorkspaceRole;
    profile: {
        full_name: string | null;
        display_name: string | null;
        avatar_url: string | null;
        email: string;
        status: string;
    } | null;
}

const ROLE_CONFIG: Record<WorkspaceRole, { icon: typeof Crown; label: string; color: string; dotColor: string }> = {
    owner: { icon: Crown, label: 'Owner', color: 'text-amber-400', dotColor: 'bg-amber-400' },
    admin: { icon: Shield, label: 'Admin', color: 'text-cyan-400', dotColor: 'bg-cyan-400' },
    member: { icon: User, label: 'Membri', color: 'text-slate-300', dotColor: 'bg-slate-400' },
    guest: { icon: Star, label: 'Ospiti', color: 'text-purple-400', dotColor: 'bg-purple-400' },
};

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
    owner: 3,
    admin: 2,
    member: 1,
    guest: 0,
};

const ROLE_ORDER: WorkspaceRole[] = ['owner', 'admin', 'member', 'guest'];

const STATUS_DOT: Record<string, string> = {
    online: 'bg-emerald-500',
    away: 'bg-amber-500',
    busy: 'bg-red-500',
    offline: 'bg-slate-600',
};

interface TeamListProps {
    spaceId: string;
}

export function TeamList({ spaceId }: TeamListProps) {
    const peers = useAvatarStore(s => s.peers);
    const myProfile = useAvatarStore(s => s.myProfile);
    const myStatus = useAvatarStore(s => s.myStatus);
    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [showAllMembers, setShowAllMembers] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [myRole, setMyRole] = useState<WorkspaceRole | null>(null);
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);
    const [kickingUserId, setKickingUserId] = useState<string | null>(null);

    const peerList = Object.values(peers);
    const onlinePeerIds = new Set(peerList.map(p => p.id));

    // Fetch all workspace members
    const fetchMembers = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);

        const { data: space } = await supabase
            .from('spaces')
            .select('workspace_id')
            .eq('id', spaceId)
            .single();

        if (!space?.workspace_id) return;
        setWorkspaceId(space.workspace_id);

        const { data: membersData } = await supabase
            .from('workspace_members')
            .select(`
                user_id,
                role,
                profiles:user_id (
                    full_name,
                    display_name,
                    avatar_url,
                    email,
                    status
                )
            `)
            .eq('workspace_id', space.workspace_id)
            .is('removed_at', null);

        if (membersData) {
            const formatted = (membersData as any[]).map(m => ({
                user_id: m.user_id,
                role: m.role as WorkspaceRole,
                profile: m.profiles || null,
            }));
            setMembers(formatted);

            // Find my role
            const me = formatted.find(m => m.user_id === user.id);
            setMyRole(me?.role || null);
        }
    }, [spaceId]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    // Kick member — sets removed_at in workspace_members
    const handleKick = async (userId: string, userName: string) => {
        if (!workspaceId) return;
        if (!confirm(`Sei sicuro di voler rimuovere ${userName} dal workspace?`)) return;

        setKickingUserId(userId);
        try {
            const { error } = await supabase
                .from('workspace_members')
                .update({
                    removed_at: new Date().toISOString(),
                    removed_by: currentUserId,
                    remove_reason: 'Kicked by admin',
                })
                .eq('workspace_id', workspaceId)
                .eq('user_id', userId);

            if (error) {
                console.error('Kick error:', error);
                alert('Errore durante la rimozione: ' + error.message);
            } else {
                // Remove from local list
                setMembers(prev => prev.filter(m => m.user_id !== userId));
            }
        } catch (err: any) {
            console.error('Kick error:', err);
            alert('Errore: ' + err.message);
        }
        setKickingUserId(null);
    };

    // Can current user kick this member?
    const canKickMember = (targetRole: WorkspaceRole) => {
        if (!myRole) return false;
        // Can only kick users with LOWER role
        return ROLE_HIERARCHY[myRole] > ROLE_HIERARCHY[targetRole];
    };

    // For the current user, use real-time myProfile from the store instead of stale DB data
    const getName = (m: WorkspaceMember) => {
        if (m.user_id === currentUserId && myProfile) {
            return myProfile.display_name || myProfile.full_name || m.profile?.email || 'Unknown';
        }
        return m.profile?.display_name || m.profile?.full_name || m.profile?.email || 'Unknown';
    };

    const getAvatarUrl = (m: WorkspaceMember) => {
        if (m.user_id === currentUserId && myProfile) {
            return myProfile.avatar_url || m.profile?.avatar_url || null;
        }
        return m.profile?.avatar_url || null;
    };

    const getInitials = (m: WorkspaceMember) => {
        const name = getName(m);
        return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const isOnline = (m: WorkspaceMember) => {
        if (m.user_id === currentUserId) return true;
        return onlinePeerIds.has(m.user_id);
    };

    const getMemberStatus = (m: WorkspaceMember) => {
        if (m.user_id === currentUserId) return myStatus || 'online';
        const peer = peerList.find(p => p.id === m.user_id);
        return peer?.status || 'online';
    };

    // Group members by role
    const grouped = ROLE_ORDER.map(role => ({
        role,
        config: ROLE_CONFIG[role],
        members: members.filter(m => m.role === role),
    })).filter(g => g.members.length > 0);

    // Online members
    const onlineMembers = members.filter(m => isOnline(m));

    // Member row component
    const MemberRow = ({ m, showRole = false }: { m: WorkspaceMember; showRole?: boolean }) => {
        const online = isOnline(m);
        const status = getMemberStatus(m);
        const isMe = m.user_id === currentUserId;
        const roleConfig = ROLE_CONFIG[m.role];
        const RIcon = roleConfig.icon;
        const showKick = !isMe && canKickMember(m.role);
        const isKicking = kickingUserId === m.user_id;

        return (
            <div
                className={`group flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors ${isMe ? 'bg-primary-500/5' : 'hover:bg-white/5'
                    }`}
            >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[status] || STATUS_DOT.offline}`} />
                <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-medium truncate ${online ? 'text-slate-200' : 'text-slate-500'}`}>
                        {isMe ? `${getName(m)} (Tu)` : getName(m)}
                    </p>
                </div>
                {showRole && <RIcon className={`w-3 h-3 ${roleConfig.color} opacity-40 flex-shrink-0`} />}
                {showKick && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleKick(m.user_id, getName(m));
                        }}
                        disabled={isKicking}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded-md hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                        title={`Rimuovi ${getName(m)}`}
                    >
                        {isKicking ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <UserX className="w-3 h-3" />
                        )}
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="mt-1 space-y-1">
            {/* === TEAM MEMBERS (styled like Virtual Office button) === */}
            <Button
                variant="ghost"
                onClick={() => setShowAllMembers(!showAllMembers)}
                className="w-full justify-start gap-3 transition-all duration-300 bg-primary-500/20 text-primary-300 shadow-[inset_0_0_20px_rgba(99,102,241,0.2)]"
            >
                <Users className="w-5 h-5 flex-shrink-0" />
                <span className="whitespace-nowrap">Team members</span>
                <span className="text-[10px] text-slate-500 ml-auto">{members.length}</span>
                <ChevronDown className={`w-3 h-3 flex-shrink-0 opacity-50 transition-transform ${showAllMembers ? '' : '-rotate-90'}`} />
            </Button>

            <AnimatePresence initial={false}>
                {showAllMembers && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-2 pl-2 pb-2">
                            {grouped.map(({ role, config, members: groupMembers }) => {
                                const RIcon = config.icon;
                                return (
                                    <div key={role}>
                                        <div className="flex items-center gap-1.5 px-2 py-1">
                                            <RIcon className={`w-3 h-3 ${config.color}`} />
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${config.color}`}>
                                                {config.label}
                                            </span>
                                            <span className="text-[10px] text-slate-600 ml-auto">{groupMembers.length}</span>
                                        </div>
                                        <div className="space-y-0.5">
                                            {groupMembers.map(m => (
                                                <MemberRow key={m.user_id} m={m} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* === ONLINE (always visible) === */}
            <div className="pt-1">
                <div className="flex items-center gap-2 px-2 py-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest">
                        Online ({onlineMembers.length})
                    </span>
                </div>
                <div className="space-y-0.5">
                    {onlineMembers.map(m => (
                        <MemberRow key={`online-${m.user_id}`} m={m} showRole />
                    ))}
                </div>
            </div>
        </div>
    );
}
