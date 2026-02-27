'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '../../../utils/supabase/client';
import { Loader2, CheckCircle2, XCircle, LogIn, UserPlus, Rocket, Shield, Crown, User, Star } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Logo } from '../../../components/ui/logo';
import Link from 'next/link';

const supabase = createClient();

type InviteState = 'loading' | 'needs_auth' | 'accepting' | 'success' | 'error' | 'already_member';

const ROLE_INFO: Record<string, { icon: React.ReactNode; label: string; color: string; description: string }> = {
    owner: { icon: <Crown className="w-5 h-5" />, label: 'Owner', color: 'text-amber-400', description: 'Controllo totale del workspace' },
    admin: { icon: <Shield className="w-5 h-5" />, label: 'Admin', color: 'text-primary-400', description: 'Gestione workspace e membri' },
    member: { icon: <User className="w-5 h-5" />, label: 'Membro', color: 'text-emerald-400', description: 'Accesso completo alle funzionalità' },
    guest: { icon: <Star className="w-5 h-5" />, label: 'Ospite', color: 'text-purple-400', description: 'Accesso base al workspace' },
    viewer: { icon: <User className="w-5 h-5" />, label: 'Viewer', color: 'text-slate-400', description: 'Solo visualizzazione' },
};

export default function InvitePage() {
    const params = useParams();
    const router = useRouter();
    const token = params.token as string;

    const [state, setState] = useState<InviteState>('loading');
    const [error, setError] = useState('');
    const [invite, setInvite] = useState<any>(null);
    const [workspace, setWorkspace] = useState<any>(null);
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);

    // Check auth and load invite info
    useEffect(() => {
        if (!token) return;

        const checkInvite = async () => {
            // Use RPC to get invite info (bypasses RLS)
            const { data: info, error: infoError } = await supabase.rpc('get_invite_info', {
                p_token: token,
            });

            if (infoError || !info || !(info as any).found) {
                setState('error');
                setError('Invito non trovato o non valido.');
                return;
            }

            const inviteInfo = info as any;
            setInvite(inviteInfo);
            setWorkspace({ name: inviteInfo.workspace_name });

            // Check if expired/revoked/exhausted
            if (inviteInfo.is_expired) {
                setState('error');
                setError('Questo invito è scaduto.');
                return;
            }
            if (inviteInfo.is_revoked) {
                setState('error');
                setError('Questo invito è stato revocato.');
                return;
            }
            if (inviteInfo.is_exhausted) {
                setState('error');
                setError('Questo link di invito ha raggiunto il numero massimo di utilizzi.');
                return;
            }

            // Check if user is authenticated
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setState('needs_auth');
                return;
            }

            // User is authenticated — accept invite
            setState('accepting');
            const { data: result, error: acceptError } = await supabase.rpc('accept_invite_link', {
                p_token: token,
            });

            if (acceptError) {
                setState('error');
                setError(acceptError.message || 'Errore nell\'accettazione dell\'invito.');
                return;
            }

            const res = result as any;
            if (res.success) {
                setWorkspaceId(res.workspace_id);
                // Auto-redirect to the workspace office
                const wsId = res.workspace_id;
                const { data: space } = await supabase
                    .from('spaces')
                    .select('id')
                    .eq('workspace_id', wsId)
                    .limit(1)
                    .single();

                if (space) {
                    router.push(`/office/${space.id}`);
                } else {
                    router.push('/office');
                }
                return;
            } else {
                setState('error');
                setError(res.error || 'Errore sconosciuto.');
            }
        };

        checkInvite();
    }, [token]);

    const goToOffice = async () => {
        const wsId = workspaceId || invite?.workspace_id;
        if (!wsId) {
            router.push('/office');
            return;
        }

        // Find first space in workspace
        const { data: space } = await supabase
            .from('spaces')
            .select('id')
            .eq('workspace_id', wsId)
            .limit(1)
            .single();

        if (space) {
            router.push(`/office/${space.id}`);
        } else {
            router.push('/office');
        }
    };

    const roleInfo = invite ? ROLE_INFO[invite.role] || ROLE_INFO.member : ROLE_INFO.member;

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0">
                <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary-500/8 to-transparent rounded-full blur-3xl" />
                <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-purple-500/8 to-transparent rounded-full blur-3xl" />
                <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-full blur-3xl animate-pulse" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="relative z-10 w-full max-w-md"
            >
                <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                    {/* Header with logo */}
                    <div className="p-6 pb-4 text-center border-b border-white/5 bg-gradient-to-b from-slate-800/50 to-transparent">
                        <div className="flex justify-center mb-4">
                            <Logo size="lg" showText={false} variant="glow" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-100">
                            {state === 'loading' || state === 'accepting' ? 'Caricamento invito...' :
                                state === 'needs_auth' ? 'Sei stato invitato!' :
                                    state === 'success' ? 'Benvenuto! 🎉' :
                                        state === 'already_member' ? 'Già nel team! 👋' :
                                            'Invito non valido'}
                        </h1>
                        {workspace && (
                            <p className="text-sm text-slate-400 mt-2">
                                Workspace: <span className="text-slate-200 font-semibold">{workspace.name}</span>
                            </p>
                        )}
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Loading / Accepting */}
                        {(state === 'loading' || state === 'accepting') && (
                            <div className="flex flex-col items-center gap-4 py-8">
                                <div className="relative">
                                    <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
                                    </div>
                                </div>
                                <p className="text-sm text-slate-400">
                                    {state === 'loading' ? 'Verifico l\'invito...' : 'Accetto l\'invito...'}
                                </p>
                            </div>
                        )}

                        {/* Needs Auth */}
                        {state === 'needs_auth' && (
                            <div className="space-y-6">
                                {/* Role badge */}
                                <div className="flex items-center justify-center">
                                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 border border-white/10 ${roleInfo.color}`}>
                                        {roleInfo.icon}
                                        <span className="text-sm font-semibold">{roleInfo.label}</span>
                                    </div>
                                </div>

                                <p className="text-center text-sm text-slate-400">
                                    {roleInfo.description}. Accedi o registrati per entrare nel workspace.
                                </p>

                                <div className="space-y-3">
                                    <Link href={`/login?redirect=/invite/${token}`} className="block">
                                        <Button className="w-full gap-2 bg-primary-500 hover:bg-primary-400 shadow-lg shadow-primary-500/20 rounded-xl py-3 font-semibold">
                                            <LogIn className="w-4 h-4" />
                                            Accedi
                                        </Button>
                                    </Link>
                                    <Link href={`/signup?redirect=/invite/${token}`} className="block">
                                        <Button variant="outline" className="w-full gap-2 border-white/10 hover:bg-white/5 rounded-xl py-3 font-semibold text-slate-300">
                                            <UserPlus className="w-4 h-4" />
                                            Registrati
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Success */}
                        {state === 'success' && (
                            <div className="space-y-6">
                                <div className="flex flex-col items-center gap-4 py-4">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', damping: 12, delay: 0.2 }}
                                    >
                                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                                            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                        </div>
                                    </motion.div>
                                    <div className="text-center">
                                        <p className="text-slate-200 font-medium">
                                            Sei entrato come <span className={roleInfo.color}>{roleInfo.label}</span>
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">in {workspace?.name || 'il workspace'}</p>
                                    </div>
                                </div>

                                <Button onClick={goToOffice} className="w-full gap-2 bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-400 hover:to-purple-400 rounded-xl py-3 font-semibold shadow-lg">
                                    <Rocket className="w-4 h-4" />
                                    Entra nell&apos;ufficio
                                </Button>
                            </div>
                        )}

                        {/* Already member */}
                        {state === 'already_member' && (
                            <div className="space-y-6">
                                <div className="flex flex-col items-center gap-4 py-4">
                                    <div className="w-16 h-16 rounded-2xl bg-primary-500/15 flex items-center justify-center">
                                        <CheckCircle2 className="w-8 h-8 text-primary-400" />
                                    </div>
                                    <p className="text-sm text-slate-400 text-center">
                                        Fai già parte di questo workspace!
                                    </p>
                                </div>

                                <Button onClick={goToOffice} className="w-full gap-2 bg-primary-500 hover:bg-primary-400 rounded-xl py-3 font-semibold shadow-lg shadow-primary-500/20">
                                    <Rocket className="w-4 h-4" />
                                    Vai all&apos;ufficio
                                </Button>
                            </div>
                        )}

                        {/* Error */}
                        {state === 'error' && (
                            <div className="space-y-6">
                                <div className="flex flex-col items-center gap-4 py-4">
                                    <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center">
                                        <XCircle className="w-8 h-8 text-red-400" />
                                    </div>
                                    <p className="text-sm text-red-400 text-center">
                                        {error}
                                    </p>
                                </div>

                                <Link href="/office" className="block">
                                    <Button className="w-full rounded-xl py-3 font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200">
                                        Torna alla home
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 pb-5 pt-2 text-center">
                        <p className="text-[10px] text-slate-600 uppercase tracking-wider">
                            Powered by Cosmoffice
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
