'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import {
    X,
    UserPlus,
    Check,
    Users,
    Loader2,
    Link2,
    Copy,
    Trash2,
    CheckCircle2,
    Shield,
    MapPin,
} from 'lucide-react';
import { Button } from '../ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import UpgradeBanner from '../ui/UpgradeBanner';
import { useT } from '../../lib/i18n';

const supabase = createClient();

type InviteRole = 'admin' | 'member' | 'guest';

interface InvitePanelProps {
    spaceId: string;
    isOpen: boolean;
    onClose: () => void;
    /** Roles this user is allowed to assign (computed from useWorkspaceRole) */
    invitableRoles: string[];
}

export function InvitePanel({ spaceId, isOpen, onClose, invitableRoles }: InvitePanelProps) {
    const { t } = useT();
    const ROLE_LABELS: Record<InviteRole, { emoji: string; label: string; description: string }> = {
        admin: { emoji: '🛡️', label: t('invitePanel.roleAdmin'), description: t('invitePanel.roleAdminDesc') },
        member: { emoji: '👤', label: t('invitePanel.roleMember'), description: t('invitePanel.roleMemberDesc') },
        guest: { emoji: '🎫', label: t('invitePanel.roleGuest'), description: t('invitePanel.roleGuestDesc') },
    };
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);

    const [inviteRole, setInviteRole] = useState<InviteRole>('member');
    const [inviting, setInviting] = useState(false);
    const [inviteResult, setInviteResult] = useState<'idle' | 'success' | 'error'>('idle');
    const [inviteError, setInviteError] = useState('');

    const [generatedLink, setGeneratedLink] = useState('');
    const [copiedLink, setCopiedLink] = useState(false);
    const [activeInvites, setActiveInvites] = useState<any[]>([]);
    const [loadingInvites, setLoadingInvites] = useState(false);
    const [limitInfo, setLimitInfo] = useState<{ current: number; max: number; plan: string } | null>(null);
    const [rooms, setRooms] = useState<any[]>([]);
    const [destinationRoomId, setDestinationRoomId] = useState<string>('');
    const isAtLimit = limitInfo ? limitInfo.current >= limitInfo.max : false;

    const panelRef = useRef<HTMLDivElement>(null);

    // Set default invite role to first available
    useEffect(() => {
        if (invitableRoles.length > 0 && !invitableRoles.includes(inviteRole)) {
            setInviteRole(invitableRoles[0] as InviteRole);
        }
    }, [invitableRoles, inviteRole]);

    // Load workspace data + seat check (non-guest members + active guest invites)
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        const load = async () => {
            const { data: spaceData } = await supabase
                .from('spaces')
                .select('workspace_id')
                .eq('id', spaceId)
                .single();

            if (cancelled || !spaceData) return;
            setWorkspaceId(spaceData.workspace_id);

            // Check plan limits (seat-based)
            const { data: wsData } = await supabase.from('workspaces')
                .select('max_members, plan').eq('id', spaceData.workspace_id).single();

            // Count all active members (non-removed)
            const { count: memberCount } = await supabase.from('workspace_members')
                .select('*', { count: 'exact', head: true })
                .eq('workspace_id', spaceData.workspace_id)
                .is('removed_at', null);

            if (wsData) {
                setLimitInfo({ current: memberCount || 0, max: wsData.max_members || 3, plan: wsData.plan || 'free' });
            }

            // Load rooms for destination selector
            const { data: roomsData } = await supabase
                .from('rooms')
                .select('id, name')
                .eq('space_id', spaceId)
                .order('name');
            setRooms(roomsData || []);
        };
        load();
        return () => { cancelled = true; };
    }, [spaceId, isOpen]);



    const handleGenerateLink = async () => {
        if (!workspaceId || isAtLimit) return;
        setInviting(true);
        setInviteError('');
        setGeneratedLink('');

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setInviting(false); return; }

        const token = crypto.randomUUID();

        const insertData: any = {
            workspace_id: workspaceId,
            role: inviteRole,
            invited_by: user.id,
            token,
            invite_type: 'link',
            // All links permanent & unlimited — capacity enforced by office max_capacity
            max_uses: null,
            expires_at: null,
            destination_room_id: destinationRoomId || null,
            label: `Link ${ROLE_LABELS[inviteRole]?.label || inviteRole} - ${new Date().toLocaleDateString('it-IT')}`,
        };

        const { error } = await supabase
            .from('workspace_invitations')
            .insert(insertData);

        if (error) {
            console.error('Invite error:', error);
            setInviteError(t('invitePanel.linkError'));
            setInviteResult('error');
        } else {
            setInviteResult('success');
            const link = `${window.location.origin}/invite/${token}`;
            setGeneratedLink(link);
            navigator.clipboard.writeText(link).then(() => setCopiedLink(true));
            setTimeout(() => setCopiedLink(false), 3000);
            loadInvites();
        }
        setInviting(false);
        setTimeout(() => { setInviteResult('idle'); setInviteError(''); }, 4000);
    };

    const loadInvites = useCallback(async () => {
        if (!workspaceId) return;
        setLoadingInvites(true);
        const { data } = await supabase
            .from('workspace_invitations')
            .select('*')
            .eq('workspace_id', workspaceId)
            .is('revoked_at', null)
            .order('invited_at', { ascending: false })
            .limit(20);
        setActiveInvites(data || []);
        setLoadingInvites(false);
    }, [workspaceId]);

    useEffect(() => {
        if (workspaceId && isOpen) loadInvites();
    }, [workspaceId, isOpen, loadInvites]);

    const revokeInvite = async (inviteId: string) => {
        try {
            const res = await fetch('/api/workspaces/invites/revoke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inviteId, workspaceId })
            });
            if (!res.ok) throw new Error('Failed to revoke invite');
            loadInvites();
        } catch (err) {
            console.error('Error revoking invite:', err);
        }
    };

    const copyLink = (token: string) => {
        const link = `${window.location.origin}/invite/${token}`;
        navigator.clipboard.writeText(link);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    // Click outside to close
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 100);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClick);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const availableRoles = invitableRoles.filter(r => ['admin', 'member', 'guest'].includes(r)) as InviteRole[];

    return (
        <AnimatePresence>
            <motion.div
                ref={panelRef}
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                className="absolute top-full left-0 mt-2 w-[400px] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-[100]"
                style={{ background: '#0c1222', boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/10 to-transparent">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary-500/20">
                            <Link2 className="w-4 h-4 text-primary-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-100">{t('invitePanel.title')}</h3>
                            <p className="text-[10px] text-slate-500">{t('invitePanel.subtitle')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Role selection */}
                    <div className="space-y-2">
                        <label className="text-xs text-slate-400 font-medium ml-0.5 flex items-center gap-1.5">
                            <Shield className="w-3 h-3" /> {t('invitePanel.roleLabel')}
                        </label>
                        <div className="grid gap-2">
                            {availableRoles.map(role => {
                                const info = ROLE_LABELS[role];
                                return (
                                    <button
                                        key={role}
                                        onClick={() => setInviteRole(role)}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${inviteRole === role
                                            ? 'bg-primary-500/15 ring-1 ring-primary-500/30'
                                            : 'bg-slate-800/40 hover:bg-slate-800/60'
                                            }`}
                                    >
                                        <span className="text-base">{info.emoji}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-xs font-semibold ${inviteRole === role ? 'text-primary-300' : 'text-slate-300'}`}>
                                                {info.label}
                                            </div>
                                            <div className="text-[10px] text-slate-500 truncate">{info.description}</div>
                                        </div>
                                        {inviteRole === role && (
                                            <Check className="w-4 h-4 text-primary-400 flex-shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Destination Room Selector — available for all roles */}
                    <div className="space-y-1.5 mt-2">
                        <label className="text-[10px] text-slate-500 font-medium ml-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {t('invitePanel.destinationLabel')}
                        </label>
                        <select
                            value={destinationRoomId}
                            onChange={(e) => setDestinationRoomId(e.target.value)}
                            className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-primary-500/50 transition-all appearance-none cursor-pointer"
                        >
                            <option value="">{t('invitePanel.mainEntrance')}</option>
                            {rooms.map(room => (
                                <option key={room.id} value={room.id}>{room.name}</option>
                            ))}
                        </select>
                        <p className="text-[9px] text-slate-600 ml-0.5">{t('invitePanel.permanentNote')}</p>
                    </div>

                    {/* Generated link */}
                    {generatedLink && (
                        <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2"
                        >
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                <span className="text-xs text-emerald-300 font-medium">{t('invitePanel.linkCreated')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    readOnly
                                    value={generatedLink}
                                    className="flex-1 bg-slate-900/50 border border-white/5 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 outline-none font-mono"
                                />
                                <button
                                    onClick={() => { navigator.clipboard.writeText(generatedLink); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }}
                                    className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 transition-colors"
                                >
                                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Limit check */}
                    {isAtLimit && limitInfo && (
                        <UpgradeBanner
                            currentCount={limitInfo.current}
                            maxCount={limitInfo.max}
                            planName={limitInfo.plan}
                            className="mb-2"
                        />
                    )}

                    {/* Generate button */}
                    <Button
                        onClick={handleGenerateLink}
                        disabled={inviting || availableRoles.length === 0 || isAtLimit}
                        className={`w-full gap-2 font-semibold rounded-xl py-2.5 text-sm transition-all ${isAtLimit
                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                            : inviteResult === 'error'
                                ? 'bg-red-500 hover:bg-red-400'
                                : 'bg-gradient-to-r from-primary-500 to-indigo-500 hover:from-primary-400 hover:to-indigo-400 shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30'
                            }`}
                    >
                        {inviting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : inviteResult === 'error' ? (
                            inviteError || t('invitePanel.error')
                        ) : (
                            <><Link2 className="w-4 h-4" /> {t('invitePanel.generateButton')}</>
                        )}
                    </Button>

                    {/* Active invites list */}
                    {activeInvites.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-white/5">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs text-slate-400 font-medium">{t('invitePanel.activeInvites')}</h4>
                                <span className="text-[10px] text-slate-600 bg-slate-800/50 px-2 py-0.5 rounded-full">{activeInvites.length}</span>
                            </div>
                            <div className="space-y-1.5 max-h-36 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                                {activeInvites.map(inv => (
                                    <div key={inv.id}
                                        className="flex items-center gap-3 p-2 rounded-xl border transition-all bg-slate-800/40 border-white/5 hover:border-white/10"
                                    >
                                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-purple-500/15 text-purple-400">
                                            <Link2 className="w-3 h-3" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] text-slate-200 truncate">
                                                    {inv.label || t('invitePanel.inviteLabel')}
                                                </span>
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${inv.role === 'admin' ? 'bg-primary-500/15 text-primary-300'
                                                    : inv.role === 'guest' ? 'bg-purple-500/15 text-purple-300'
                                                        : 'bg-emerald-500/15 text-emerald-300'
                                                    }`}>
                                                    {inv.role}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[9px] text-emerald-500/70">{t('invitePanel.permanent')}</span>
                                                <span className="text-[9px] text-slate-600">
                                                    {inv.use_count || 0} {t('invitePanel.accesses')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => copyLink(inv.token)}
                                                className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
                                                title={t('invitePanel.copyLink')}
                                            >
                                                <Copy className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => revokeInvite(inv.id)}
                                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                                                title={t('invitePanel.deleteLink')}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence >
    );
}

export default InvitePanel;
