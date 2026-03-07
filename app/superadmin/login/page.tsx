'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Mail, Lock, ArrowLeft, AlertCircle, ShieldAlert, Crown } from 'lucide-react';
import { superadminLogin } from './actions';
import '../../auth.css';

function SuperAdminLoginForm() {
    const [isPending, startTransition] = useTransition();
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorMsg('');
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
            const result = await superadminLogin(formData);
            if (result?.error) setErrorMsg(result.error);
        });
    };

    return (
        <div className="auth-card" style={{ borderColor: 'rgba(245, 158, 11, 0.2)' }}>
            <div className="auth-card__glow" style={{ background: 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.12), transparent 70%)' }} />
            <div className="auth-card__inner">
                <div className="auth-header">
                    <div style={{
                        width: 64,
                        height: 64,
                        borderRadius: 20,
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.3))',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 30px rgba(245, 158, 11, 0.2)',
                        margin: '0 auto 16px',
                    }}>
                        <Crown style={{ width: 32, height: 32, color: '#f59e0b' }} />
                    </div>
                    <h1 style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Super Admin
                    </h1>
                    <p>Accesso riservato al pannello di gestione piattaforma</p>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(245, 158, 11, 0.06)',
                    border: '1px solid rgba(245, 158, 11, 0.15)',
                    marginBottom: 20,
                }}>
                    <ShieldAlert style={{ width: 16, height: 16, color: '#f59e0b', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'rgba(245, 158, 11, 0.8)', fontWeight: 600, letterSpacing: '0.03em' }}>
                        Area riservata — Solo personale autorizzato
                    </span>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="auth-field">
                        <label>Email</label>
                        <div className="auth-input-wrap">
                            <Mail className="auth-input-icon" />
                            <input type="email" name="email" placeholder="admin@cosmoffice.com" required />
                        </div>
                    </div>

                    <div className="auth-field">
                        <label>Password</label>
                        <div className="auth-input-wrap">
                            <Lock className="auth-input-icon" />
                            <input type="password" name="password" placeholder="••••••••" required />
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="auth-error">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isPending}
                        className="auth-submit"
                        style={{
                            background: isPending ? undefined : 'linear-gradient(135deg, #f59e0b, #d97706)',
                            boxShadow: isPending ? undefined : '0 0 20px rgba(245, 158, 11, 0.3)',
                        }}
                    >
                        <span>{isPending ? 'Verifica in corso...' : 'Accedi al Pannello'}</span>
                        {!isPending && <ArrowLeft className="w-4 h-4 rotate-180" />}
                    </button>
                </form>

                <div className="auth-footer" style={{ opacity: 0.5 }}>
                    <Link href="/">← Torna al sito</Link>
                </div>
            </div>
        </div>
    );
}

export default function SuperAdminLoginPage() {
    return (
        <div className="auth-page">
            <div className="auth-bg" aria-hidden>
                <div className="auth-bg__orb auth-bg__orb--1" style={{ background: 'radial-gradient(ellipse, rgba(245, 158, 11, 0.15), transparent 70%)' }} />
                <div className="auth-bg__orb auth-bg__orb--2" style={{ background: 'radial-gradient(ellipse, rgba(217, 119, 6, 0.1), transparent 70%)' }} />
                <div className="auth-bg__grid" />
            </div>

            <div className="auth-container fade-up">
                <SuperAdminLoginForm />
            </div>
        </div>
    );
}

