'use client';

import { Suspense, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Mail, Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import { Logo } from '../../components/ui/logo';
import { login } from './actions';
import '../auth.css';

function LoginForm() {
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
      const result = await login(formData);
      if (result?.error) setErrorMsg(result.error);
    });
  };

  return (
    <div className="auth-card">
      <div className="auth-card__glow" />
      <div className="auth-card__inner">
        <div className="auth-header">
          <Logo size="lg" showText={false} variant="glow" />
          <h1>{isInvite ? 'Accept Invitation' : 'Welcome Back'}</h1>
          <p>{isInvite ? 'Sign in to accept your invitation' : 'Enter your credentials to access your office'}</p>
        </div>

        {isInvite && (
          <div className="auth-invite-badge">
            <span className="auth-invite-badge__dot" />
            Invitation Pending
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}

          <div className="auth-field">
            <label>Email</label>
            <div className="auth-input-wrap">
              <Mail className="auth-input-icon" />
              <input type="email" name="email" placeholder="name@company.com" required />
            </div>
          </div>

          <div className="auth-field">
            <div className="auth-field__head">
              <label>Password</label>
              <Link href="#" className="auth-forgot">Forgot?</Link>
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
            <span>{isPending ? 'Authenticating...' : isInvite ? 'Sign In to Join' : 'Sign In'}</span>
            {!isPending && <ArrowLeft className="w-4 h-4 rotate-180" />}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?{' '}
          <Link href={redirectTo ? `/signup?redirect=${encodeURIComponent(redirectTo)}` : '/signup'}>
            Create one now
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
          Back to Cosmos
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
