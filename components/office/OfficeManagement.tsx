'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import {
    Settings,
    X,
    Lock,
    Unlock,
    Link as LinkIcon,
    UserPlus,
    Trash2,
    Check,
    Users,
    Upload,
    Camera
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { motion } from 'framer-motion';

interface Props {
    spaceId: string;
    onClose: () => void;
}

export function OfficeManagement({ spaceId, onClose }: Props) {
    const supabase = createClient();
    const { rooms, roomConnections, setMyProfile } = useOfficeStore();
    const [email, setEmail] = useState('');
    const [inviting, setInviting] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [fullName, setFullName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                if (profile) {
                    setFullName(profile.full_name || '');
                    setAvatarUrl(profile.avatar_url || '');
                }
            }
        };
        fetchProfile();
    }, [supabase]);

    const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            
            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('Seleziona un file da caricare');
            }

            const file = event.target.files[0];
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) throw new Error('Utente non autenticato');

            // Create unique file path
            const fileExt = file.name.split('.').pop();
            const filePath = `${user.id}/${Date.now()}.${fileExt}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            setAvatarUrl(publicUrl);
            
            // Auto-save profile with new avatar
            const updates = {
                full_name: fullName,
                avatar_url: publicUrl
            };

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id);

            if (!error) {
                setMyProfile(updates);
                setStatus('success');
            }
            
            setTimeout(() => setStatus('idle'), 3000);
        } catch (error) {
            console.error('Error uploading avatar:', error);
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000);
        } finally {
            setUploading(false);
        }
    };

    const updateProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const updates = {
                full_name: fullName,
                avatar_url: avatarUrl
            };

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id);

            if (!error) {
                setMyProfile(updates);
                setStatus('success');
            } else {
                setStatus('error');
            }
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    const updateRoom = async (roomId: string, updates: any) => {
        await supabase
            .from('rooms')
            .update(updates)
            .eq('id', roomId);
    };

    const deleteRoom = async (roomId: string) => {
        if (confirm('Are you sure you want to delete this room?')) {
            await supabase
                .from('rooms')
                .delete()
                .eq('id', roomId);
        }
    };

    const handleInvite = async () => {
        if (!email) return;
        setInviting(true);
        const { error } = await supabase
            .from('invitations')
            .insert({
                space_id: spaceId,
                email,
                role: 'member'
            });

        setInviting(false);
        if (error) setStatus('error');
        else {
            setStatus('success');
            setEmail('');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    const removeConnection = async (connId: string) => {
        await supabase
            .from('room_connections')
            .delete()
            .eq('id', connId);
    };

    const toggleSecret = async (roomId: string, isSecret: boolean) => {
        await updateRoom(roomId, { is_secret: !isSecret });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-3xl glass-dark border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-primary-400" />
                        <h2 className="text-xl font-bold">Office Settings & Management</h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
                </div>

                <div className="p-6 grid gap-8 overflow-y-auto max-h-[75vh]">
                    {/* User Profile Section */}
                    <section className="p-1 rounded-2xl bg-primary-500/5 border border-primary-500/10 shadow-[0_0_20px_rgba(99,102,241,0.05)]">
                        <div className="p-4 space-y-4">
                            <h3 className="text-sm font-semibold text-primary-400 uppercase tracking-wider flex items-center gap-2">
                                <Users className="w-4 h-4" /> My Profile
                            </h3>
                            
                            {/* Avatar Preview */}
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    {avatarUrl ? (
                                        <img 
                                            src={avatarUrl} 
                                            alt="Avatar" 
                                            className="w-20 h-20 rounded-full object-cover border-2 border-primary-500/30"
                                        />
                                    ) : (
                                        <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-primary-500/30 flex items-center justify-center text-2xl font-bold text-slate-400">
                                            {fullName?.[0]?.toUpperCase() || '?'}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary-500 hover:bg-primary-400 rounded-full flex items-center justify-center text-white shadow-lg transition-colors disabled:opacity-50"
                                    >
                                        <Camera className="w-4 h-4" />
                                    </button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={uploadAvatar}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-slate-400">Clicca l&apos;icona camera per caricare un avatar</p>
                                    {uploading && <p className="text-xs text-primary-400 mt-1">Caricamento...</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-500 ml-1 font-medium">Full Name</label>
                                    <input
                                        placeholder="Your Name"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all text-sm"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-500 ml-1 font-medium">Avatar URL (opzionale)</label>
                                    <input
                                        placeholder="https://example.com/avatar.jpg"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all text-sm"
                                        value={avatarUrl}
                                        onChange={(e) => setAvatarUrl(e.target.value)}
                                    />
                                </div>
                            </div>
                            <Button className="w-full gap-2 font-semibold shadow-lg shadow-primary-500/20" onClick={updateProfile}>
                                {status === 'success' ? <Check className="w-4 h-4" /> : 'Save Profile Changes'}
                            </Button>
                        </div>
                    </section>

                    <div className="h-px bg-white/5 mx-2"></div>

                    {/* Invitation Section */}
                    <section>
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <UserPlus className="w-4 h-4" /> Invite Team Members
                        </h3>
                        <div className="flex gap-2">
                            <input
                                type="email"
                                placeholder="colleague@company.com"
                                className="flex-1 bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-primary-500/50 text-sm"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <Button disabled={inviting} onClick={handleInvite} className="px-6">
                                {status === 'success' ? <Check className="w-4 h-4" /> : 'Invite'}
                            </Button>
                        </div>
                        {status === 'error' && <p className="text-xs text-red-400 mt-2 font-medium">Error sending invitation.</p>}
                    </section>

                    {/* Rooms Section */}
                    <section>
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Lock className="w-4 h-4" /> Rooms & Zones
                        </h3>
                        <div className="grid gap-4">
                            {rooms.map(room => (
                                <div key={room.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <input
                                            className="bg-transparent border-b border-white/10 focus:border-primary-500 outline-none font-medium px-1 py-0.5 flex-1"
                                            defaultValue={room.name}
                                            onBlur={(e) => updateRoom(room.id, { name: e.target.value })}
                                        />
                                        <div className="flex items-center gap-2">
                                            <select
                                                className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-xs outline-none"
                                                value={room.type}
                                                onChange={(e) => updateRoom(room.id, { type: e.target.value })}
                                            >
                                                <option value="open">Open Area</option>
                                                <option value="meeting">Meeting Room</option>
                                                <option value="focus">Focus Zone</option>
                                                <option value="break">Break Area</option>
                                                <option value="reception">Reception</option>
                                            </select>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={`p-1.5 h-8 w-8 rounded-lg ${room.is_secret ? 'bg-amber-500/10 text-amber-400' : 'text-slate-500'}`}
                                                onClick={() => toggleSecret(room.id, room.is_secret)}
                                            >
                                                {room.is_secret ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="p-1.5 h-8 w-8 rounded-lg text-slate-500 hover:text-red-400"
                                                onClick={() => deleteRoom(room.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Connections Section */}
                    <section>
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <LinkIcon className="w-4 h-4" /> Room Connections (Portals)
                        </h3>
                        <div className="grid gap-2">
                            {roomConnections.map(conn => {
                                const roomA = rooms.find(r => r.id === conn.room_a_id);
                                const roomB = rooms.find(r => r.id === conn.room_b_id);
                                return (
                                    <div key={conn.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-slate-100">{roomA?.name}</span>
                                            <LinkIcon className="w-3 h-3 text-slate-500" />
                                            <span className="text-slate-100">{roomB?.name}</span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-400" onClick={() => removeConnection(conn.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                );
                            })}
                            {roomConnections.length === 0 && (
                                <p className="text-sm text-slate-500 text-center py-4 bg-white/5 rounded-xl border border-dashed border-white/10">
                                    No portals active. Link rooms to enable teleportation.
                                </p>
                            )}
                        </div>
                    </section>
                </div>
            </motion.div >
        </div >
    );
}

export default OfficeManagement;
