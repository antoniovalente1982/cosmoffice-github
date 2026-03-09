'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '../../../utils/supabase/client';
import { Loader2, CheckCircle2, XCircle, LogIn, UserPlus, Rocket, Shield, Crown, User, Star } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Logo } from '../../../components/ui/logo';
import Link from 'next/link';

const supabase = createClient();

type InviteState = 'loading' | 'needs_auth' | 'guest_name' | 'accepting' | 'success' | 'error' | 'already_member';

const ROLE_INFO: Record<string, { icon: React.ReactNode; label: string; color: string; description: string }> = {
    owner: { icon: <Crown className="w-5 h-5" />, label: 'Owner', color: 'text-amber-400', description: 'Controllo totale del workspace' },
    admin: { icon: <Shield className="w-5 h-5" />, label: 'Admin', color: 'text-primary-400', description: 'Gestione workspace e membri' },
    member: { icon: <User className="w-5 h-5" />, label: 'Membro', color: 'text-emerald-400', description: 'Accesso completo alle funzionalità' },
    guest: { icon: <Star className="w-5 h-5" />, label: 'Ospite', color: 'text-purple-400', description: 'Accesso base al workspace' },
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
    const [guestName, setGuestName] = useState('');
    const [isSubmittingGuest, setIsSubmittingGuest] = useState(false);

    // Check auth and load invite info
    useEffect(() => {
        if (!token) return;

        const checkInvite = async () => {
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

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                if (inviteInfo.role === 'guest') {
                    setState('guest_name');
                } else {
                    setState('needs_auth');
                }
                return;
            }

            await acceptInvite();
        };

        checkInvite();
    }, [token]);

    const acceptInvite = async () => {
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

            const wsId = res.workspace_id;
            const { data: space } = await supabase
                .from('spaces')
                .select('id')
                .eq('workspace_id', wsId)
                .limit(1)
                .single();

            let targetUrl = '/office';
            if (res.space_id) {
                targetUrl = `/office/${res.space_id}`;
            } else if (space) {
                targetUrl = `/office/${space.id}`;
            }

            if (res.destination_room_id && targetUrl.includes('/office/')) {
                targetUrl += `?roomId=${res.destination_room_id}`;
            }

            router.push(targetUrl);
            return;
        } else {
            setState('error');
            setError(res.error || 'Errore sconosciuto.');
        }
    };

    const handleGuestEntry = async () => {
        if (!guestName.trim()) return;
        setIsSubmittingGuest(true);
        setError('');

        try {
            const { data: { user: existingUser } } = await supabase.auth.getUser();
            if (existingUser?.is_anonymous) {
                await supabase.auth.signOut();
            }

            let { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();

            if (anonError) {
                await new Promise(resolve => setTimeout(resolve, 500));
                const retry = await supabase.auth.signInAnonymously();
                anonData = retry.data;
                anonError = retry.error;
            }

            if (anonError) {
                console.error('Anonymous sign-in failed:', anonError);
                setState('error');
                setError(
                    `Accesso ospite non disponibile (${anonError.message}). ` +
                    'Verifica che "Allow anonymous sign-ins" sia abilitato nelle impostazioni di Supabase Authentication.'
                );
                setIsSubmittingGuest(false);
                return;
            }

            if (!anonData?.user) {
                setState('error');
                setError('Errore nella creazione della sessione ospite.');
                setIsSubmittingGuest(false);
                return;
            }

            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: anonData.user.id,
                    display_name: guestName.trim(),
                    full_name: guestName.trim(),
                    is_anonymous: true,
                }, { onConflict: 'id' });

            if (profileError) {
                console.warn('Profile upsert failed (may not have is_anonymous column):', profileError);
                await supabase
                    .from('profiles')
                    .upsert({
                        id: anonData.user.id,
                        display_name: guestName.trim(),
                        full_name: guestName.trim(),
                    }, { onConflict: 'id' });
            }

            await acceptInvite();
        } catch (err: any) {
            console.error('Guest entry error:', err);
            setState('error');
            setError('Errore durante l\'accesso ospite: ' + (err.message || 'Errore sconosciuto'));
        }

        setIsSubmittingGuest(false);
    };

    const goToOffice = async () => {
        const wsId = workspaceId || invite?.workspace_id;
        if (!wsId) {
            router.push('/office');
            return;
        }

        const { data: space } = await supabase
            .from('spaces')
            .select('id')
            .eq('workspace_id', wsId)
            .limit(1)
            .single();

        let targetUrl = '/office';
        if (space) {
            targetUrl = `/office/${space.id}`;
        }

        if (invite?.destination_room_id && targetUrl.includes('/office/')) {
            targetUrl += `?roomId=${invite.destination_room_id}`;
        }

        router.push(targetUrl);
    };

    const roleInfo = invite ? ROLE_INFO[invite.role] || ROLE_INFO.member : ROLE_INFO.member;

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: '#020617' }}>
            {/* Background: lightweight static gradients */}
            <div className="absolute inset-0" aria-hidden>
                <div className="absolute -top-1/4 -left-1/4 w-3/4 h-3/4" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.06), transparent 70%)', borderRadius: '50%' }} />
                <div className="absolute -bottom-1/4 -right-1/4 w-3/4 h-3/4" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.05), transparent 70%)', borderRadius: '50%' }} />
            </div>

            <div className="invite-card relative z-10 w-full max-w-md">
                <div className="bg-slate-900/95 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                    {/* Header with logo */}
                    <div className="p-6 pb-4 text-center border-b border-white/5 bg-gradient-to-b from-slate-800/50 to-transparent">
                        <div className="flex justify-center mb-4">
                            <Logo size="lg" showText={false} variant="glow" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-100">
                            {state === 'loading' || state === 'accepting' ? 'Caricamento invito...' :
                                state === 'needs_auth' ? 'Sei stato invitato!' :
                                    state === 'guest_name' ? 'Sei stato invitato!' :
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

                        {/* Guest Name Entry */}
                        {state === 'guest_name' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-center">
                                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 border border-white/10 ${roleInfo.color}`}>
                                        {roleInfo.icon}
                                        <span className="text-sm font-semibold">{roleInfo.label}</span>
                                    </div>
                                </div>

                                <p className="text-center text-sm text-slate-400">
                                    Entra come ospite — inserisci il tuo nome per continuare.
                                </p>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Il tuo nome</label>
                                        <input
                                            type="text"
                                            value={guestName}
                                            onChange={(e) => setGuestName(e.target.value)}
                                            placeholder="Come vuoi essere chiamato?"
                                            className="w-full px-4 py-3 bg-slate-800/80 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/30 transition-all"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && guestName.trim()) handleGuestEntry();
                                            }}
                                        />
                                    </div>

                                    <Button
                                        onClick={handleGuestEntry}
                                        disabled={!guestName.trim() || isSubmittingGuest}
                                        className="w-full gap-2 bg-gradient-to-r from-purple-500 to-primary-500 hover:from-purple-400 hover:to-primary-400 rounded-xl py-3 font-semibold shadow-lg shadow-purple-500/20 disabled:opacity-50"
                                    >
                                        {isSubmittingGuest ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Accesso in corso...</>
                                        ) : (
                                            <><Rocket className="w-4 h-4" /> Entra come Ospite</>
                                        )}
                                    </Button>
                                </div>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
                                    <div className="relative flex justify-center"><span className="px-3 text-[10px] text-slate-600 bg-slate-900 uppercase tracking-wider">oppure</span></div>
                                </div>

                                <div className="space-y-2">
                                    <Link href={`/login?redirect=/invite/${token}`} className="block">
                                        <Button variant="outline" className="w-full gap-2 border-white/10 hover:bg-white/5 rounded-xl py-2.5 font-medium text-slate-400 text-sm">
                                            <LogIn className="w-3.5 h-3.5" />
                                            Accedi con account
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Needs Auth */}
                        {state === 'needs_auth' && (
                            <div className="space-y-6">
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
                                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center invite-scale-in">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                    </div>
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
            </div>

            <style jsx>{`
                @keyframes inviteFadeIn {
                    from { opacity: 0; transform: translateY(16px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes inviteScaleIn {
                    from { transform: scale(0); }
                    to   { transform: scale(1); }
                }
                .invite-card {
                    animation: inviteFadeIn 0.4s ease-out;
                }
                .invite-scale-in {
                    animation: inviteScaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both;
                }
            `}</style>
        </div>
    );
}
