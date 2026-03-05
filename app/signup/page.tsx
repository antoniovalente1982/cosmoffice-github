'use client';

import { Suspense, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Mail, Lock, User, ArrowLeft, AlertCircle } from 'lucide-react';
import { Logo } from '../../components/ui/logo';
import { signup } from './actions';

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

            <style jsx global>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up {
          opacity: 0;
          animation: fadeUp 0.5s ease-out forwards;
        }
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          overflow: hidden;
          background: #020617;
        }
        .auth-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .auth-bg__orb {
          position: absolute;
          border-radius: 50%;
        }
        .auth-bg__orb--1 {
          width: 50%; height: 50%;
          top: -15%; left: -10%;
          background: radial-gradient(circle, rgba(139,92,246,0.18), transparent 70%);
        }
        .auth-bg__orb--2 {
          width: 45%; height: 60%;
          top: 20%; right: -10%;
          background: radial-gradient(circle, rgba(6,182,212,0.15), transparent 70%);
        }
        .auth-bg__grid {
          position: absolute;
          inset: 0;
          opacity: 0.06;
          background-image:
            linear-gradient(rgba(139,92,246,0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.4) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .auth-container {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 440px;
        }
        .auth-back {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #94a3b8;
          text-decoration: none;
          margin-bottom: 32px;
          transition: all 0.2s;
        }
        .auth-back:hover { color: #fff; background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }
        .auth-card { position: relative; }
        .auth-card__glow {
          position: absolute;
          inset: -1px;
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(139,92,246,0.4), rgba(6,182,212,0.4));
          opacity: 0.2;
          filter: blur(1px);
          transition: opacity 0.4s;
        }
        .auth-card:hover .auth-card__glow { opacity: 0.35; }
        .auth-card__inner {
          position: relative;
          background: rgba(15,23,42,0.8);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 40px;
        }
        .auth-header {
          text-align: center;
          margin-bottom: 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .auth-header h1 {
          font-size: 1.7rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          background: linear-gradient(to right, #fff, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .auth-header p { font-size: 0.85rem; color: #64748b; font-weight: 500; }
        .auth-invite-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          margin-bottom: 24px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(139,92,246,0.08), rgba(6,182,212,0.08));
          border: 1px solid rgba(6,182,212,0.2);
          font-size: 0.75rem;
          font-weight: 600;
          color: #67e8f9;
        }
        .auth-invite-badge__dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #22d3ee;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .auth-form { display: flex; flex-direction: column; gap: 18px; }
        .auth-field { display: flex; flex-direction: column; gap: 6px; }
        .auth-field__head { display: flex; justify-content: space-between; align-items: center; }
        .auth-field label {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #64748b;
          margin-left: 2px;
        }
        .auth-input-wrap {
          display: flex;
          align-items: center;
          background: rgba(2,6,23,0.8);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          overflow: hidden;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .auth-input-wrap:focus-within {
          border-color: rgba(6,182,212,0.4);
          box-shadow: 0 0 0 3px rgba(6,182,212,0.1);
        }
        .auth-input-icon {
          width: 18px; height: 18px;
          margin-left: 16px;
          color: #475569;
          flex-shrink: 0;
          transition: color 0.2s;
        }
        .auth-input-wrap:focus-within .auth-input-icon { color: #22d3ee; }
        .auth-input-wrap input {
          flex: 1;
          padding: 14px 16px;
          background: transparent;
          border: none;
          outline: none;
          color: #e2e8f0;
          font-size: 0.9rem;
        }
        .auth-input-wrap input::placeholder { color: #334155; }
        .auth-error {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 12px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          color: #fca5a5;
          font-size: 0.85rem;
          font-weight: 500;
        }
        .auth-submit {
          width: 100%;
          padding: 14px 24px;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          font-weight: 700;
          font-size: 0.95rem;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(135deg, #7c3aed, #0891b2);
          background-size: 200% auto;
          transition: background-position 0.4s, box-shadow 0.3s, transform 0.2s;
          box-shadow: 0 4px 20px rgba(124,58,237,0.3);
          margin-top: 4px;
        }
        .auth-submit:hover {
          background-position: 100% 0;
          box-shadow: 0 6px 28px rgba(124,58,237,0.45);
          transform: translateY(-1px);
        }
        .auth-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .auth-footer {
          text-align: center;
          margin-top: 28px;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.05);
          font-size: 0.85rem;
          color: #64748b;
          font-weight: 500;
        }
        .auth-footer a {
          color: #22d3ee;
          text-decoration: none;
          font-weight: 700;
          transition: color 0.2s;
        }
        .auth-footer a:hover { color: #67e8f9; }
        .auth-spinner {
          width: 32px; height: 32px;
          border: 3px solid rgba(6,182,212,0.2);
          border-top-color: #22d3ee;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
}
