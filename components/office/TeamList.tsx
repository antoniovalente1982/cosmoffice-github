'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Shield, User, Star, ChevronDown } from 'lucide-react';

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
    const { peers, myProfile } = useOfficeStore();
    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const peerList = Object.values(peers);
    const onlinePeerIds = new Set(peerList.map(p => p.id));

    // Fetch all workspace members
    useEffect(() => {
        let cancelled = false;

        const fetchMembers = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (cancelled || !user) return;
            setCurrentUserId(user.id);

            // Get workspace_id from space
            const { data: space } = await supabase
                .from('spaces')
                .select('workspace_id')
                .eq('id', spaceId)
                .single();

            if (!space?.workspace_id || cancelled) return;

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

            if (!cancelled && membersData) {
                const formatted = (membersData as any[]).map(m => ({
                    user_id: m.user_id,
                    role: m.role as WorkspaceRole,
                    profile: m.profiles || null,
                }));
                setMembers(formatted);
            }
        };

        fetchMembers();
        return () => { cancelled = true; };
    }, [spaceId]);

    const getName = (m: WorkspaceMember) => {
        return m.profile?.display_name || m.profile?.full_name || m.profile?.email || 'Unknown';
    };

    const getInitials = (m: WorkspaceMember) => {
        const name = getName(m);
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const isOnline = (m: WorkspaceMember) => {
        if (m.user_id === currentUserId) return true; // I'm always online here
        return onlinePeerIds.has(m.user_id);
    };

    const getMemberStatus = (m: WorkspaceMember) => {
        if (m.user_id === currentUserId) return myProfile?.status || 'online';
        const peer = peerList.find(p => p.id === m.user_id);
        return peer?.status || m.profile?.status || 'offline';
    };

    // Group members by role
    const grouped = ROLE_ORDER.map(role => ({
        role,
        config: ROLE_CONFIG[role],
        members: members.filter(m => m.role === role),
    })).filter(g => g.members.length > 0);

    // Online members (me + peers)
    const onlineMembers = members.filter(m => isOnline(m));
    const onlineCount = onlineMembers.length;

    const toggleCollapse = (role: string) => {
        setCollapsed(prev => ({ ...prev, [role]: !prev[role] }));
    };

    return (
        <div className="mt-2 space-y-3 px-2">
            {/* === ALL MEMBERS BY ROLE === */}
            {grouped.map(({ role, config, members: groupMembers }) => {
                const RIcon = config.icon;
                const isCollapsed = collapsed[role];

                return (
                    <div key={role}>
                        <button
                            onClick={() => toggleCollapse(role)}
                            className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                        >
                            <RIcon className={`w-3 h-3 ${config.color}`} />
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${config.color}`}>
                                {config.label}
                            </span>
                            <span className="text-[10px] text-slate-600 ml-auto mr-1">
                                {groupMembers.length}
                            </span>
                            <ChevronDown className={`w-3 h-3 text-slate-600 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                        </button>

                        <AnimatePresence initial={false}>
                            {!isCollapsed && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="space-y-0.5 mt-1">
                                        {groupMembers.map(m => {
                                            const online = isOnline(m);
                                            const status = getMemberStatus(m);
                                            const isMe = m.user_id === currentUserId;

                                            return (
                                                <div
                                                    key={m.user_id}
                                                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors ${isMe ? 'bg-primary-500/5' : 'hover:bg-white/5'
                                                        }`}
                                                >
                                                    {/* Avatar */}
                                                    <div className="relative flex-shrink-0">
                                                        {m.profile?.avatar_url ? (
                                                            <img
                                                                src={m.profile.avatar_url}
                                                                alt={getName(m)}
                                                                className={`w-7 h-7 rounded-full object-cover ${online ? '' : 'opacity-40 grayscale'}`}
                                                            />
                                                        ) : (
                                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold ${online ? 'bg-slate-700 text-slate-200' : 'bg-slate-800 text-slate-600'
                                                                }`}>
                                                                {getInitials(m)}
                                                            </div>
                                                        )}
                                                        {/* Status dot */}
                                                        <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${STATUS_DOT[status] || STATUS_DOT.offline}`} />
                                                    </div>

                                                    {/* Name */}
                                                    <div className="flex-1 min-w-0 overflow-hidden">
                                                        <p className={`text-[11px] font-medium truncate ${online ? 'text-slate-200' : 'text-slate-500'
                                                            }`}>
                                                            {getName(m)}
                                                            {isMe && <span className="text-primary-400 ml-1 text-[9px]">(Tu)</span>}
                                                        </p>
                                                    </div>

                                                    {/* Role dot */}
                                                    <div className={`w-1.5 h-1.5 rounded-full ${config.dotColor} flex-shrink-0 opacity-50`} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}

            {/* === ONLINE NOW === */}
            {onlineCount > 0 && (
                <div className="pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2 px-2 py-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest">
                            Online ({onlineCount})
                        </span>
                    </div>
                    <div className="space-y-0.5 mt-1">
                        {onlineMembers.map(m => {
                            const isMe = m.user_id === currentUserId;
                            const roleConfig = ROLE_CONFIG[m.role];
                            const RIcon = roleConfig.icon;

                            return (
                                <div
                                    key={`online-${m.user_id}`}
                                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg ${isMe ? 'bg-primary-500/5' : 'hover:bg-white/5'
                                        } transition-colors`}
                                >
                                    <div className="relative flex-shrink-0">
                                        {m.profile?.avatar_url ? (
                                            <img
                                                src={m.profile.avatar_url}
                                                alt={getName(m)}
                                                className="w-7 h-7 rounded-full object-cover ring-1 ring-emerald-500/30"
                                            />
                                        ) : (
                                            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-200 ring-1 ring-emerald-500/30">
                                                {getInitials(m)}
                                            </div>
                                        )}
                                        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 bg-emerald-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-medium text-slate-200 truncate">
                                            {isMe ? 'Tu' : getName(m)}
                                        </p>
                                    </div>
                                    <RIcon className={`w-3 h-3 ${roleConfig.color} opacity-40`} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
