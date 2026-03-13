'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAvatarStore } from '../../stores/avatarStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Crown, Shield, User, Star, ChevronDown, Users, UserX, Loader2, Phone,
    ArrowUpRight, AlertTriangle, Search, Link2, Trash2, Copy,
} from 'lucide-react';
import { Button } from '../ui/button';
import { useCallStore } from '../../stores/callStore';
import { useT } from '../../lib/i18n';

const supabase = createClient();

type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest';

interface WorkspaceMember {
    user_id: string;
    role: WorkspaceRole;
    joined_at?: string;
    profile: {
        full_name: string | null;
        display_name: string | null;
        avatar_url: string | null;
        email: string | null;
        status: string;
    } | null;
}

interface GuestInvite {
    id: string;
    token: string;
    label: string | null;
    use_count: number;
    expires_at: string | null;
    invited_at: string;
}

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = { owner: 3, admin: 2, member: 1, guest: 0 };
const ROLE_ORDER: WorkspaceRole[] = ['owner', 'admin', 'member', 'guest'];
const STATUS_DOT: Record<string, string> = {
    online: 'bg-emerald-500', away: 'bg-amber-500', busy: 'bg-red-500', offline: 'bg-slate-600',
};

interface TeamListProps {
    spaceId: string;
    workspaceId: string | null;
    role: string | null;
    canInvite: boolean;
    invitableRoles: string[];
}

export function TeamList({ spaceId, workspaceId, role, canInvite, invitableRoles }: TeamListProps) {
    const { t } = useT();
    const ROLE_CONFIG: Record<WorkspaceRole, { icon: typeof Crown; label: string; color: string; dotColor: string; bgColor: string }> = {
        owner: { icon: Crown, label: t('role.owner'), color: 'text-amber-400', dotColor: 'bg-amber-400', bgColor: 'bg-amber-500/15' },
        admin: { icon: Shield, label: t('role.admin'), color: 'text-cyan-400', dotColor: 'bg-cyan-400', bgColor: 'bg-cyan-500/15' },
        member: { icon: User, label: t('role.member'), color: 'text-slate-300', dotColor: 'bg-slate-400', bgColor: 'bg-slate-500/15' },
        guest: { icon: Star, label: t('role.guest'), color: 'text-purple-400', dotColor: 'bg-purple-400', bgColor: 'bg-purple-500/15' },
    };
    const peers = useAvatarStore(s => s.peers);
    const peerCount = Object.keys(peers).length; // reactive trigger for online detection
    const myProfile = useAvatarStore(s => s.myProfile);
    const myStatus = useAvatarStore(s => s.myStatus);
    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [guestInvites, setGuestInvites] = useState<GuestInvite[]>([]);
    const [showPanel, setShowPanel] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [myRole, setMyRole] = useState<WorkspaceRole | null>(null);
    const [kickingUserId, setKickingUserId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedToken, setCopiedToken] = useState<string | null>(null);

    const peerList = Object.values(peers);

    // ─── Fetch members + guest invites ───
    const fetchData = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);

        const effectiveWsId = workspaceId || await supabase.from('spaces').select('workspace_id').eq('id', spaceId).single().then(r => r.data?.workspace_id);
        if (!effectiveWsId) return;

        // Fetch members (non-guest only for seat counting, but show all)
        const { data: membersData } = await supabase
            .from('workspace_members')
            .select(`user_id, role, joined_at, profiles:user_id (full_name, display_name, avatar_url, email, status)`)
            .eq('workspace_id', effectiveWsId)
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

        // Fetch active guest invites (count as seats)
        const { data: guestInvData } = await supabase
            .from('workspace_invitations')
            .select('id, token, label, use_count, expires_at, invited_at')
            .eq('workspace_id', effectiveWsId)
            .eq('role', 'guest')
            .is('revoked_at', null)
            .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
            .order('invited_at', { ascending: false });

        setGuestInvites(guestInvData || []);
    }, [spaceId, workspaceId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Poll for member/invite changes every 30s
    useEffect(() => {
        if (!workspaceId) return;
        const intervalId = setInterval(fetchData, 30000);
        return () => { clearInterval(intervalId); };
    }, [workspaceId, fetchData]);

    // ─── Actions ───
    const handleKick = async (userId: string, userName: string) => {
        if (!workspaceId) return;
        if (!confirm(t('team.kickConfirm', { name: userName }))) return;
        setKickingUserId(userId);
        try {
            const { data, error } = await supabase.rpc('kick_workspace_member', {
                p_workspace_id: workspaceId, p_target_user_id: userId,
            });
            if (error) alert(t('team.kickError') + error.message);
            else {
                const result = data as any;
                if (result?.success) setMembers(prev => prev.filter(m => m.user_id !== userId));
                else alert(result?.error || t('team.unknownError'));
            }
        } catch (err: any) { alert(t('team.kickError') + err.message); }
        setKickingUserId(null);
    };

    const canKickMember = (targetRole: WorkspaceRole) => myRole ? ROLE_HIERARCHY[myRole] > ROLE_HIERARCHY[targetRole] : false;

    const revokeGuestInvite = async (inviteId: string) => {
        if (!confirm(t('team.revokeConfirm'))) return;
        await supabase.from('workspace_invitations').delete().eq('id', inviteId);
        setGuestInvites(prev => prev.filter(g => g.id !== inviteId));
    };

    const copyInviteLink = (token: string) => {
        navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
        setCopiedToken(token);
        setTimeout(() => setCopiedToken(null), 2000);
    };

    // ─── Helpers ───
    const getName = (m: WorkspaceMember) => {
        if (m.user_id === currentUserId && myProfile) return myProfile.display_name || myProfile.full_name || m.profile?.email || t('office.guest');
        return m.profile?.display_name || m.profile?.full_name || m.profile?.email || t('office.guest');
    };
    const getInitials = (m: WorkspaceMember) => getName(m).split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    const isOnline = (m: WorkspaceMember) => {
        if (m.user_id === currentUserId) return true;
        const peer = peers[m.user_id];
        return !!peer && peer.position && peer.position.x > 0 && peer.position.y > 0;
    };
    const getMemberStatus = (m: WorkspaceMember) => {
        if (m.user_id === currentUserId) return myStatus || 'online';
        const peer = peerList.find(p => p.id === m.user_id);
        return peer?.status || 'offline';
    };

    // Seat counter: non-guest members + active guest invites
    const nonGuestMembers = members.filter(m => m.role !== 'guest');
    const usedSeats = nonGuestMembers.length + guestInvites.length;

    // Online members
    const onlineMembers = members.filter(m => isOnline(m));

    // Grouped by role (with search)
    const grouped = ROLE_ORDER.map(r => ({
        role: r, config: ROLE_CONFIG[r],
        members: members.filter(m => m.role === r && (searchQuery ? (getName(m).toLowerCase().includes(searchQuery.toLowerCase()) || (m.profile?.email || '').toLowerCase().includes(searchQuery.toLowerCase())) : true)),
    })).filter(g => g.members.length > 0);

    const isManager = myRole === 'owner' || myRole === 'admin';

    // ─── MemberRow ───
    const MemberRow = ({ m, showRole = false, compact = false }: { m: WorkspaceMember; showRole?: boolean; compact?: boolean }) => {
        const online = isOnline(m);
        const status = getMemberStatus(m);
        const isMe = m.user_id === currentUserId;
        const roleConfig = ROLE_CONFIG[m.role];
        const RIcon = roleConfig.icon;
        const showKick = !isMe && isManager && canKickMember(m.role);
        const isKicking = kickingUserId === m.user_id;

        return (
            <div className={`group flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors ${isMe ? 'bg-primary-500/5' : 'hover:bg-white/5'}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[status] || STATUS_DOT.offline}`} />
                <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-medium truncate ${online ? 'text-slate-200' : 'text-slate-500'}`}>
                        {isMe ? `${getName(m)} (${t('team.you')})` : getName(m)}
                    </p>
                </div>
                {showRole && <RIcon className={`w-3 h-3 ${roleConfig.color} opacity-40 flex-shrink-0`} />}
                {!isMe && online && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const mp = useAvatarStore.getState().myProfile;
                            const socket = (window as any).__partykitSocket;
                            if (socket?.readyState === WebSocket.OPEN && mp) {
                                const callId = crypto.randomUUID();
                                socket.send(JSON.stringify({
                                    type: 'call_request', id: callId,
                                    fromUserId: currentUserId, fromName: mp.display_name || mp.full_name || 'User',
                                    fromAvatarUrl: mp.avatar_url || null, toUserId: m.user_id,
                                }));
                                useCallStore.getState().setOutgoingCall({
                                    id: callId, fromUserId: currentUserId || '', fromName: mp.display_name || mp.full_name || 'User',
                                    toUserId: m.user_id, toName: getName(m), timestamp: Date.now(), status: 'pending',
                                });
                                setTimeout(() => {
                                    const current = useCallStore.getState().outgoingCall;
                                    if (current?.id === callId) { useCallStore.getState().setOutgoingCall(null); useCallStore.getState().setCallResponse({ type: 'timeout', fromName: getName(m) }); }
                                }, 30000);
                            }
                        }}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded-md hover:bg-primary-500/20 text-slate-500 hover:text-primary-400 transition-all"
                        title={t('team.callTooltip', { name: getName(m) })}
                    >
                        <Phone className="w-3 h-3" />
                    </button>
                )}
                {showKick && (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleKick(m.user_id, getName(m)); }}
                        disabled={isKicking}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded-md hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                        title={t('team.removeTooltip', { name: getName(m) })}
                    >
                        {isKicking ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserX className="w-3 h-3" />}
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="mt-1 space-y-1">
            {/* Main Toggle */}
            <Button
                variant="ghost"
                onClick={() => setShowPanel(!showPanel)}
                className="w-full justify-start gap-3 transition-all duration-300 bg-primary-500/20 text-primary-300 shadow-[inset_0_0_20px_rgba(99,102,241,0.2)]"
            >
                <Users className="w-5 h-5 flex-shrink-0" />
                <span className="whitespace-nowrap">{t('team.title')}</span>
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400">
                    {usedSeats}
                </span>
                <ChevronDown className={`w-3 h-3 flex-shrink-0 opacity-50 transition-transform ${showPanel ? '' : '-rotate-90'}`} />
            </Button>

            <AnimatePresence initial={false}>
                {showPanel && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        {/* Recap Utenti (no progressBar) */}
                        <div className="px-3 py-2 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] text-slate-600">
                                    👤 {nonGuestMembers.length} {t('team.members')}
                                </span>
                                <span className="text-[9px] text-slate-600">
                                    🎫 {guestInvites.length} {t('team.guests')}
                                </span>
                            </div>
                        </div>

                        {/* Search (managers only) */}
                        {isManager && (
                            <div className="px-3 pb-1">
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
                                    <input type="text" placeholder={t('team.search')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-7 pr-2 py-1 bg-white/5 border border-white/5 rounded-lg text-[10px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/20" />
                                </div>
                            </div>
                        )}

                        <div className="border-t border-white/5 px-2 pb-2 pt-1 space-y-1">
                            {/* Online section */}
                            <div className="pb-1">
                                <div className="flex items-center gap-2 px-2 py-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest">{t('team.online')} ({onlineMembers.length})</span>
                                </div>
                                <div className="space-y-0.5">
                                    {onlineMembers.map(m => <MemberRow key={`online-${m.user_id}`} m={m} showRole compact />)}
                                </div>
                            </div>

                            {/* All by role */}
                            {grouped.map(({ role: r, config, members: groupMembers }) => {
                                const RIcon = config.icon;
                                return (
                                    <div key={r}>
                                        <div className="flex items-center gap-1.5 px-2 py-1">
                                            <RIcon className={`w-3 h-3 ${config.color}`} />
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${config.color}`}>{config.label}</span>
                                            <span className="text-[10px] text-slate-600 ml-auto">{groupMembers.length}</span>
                                        </div>
                                        <div className="space-y-0.5">
                                            {groupMembers.map(m => <MemberRow key={m.user_id} m={m} />)}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Guest invites section (visible to managers) */}
                            {isManager && guestInvites.length > 0 && (
                                <div className="pt-1 border-t border-white/5">
                                    <div className="flex items-center gap-1.5 px-2 py-1">
                                        <Link2 className="w-3 h-3 text-purple-400" />
                                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">{t('team.guestInvites')}</span>
                                        <span className="text-[10px] text-slate-600 ml-auto">{guestInvites.length}</span>
                                    </div>
                                    <div className="space-y-0.5">
                                        {guestInvites.map(inv => (
                                            <div key={inv.id} className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                                                <Star className="w-3 h-3 text-purple-400 opacity-50 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] text-slate-300 truncate">{inv.label || t('team.guestInviteLabel')}</p>
                                                    <p className="text-[9px] text-slate-600">{inv.use_count} {t('team.accesses')}</p>
                                                </div>
                                                <button onClick={() => copyInviteLink(inv.token)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-all">
                                                    {copiedToken === inv.token ? <span className="text-[9px] text-emerald-400">✓</span> : <Copy className="w-2.5 h-2.5" />}
                                                </button>
                                                <button onClick={() => revokeGuestInvite(inv.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all">
                                                    <Trash2 className="w-2.5 h-2.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
