'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import {
    X,
    UserPlus,
    Check,
    Users,
    Mail,
    Clock,
    Loader2,
    Link2,
    Copy,
    Trash2,
    CheckCircle2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const supabase = createClient();

interface InvitePanelProps {
    spaceId: string;
    isOpen: boolean;
    onClose: () => void;
}

export function InvitePanel({ spaceId, isOpen, onClose }: InvitePanelProps) {
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);

    const [inviteMode, setInviteMode] = useState<'email' | 'link'>('link');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'member' | 'admin' | 'guest'>('member');
    const [inviting, setInviting] = useState(false);
    const [inviteResult, setInviteResult] = useState<'idle' | 'success' | 'error'>('idle');
    const [inviteError, setInviteError] = useState('');
    const [linkExpiry, setLinkExpiry] = useState<'1d' | '7d' | '30d' | 'never'>('7d');
    const [linkMaxUses, setLinkMaxUses] = useState<number | null>(null);
    const [generatedLink, setGeneratedLink] = useState('');
    const [copiedLink, setCopiedLink] = useState(false);
    const [activeInvites, setActiveInvites] = useState<any[]>([]);
    const [loadingInvites, setLoadingInvites] = useState(false);

    const panelRef = useRef<HTMLDivElement>(null);

    // Load workspace data
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (cancelled || !user) return;

            const { data: spaceData } = await supabase
                .from('spaces')
                .select('workspace_id')
                .eq('id', spaceId)
                .single();

            if (cancelled || !spaceData) return;
            setWorkspaceId(spaceData.workspace_id);

            const { data: member } = await supabase
                .from('workspace_members')
                .select('role')
                .eq('workspace_id', spaceData.workspace_id)
                .eq('user_id', user.id)
                .is('removed_at', null)
                .single();

            if (!cancelled && member) {
                setUserRole(member.role);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [spaceId, isOpen]);

    const availableRoles = userRole === 'owner'
        ? (['admin', 'member', 'guest'] as const)
        : userRole === 'admin'
            ? (['member', 'guest'] as const)
            : (['member', 'guest'] as const);

    const canInvite = userRole && userRole !== 'guest' && userRole !== 'viewer';

    const getExpiryDate = () => {
        const now = Date.now();
        switch (linkExpiry) {
            case '1d': return new Date(now + 1 * 24 * 60 * 60 * 1000).toISOString();
            case '7d': return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
            case '30d': return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
            case 'never': return null;
        }
    };

    const handleInvite = async () => {
        if (!workspaceId) return;
        if (inviteMode === 'email' && !inviteEmail) return;
        setInviting(true);
        setInviteError('');
        setGeneratedLink('');

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setInviting(false); return; }

        const token = crypto.randomUUID();
        const expiresAt = getExpiryDate();

        const insertData: any = {
            workspace_id: workspaceId,
            role: inviteRole,
            invited_by: user.id,
            token,
            invite_type: inviteMode,
        };

        if (expiresAt) insertData.expires_at = expiresAt;

        if (inviteMode === 'email') {
            insertData.email = inviteEmail;
            insertData.max_uses = 1;
        } else {
            insertData.max_uses = linkMaxUses;
            insertData.label = `Link ${inviteRole} - ${new Date().toLocaleDateString('it-IT')}`;
        }

        const { error } = await supabase
            .from('workspace_invitations')
            .insert(insertData);

        if (error) {
            console.error('Invite error:', error);
            setInviteError(error.message?.includes('duplicate')
                ? 'Utente già invitato'
                : 'Errore nella creazione dell\'invito');
            setInviteResult('error');
        } else {
            setInviteResult('success');
            if (inviteMode === 'email') {
                setInviteEmail('');
            } else {
                const link = `${window.location.origin}/invite/${token}`;
                setGeneratedLink(link);
                navigator.clipboard.writeText(link).then(() => setCopiedLink(true));
                setTimeout(() => setCopiedLink(false), 3000);
            }
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
        if (workspaceId && canInvite) loadInvites();
    }, [workspaceId, canInvite, loadInvites]);

    const revokeInvite = async (inviteId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase
            .from('workspace_invitations')
            .update({ revoked_at: new Date().toISOString(), revoked_by: user.id })
            .eq('id', inviteId);
        loadInvites();
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
        // Delay to avoid instant close from the trigger click
        const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 100);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClick);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                ref={panelRef}
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                className="absolute top-full left-0 mt-2 w-[420px] bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-[100]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-primary-500/10 to-transparent">
                    <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-primary-400" />
                        <h3 className="text-sm font-bold text-slate-100">Invita nel workspace</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-4">
                    {!canInvite ? (
                        <div className="text-center py-8 space-y-2 text-slate-500">
                            <UserPlus className="w-8 h-8 mx-auto opacity-40" />
                            <p className="text-xs">Solo i membri, admin e owner possono invitare.</p>
                        </div>
                    ) : (
                        <>
                            {/* Mode toggle */}
                            <div className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-xl">
                                <button
                                    onClick={() => setInviteMode('link')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${inviteMode === 'link' ? 'bg-primary-500/20 text-primary-300 shadow' : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                >
                                    <Link2 className="w-3.5 h-3.5" />
                                    Link invito
                                </button>
                                <button
                                    onClick={() => setInviteMode('email')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${inviteMode === 'email' ? 'bg-primary-500/20 text-primary-300 shadow' : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                >
                                    <Mail className="w-3.5 h-3.5" />
                                    Email
                                </button>
                            </div>

                            <div className="space-y-3">
                                {/* Email input */}
                                {inviteMode === 'email' && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs text-slate-400 font-medium ml-1">Email</label>
                                        <input
                                            type="email"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            placeholder="collega@azienda.com"
                                            className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all"
                                            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                                        />
                                    </div>
                                )}

                                {/* Role selection */}
                                <div className="space-y-1.5">
                                    <label className="text-xs text-slate-400 font-medium ml-1">Ruolo</label>
                                    <div className="flex gap-2">
                                        {availableRoles.map(role => (
                                            <button
                                                key={role}
                                                onClick={() => setInviteRole(role)}
                                                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${inviteRole === role
                                                    ? 'bg-primary-500/15 text-primary-300 ring-1 ring-primary-500/30'
                                                    : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800/60'
                                                    }`}
                                            >
                                                {role === 'admin' ? '🛡️ Admin' : role === 'member' ? '👤 Membro' : '🎫 Ospite'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Link options */}
                                {inviteMode === 'link' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-xs text-slate-400 font-medium ml-1 flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> Scadenza
                                            </label>
                                            <select
                                                value={linkExpiry}
                                                onChange={(e) => setLinkExpiry(e.target.value as any)}
                                                className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-primary-500/50 transition-all appearance-none"
                                            >
                                                <option value="1d">1 giorno</option>
                                                <option value="7d">7 giorni</option>
                                                <option value="30d">30 giorni</option>
                                                <option value="never">Mai</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs text-slate-400 font-medium ml-1 flex items-center gap-1">
                                                <Users className="w-3 h-3" /> Max utilizzi
                                            </label>
                                            <select
                                                value={linkMaxUses ?? 'unlimited'}
                                                onChange={(e) => setLinkMaxUses(e.target.value === 'unlimited' ? null : parseInt(e.target.value))}
                                                className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-primary-500/50 transition-all appearance-none"
                                            >
                                                <option value="1">1 persona</option>
                                                <option value="5">5 persone</option>
                                                <option value="10">10 persone</option>
                                                <option value="25">25 persone</option>
                                                <option value="unlimited">Illimitato</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Generated link */}
                            {generatedLink && (
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                        <span className="text-xs text-emerald-300 font-medium">Link creato e copiato!</span>
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
                                </div>
                            )}

                            {/* Action button */}
                            <Button
                                onClick={handleInvite}
                                disabled={inviting || (inviteMode === 'email' && !inviteEmail)}
                                className={`w-full gap-2 font-semibold rounded-xl py-2.5 text-sm ${inviteResult === 'success' && !generatedLink
                                    ? 'bg-emerald-500'
                                    : inviteResult === 'error'
                                        ? 'bg-red-500'
                                        : 'bg-primary-500 hover:bg-primary-400 shadow-lg shadow-primary-500/20'
                                    }`}
                            >
                                {inviting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : inviteResult === 'success' && inviteMode === 'email' ? (
                                    <><Check className="w-4 h-4" /> Invito inviato!</>
                                ) : inviteResult === 'error' ? (
                                    inviteError || 'Errore'
                                ) : inviteMode === 'link' ? (
                                    <><Link2 className="w-4 h-4" /> Genera link invito</>
                                ) : (
                                    <><UserPlus className="w-4 h-4" /> Invia invito</>
                                )}
                            </Button>

                            {/* Active invites list */}
                            {activeInvites.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-white/5">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs text-slate-400 font-medium">Inviti attivi</h4>
                                        <span className="text-[10px] text-slate-600">{activeInvites.length}</span>
                                    </div>
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                                        {activeInvites.map(inv => {
                                            const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date();
                                            const isAccepted = inv.invite_type === 'email' && inv.accepted_at;
                                            const isExhausted = inv.invite_type === 'link' && inv.max_uses && inv.use_count >= inv.max_uses;

                                            return (
                                                <div key={inv.id}
                                                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${isExpired || isAccepted || isExhausted
                                                        ? 'bg-slate-800/20 border-white/5 opacity-60'
                                                        : 'bg-slate-800/40 border-white/5 hover:border-white/10'
                                                        }`}
                                                >
                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${inv.invite_type === 'link' ? 'bg-purple-500/15 text-purple-400' : 'bg-primary-500/15 text-primary-400'
                                                        }`}>
                                                        {inv.invite_type === 'link' ? <Link2 className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-slate-200 truncate">
                                                                {inv.email || inv.label || 'Link invito'}
                                                            </span>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${inv.role === 'admin' ? 'bg-primary-500/15 text-primary-300'
                                                                : inv.role === 'guest' ? 'bg-purple-500/15 text-purple-300'
                                                                    : 'bg-emerald-500/15 text-emerald-300'
                                                                }`}>
                                                                {inv.role}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            {isExpired && <span className="text-[9px] text-red-400">Scaduto</span>}
                                                            {isAccepted && <span className="text-[9px] text-emerald-400">Accettato</span>}
                                                            {isExhausted && <span className="text-[9px] text-amber-400">Esaurito</span>}
                                                            {!isExpired && !isAccepted && !isExhausted && inv.invite_type === 'link' && (
                                                                <span className="text-[9px] text-slate-500">
                                                                    {inv.use_count || 0}{inv.max_uses ? `/${inv.max_uses}` : ''} usi
                                                                </span>
                                                            )}
                                                            {inv.expires_at && !isExpired && (
                                                                <span className="text-[9px] text-slate-600">
                                                                    scade {new Date(inv.expires_at).toLocaleDateString('it-IT')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {inv.invite_type === 'link' && !isExpired && !isExhausted && (
                                                            <button
                                                                onClick={() => copyLink(inv.token)}
                                                                className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
                                                                title="Copia link"
                                                            >
                                                                <Copy className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                        {!isAccepted && (
                                                            <button
                                                                onClick={() => revokeInvite(inv.id)}
                                                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                                                                title="Revoca"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

export default InvitePanel;
