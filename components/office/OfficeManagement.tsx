'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import {
    X,
    UserPlus,
    Check,
    Users,
    Camera,
    User,
    Building2,
    Mail,
    Globe,
    Clock,
    Loader2,
    Link2,
    Copy,
    Trash2,
    CheckCircle2,
    ExternalLink,
    Shield,
    Star
} from 'lucide-react';
import { Button } from '../ui/button';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { motion, AnimatePresence } from 'framer-motion';

const supabase = createClient();

interface Props {
    spaceId: string;
    onClose: () => void;
}

type Tab = 'profile' | 'workspace' | 'invites';

const STATUS_OPTIONS = [
    { value: 'online', emoji: '🟢', label: 'Online' },
    { value: 'busy', emoji: '🔴', label: 'Occupato' },
    { value: 'away', emoji: '🟡', label: 'Assente' },
    { value: 'invisible', emoji: '⚫', label: 'Invisibile' },
];

const TIMEZONES = [
    'Europe/Rome', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Dubai', 'Australia/Sydney',
    'Pacific/Auckland', 'America/Sao_Paulo',
];

export function OfficeManagement({ spaceId, onClose }: Props) {
    const { setMyProfile } = useOfficeStore();
    const [activeTab, setActiveTab] = useState<Tab>('profile');

    // Profile state
    const [fullName, setFullName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [userStatus, setUserStatus] = useState('online');
    const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome');
    const [userEmail, setUserEmail] = useState('');
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<'idle' | 'success' | 'error'>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Workspace state
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);
    const [workspaceName, setWorkspaceName] = useState('');
    const [workspaceDescription, setWorkspaceDescription] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);

    // Invite state
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

    // Load profile and workspace data
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (cancelled || !user) return;

            setUserEmail(user.email || '');

            // Load profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (!cancelled && profile) {
                setFullName(profile.full_name || '');
                setDisplayName(profile.display_name || '');
                setAvatarUrl(profile.avatar_url || '');
                setUserStatus(profile.status || 'online');
                setTimezone(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
            }

            // Load workspace via space
            const { data: spaceData } = await supabase
                .from('spaces')
                .select('workspace_id')
                .eq('id', spaceId)
                .single();

            if (cancelled || !spaceData) return;
            setWorkspaceId(spaceData.workspace_id);

            // Load workspace info
            const { data: ws } = await supabase
                .from('workspaces')
                .select('name, description, created_by')
                .eq('id', spaceData.workspace_id)
                .single();

            if (!cancelled && ws) {
                setWorkspaceName(ws.name || '');
                setWorkspaceDescription(ws.description || '');
                setIsAdmin(ws.created_by === user.id);
            }

            // Check admin role
            const { data: member } = await supabase
                .from('workspace_members')
                .select('role')
                .eq('workspace_id', spaceData.workspace_id)
                .eq('user_id', user.id)
                .is('removed_at', null)
                .single();

            if (!cancelled && member) {
                setIsAdmin(member.role === 'owner' || member.role === 'admin');
                setUserRole(member.role);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [spaceId]);

    const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            if (!event.target.files || event.target.files.length === 0) return;

            const file = event.target.files[0];
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Non autenticato');

            // Compress/resize if needed (max 500x500)
            const compressed = await compressImage(file, 500, 500);

            const fileExt = file.name.split('.').pop() || 'jpg';
            const filePath = `${user.id}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, compressed, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            setAvatarUrl(publicUrl);

            // Auto-save avatar immediately
            await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            setMyProfile({ avatar_url: publicUrl });
        } catch (error) {
            console.error('Error uploading avatar:', error);
            setSaveResult('error');
            setTimeout(() => setSaveResult('idle'), 3000);
        } finally {
            setUploading(false);
        }
    };

    const compressImage = (file: File, maxW: number, maxH: number): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                if (width > maxW || height > maxH) {
                    const ratio = Math.min(maxW / width, maxH / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('No canvas context'));
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(
                    (blob) => blob ? resolve(blob) : reject(new Error('Compression failed')),
                    'image/jpeg',
                    0.85
                );
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    };

    const saveProfile = async () => {
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setSaving(false); return; }

        const updates = {
            full_name: fullName,
            display_name: displayName || null,
            avatar_url: avatarUrl || null,
            status: userStatus,
            timezone,
        };

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id);

        if (!error) {
            setMyProfile(updates);
            setSaveResult('success');
        } else {
            console.error('Error saving profile:', error);
            setSaveResult('error');
        }
        setSaving(false);
        setTimeout(() => setSaveResult('idle'), 3000);
    };

    const saveWorkspace = async () => {
        if (!workspaceId) return;
        setSaving(true);
        const { error } = await supabase
            .from('workspaces')
            .update({ name: workspaceName, description: workspaceDescription })
            .eq('id', workspaceId);

        setSaveResult(error ? 'error' : 'success');
        setSaving(false);
        setTimeout(() => setSaveResult('idle'), 3000);
    };

    // Roles available based on current user role
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

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: 'profile', label: 'Profilo', icon: <User className="w-4 h-4" /> },
        { key: 'workspace', label: 'Workspace', icon: <Building2 className="w-4 h-4" /> },
        { key: 'invites', label: 'Inviti', icon: <Mail className="w-4 h-4" /> },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.92, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.92, opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full max-w-2xl bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-slate-800/50 to-transparent">
                    <h2 className="text-lg font-bold text-slate-100">Impostazioni</h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-400 hover:text-white hover:bg-white/10">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 px-5 pt-4 pb-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === tab.key
                                ? 'bg-primary-500/15 text-primary-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto max-h-[65vh]">
                    <AnimatePresence mode="wait">
                        {/* ── PROFILE TAB ── */}
                        {activeTab === 'profile' && (
                            <motion.div
                                key="profile"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="space-y-6"
                            >
                                {/* Avatar section */}
                                <div className="flex items-center gap-5">
                                    <div className="relative group">
                                        <div className="w-24 h-24 rounded-2xl overflow-hidden ring-2 ring-primary-500/30 shadow-xl">
                                            {avatarUrl ? (
                                                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-3xl font-bold text-slate-400">
                                                    {(displayName || fullName || '?')[0]?.toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
                                            className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer disabled:cursor-wait"
                                        >
                                            {uploading ? (
                                                <Loader2 className="w-6 h-6 text-white animate-spin" />
                                            ) : (
                                                <Camera className="w-6 h-6 text-white" />
                                            )}
                                        </button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={uploadAvatar}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <h3 className="text-base font-semibold text-slate-100">{displayName || fullName || 'Il tuo profilo'}</h3>
                                        <p className="text-sm text-slate-500">{userEmail}</p>
                                        <p className="text-xs text-slate-600">Clicca sull&apos;avatar per cambiarlo • Max 5MB</p>
                                    </div>
                                </div>

                                {/* Name fields */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs text-slate-400 font-medium ml-1">Nome completo</label>
                                        <input
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="Mario Rossi"
                                            className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs text-slate-400 font-medium ml-1">Display name</label>
                                        <input
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            placeholder="Mario"
                                            className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Status + Timezone */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs text-slate-400 font-medium ml-1 flex items-center gap-1.5">
                                            <Globe className="w-3 h-3" /> Stato
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {STATUS_OPTIONS.map(opt => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => setUserStatus(opt.value)}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${userStatus === opt.value
                                                        ? 'bg-primary-500/15 text-primary-300 ring-1 ring-primary-500/30'
                                                        : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-300'
                                                        }`}
                                                >
                                                    <span>{opt.emoji}</span>
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs text-slate-400 font-medium ml-1 flex items-center gap-1.5">
                                            <Clock className="w-3 h-3" /> Fuso orario
                                        </label>
                                        <select
                                            value={timezone}
                                            onChange={(e) => setTimezone(e.target.value)}
                                            className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-primary-500/50 transition-all appearance-none"
                                        >
                                            {TIMEZONES.map(tz => (
                                                <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Save button */}
                                <Button
                                    onClick={saveProfile}
                                    disabled={saving}
                                    className={`w-full gap-2 font-semibold rounded-xl py-2.5 transition-all ${saveResult === 'success'
                                        ? 'bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
                                        : saveResult === 'error'
                                            ? 'bg-red-500 hover:bg-red-400'
                                            : 'bg-primary-500 hover:bg-primary-400 shadow-lg shadow-primary-500/20'
                                        }`}
                                >
                                    {saving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : saveResult === 'success' ? (
                                        <><Check className="w-4 h-4" /> Salvato!</>
                                    ) : saveResult === 'error' ? (
                                        'Errore nel salvataggio'
                                    ) : (
                                        'Salva profilo'
                                    )}
                                </Button>
                            </motion.div>
                        )}

                        {/* ── WORKSPACE TAB ── */}
                        {activeTab === 'workspace' && (
                            <motion.div
                                key="workspace"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="space-y-5"
                            >
                                {isAdmin ? (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="text-xs text-slate-400 font-medium ml-1">Nome workspace</label>
                                            <input
                                                value={workspaceName}
                                                onChange={(e) => setWorkspaceName(e.target.value)}
                                                className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs text-slate-400 font-medium ml-1">Descrizione</label>
                                            <textarea
                                                value={workspaceDescription}
                                                onChange={(e) => setWorkspaceDescription(e.target.value)}
                                                rows={3}
                                                placeholder="Descrivi il tuo workspace..."
                                                className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all resize-none"
                                            />
                                        </div>
                                        <Button
                                            onClick={saveWorkspace}
                                            disabled={saving}
                                            className={`w-full gap-2 font-semibold rounded-xl py-2.5 ${saveResult === 'success' ? 'bg-emerald-500' : 'bg-primary-500 hover:bg-primary-400 shadow-lg shadow-primary-500/20'
                                                }`}
                                        >
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveResult === 'success' ? <><Check className="w-4 h-4" /> Salvato!</> : 'Salva workspace'}
                                        </Button>
                                    </>
                                ) : (
                                    <div className="text-center py-12 space-y-3 text-slate-500">
                                        <Building2 className="w-10 h-10 mx-auto opacity-40" />
                                        <p className="text-sm">Solo gli admin possono modificare le impostazioni del workspace</p>
                                        <p className="text-xs">Workspace: <span className="text-slate-300 font-medium">{workspaceName}</span></p>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ── INVITES TAB ── */}
                        {activeTab === 'invites' && (
                            <motion.div
                                key="invites"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="space-y-5"
                            >
                                {!canInvite ? (
                                    <div className="text-center py-12 space-y-3 text-slate-500">
                                        <UserPlus className="w-10 h-10 mx-auto opacity-40" />
                                        <p className="text-sm">Solo i membri, admin e owner possono invitare.</p>
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
                                            {/* Email input (only for email mode) */}
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

                                        {/* Generated link display */}
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
                                            className={`w-full gap-2 font-semibold rounded-xl py-2.5 ${inviteResult === 'success' && !generatedLink
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
                                            <div className="space-y-2 pt-2">
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
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}

export default OfficeManagement;
