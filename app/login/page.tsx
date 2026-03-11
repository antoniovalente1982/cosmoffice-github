'use client';

import { Suspense, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Mail, Lock, ArrowLeft, AlertCircle, Check } from 'lucide-react';
import { Logo } from '../../components/ui/logo';
import { login } from './actions';
import { forgotPassword } from './forgot-password';
import '../auth.css';

function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotPending, setForgotPending] = useState(false);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '';
  const isInvite = redirectTo.startsWith('/invite/');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) setErrorMsg(result.error);
    });
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) return;
    setForgotPending(true);
    const formData = new FormData();
    formData.set('email', forgotEmail.trim());
    await forgotPassword(formData);
    setForgotSent(true);
    setForgotPending(false);
  };

  if (showForgot) {
    return (
      <div className="auth-card">
        <div className="auth-card__glow" />
        <div className="auth-card__inner">
          <div className="auth-header">
            <Logo size="lg" showText={false} variant="glow" />
            <h1>{forgotSent ? 'Email Inviata!' : 'Recupera Password'}</h1>
            <p>
              {forgotSent
                ? 'Se l\'email esiste, riceverai un link per reimpostare la password.'
                : 'Inserisci la tua email per ricevere un link di recupero'}
            </p>
          </div>

          {forgotSent ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <Check className="w-7 h-7 text-white" />
              </div>
              <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
                Controlla la tua casella di posta (anche lo spam).
              </p>
              <button
                onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); }}
                className="auth-submit"
                style={{ marginTop: 8 }}
              >
                <span>Torna al Login</span>
              </button>
            </div>
          ) : (
            <div className="auth-form">
              <div className="auth-field">
                <label>Email</label>
                <div className="auth-input-wrap">
                  <Mail className="auth-input-icon" />
                  <input
                    type="email"
                    placeholder="nome@azienda.it"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()}
                    required
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={forgotPending || !forgotEmail.trim()}
                onClick={handleForgotPassword}
                className="auth-submit"
              >
                <span>{forgotPending ? 'Invio...' : 'Invia Link di Recupero'}</span>
              </button>

              <div className="auth-footer">
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  style={{ background: 'none', border: 'none', color: '#06b6d4', cursor: 'pointer', fontSize: 14 }}
                >
                  ← Torna al Login
                </button>
              </div>
            </div>
          )}
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
          <h1>{isInvite ? 'Accedi per Entrare' : 'Bentornato'}</h1>
          <p>{isInvite ? 'Accedi per accettare il tuo invito' : 'Inserisci le tue credenziali per accedere al tuo ufficio'}</p>
        </div>

        {isInvite && (
          <div className="auth-invite-badge">
            <span className="auth-invite-badge__dot" />
            🔗 Invito in attesa — accedi per entrare nel workspace
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}

          <div className="auth-field">
            <label>Email</label>
            <div className="auth-input-wrap">
              <Mail className="auth-input-icon" />
              <input type="email" name="email" placeholder="nome@azienda.it" required />
            </div>
          </div>

          <div className="auth-field">
            <div className="auth-field__head">
              <label>Password</label>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="auth-forgot"
              >
                Password dimenticata?
              </button>
            </div>
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

          <button type="submit" disabled={isPending} className="auth-submit">
            <span>{isPending ? 'Autenticazione...' : isInvite ? 'Accedi e Entra' : 'Accedi'}</span>
            {!isPending && <ArrowLeft className="w-4 h-4 rotate-180" />}
          </button>
        </form>

        <div className="auth-footer">
          Non hai un account?{' '}
          <Link href={redirectTo ? `/signup?redirect=${encodeURIComponent(redirectTo)}` : '/signup'}>
            Registrati ora
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
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
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
