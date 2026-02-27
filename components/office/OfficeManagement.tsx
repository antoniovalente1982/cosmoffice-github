'use client';

import { useState, useEffect, useRef } from 'react';
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
    Loader2
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

    // Invite state
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'member' | 'admin' | 'guest'>('member');
    const [inviting, setInviting] = useState(false);
    const [inviteResult, setInviteResult] = useState<'idle' | 'success' | 'error'>('idle');
    const [inviteError, setInviteError] = useState('');

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

    const handleInvite = async () => {
        if (!inviteEmail || !workspaceId) return;
        setInviting(true);
        setInviteError('');

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setInviting(false); return; }

        const { error } = await supabase
            .from('workspace_invitations')
            .insert({
                workspace_id: workspaceId,
                email: inviteEmail,
                role: inviteRole,
                invited_by: user.id,
                token: crypto.randomUUID(),
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            });

        if (error) {
            console.error('Invite error:', error);
            setInviteError(error.message?.includes('duplicate')
                ? 'Utente già invitato'
                : 'Errore nell\'invio dell\'invito');
            setInviteResult('error');
        } else {
            setInviteResult('success');
            setInviteEmail('');
        }
        setInviting(false);
        setTimeout(() => { setInviteResult('idle'); setInviteError(''); }, 4000);
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
                                <div className="space-y-3">
                                    <p className="text-sm text-slate-400">
                                        Invita un nuovo membro nel workspace. Riceverà un invito via email.
                                    </p>
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
                                    <div className="space-y-1.5">
                                        <label className="text-xs text-slate-400 font-medium ml-1">Ruolo</label>
                                        <div className="flex gap-2">
                                            {(['member', 'admin', 'guest'] as const).map(role => (
                                                <button
                                                    key={role}
                                                    onClick={() => setInviteRole(role)}
                                                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${inviteRole === role
                                                        ? 'bg-primary-500/15 text-primary-300 ring-1 ring-primary-500/30'
                                                        : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800/60'
                                                        }`}
                                                >
                                                    {role === 'member' ? '👤 Membro' : role === 'admin' ? '🛡️ Admin' : '🎫 Ospite'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleInvite}
                                    disabled={inviting || !inviteEmail}
                                    className={`w-full gap-2 font-semibold rounded-xl py-2.5 ${inviteResult === 'success'
                                        ? 'bg-emerald-500'
                                        : inviteResult === 'error'
                                            ? 'bg-red-500'
                                            : 'bg-primary-500 hover:bg-primary-400 shadow-lg shadow-primary-500/20'
                                        }`}
                                >
                                    {inviting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : inviteResult === 'success' ? (
                                        <><Check className="w-4 h-4" /> Invito inviato!</>
                                    ) : inviteResult === 'error' ? (
                                        inviteError || 'Errore'
                                    ) : (
                                        <><UserPlus className="w-4 h-4" /> Invia invito</>
                                    )}
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}

export default OfficeManagement;
