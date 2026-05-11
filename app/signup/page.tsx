'use client';

import { Suspense, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Mail, Lock, User, ArrowLeft, AlertCircle, Building2, Phone, Hash } from 'lucide-react';
import { Logo } from '../../components/ui/logo';
import { signup } from './actions';
import { useT } from '../../lib/i18n';
import { LanguageSelector } from '../../components/ui/LanguageSelector';
import '../auth.css';

function SignupForm() {
  const { t } = useT();
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
          <h1>{isInvite ? t('signup.inviteTitle') : t('auth.signupTitle')}</h1>
          <p>{isInvite ? t('signup.inviteSubtitle') : t('signup.joinCosmoffice')}</p>
        </div>

        {isInvite && (
          <div className="auth-invite-badge">
            <span className="auth-invite-badge__dot" />
            🔗 {t('signup.inviteBadge')}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}

          <div className="auth-field">
            <label>{t('auth.fullName')} *</label>
            <div className="auth-input-wrap">
              <User className="auth-input-icon" />
              <input type="text" name="full_name" placeholder={t('auth.fullNamePlaceholder')} required />
            </div>
          </div>

          <div className="auth-field">
            <label>{t('auth.email')} *</label>
            <div className="auth-input-wrap">
              <Mail className="auth-input-icon" />
              <input type="email" name="email" placeholder={t('auth.emailPlaceholder')} required />
            </div>
          </div>

          {!isInvite && (
            <>
              <div className="auth-field">
                <label>{t('signup.phone')} *</label>
                <div className="auth-input-wrap">
                  <Phone className="auth-input-icon" />
                  <input type="tel" name="phone" placeholder={t('signup.phonePlaceholder')} required />
                </div>
              </div>

              <div style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(148,163,184,0.6)', paddingLeft: 4 }}>
                  {t('signup.companySection')}
                </p>
              </div>

              <div className="auth-field">
                <label>{t('signup.companyName')} *</label>
                <div className="auth-input-wrap">
                  <Building2 className="auth-input-icon" />
                  <input type="text" name="company_name" placeholder={t('signup.companyPlaceholder')} required />
                </div>
              </div>

              <div className="auth-field">
                <label>{t('signup.vatNumber')}</label>
                <div className="auth-input-wrap">
                  <Hash className="auth-input-icon" />
                  <input type="text" name="vat_number" placeholder={t('signup.vatPlaceholder')} />
                </div>
              </div>
            </>
          )}

          <div className="auth-field">
            <label>{t('auth.password')} *</label>
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
            <span>{isPending ? t('signup.submitting') : isInvite ? t('signup.submitInvite') : t('auth.signupButton')}</span>
          </button>
        </form>

        <div className="auth-footer">
          {t('auth.hasAccount')}{' '}
          <Link href={redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'}>
            {t('auth.login')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  const { t } = useT();
  return (
    <div className="auth-page">
      <div className="auth-bg" aria-hidden>
        <div className="auth-bg__orb auth-bg__orb--1" />
        <div className="auth-bg__orb auth-bg__orb--2" />
        <div className="auth-bg__grid" />
      </div>

      <div className="auth-container fade-up">
        <div className="flex items-center justify-between w-full max-w-md mx-auto mb-4">
          <Link href="/" className="auth-back">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('auth.backToHome')}
          </Link>
          <LanguageSelector compact />
        </div>

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
