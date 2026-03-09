'use client';

import { Suspense, useState, useEffect, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, User, ArrowLeft, AlertCircle, Building2, Phone, Hash, Crown, Loader2, XCircle } from 'lucide-react';
import { Logo } from '../../../components/ui/logo';
import { registerOwner } from './actions';
import { createClient } from '../../../utils/supabase/client';
import '../../auth.css';

function OwnerRegistrationForm() {
    const [isPending, startTransition] = useTransition();
    const [errorMsg, setErrorMsg] = useState('');
    const [tokenValid, setTokenValid] = useState<boolean | null>(null);
    const [tokenInfo, setTokenInfo] = useState<any>(null);
    const searchParams = useSearchParams();
    const token = searchParams.get('token') || '';

    // Verify token on mount
    useEffect(() => {
        if (!token) {
            setTokenValid(false);
            return;
        }

        const verifyToken = async () => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from('owner_registration_tokens')
                .select('id, email, max_workspaces, max_capacity, notes, expires_at')
                .eq('token', token)
                .is('used_at', null)
                .single();

            if (error || !data) {
                setTokenValid(false);
                return;
            }

            if (data.expires_at && new Date(data.expires_at) < new Date()) {
                setTokenValid(false);
                return;
            }

            setTokenInfo(data);
            setTokenValid(true);
        };

        verifyToken();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorMsg('');
        const formData = new FormData(e.currentTarget);
        formData.set('token', token);
        startTransition(async () => {
            const result = await registerOwner(formData);
            if (result?.error) setErrorMsg(result.error);
        });
    };

    // Loading state
    if (tokenValid === null) {
        return (
            <div className="auth-card">
                <div className="auth-card__glow" />
                <div className="auth-card__inner">
                    <div className="auth-header">
                        <Logo size="lg" showText={false} variant="glow" />
                        <h1>Verifica in corso...</h1>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
                    </div>
                </div>
            </div>
        );
    }

    // Invalid token
    if (!tokenValid) {
        return (
            <div className="auth-card">
                <div className="auth-card__glow" />
                <div className="auth-card__inner">
                    <div className="auth-header">
                        <Logo size="lg" showText={false} variant="glow" />
                        <h1>Link non valido</h1>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
                        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <XCircle className="w-8 h-8 text-red-400" />
                        </div>
                        <p style={{ fontSize: '0.875rem', color: 'rgb(148,163,184)', textAlign: 'center' }}>
                            Questo link di registrazione non è valido o è già stato utilizzato.
                            Contatta il tuo referente per ottenere un nuovo link.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-card">
            <div className="auth-card__glow" />
            <div className="auth-card__inner">
                <div className="auth-header">
                    <Logo size="lg" showText={false} variant="glow" />
                    <h1>Registrazione Owner</h1>
                    <p>Crea il tuo account proprietario</p>
                </div>

                {/* Owner badge */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '8px 16px', borderRadius: 12,
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                    margin: '0 auto 1rem', width: 'fit-content'
                }}>
                    <Crown className="w-4 h-4" style={{ color: '#fbbf24' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Account Owner
                    </span>
                </div>

                {tokenInfo?.notes && (
                    <p style={{ fontSize: '0.8rem', color: 'rgb(148,163,184)', textAlign: 'center', marginBottom: '1rem' }}>
                        {tokenInfo.notes}
                    </p>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                    {/* Personal Info */}
                    <div className="auth-field">
                        <label>Nome Completo *</label>
                        <div className="auth-input-wrap">
                            <User className="auth-input-icon" />
                            <input type="text" name="full_name" placeholder="Mario Rossi" required />
                        </div>
                    </div>

                    <div className="auth-field">
                        <label>Email *</label>
                        <div className="auth-input-wrap">
                            <Mail className="auth-input-icon" />
                            <input
                                type="email"
                                name="email"
                                placeholder="mario@azienda.it"
                                required
                                defaultValue={tokenInfo?.email || ''}
                                readOnly={!!tokenInfo?.email}
                                style={tokenInfo?.email ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
                            />
                        </div>
                        {tokenInfo?.email && (
                            <p style={{ fontSize: '0.65rem', color: 'rgba(148,163,184,0.6)', marginTop: 4 }}>
                                Email preimpostata dall&apos;amministratore
                            </p>
                        )}
                    </div>

                    <div className="auth-field">
                        <label>Telefono</label>
                        <div className="auth-input-wrap">
                            <Phone className="auth-input-icon" />
                            <input type="tel" name="phone" placeholder="+39 333 1234567" />
                        </div>
                    </div>

                    {/* Company Info */}
                    <div style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                        <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(148,163,184,0.6)', paddingLeft: 4 }}>
                            Dati Aziendali
                        </p>
                    </div>

                    <div className="auth-field">
                        <label>Nome Azienda *</label>
                        <div className="auth-input-wrap">
                            <Building2 className="auth-input-icon" />
                            <input type="text" name="company_name" placeholder="La Mia Azienda S.r.l." required />
                        </div>
                    </div>

                    <div className="auth-field">
                        <label>Partita IVA</label>
                        <div className="auth-input-wrap">
                            <Hash className="auth-input-icon" />
                            <input type="text" name="vat_number" placeholder="IT12345678901" />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="auth-field">
                        <label>Password *</label>
                        <div className="auth-input-wrap">
                            <Lock className="auth-input-icon" />
                            <input type="password" name="password" placeholder="••••••••" required minLength={6} />
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="auth-error">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    <button type="submit" disabled={isPending} className="auth-submit">
                        <span>{isPending ? 'Registrazione...' : 'Crea Account Owner'}</span>
                    </button>
                </form>

                <div className="auth-footer">
                    Hai già un account?{' '}
                    <Link href="/login">Accedi</Link>
                </div>
            </div>
        </div>
    );
}

export default function OwnerRegistrationPage() {
    return (
        <div className="auth-page">
            <div className="auth-bg" aria-hidden>
                <div className="auth-bg__orb auth-bg__orb--1" />
                <div className="auth-bg__orb auth-bg__orb--2" />
                <div className="auth-bg__grid" />
            </div>

            <div className="auth-container fade-up">
                <Link href="/" className="auth-back">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Torna alla Home
                </Link>

                <Suspense fallback={
                    <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="auth-spinner" />
                    </div>
                }>
                    <OwnerRegistrationForm />
                </Suspense>
            </div>
        </div>
    );
}
