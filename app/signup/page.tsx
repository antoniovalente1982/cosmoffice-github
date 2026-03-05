'use client';

import { Suspense, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Mail, Lock, User, ArrowLeft, AlertCircle } from 'lucide-react';
import { Logo } from '../../components/ui/logo';
import { signup } from './actions';
import '../auth.css';

function SignupForm() {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState('');
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '';
  const isInvite = redirectTo.startsWith('/invite/');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await signup(formData);
      if (result?.error) setErrorMsg(result.error);
    });
  };

  return (
    <div className="auth-card">
      <div className="auth-card__glow" />
      <div className="auth-card__inner">
        <div className="auth-header">
          <Logo size="lg" showText={false} variant="glow" />
          <h1>{isInvite ? 'Registrati per entrare' : 'Create an account'}</h1>
          <p>{isInvite ? 'Crea il tuo account per accettare l\'invito' : 'Join Cosmoffice today'}</p>
        </div>

        {isInvite && (
          <div className="auth-invite-badge">
            <span className="auth-invite-badge__dot" />
            🔗 Hai un invito! Registrati per entrare nel workspace.
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}

          <div className="auth-field">
            <label>Full Name</label>
            <div className="auth-input-wrap">
              <User className="auth-input-icon" />
              <input type="text" name="full_name" placeholder="Mario Rossi" required />
            </div>
          </div>

          <div className="auth-field">
            <label>Email</label>
            <div className="auth-input-wrap">
              <Mail className="auth-input-icon" />
              <input type="email" name="email" placeholder="you@company.com" required />
            </div>
          </div>

          <div className="auth-field">
            <label>Password</label>
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
            <span>{isPending ? 'Signing up...' : isInvite ? 'Registrati e entra' : 'Sign Up'}</span>
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link href={redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
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
          Back to Cosmos
        </Link>

        <Suspense fallback={
          <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="auth-spinner" />
          </div>
        }>
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
