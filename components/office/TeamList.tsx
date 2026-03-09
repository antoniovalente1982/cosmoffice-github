'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAvatarStore } from '../../stores/avatarStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Crown, Shield, User, Star, ChevronDown, Users, UserX, Loader2, Phone,
    UserPlus, Link2, Copy, Check, Trash2, Clock, ArrowUpRight, AlertTriangle,
    Search, CheckCircle2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { useCallStore } from '../../stores/callStore';

const supabase = createClient();

type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest';
type InviteRole = 'admin' | 'member' | 'guest';
type PanelTab = 'team' | 'invite';

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

const ROLE_CONFIG: Record<WorkspaceRole, { icon: typeof Crown; label: string; color: string; dotColor: string; bgColor: string }> = {
    owner: { icon: Crown, label: 'Owner', color: 'text-amber-400', dotColor: 'bg-amber-400', bgColor: 'bg-amber-500/15' },
    admin: { icon: Shield, label: 'Admin', color: 'text-cyan-400', dotColor: 'bg-cyan-400', bgColor: 'bg-cyan-500/15' },
    member: { icon: User, label: 'Membri', color: 'text-slate-300', dotColor: 'bg-slate-400', bgColor: 'bg-slate-500/15' },
    guest: { icon: Star, label: 'Ospiti', color: 'text-purple-400', dotColor: 'bg-purple-400', bgColor: 'bg-purple-500/15' },
};

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = { owner: 3, admin: 2, member: 1, guest: 0 };
const ROLE_ORDER: WorkspaceRole[] = ['owner', 'admin', 'member', 'guest'];
const STATUS_DOT: Record<string, string> = {
    online: 'bg-emerald-500', away: 'bg-amber-500', busy: 'bg-red-500', offline: 'bg-slate-600',
};

const INVITE_ROLE_LABELS: Record<InviteRole, { emoji: string; label: string; desc: string }> = {
    admin: { emoji: '🛡️', label: 'Admin', desc: 'Gestisce spazi, stanze e membri' },
    member: { emoji: '👤', label: 'Membro', desc: 'Accesso completo all\'ufficio' },
    guest: { emoji: '🎫', label: 'Ospite', desc: 'Accesso limitato' },
};

interface TeamListProps {
    spaceId: string;
    workspaceId: string | null;
    role: string | null;
    canInvite: boolean;
    invitableRoles: string[];
}

export function TeamList({ spaceId, workspaceId, role, canInvite, invitableRoles }: TeamListProps) {
    const peers = useAvatarStore(s => s.peers);
    const myProfile = useAvatarStore(s => s.myProfile);
    const myStatus = useAvatarStore(s => s.myStatus);
    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [maxMembers, setMaxMembers] = useState(10);
    const [showPanel, setShowPanel] = useState(false);
    const [activeTab, setActiveTab] = useState<PanelTab>('team');
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [myRole, setMyRole] = useState<WorkspaceRole | null>(null);
    const [kickingUserId, setKickingUserId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Invite state
    const [inviteRole, setInviteRole] = useState<InviteRole>('member');
    const [inviting, setInviting] = useState(false);
    const [linkExpiry, setLinkExpiry] = useState<'1d' | '7d' | '30d' | 'never'>('7d');
    const [linkMaxUses, setLinkMaxUses] = useState<number | null>(null);
    const [generatedLink, setGeneratedLink] = useState('');
    const [copiedLink, setCopiedLink] = useState(false);
    const [activeInvites, setActiveInvites] = useState<any[]>([]);
    const [upgradeLoading, setUpgradeLoading] = useState(false);

    const peerList = Object.values(peers);

    // ─── Fetch members & workspace limits ───
    const fetchMembers = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);

        const wsId = workspaceId;
        if (!wsId) {
            // Fallback: lookup from space
            const { data: space } = await supabase.from('spaces').select('workspace_id').eq('id', spaceId).single();
            if (!space?.workspace_id) return;
        }

        const effectiveWsId = wsId || await supabase.from('spaces').select('workspace_id').eq('id', spaceId).single().then(r => r.data?.workspace_id);
        if (!effectiveWsId) return;

        // Fetch workspace limits
        const { data: ws } = await supabase.from('workspaces').select('max_members').eq('id', effectiveWsId).single();
        if (ws) setMaxMembers(ws.max_members || 10);

        // Fetch members
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
    }, [spaceId, workspaceId]);

    useEffect(() => { fetchMembers(); }, [fetchMembers]);

    // Realtime member updates
    useEffect(() => {
        if (!workspaceId) return;
        const channel = supabase.channel(`team-panel-${workspaceId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${workspaceId}` }, () => fetchMembers())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [workspaceId, fetchMembers]);

    // ─── Invite logic ───
    const loadInvites = useCallback(async () => {
        if (!workspaceId) return;
        const { data } = await supabase.from('workspace_invitations')
            .select('*').eq('workspace_id', workspaceId).is('revoked_at', null)
            .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
            .order('invited_at', { ascending: false }).limit(20);
        setActiveInvites(data || []);
    }, [workspaceId]);

    useEffect(() => {
        if (workspaceId && showPanel && activeTab === 'invite') loadInvites();
    }, [workspaceId, showPanel, activeTab, loadInvites]);

    const getExpiryDate = () => {
        const now = Date.now();
        switch (linkExpiry) {
            case '1d': return new Date(now + 86400000).toISOString();
            case '7d': return new Date(now + 604800000).toISOString();
            case '30d': return new Date(now + 2592000000).toISOString();
            case 'never': return null;
        }
    };

    const handleGenerateLink = async () => {
        if (!workspaceId || isAtLimit) return;
        setInviting(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setInviting(false); return; }
        const token = crypto.randomUUID();
        const { error } = await supabase.from('workspace_invitations').insert({
            workspace_id: workspaceId, role: inviteRole, invited_by: user.id,
            token, invite_type: 'link', max_uses: linkMaxUses, expires_at: getExpiryDate(),
            label: `Link ${inviteRole} - ${new Date().toLocaleDateString('it-IT')}`,
        });
        if (!error) {
            const link = `${window.location.origin}/invite/${token}`;
            setGeneratedLink(link);
            navigator.clipboard.writeText(link).then(() => setCopiedLink(true));
            setTimeout(() => setCopiedLink(false), 3000);
            loadInvites();
        }
        setInviting(false);
    };

    const revokeInvite = async (inviteId: string) => {
        await supabase.from('workspace_invitations').delete().eq('id', inviteId);
        loadInvites();
    };

    const copyLink = (token: string) => {
        navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    // ─── Kick & upgrade ───
    const handleKick = async (userId: string, userName: string) => {
        if (!workspaceId) return;
        if (!confirm(`Sei sicuro di voler rimuovere ${userName} dal workspace?`)) return;
        setKickingUserId(userId);
        try {
            const { data, error } = await supabase.rpc('kick_workspace_member', {
                p_workspace_id: workspaceId, p_target_user_id: userId,
            });
            if (error) { alert('Errore: ' + error.message); }
            else {
                const result = data as any;
                if (result?.success) setMembers(prev => prev.filter(m => m.user_id !== userId));
                else alert(result?.error || 'Errore sconosciuto');
            }
        } catch (err: any) { alert('Errore: ' + err.message); }
        setKickingUserId(null);
    };

    const canKickMember = (targetRole: WorkspaceRole) => {
        if (!myRole) return false;
        return ROLE_HIERARCHY[myRole] > ROLE_HIERARCHY[targetRole];
    };

    const handleUpgradeRequest = async () => {
        setUpgradeLoading(true);
        try {
            const res = await fetch('/api/upgrade-request', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId, type: 'seats' }),
            });
            if (res.ok) alert('✅ Richiesta di upgrade inviata!');
            else { const d = await res.json(); alert(d.error || 'Errore.'); }
        } catch { alert('Errore di rete.'); }
        setUpgradeLoading(false);
    };

    // ─── Helpers ───
    const getName = (m: WorkspaceMember) => {
        if (m.user_id === currentUserId && myProfile) return myProfile.display_name || myProfile.full_name || m.profile?.email || 'Ospite';
        return m.profile?.display_name || m.profile?.full_name || m.profile?.email || 'Ospite';
    };
    const getAvatarUrl = (m: WorkspaceMember) => {
        if (m.user_id === currentUserId && myProfile) return myProfile.avatar_url || m.profile?.avatar_url || null;
        return m.profile?.avatar_url || null;
    };
    const getInitials = (m: WorkspaceMember) => getName(m).split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    const isOnline = (m: WorkspaceMember) => {
        if (m.user_id === currentUserId) return true;
        const peer = peers[m.user_id];
        return !!peer && peer.position && peer.position.x !== -9999;
    };
    const getMemberStatus = (m: WorkspaceMember) => {
        if (m.user_id === currentUserId) return myStatus || 'online';
        const peer = peerList.find(p => p.id === m.user_id);
        return peer?.status || 'offline';
    };

    // Seat counter
    const usedSeats = members.length;
    const usagePercent = maxMembers > 0 ? Math.min((usedSeats / maxMembers) * 100, 100) : 0;
    const isAtLimit = usedSeats >= maxMembers;
    const isNearLimit = usagePercent >= 80;

    // Online members
    const onlineMembers = members.filter(m => isOnline(m));

    // Grouped by role
    const grouped = ROLE_ORDER.map(r => ({
        role: r, config: ROLE_CONFIG[r],
        members: members.filter(m => m.role === r && (searchQuery ? (getName(m).toLowerCase().includes(searchQuery.toLowerCase()) || (m.profile?.email || '').toLowerCase().includes(searchQuery.toLowerCase())) : true)),
    })).filter(g => g.members.length > 0);

    const isManager = myRole === 'owner' || myRole === 'admin';
    const availableInviteRoles = invitableRoles.filter(r => ['admin', 'member', 'guest'].includes(r)) as InviteRole[];

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
                        {isMe ? `${getName(m)} (Tu)` : getName(m)}
                    </p>
                    {!compact && m.profile?.email && (
                        <p className="text-[9px] text-slate-600 truncate">{m.profile.email}</p>
                    )}
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
                        title={`Chiedi di parlare con ${getName(m)}`}
                    >
                        <Phone className="w-3 h-3" />
                    </button>
                )}
                {showKick && (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleKick(m.user_id, getName(m)); }}
                        disabled={isKicking}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded-md hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                        title={`Rimuovi ${getName(m)}`}
                    >
                        {isKicking ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserX className="w-3 h-3" />}
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="mt-1 space-y-1">
            {/* Main Toggle Button */}
            <Button
                variant="ghost"
                onClick={() => setShowPanel(!showPanel)}
                className="w-full justify-start gap-3 transition-all duration-300 bg-primary-500/20 text-primary-300 shadow-[inset_0_0_20px_rgba(99,102,241,0.2)]"
            >
                <Users className="w-5 h-5 flex-shrink-0" />
                <span className="whitespace-nowrap">Team</span>
                {/* Seat counter mini badge */}
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isAtLimit ? 'bg-red-500/20 text-red-400' : isNearLimit ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-400'}`}>
                    {usedSeats}/{maxMembers}
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
                        {/* ── Seat Progress Bar ── */}
                        <div className="px-3 py-2">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Accessi</span>
                                <span className={`text-[10px] font-bold ${isAtLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-cyan-400'}`}>
                                    {usedSeats} / {maxMembers}
                                </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${usagePercent}%` }}
                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                    className={`h-full rounded-full ${isAtLimit ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : isNearLimit ? 'bg-amber-500' : 'bg-cyan-500'}`}
                                />
                            </div>
                            {isAtLimit && (
                                <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
                                    <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                                    <span className="text-[9px] text-red-300 flex-1">Limite raggiunto</span>
                                    {myRole === 'owner' && (
                                        <button onClick={handleUpgradeRequest} disabled={upgradeLoading}
                                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold text-white bg-gradient-to-r from-cyan-500 to-purple-500 shrink-0">
                                            {upgradeLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <><ArrowUpRight className="w-2.5 h-2.5" /> Upgrade</>}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── Tab Navigation ── */}
                        <div className="flex items-center gap-1 px-3 pb-1">
                            <button
                                onClick={() => setActiveTab('team')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'team' ? 'bg-primary-500/15 text-primary-300' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                            >
                                <Users className="w-3 h-3" /> Team
                            </button>
                            {canInvite && (
                                <button
                                    onClick={() => { setActiveTab('invite'); }}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'invite' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                                >
                                    <UserPlus className="w-3 h-3" /> Invita
                                </button>
                            )}
                        </div>

                        <div className="border-t border-white/5">
                            {/* ═══ TEAM TAB ═══ */}
                            {activeTab === 'team' && (
                                <div className="space-y-1 px-2 pb-2 pt-1">
                                    {/* Search (only for managers) */}
                                    {isManager && (
                                        <div className="relative mb-1">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
                                            <input
                                                type="text" placeholder="Cerca..."
                                                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                                className="w-full pl-7 pr-2 py-1 bg-white/5 border border-white/5 rounded-lg text-[10px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/20"
                                            />
                                        </div>
                                    )}

                                    {/* Online section (always first) */}
                                    <div className="pb-1">
                                        <div className="flex items-center gap-2 px-2 py-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest">
                                                Online ({onlineMembers.length})
                                            </span>
                                        </div>
                                        <div className="space-y-0.5">
                                            {onlineMembers.map(m => (
                                                <MemberRow key={`online-${m.user_id}`} m={m} showRole compact />
                                            ))}
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
                                </div>
                            )}

                            {/* ═══ INVITE TAB ═══ */}
                            {activeTab === 'invite' && canInvite && (
                                <div className="p-3 space-y-3">
                                    {isAtLimit ? (
                                        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-[11px] font-semibold text-red-300">Limite accessi raggiunto</p>
                                                <p className="text-[9px] text-red-400/70 mt-0.5">Richiedi un upgrade per invitare altri utenti.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Role selection */}
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                                    <Shield className="w-3 h-3" /> Ruolo
                                                </label>
                                                <div className="space-y-1">
                                                    {availableInviteRoles.map(r => {
                                                        const info = INVITE_ROLE_LABELS[r];
                                                        return (
                                                            <button key={r} onClick={() => setInviteRole(r)}
                                                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all ${inviteRole === r ? 'bg-primary-500/15 ring-1 ring-primary-500/30' : 'bg-slate-800/40 hover:bg-slate-800/60'}`}>
                                                                <span className="text-sm">{info.emoji}</span>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={`text-[11px] font-semibold ${inviteRole === r ? 'text-primary-300' : 'text-slate-300'}`}>{info.label}</p>
                                                                    <p className="text-[9px] text-slate-500 truncate">{info.desc}</p>
                                                                </div>
                                                                {inviteRole === r && <Check className="w-3.5 h-3.5 text-primary-400 shrink-0" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Options */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[9px] text-slate-600 font-medium flex items-center gap-1 mb-1"><Clock className="w-2.5 h-2.5" /> Scadenza</label>
                                                    <select value={linkExpiry} onChange={e => setLinkExpiry(e.target.value as any)}
                                                        className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-slate-200 outline-none">
                                                        <option value="1d">1 giorno</option>
                                                        <option value="7d">7 giorni</option>
                                                        <option value="30d">30 giorni</option>
                                                        <option value="never">Mai</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] text-slate-600 font-medium flex items-center gap-1 mb-1"><Users className="w-2.5 h-2.5" /> Max usi</label>
                                                    <select value={linkMaxUses ?? 'unlimited'} onChange={e => setLinkMaxUses(e.target.value === 'unlimited' ? null : parseInt(e.target.value))}
                                                        className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-slate-200 outline-none">
                                                        <option value="1">1</option><option value="5">5</option><option value="10">10</option>
                                                        <option value="25">25</option><option value="unlimited">∞</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Generated link */}
                                            {generatedLink && (
                                                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                        <span className="text-[10px] text-emerald-300 font-medium">Link copiato!</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <input readOnly value={generatedLink} className="flex-1 bg-slate-900/50 border border-white/5 rounded px-2 py-1 text-[9px] text-slate-300 outline-none font-mono" />
                                                        <button onClick={() => { navigator.clipboard.writeText(generatedLink); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }}
                                                            className="p-1.5 rounded hover:bg-slate-800/60 text-slate-300">
                                                            {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Generate button */}
                                            <button onClick={handleGenerateLink} disabled={inviting || isAtLimit}
                                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-primary-500 to-indigo-500 hover:from-primary-400 hover:to-indigo-400 disabled:opacity-40 transition-all shadow-lg shadow-primary-500/20">
                                                {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Link2 className="w-3.5 h-3.5" /> Genera link invito</>}
                                            </button>
                                        </>
                                    )}

                                    {/* Active invites */}
                                    {activeInvites.length > 0 && (
                                        <div className="space-y-1.5 pt-2 border-t border-white/5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-slate-400 font-medium">Inviti attivi</span>
                                                <span className="text-[9px] text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded-full">{activeInvites.length}</span>
                                            </div>
                                            <div className="space-y-1 max-h-28 overflow-y-auto">
                                                {activeInvites.map(inv => {
                                                    const expired = inv.expires_at && new Date(inv.expires_at) < new Date();
                                                    const exhausted = inv.max_uses && inv.use_count >= inv.max_uses;
                                                    return (
                                                        <div key={inv.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all ${expired || exhausted ? 'opacity-40 border-white/5' : 'border-white/5 hover:border-white/10'}`}>
                                                            <Link2 className="w-3 h-3 text-purple-400 shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-[10px] text-slate-200 truncate block">{inv.label || 'Link invito'}</span>
                                                                <span className="text-[9px] text-slate-600">{inv.use_count || 0}{inv.max_uses ? `/${inv.max_uses}` : ''} usi</span>
                                                            </div>
                                                            <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${inv.role === 'admin' ? 'bg-cyan-500/15 text-cyan-300' : inv.role === 'guest' ? 'bg-purple-500/15 text-purple-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{inv.role}</span>
                                                            {!expired && !exhausted && (
                                                                <button onClick={() => copyLink(inv.token)} className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300"><Copy className="w-2.5 h-2.5" /></button>
                                                            )}
                                                            <button onClick={() => revokeInvite(inv.id)} className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400"><Trash2 className="w-2.5 h-2.5" /></button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
