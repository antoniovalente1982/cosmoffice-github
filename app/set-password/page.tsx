'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Shield, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Logo } from '../../components/ui/logo';
import { createClient } from '../../utils/supabase/client';
import { useT } from '../../lib/i18n';
import { LanguageSelector } from '../../components/ui/LanguageSelector';
import '../auth.css';

export default function SetPasswordPage() {
    const { t } = useT();
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [success, setSuccess] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [userName, setUserName] = useState('');

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) {
                router.replace('/login');
                return;
            }
            setUserName(user.user_metadata?.full_name || user.email || '');
        });
    }, [router]);

    const passwordStrength = (pw: string): { score: number; label: string; color: string } => {
        let score = 0;
        if (pw.length >= 8) score++;
        if (pw.length >= 12) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;

        if (score <= 1) return { score, label: t('setPassword.weak'), color: '#ef4444' };
        if (score <= 2) return { score, label: t('setPassword.fair'), color: '#f59e0b' };
        if (score <= 3) return { score, label: t('setPassword.good'), color: '#06b6d4' };
        return { score, label: t('setPassword.strong'), color: '#10b981' };
    };

    const strength = passwordStrength(password);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (password.length < 8) {
            setErrorMsg(t('setPassword.tooShort'));
            return;
        }
        if (password !== confirmPassword) {
            setErrorMsg(t('setPassword.noMatch'));
            return;
        }

        startTransition(async () => {
            try {
                const supabase = createClient();
                const { error } = await supabase.auth.updateUser({ password });

                if (error) {
                    setErrorMsg(error.message);
                    return;
                }

                setSuccess(true);
                setTimeout(() => {
                    router.replace('/office');
                }, 2000);
            } catch (err: any) {
                setErrorMsg(err.message || t('setPassword.unexpectedError'));
            }
        });
    };

    return (
        <div className="auth-page">
            <div className="auth-bg" aria-hidden>
                <div className="auth-bg__orb auth-bg__orb--1" />
                <div className="auth-bg__orb auth-bg__orb--2" />
                <div className="auth-bg__grid" />
            </div>

            <div className="auth-container fade-up">
                <div className="flex justify-end w-full max-w-md mx-auto mb-4">
                    <LanguageSelector compact />
                </div>
                <div className="auth-card">
                    <div className="auth-card__glow" />
                    <div className="auth-card__inner">
                        <div className="auth-header">
                            <Logo size="lg" showText={false} variant="glow" />
                            <h1>{success ? t('setPassword.successTitle') : t('setPassword.title')}</h1>
                            <p>
                                {success
                                    ? t('setPassword.successMsg')
                                    : t('setPassword.greeting', { name: userName })
                                }
                            </p>
                        </div>

                        {success ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '30px 0',
                            }}>
                                <div style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 16px',
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                }}>
                                    <Check className="w-8 h-8 text-white" />
                                </div>
                                <p style={{ color: '#94a3b8', fontSize: 14 }}>
                                    {t('setPassword.redirecting')}
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="auth-form">
                                <div className="auth-field">
                                    <label>{t('setPassword.newPassword')}</label>
                                    <div className="auth-input-wrap">
                                        <Lock className="auth-input-icon" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder={t('setPassword.placeholder')}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            minLength={8}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '0 8px',
                                                color: '#64748b',
                                            }}
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {password && (
                                        <div style={{ marginTop: 8 }}>
                                            <div style={{
                                                display: 'flex',
                                                gap: 4,
                                                marginBottom: 4,
                                            }}>
                                                {[1, 2, 3, 4, 5].map((i) => (
                                                    <div
                                                        key={i}
                                                        style={{
                                                            flex: 1,
                                                            height: 3,
                                                            borderRadius: 2,
                                                            background: i <= strength.score ? strength.color : 'rgba(255,255,255,0.1)',
                                                            transition: 'all 0.3s ease',
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <span style={{
                                                fontSize: 11,
                                                color: strength.color,
                                                fontWeight: 500,
                                            }}>
                                                {strength.label}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="auth-field">
                                    <label>{t('setPassword.confirmPassword')}</label>
                                    <div className="auth-input-wrap">
                                        <Shield className="auth-input-icon" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder={t('setPassword.confirmPlaceholder')}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            minLength={8}
                                        />
                                    </div>
                                    {confirmPassword && password && (
                                        <div style={{ marginTop: 4 }}>
                                            {password === confirmPassword ? (
                                                <span style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Check className="w-3 h-3" /> {t('setPassword.match')}
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: 11, color: '#ef4444' }}>
                                                    {t('setPassword.noMatch')}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {errorMsg && (
                                    <div className="auth-error">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <span>{errorMsg}</span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isPending || !password || !confirmPassword}
                                    className="auth-submit"
                                >
                                    <span>{isPending ? t('setPassword.saving') : t('setPassword.submit')}</span>
                                </button>

                                <p style={{
                                    textAlign: 'center',
                                    fontSize: 12,
                                    color: '#64748b',
                                    marginTop: 8,
                                }}>
                                    {t('setPassword.encrypted')}
                                </p>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
