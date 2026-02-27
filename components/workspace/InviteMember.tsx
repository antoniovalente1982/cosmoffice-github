'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Mail,
    UserPlus,
    X,
    Clock,
    Trash2,
    AlertCircle,
    Check,
} from 'lucide-react';
import { Button } from '../ui/button';

type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest' | 'viewer';

interface PendingInvitation {
    id: string;
    email: string;
    role: WorkspaceRole;
    invited_at: string;
    expires_at: string;
}

interface InviteMemberProps {
    invitations: PendingInvitation[];
    onInvite: (email: string, role: WorkspaceRole) => Promise<{ success: boolean; error?: string }>;
    onCancelInvitation: (invitationId: string) => Promise<{ success: boolean; error?: string }>;
    disabled?: boolean;
}

const ROLE_OPTIONS: { value: WorkspaceRole; label: string; description: string }[] = [
    { value: 'admin', label: 'Admin', description: 'Gestisce membri, stanze e impostazioni' },
    { value: 'member', label: 'Membro', description: 'Accede a spazi e stanze' },
    { value: 'guest', label: 'Ospite', description: 'Accesso limitato' },
    { value: 'viewer', label: 'Viewer', description: 'Solo visualizzazione' },
];

export function InviteMember({ invitations, onInvite, onCancelInvitation, disabled }: InviteMemberProps) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<WorkspaceRole>('member');
    const [inviting, setInviting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleInvite = async () => {
        if (!email.trim()) return;

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            setError('Inserisci un indirizzo email valido');
            return;
        }

        setInviting(true);
        setError(null);
        setSuccess(false);

        const result = await onInvite(email.trim().toLowerCase(), role);

        if (result.success) {
            setEmail('');
            setRole('member');
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } else {
            setError(result.error || 'Errore durante l\'invio dell\'invito');
        }

        setInviting(false);
    };

    const formatTimeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours < 1) return 'Poco fa';
        if (hours < 24) return `${hours}h fa`;
        return `${Math.floor(hours / 24)}g fa`;
    };

    return (
        <div className="space-y-4">
            {/* Invite Form */}
            <div className="space-y-3">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="email"
                            placeholder="email@esempio.com"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setError(null); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                            disabled={disabled || inviting}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25 outline-none transition-all disabled:opacity-50"
                        />
                    </div>
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                        disabled={disabled || inviting}
                        className="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:border-cyan-500/50 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50 min-w-[110px]"
                    >
                        {ROLE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <Button
                        onClick={handleInvite}
                        disabled={disabled || inviting || !email.trim()}
                        className="gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 border-0 min-w-[100px]"
                    >
                        {inviting ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <UserPlus className="w-4 h-4" />
                        )}
                        {inviting ? '' : 'Invita'}
                    </Button>
                </div>

                {/* Role description */}
                <p className="text-xs text-slate-500 pl-1">
                    {ROLE_OPTIONS.find(o => o.value === role)?.description}
                </p>
            </div>

            {/* Success / Error messages */}
            {success && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"
                >
                    <Check className="w-4 h-4" />
                    Invito inviato con successo!
                </motion.div>
            )}

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                >
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </motion.div>
            )}

            {/* Pending Invitations */}
            {invitations.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Inviti in attesa ({invitations.length})
                    </h4>
                    <div className="space-y-1.5">
                        {invitations.map((inv) => (
                            <motion.div
                                key={inv.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-white/5 group hover:border-white/10 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                                        <Clock className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-200">{inv.email}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500">{formatTimeAgo(inv.invited_at)}</span>
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">{inv.role}</span>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => onCancelInvitation(inv.id)}
                                >
                                    <X className="w-3.5 h-3.5" />
                                </Button>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
