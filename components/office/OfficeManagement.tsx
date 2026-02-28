'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import {
    X,
    Check,
    Camera,
    Globe,
    Clock,
    Loader2,
    Shield,
    Star
} from 'lucide-react';
import { Button } from '../ui/button';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { motion } from 'framer-motion';

const supabase = createClient();

interface Props {
    spaceId: string;
    onClose: () => void;
}

const STATUS_OPTIONS = [
    { value: 'online', emoji: '🟢', label: 'Online' },
    { value: 'busy', emoji: '🔴', label: 'Occupato' },
    { value: 'away', emoji: '🟡', label: 'Assente' },
];

const TIMEZONES = [
    'Europe/Rome', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Dubai', 'Australia/Sydney',
    'Pacific/Auckland', 'America/Sao_Paulo',
];

export function OfficeManagement({ spaceId, onClose }: Props) {
    const { setMyProfile, isPerformanceMode, togglePerformanceMode } = useOfficeStore();

    // Profile state — single "name" field syncs both full_name and display_name
    const [name, setName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [userStatus, setUserStatus] = useState('online');
    const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome');
    const [userEmail, setUserEmail] = useState('');
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<'idle' | 'success' | 'error'>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                setUserStatus(profile.status || 'online');
                setTimezone(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
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

        // Sync both full_name and display_name with the single "name" field
        const updates = {
            full_name: name,
            display_name: name || null,
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
                    <h2 className="text-lg font-bold text-slate-100">User Settings</h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-400 hover:text-white hover:bg-white/10">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto max-h-[65vh]">
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
                                <h3 className="text-base font-semibold text-slate-100">{name || 'Il tuo profilo'}</h3>
                                <p className="text-sm text-slate-500">{userEmail}</p>
                                <p className="text-xs text-slate-600">Clicca sull&apos;avatar per cambiarlo • Max 5MB</p>
                            </div>
                        </div>

                        {/* Name field — single unified field */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium ml-1">Nome</label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Il tuo nome"
                                className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 transition-all"
                            />
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

                        {/* Performance Mode Toggle */}
                        <div className="space-y-1.5">
                            <label className="text-xs text-slate-400 font-medium ml-1 flex items-center gap-1.5">
                                <Shield className="w-3 h-3" /> Prestazioni e Risparmio Energetico
                            </label>
                            <button
                                onClick={togglePerformanceMode}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${isPerformanceMode
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                                    : 'bg-slate-800/60 border-white/10 hover:bg-slate-800/80 text-slate-300'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${isPerformanceMode ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-400'}`}>
                                        <Star className="w-4 h-4" />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-sm font-medium">{isPerformanceMode ? 'Low-power Mode Attivata' : 'Alta Qualità Grafica'}</div>
                                        <div className="text-[10px] sm:text-xs opacity-70 mt-0.5">
                                            {isPerformanceMode ? 'Prestazioni massime su vecchi PC. Effetti ridotti.' : 'Grafica avanzata attiva. Sconsigliato su vecchi PC.'}
                                        </div>
                                    </div>
                                </div>

                                {/* Simple Toggle relative to state */}
                                <div className={`w-10 h-5.5 rounded-full p-0.5 flex items-center transition-colors ${isPerformanceMode ? 'bg-amber-500' : 'bg-slate-700'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isPerformanceMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </div>
                            </button>
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
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export default OfficeManagement;
