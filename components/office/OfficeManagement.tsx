'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import {
    Settings,
    X,
    Lock,
    Unlock,
    Link as LinkIcon,
    UserPlus,
    Trash2,
    Check
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
    const { rooms, roomConnections } = useOfficeStore();
    const [email, setEmail] = useState('');
    const [inviting, setInviting] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const toggleSecret = async (roomId: string, isSecret: boolean) => {
        await supabase
            .from('rooms')
            .update({ is_secret: !isSecret })
            .eq('id', roomId);
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-2xl glass-dark border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-primary-400" />
                        <h2 className="text-xl font-bold">Office Management</h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
                </div>

                <div className="p-6 grid gap-8 overflow-y-auto max-h-[70vh]">
                    {/* Invitation Section */}
                    <section>
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <UserPlus className="w-4 h-4" /> Invite Team Members
                        </h3>
                        <div className="flex gap-2">
                            <input
                                type="email"
                                placeholder="colleague@company.com"
                                className="flex-1 bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-primary-500 transition-colors"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <Button disabled={inviting} onClick={handleInvite}>
                                {status === 'success' ? <Check className="w-4 h-4" /> : 'Invite'}
                            </Button>
                        </div>
                        {status === 'error' && <p className="text-xs text-red-400 mt-2">Error sending invitation.</p>}
                    </section>

                    {/* Rooms Section */}
                    <section>
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Lock className="w-4 h-4" /> Room Permissions
                        </h3>
                        <div className="grid gap-2">
                            {rooms.map(room => (
                                <div key={room.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                                    <span className="font-medium">{room.name}</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={`gap-2 ${room.is_secret ? 'text-amber-400' : 'text-slate-400'}`}
                                        onClick={() => toggleSecret(room.id, room.is_secret)}
                                    >
                                        {room.is_secret ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                        {room.is_secret ? 'Secret' : 'Public'}
                                    </Button>
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
                                        <Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-400">
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
            </motion.div>
        </div>
    );
}

export default OfficeManagement;
