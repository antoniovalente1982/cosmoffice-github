// Custom Auth Email Hook API — sends branded Cosmoffice emails via Resend
// This route is called by Supabase Auth Hooks for custom email templates

import { NextRequest, NextResponse } from 'next/server';
import { getResend, EMAIL_FROM } from '../../../../lib/resend';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.cosmoffice.io';

// Branded email templates
function getConfirmationEmail(name: string, confirmUrl: string) {
    return {
        subject: 'Conferma il tuo account Cosmoffice ✨',
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: #0f172a;">
                <div style="background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%); padding: 36px 30px; text-align: center; border-radius: 0 0 20px 20px;">
                    <h1 style="color: white; font-size: 26px; margin: 0 0 6px; font-weight: 700;">Benvenuto in Cosmoffice!</h1>
                    <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 0;">Conferma la tua email per iniziare</p>
                </div>
                <div style="padding: 30px;">
                    <p style="color: #e2e8f0; font-size: 16px; line-height: 1.7; margin: 0 0 20px;">
                        Ciao <strong style="color: #06b6d4;">${name}</strong>,
                    </p>
                    <p style="color: #cbd5e1; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
                        Clicca il pulsante qui sotto per confermare il tuo indirizzo email e attivare il tuo account.
                    </p>
                    <div style="text-align: center; margin: 28px 0;">
                        <a href="${confirmUrl}" style="display: inline-block; padding: 15px 36px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 20px rgba(6, 182, 212, 0.35);">
                            Conferma Email →
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px;">
                        ⏳ Questo link è valido per 24 ore.
                    </p>
                </div>
                <div style="border-top: 1px solid rgba(255,255,255,0.08); padding: 20px 30px; text-align: center;">
                    <p style="color: #475569; font-size: 12px; margin: 0 0 4px;">Cosmoffice — Il tuo ufficio virtuale</p>
                    <a href="${SITE_URL}" style="color: #06b6d4; font-size: 12px; text-decoration: none;">www.cosmoffice.io</a>
                </div>
            </div>
        `,
    };
}

function getPasswordResetEmail(name: string, resetUrl: string) {
    return {
        subject: 'Reimposta la tua password — Cosmoffice',
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: #0f172a;">
                <div style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 36px 30px; text-align: center; border-radius: 0 0 20px 20px;">
                    <h1 style="color: white; font-size: 26px; margin: 0 0 6px; font-weight: 700;">Reimposta Password 🔐</h1>
                    <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 0;">Hai richiesto di reimpostare la tua password</p>
                </div>
                <div style="padding: 30px;">
                    <p style="color: #e2e8f0; font-size: 16px; line-height: 1.7; margin: 0 0 20px;">
                        Ciao <strong style="color: #f59e0b;">${name}</strong>,
                    </p>
                    <p style="color: #cbd5e1; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
                        Clicca il pulsante qui sotto per reimpostare la tua password. Se non hai richiesto tu questa azione, ignora questa email.
                    </p>
                    <div style="text-align: center; margin: 28px 0;">
                        <a href="${resetUrl}" style="display: inline-block; padding: 15px 36px; background: linear-gradient(135deg, #f59e0b, #ef4444); color: white; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.35);">
                            Reimposta Password →
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px;">
                        ⏳ Questo link è valido per 1 ora.
                    </p>
                </div>
                <div style="border-top: 1px solid rgba(255,255,255,0.08); padding: 20px 30px; text-align: center;">
                    <p style="color: #475569; font-size: 12px; margin: 0 0 4px;">Cosmoffice — Il tuo ufficio virtuale</p>
                    <a href="${SITE_URL}" style="color: #06b6d4; font-size: 12px; text-decoration: none;">www.cosmoffice.io</a>
                </div>
            </div>
        `,
    };
}

function getMagicLinkEmail(name: string, loginUrl: string) {
    return {
        subject: 'Il tuo link di accesso — Cosmoffice',
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: #0f172a;">
                <div style="background: linear-gradient(135deg, #06b6d4, #8b5cf6); padding: 36px 30px; text-align: center; border-radius: 0 0 20px 20px;">
                    <h1 style="color: white; font-size: 26px; margin: 0 0 6px; font-weight: 700;">Accesso Rapido 🚀</h1>
                    <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 0;">Entra nel tuo ufficio virtuale con un click</p>
                </div>
                <div style="padding: 30px;">
                    <p style="color: #e2e8f0; font-size: 16px; line-height: 1.7; margin: 0 0 24px;">
                        Ciao <strong style="color: #06b6d4;">${name || 'Utente'}</strong>, clicca per accedere al tuo ufficio:
                    </p>
                    <div style="text-align: center; margin: 28px 0;">
                        <a href="${loginUrl}" style="display: inline-block; padding: 15px 36px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 20px rgba(6, 182, 212, 0.35);">
                            Accedi a Cosmoffice →
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 12px; text-align: center;">⏳ Link valido per 1 ora.</p>
                </div>
                <div style="border-top: 1px solid rgba(255,255,255,0.08); padding: 20px 30px; text-align: center;">
                    <p style="color: #475569; font-size: 12px; margin: 0 0 4px;">Cosmoffice — Il tuo ufficio virtuale</p>
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
        const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Utente';

        if (!emailTo) {
            return NextResponse.json({ error: 'No email address' }, { status: 400 });
        }

        const resend = getResend();
        let emailContent: { subject: string; html: string };

        switch (email_data?.token_type || payload.type) {
            case 'signup':
            case 'confirmation': {
                const confirmUrl = email_data?.confirmation_url || 
                    `${SITE_URL}/auth/callback?token_hash=${email_data?.token_hash}&type=signup`;
                emailContent = getConfirmationEmail(name, confirmUrl);
                break;
            }
            case 'recovery':
            case 'reset': {
                const resetUrl = email_data?.confirmation_url ||
                    `${SITE_URL}/auth/callback?token_hash=${email_data?.token_hash}&type=recovery&next=/set-password`;
                emailContent = getPasswordResetEmail(name, resetUrl);
                break;
            }
            case 'magiclink':
            case 'magic_link': {
                const loginUrl = email_data?.confirmation_url ||
                    `${SITE_URL}/auth/callback?token_hash=${email_data?.token_hash}&type=magiclink`;
                emailContent = getMagicLinkEmail(name, loginUrl);
                break;
            }
            case 'invite': {
                const inviteUrl = email_data?.confirmation_url ||
                    `${SITE_URL}/auth/callback?token_hash=${email_data?.token_hash}&type=invite&next=/set-password`;
                emailContent = getConfirmationEmail(name, inviteUrl);
                emailContent.subject = 'Sei stato invitato su Cosmoffice! 🎉';
                break;
            }
            default:
                console.warn('[auth-emails] Unknown email type:', email_data?.token_type || payload.type);
                // Fallback: use confirmation template
                const fallbackUrl = email_data?.confirmation_url || `${SITE_URL}/login`;
                emailContent = getConfirmationEmail(name, fallbackUrl);
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
