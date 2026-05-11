// Custom Auth Email Hook API — sends branded Cosmoffice emails via Resend
// This route is called by Supabase Auth Hooks for custom email templates

import { NextRequest, NextResponse } from 'next/server';
import { getResend, EMAIL_FROM } from '../../../../lib/resend';
import { createClient } from '../../../../utils/supabase/server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.cosmoffice.io';

type Lang = 'it' | 'en' | 'es';

// ─── Auth Email i18n ───────────────────────────────
const authEmailStrings: Record<Lang, Record<string, string>> = {
    it: {
        'confirm.subject': 'Conferma il tuo account Cosmoffice ✨',
        'confirm.title': 'Benvenuto in Cosmoffice!',
        'confirm.subtitle': 'Conferma la tua email per iniziare',
        'confirm.body': 'Clicca il pulsante qui sotto per confermare il tuo indirizzo email e attivare il tuo account.',
        'confirm.cta': 'Conferma Email →',
        'confirm.expiry': '⏳ Questo link è valido per 24 ore.',
        'reset.subject': 'Reimposta la tua password — Cosmoffice',
        'reset.title': 'Reimposta Password 🔐',
        'reset.subtitle': 'Hai richiesto di reimpostare la tua password',
        'reset.body': 'Clicca il pulsante qui sotto per reimpostare la tua password. Se non hai richiesto tu questa azione, ignora questa email.',
        'reset.cta': 'Reimposta Password →',
        'reset.expiry': '⏳ Questo link è valido per 1 ora.',
        'magic.subject': 'Il tuo link di accesso — Cosmoffice',
        'magic.title': 'Accesso Rapido 🚀',
        'magic.subtitle': 'Entra nel tuo ufficio virtuale con un click',
        'magic.body': 'clicca per accedere al tuo ufficio:',
        'magic.cta': 'Accedi a Cosmoffice →',
        'magic.expiry': '⏳ Link valido per 1 ora.',
        'invite.subject': 'Sei stato invitato su Cosmoffice! 🎉',
        'hello': 'Ciao',
        'user': 'Utente',
        'footer': 'Cosmoffice — Il tuo ufficio virtuale',
    },
    en: {
        'confirm.subject': 'Confirm your Cosmoffice account ✨',
        'confirm.title': 'Welcome to Cosmoffice!',
        'confirm.subtitle': 'Confirm your email to get started',
        'confirm.body': 'Click the button below to confirm your email address and activate your account.',
        'confirm.cta': 'Confirm Email →',
        'confirm.expiry': '⏳ This link is valid for 24 hours.',
        'reset.subject': 'Reset your password — Cosmoffice',
        'reset.title': 'Reset Password 🔐',
        'reset.subtitle': 'You requested to reset your password',
        'reset.body': 'Click the button below to reset your password. If you didn\'t request this, please ignore this email.',
        'reset.cta': 'Reset Password →',
        'reset.expiry': '⏳ This link is valid for 1 hour.',
        'magic.subject': 'Your login link — Cosmoffice',
        'magic.title': 'Quick Access 🚀',
        'magic.subtitle': 'Enter your virtual office with one click',
        'magic.body': 'click to access your office:',
        'magic.cta': 'Access Cosmoffice →',
        'magic.expiry': '⏳ Link valid for 1 hour.',
        'invite.subject': 'You\'ve been invited to Cosmoffice! 🎉',
        'hello': 'Hi',
        'user': 'User',
        'footer': 'Cosmoffice — Your virtual office',
    },
    es: {
        'confirm.subject': 'Confirma tu cuenta Cosmoffice ✨',
        'confirm.title': '¡Bienvenido a Cosmoffice!',
        'confirm.subtitle': 'Confirma tu email para comenzar',
        'confirm.body': 'Haz clic en el botón de abajo para confirmar tu dirección de email y activar tu cuenta.',
        'confirm.cta': 'Confirmar Email →',
        'confirm.expiry': '⏳ Este enlace es válido por 24 horas.',
        'reset.subject': 'Restablece tu contraseña — Cosmoffice',
        'reset.title': 'Restablecer Contraseña 🔐',
        'reset.subtitle': 'Has solicitado restablecer tu contraseña',
        'reset.body': 'Haz clic en el botón de abajo para restablecer tu contraseña. Si no solicitaste esta acción, ignora este email.',
        'reset.cta': 'Restablecer Contraseña →',
        'reset.expiry': '⏳ Este enlace es válido por 1 hora.',
        'magic.subject': 'Tu enlace de acceso — Cosmoffice',
        'magic.title': 'Acceso Rápido 🚀',
        'magic.subtitle': 'Entra a tu oficina virtual con un clic',
        'magic.body': 'haz clic para acceder a tu oficina:',
        'magic.cta': 'Acceder a Cosmoffice →',
        'magic.expiry': '⏳ Enlace válido por 1 hora.',
        'invite.subject': '¡Has sido invitado a Cosmoffice! 🎉',
        'hello': 'Hola',
        'user': 'Usuario',
        'footer': 'Cosmoffice — Tu oficina virtual',
    },
};

function et(lang: Lang, key: string): string {
    return authEmailStrings[lang]?.[key] || authEmailStrings.it[key] || key;
}

// ─── Branded email templates ───────────────────────

function getConfirmationEmail(name: string, confirmUrl: string, lang: Lang) {
    return {
        subject: et(lang, 'confirm.subject'),
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: #0f172a;">
                <div style="background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%); padding: 36px 30px; text-align: center; border-radius: 0 0 20px 20px;">
                    <h1 style="color: white; font-size: 26px; margin: 0 0 6px; font-weight: 700;">${et(lang, 'confirm.title')}</h1>
                    <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 0;">${et(lang, 'confirm.subtitle')}</p>
                </div>
                <div style="padding: 30px;">
                    <p style="color: #e2e8f0; font-size: 16px; line-height: 1.7; margin: 0 0 20px;">
                        ${et(lang, 'hello')} <strong style="color: #06b6d4;">${name}</strong>,
                    </p>
                    <p style="color: #cbd5e1; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
                        ${et(lang, 'confirm.body')}
                    </p>
                    <div style="text-align: center; margin: 28px 0;">
                        <a href="${confirmUrl}" style="display: inline-block; padding: 15px 36px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 20px rgba(6, 182, 212, 0.35);">
                            ${et(lang, 'confirm.cta')}
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px;">
                        ${et(lang, 'confirm.expiry')}
                    </p>
                </div>
                <div style="border-top: 1px solid rgba(255,255,255,0.08); padding: 20px 30px; text-align: center;">
                    <p style="color: #475569; font-size: 12px; margin: 0 0 4px;">${et(lang, 'footer')}</p>
                    <a href="${SITE_URL}" style="color: #06b6d4; font-size: 12px; text-decoration: none;">www.cosmoffice.io</a>
                </div>
            </div>
        `,
    };
}

function getPasswordResetEmail(name: string, resetUrl: string, lang: Lang) {
    return {
        subject: et(lang, 'reset.subject'),
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: #0f172a;">
                <div style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 36px 30px; text-align: center; border-radius: 0 0 20px 20px;">
                    <h1 style="color: white; font-size: 26px; margin: 0 0 6px; font-weight: 700;">${et(lang, 'reset.title')}</h1>
                    <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 0;">${et(lang, 'reset.subtitle')}</p>
                </div>
                <div style="padding: 30px;">
                    <p style="color: #e2e8f0; font-size: 16px; line-height: 1.7; margin: 0 0 20px;">
                        ${et(lang, 'hello')} <strong style="color: #f59e0b;">${name}</strong>,
                    </p>
                    <p style="color: #cbd5e1; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
                        ${et(lang, 'reset.body')}
                    </p>
                    <div style="text-align: center; margin: 28px 0;">
                        <a href="${resetUrl}" style="display: inline-block; padding: 15px 36px; background: linear-gradient(135deg, #f59e0b, #ef4444); color: white; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.35);">
                            ${et(lang, 'reset.cta')}
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px;">
                        ${et(lang, 'reset.expiry')}
                    </p>
                </div>
                <div style="border-top: 1px solid rgba(255,255,255,0.08); padding: 20px 30px; text-align: center;">
                    <p style="color: #475569; font-size: 12px; margin: 0 0 4px;">${et(lang, 'footer')}</p>
                    <a href="${SITE_URL}" style="color: #06b6d4; font-size: 12px; text-decoration: none;">www.cosmoffice.io</a>
                </div>
            </div>
        `,
    };
}

function getMagicLinkEmail(name: string, loginUrl: string, lang: Lang) {
    return {
        subject: et(lang, 'magic.subject'),
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: #0f172a;">
                <div style="background: linear-gradient(135deg, #06b6d4, #8b5cf6); padding: 36px 30px; text-align: center; border-radius: 0 0 20px 20px;">
                    <h1 style="color: white; font-size: 26px; margin: 0 0 6px; font-weight: 700;">${et(lang, 'magic.title')}</h1>
                    <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 0;">${et(lang, 'magic.subtitle')}</p>
                </div>
                <div style="padding: 30px;">
                    <p style="color: #e2e8f0; font-size: 16px; line-height: 1.7; margin: 0 0 24px;">
                        ${et(lang, 'hello')} <strong style="color: #06b6d4;">${name || et(lang, 'user')}</strong>, ${et(lang, 'magic.body')}
                    </p>
                    <div style="text-align: center; margin: 28px 0;">
                        <a href="${loginUrl}" style="display: inline-block; padding: 15px 36px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 20px rgba(6, 182, 212, 0.35);">
                            ${et(lang, 'magic.cta')}
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 12px; text-align: center;">${et(lang, 'magic.expiry')}</p>
                </div>
                <div style="border-top: 1px solid rgba(255,255,255,0.08); padding: 20px 30px; text-align: center;">
                    <p style="color: #475569; font-size: 12px; margin: 0 0 4px;">${et(lang, 'footer')}</p>
                    <a href="${SITE_URL}" style="color: #06b6d4; font-size: 12px; text-decoration: none;">www.cosmoffice.io</a>
                </div>
            </div>
        `,
    };
}

// Supabase Auth Hook: Send Auth Email
// https://supabase.com/docs/guides/auth/auth-hooks#hook-send-email
export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();
        
        // Validate hook secret
        const hookSecret = req.headers.get('x-supabase-webhook-secret');
        if (hookSecret !== process.env.SUPABASE_AUTH_HOOK_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { user, email_data } = payload;
        const emailTo = user?.email;
        const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

        if (!emailTo) {
            return NextResponse.json({ error: 'No email address' }, { status: 400 });
        }

        // Detect user language from profile
        let lang: Lang = 'it';
        try {
            const supabase = await createClient();
            if (user?.id) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('language')
                    .eq('id', user.id)
                    .single();
                if (profile?.language && ['it', 'en', 'es'].includes(profile.language)) {
                    lang = profile.language as Lang;
                }
            }
        } catch (e) {
            // Fallback to Italian if profile lookup fails
        }

        const resend = getResend();
        let emailContent: { subject: string; html: string };

        switch (email_data?.token_type || payload.type) {
            case 'signup':
            case 'confirmation': {
                const confirmUrl = email_data?.confirmation_url || 
                    `${SITE_URL}/auth/callback?token_hash=${email_data?.token_hash}&type=signup`;
                emailContent = getConfirmationEmail(name, confirmUrl, lang);
                break;
            }
            case 'recovery':
            case 'reset': {
                const resetUrl = email_data?.confirmation_url ||
                    `${SITE_URL}/auth/callback?token_hash=${email_data?.token_hash}&type=recovery&next=/set-password`;
                emailContent = getPasswordResetEmail(name, resetUrl, lang);
                break;
            }
            case 'magiclink':
            case 'magic_link': {
                const loginUrl = email_data?.confirmation_url ||
                    `${SITE_URL}/auth/callback?token_hash=${email_data?.token_hash}&type=magiclink`;
                emailContent = getMagicLinkEmail(name, loginUrl, lang);
                break;
            }
            case 'invite': {
                const inviteUrl = email_data?.confirmation_url ||
                    `${SITE_URL}/auth/callback?token_hash=${email_data?.token_hash}&type=invite&next=/set-password`;
                emailContent = getConfirmationEmail(name, inviteUrl, lang);
                emailContent.subject = et(lang, 'invite.subject');
                break;
            }
            default:
                console.warn('[auth-emails] Unknown email type:', email_data?.token_type || payload.type);
                // Fallback: use confirmation template
                const fallbackUrl = email_data?.confirmation_url || `${SITE_URL}/login`;
                emailContent = getConfirmationEmail(name, fallbackUrl, lang);
        }

        const { error } = await resend.emails.send({
            from: EMAIL_FROM,
            to: emailTo,
            subject: emailContent.subject,
            html: emailContent.html,
        });

        if (error) {
            console.error('[auth-emails] Resend error:', error);
            return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[auth-emails] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
