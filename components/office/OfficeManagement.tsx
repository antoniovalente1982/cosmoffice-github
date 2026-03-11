'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import {
    X,
    Check,
    Camera,
    Clock,
    Loader2,
    Shield,
    Star,
    Crown,
    User,
    Receipt,
    Building2,
    ChevronDown,
    FileText,
    CreditCard,
    History,
    Globe
} from 'lucide-react';
import { Button } from '../ui/button';
import { useAvatarStore } from '../../stores/avatarStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { OFFICE_THEMES, getThemeConfig, type OfficeThemeId } from '../../lib/officeThemes';
import { useT, LOCALE_FLAGS, LOCALE_NAMES, type Locale } from '../../lib/i18n';


const supabase = createClient();

interface Props {
    spaceId: string;
    onClose: () => void;
}

const ROLE_DISPLAY: Record<string, { icon: typeof Crown; label: string; color: string; bg: string }> = {
    owner: { icon: Crown, label: 'Owner', color: 'text-amber-400', bg: 'bg-amber-500/15' },
    admin: { icon: Shield, label: 'Admin', color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
    member: { icon: User, label: 'Membro', color: 'text-slate-300', bg: 'bg-slate-500/15' },
    guest: { icon: Star, label: 'Ospite', color: 'text-purple-400', bg: 'bg-purple-500/15' },
};

const TIMEZONES = [
    'Europe/Rome', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Dubai', 'Australia/Sydney',
    'Pacific/Auckland', 'America/Sao_Paulo',
];

export function OfficeManagement({ spaceId, onClose }: Props) {
    const { t, locale, setLocale } = useT();
    const setMyProfile = useAvatarStore(s => s.setMyProfile);
    const myProfile = useAvatarStore(s => s.myProfile);
    const isPerformanceMode = useWorkspaceStore(s => s.isPerformanceMode);
    const togglePerformanceMode = useWorkspaceStore(s => s.togglePerformanceMode);
    const theme = useWorkspaceStore(s => s.theme);
    const setTheme = useWorkspaceStore(s => s.setTheme);
    const [savingTheme, setSavingTheme] = useState(false);

    // Profile state — single "name" field syncs both full_name and display_name
    const [name, setName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [userRole, setUserRole] = useState<string | null>(null);
    const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome');
    const [userEmail, setUserEmail] = useState('');
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<'idle' | 'success' | 'error'>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'billing'>('profile');
    // Billing state
    const [bilCompany, setBilCompany] = useState('');
    const [bilVat, setBilVat] = useState('');
    const [bilFiscal, setBilFiscal] = useState('');
    const [bilSdi, setBilSdi] = useState('');
    const [bilPec, setBilPec] = useState('');
    const [bilAddress, setBilAddress] = useState('');
    const [bilCity, setBilCity] = useState('');
    const [bilZip, setBilZip] = useState('');
    const [bilCountry, setBilCountry] = useState('IT');
    const [payments, setPayments] = useState<any[]>([]);
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);
    const [workspaceName, setWorkspaceName] = useState('');

    // Load profile data
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
                // Use display_name first, fallback to full_name
                setName(profile.display_name || profile.full_name || '');
                setAvatarUrl(profile.avatar_url || '');
                setTimezone(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
                // Load billing data
                setBilCompany(profile.company_name || '');
                setBilVat(profile.vat_number || '');
                setBilFiscal(profile.fiscal_code || '');
                setBilSdi(profile.sdi_code || '');
                setBilPec(profile.pec || '');
                setBilAddress(profile.billing_address || '');
                setBilCity(profile.billing_city || '');
                setBilZip(profile.billing_zip || '');
                setBilCountry(profile.billing_country || 'IT');
            }

            // Fetch user role in this workspace
            if (!cancelled && user) {
                const { data: spaceData } = await supabase
                    .from('spaces')
                    .select('workspace_id')
                    .eq('id', spaceId)
                    .single();
                if (spaceData?.workspace_id) {
                    if (!cancelled) setWorkspaceId(spaceData.workspace_id);
                    const { data: member } = await supabase
                        .from('workspace_members')
                        .select('role')
                        .eq('workspace_id', spaceData.workspace_id)
                        .eq('user_id', user.id)
                        .is('removed_at', null)
                        .single();
                    if (!cancelled && member) setUserRole(member.role);
                    // Load workspace name
                    const { data: wsInfo } = await supabase
                        .from('workspaces')
                        .select('name')
                        .eq('id', spaceData.workspace_id)
                        .single();
                    if (!cancelled && wsInfo) setWorkspaceName(wsInfo.name);
                    // Load payments for owner/admin
                    if (member && (member.role === 'owner' || member.role === 'admin')) {
                        const { data: pays } = await supabase
                            .from('payments')
                            .select('*')
                            .eq('workspace_id', spaceData.workspace_id)
                            .order('payment_date', { ascending: false })
                            .limit(20);
                        if (!cancelled && pays) setPayments(pays);
                    }
                }
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
            if (!user) throw new Error(t('settings.notAuthenticated'));

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

        // Sync both full_name and display_name with the single "name" field
        const updates: any = {
            full_name: name,
            display_name: name || null,
            avatar_url: avatarUrl || null,
            timezone,
        };
        // Include billing data for owner/admin
        if (userRole === 'owner' || userRole === 'admin') {
            updates.company_name = bilCompany || null;
            updates.vat_number = bilVat || null;
            updates.fiscal_code = bilFiscal || null;
            updates.sdi_code = bilSdi || null;
            updates.pec = bilPec || null;
            updates.billing_address = bilAddress || null;
            updates.billing_city = bilCity || null;
            updates.billing_zip = bilZip || null;
            updates.billing_country = bilCountry || 'IT';
        }

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id);

        if (!error) {
            setMyProfile({ ...myProfile, ...updates });
            setSaveResult('success');
        } else {
            console.error('Error saving profile:', error);
            setSaveResult('error');
        }
        setSaving(false);
        setTimeout(() => setSaveResult('idle'), 3000);
    };



    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
            <div
                className="w-full max-w-2xl bg-[#0c1222] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                style={{ animation: 'fadeIn 0.2s ease-out' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-slate-800/50 to-transparent">
                    <h2 className="text-lg font-bold text-slate-100">{t('settings.title')}</h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-400 hover:text-white hover:bg-white/10">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Tabs for owner/admin */}
                {(userRole === 'owner' || userRole === 'admin') && (
                    <div className="flex border-b border-white/5">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`flex-1 px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'profile' ? 'text-cyan-300 border-b-2 border-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <User className="w-3.5 h-3.5" /> {t('settings.profileTab')}
                        </button>
                        <button
                            onClick={() => setActiveTab('billing')}
                            className={`flex-1 px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'billing' ? 'text-cyan-300 border-b-2 border-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Receipt className="w-3.5 h-3.5" /> {t('settings.billingTab')}
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="p-5 overflow-y-auto max-h-[65vh]">
                    {activeTab === 'profile' && (
                        <div className="space-y-6 animate-[fadeIn_0.15s_ease-out]">
                            {/* Avatar section */}
                            <div className="flex items-center gap-5">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-2xl overflow-hidden ring-2 ring-primary-500/30 shadow-xl">
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-3xl font-bold text-slate-400">
                                                {(name || '?')[0]?.toUpperCase()}
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
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-semibold text-slate-100">{name || t('settings.yourProfile')}</h3>
                                        {userRole && ROLE_DISPLAY[userRole] && (() => {
                                            const rd = ROLE_DISPLAY[userRole];
                                            const RIcon = rd.icon;
                                            return (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold ${rd.color} ${rd.bg}`}>
                                                    <RIcon className="w-3 h-3" />
                                                    {rd.label}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <p className="text-sm text-slate-500">{userEmail}</p>
                                    <p className="text-xs text-slate-600">{t('settings.avatarHint')}</p>
                                </div>
                            </div>

                            {/* Name field */}
                            <div className="space-y-1.5">
                                <label className="text-xs text-slate-400 font-medium ml-1">{t('settings.nameLabel')}</label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={t('settings.namePlaceholder')}
                                    className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all"
                                />
                            </div>

                            {/* Timezone */}
                            <div className="space-y-1.5">
                                <label className="text-xs text-slate-400 font-medium ml-1 flex items-center gap-1.5">
                                    <Clock className="w-3 h-3" /> {t('settings.timezoneLabel')}
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

                            {/* Language Selector */}
                            <div className="space-y-1.5">
                                <label className="text-xs text-slate-400 font-medium ml-1 flex items-center gap-1.5">
                                    <Globe className="w-3 h-3" /> {t('settings.languageLabel')}
                                </label>
                                <p className="text-[10px] text-slate-600 ml-1 mb-1.5">{t('settings.languageHint')}</p>
                                <div className="flex gap-2">
                                    {(['it', 'en', 'es'] as Locale[]).map((loc) => (
                                        <button
                                            key={loc}
                                            onClick={() => setLocale(loc)}
                                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold transition-all border ${
                                                locale === loc
                                                    ? 'bg-primary-500/15 border-primary-500/30 text-primary-300 shadow-[0_0_10px_rgba(34,211,238,0.1)]'
                                                    : 'bg-slate-800/60 border-white/10 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            <span className="text-lg">{LOCALE_FLAGS[loc]}</span>
                                            <span className="hidden sm:inline">{LOCALE_NAMES[loc]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Performance Mode Toggle */}
                            <div className="space-y-1.5">
                                <label className="text-xs text-slate-400 font-medium ml-1 flex items-center gap-1.5">
                                    <Shield className="w-3 h-3" /> {t('settings.graphicsLabel')}
                                </label>
                                <button
                                    onClick={() => {
                                        togglePerformanceMode();
                                        document.body.classList.toggle('low-power-mode');
                                    }}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${isPerformanceMode
                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                                        : 'bg-slate-800/60 border-white/10 hover:bg-slate-800/80 text-slate-300'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${isPerformanceMode ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                            <Star className="w-4 h-4" />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-medium flex items-center gap-2">
                                                {isPerformanceMode ? t('settings.powerSaving') : t('settings.highQuality')}
                                                <span className={`w-2 h-2 rounded-full ${isPerformanceMode ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                                            </div>
                                            <div className="text-[10px] sm:text-xs opacity-70 mt-0.5">
                                                {isPerformanceMode
                                                    ? t('settings.powerSavingDesc')
                                                    : t('settings.highQualityDesc')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-5.5 rounded-full p-0.5 flex items-center transition-colors ${isPerformanceMode ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isPerformanceMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </div>
                                </button>
                            </div>

                            {/* Theme Selector — Owner/Admin only */}
                            {(userRole === 'owner' || userRole === 'admin') && (
                                <div className="space-y-1.5">
                                    <label className="text-xs text-slate-400 font-medium ml-1 flex items-center gap-1.5">
                                        <Building2 className="w-3 h-3" /> {t('settings.themeLabel')}
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {(Object.values(OFFICE_THEMES) as any[]).map((thm: any) => (
                                            <button
                                                key={thm.id}
                                                disabled={savingTheme}
                                                onClick={async () => {
                                                    if (thm.id === theme) return;
                                                    setSavingTheme(true);
                                                    setTheme(thm.id);
                                                    // Save to workspace settings
                                                    if (workspaceId) {
                                                        const { data: ws } = await supabase
                                                            .from('workspaces')
                                                            .select('settings')
                                                            .eq('id', workspaceId)
                                                            .single();
                                                        const currentSettings = ws?.settings || {};
                                                        await supabase
                                                            .from('workspaces')
                                                            .update({ settings: { ...currentSettings, theme: thm.id } })
                                                            .eq('id', workspaceId);
                                                    }
                                                    setSavingTheme(false);
                                                }}
                                                className={`relative p-4 rounded-xl border-2 transition-all text-left group ${theme === thm.id
                                                        ? 'border-cyan-400 bg-cyan-500/10 ring-1 ring-cyan-400/30'
                                                        : 'border-white/10 bg-slate-800/40 hover:border-white/20 hover:bg-slate-800/60'
                                                    }`}
                                            >
                                                <div className="text-2xl mb-2">{thm.icon}</div>
                                                <div className="text-sm font-bold text-slate-100">{t(`settings.theme.${thm.id}` as any)}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{t(`settings.theme.${thm.id}Desc` as any)}</div>
                                                {theme === thm.id && (
                                                    <div className="absolute top-2 right-2">
                                                        <Check className="w-4 h-4 text-cyan-400" />
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-slate-600 ml-1">{t('settings.themeHint')}</p>
                                </div>
                            )}

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
                                    <><Check className="w-4 h-4" /> {t('settings.saved')}</>
                                ) : saveResult === 'error' ? (
                                    t('settings.saveError')
                                ) : (
                                    t('settings.saveProfile')
                                )}
                            </Button>
                        </div>
                    )}

                    {/* ═══ BILLING TAB ═══ */}
                    {activeTab === 'billing' && (
                        <div className="space-y-5 animate-[fadeIn_0.15s_ease-out]">
                            {/* Billing data */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-cyan-400" /> {t('billing.title')}</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="text-[10px] text-slate-500 font-semibold uppercase">{t('billing.companyName')}</label>
                                        <input value={bilCompany} onChange={e => setBilCompany(e.target.value)}
                                            className="w-full mt-1 bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-semibold uppercase">{t('billing.vatNumber')}</label>
                                        <input value={bilVat} onChange={e => setBilVat(e.target.value)}
                                            className="w-full mt-1 bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-semibold uppercase">{t('billing.fiscalCode')}</label>
                                        <input value={bilFiscal} onChange={e => setBilFiscal(e.target.value)}
                                            className="w-full mt-1 bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-semibold uppercase">{t('billing.sdiCode')}</label>
                                        <input value={bilSdi} onChange={e => setBilSdi(e.target.value)}
                                            className="w-full mt-1 bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-semibold uppercase">{t('billing.pec')}</label>
                                        <input value={bilPec} onChange={e => setBilPec(e.target.value)}
                                            className="w-full mt-1 bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] text-slate-500 font-semibold uppercase">{t('billing.address')}</label>
                                        <input value={bilAddress} onChange={e => setBilAddress(e.target.value)}
                                            className="w-full mt-1 bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-semibold uppercase">{t('billing.city')}</label>
                                        <input value={bilCity} onChange={e => setBilCity(e.target.value)}
                                            className="w-full mt-1 bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-semibold uppercase">{t('billing.zip')}</label>
                                        <input value={bilZip} onChange={e => setBilZip(e.target.value)}
                                            className="w-full mt-1 bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50" />
                                    </div>
                                </div>
                                <Button
                                    onClick={saveProfile}
                                    disabled={saving}
                                    className={`w-full gap-2 font-semibold rounded-xl py-2.5 transition-all ${saveResult === 'success'
                                        ? 'bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
                                        : 'bg-primary-500 hover:bg-primary-400 shadow-lg shadow-primary-500/20'
                                        }`}
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveResult === 'success' ? <><Check className="w-4 h-4" /> {t('settings.saved')}</> : t('billing.saveBilling')}
                                </Button>
                            </div>

                            {/* Payment History */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2"><History className="w-3.5 h-3.5 text-purple-400" /> {t('billing.paymentHistory')}</h3>
                                {payments.length === 0 ? (
                                    <p className="text-xs text-slate-600 italic">{t('billing.noPayments')}</p>
                                ) : (
                                    <div className="space-y-1 max-h-60 overflow-y-auto">
                                        {payments.map((p: any) => (
                                            <div key={p.id} className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-slate-800/40 border border-white/5">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <span className={`font-bold ${p.type === 'refund' ? 'text-red-400' : 'text-emerald-400'}`}>
                                                        {p.type === 'refund' ? '−' : '+'}€{new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(p.amount_cents) / 100)}
                                                    </span>
                                                    <span className="text-slate-500">{new Date(p.payment_date).toLocaleDateString('it-IT')}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {p.receipt_number && (
                                                        <button
                                                            onClick={() => window.open(`/api/admin/receipt?id=${p.id}`, '_blank')}
                                                            className="px-1.5 py-0.5 rounded text-[9px] font-bold text-blue-300 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                                                        >
                                                            {t('billing.receipt')}
                                                        </button>
                                                    )}
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${p.type === 'refund' ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                                        {p.type === 'refund' ? t('billing.refund') : t('billing.paid')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default OfficeManagement;
