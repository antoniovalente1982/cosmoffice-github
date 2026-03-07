import { Resend } from 'resend';

let _resend: Resend | null = null;

export function getResend(): Resend {
    if (!_resend) {
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY is not set in environment variables');
        }
        _resend = new Resend(process.env.RESEND_API_KEY);
    }
    return _resend;
}

// Default sender — use verified domain after DNS setup
export const EMAIL_FROM = 'Cosmoffice <noreply@cosmoffice.io>';
export const EMAIL_SUPPORT = 'support@cosmoffice.io';

// ─── Email Templates ───────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string) {
    const resend = getResend();
    return resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject: 'Benvenuto in Cosmoffice! 🚀',
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #0f172a; font-size: 28px; margin: 0;">Benvenuto in Cosmoffice!</h1>
                </div>
                <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                    Ciao <strong>${name}</strong>,
                </p>
                <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                    Il tuo account è stato creato con successo. Sei pronto per creare il tuo ufficio virtuale e collaborare con il tuo team in tempo reale.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://www.cosmoffice.io/office" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
                        Entra nel tuo ufficio →
                    </a>
                </div>
                <p style="color: #94a3b8; font-size: 13px; text-align: center; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                    Cosmoffice — Il tuo ufficio virtuale<br>
                    <a href="https://www.cosmoffice.io" style="color: #06b6d4;">www.cosmoffice.io</a>
                </p>
            </div>
        `,
    });
}

export async function sendInviteEmail(to: string, inviterName: string, workspaceName: string, inviteLink: string) {
    const resend = getResend();
    return resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject: `${inviterName} ti ha invitato in ${workspaceName} su Cosmoffice`,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="color: #0f172a; font-size: 24px; text-align: center;">Sei stato invitato! 🎉</h1>
                <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                    <strong>${inviterName}</strong> ti ha invitato a unirti al workspace <strong>"${workspaceName}"</strong> su Cosmoffice.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
                        Accetta l'invito →
                    </a>
                </div>
                <p style="color: #94a3b8; font-size: 13px; text-align: center; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                    Cosmoffice — Il tuo ufficio virtuale<br>
                    <a href="https://www.cosmoffice.io" style="color: #06b6d4;">www.cosmoffice.io</a>
                </p>
            </div>
        `,
    });
}

export async function sendPlanUpgradeEmail(to: string, name: string, planName: string) {
    const resend = getResend();
    return resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject: `Piano aggiornato a ${planName} ✨`,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="color: #0f172a; font-size: 24px; text-align: center;">Upgrade completato! 🚀</h1>
                <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                    Ciao <strong>${name}</strong>,
                </p>
                <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                    Il tuo piano è stato aggiornato a <strong>${planName}</strong>. Ora hai accesso a tutti i vantaggi del nuovo piano.
                </p>
                <p style="color: #94a3b8; font-size: 13px; text-align: center; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                    Cosmoffice — Il tuo ufficio virtuale<br>
                    <a href="https://www.cosmoffice.io" style="color: #06b6d4;">www.cosmoffice.io</a>
                </p>
            </div>
        `,
    });
}

export async function sendTrialExpiringEmail(to: string, name: string, daysLeft: number) {
    const resend = getResend();
    return resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject: `Il tuo trial scade tra ${daysLeft} giorni`,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="color: #0f172a; font-size: 24px; text-align: center;">Il tuo trial sta per scadere ⏳</h1>
                <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                    Ciao <strong>${name}</strong>,
                </p>
                <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                    Il tuo periodo di prova scade tra <strong>${daysLeft} giorni</strong>. Scegli un piano per continuare a usare tutte le funzionalità.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://www.cosmoffice.io/pricing" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
                        Scegli un piano →
                    </a>
                </div>
                <p style="color: #94a3b8; font-size: 13px; text-align: center; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                    Cosmoffice — Il tuo ufficio virtuale<br>
                    <a href="https://www.cosmoffice.io" style="color: #06b6d4;">www.cosmoffice.io</a>
                </p>
            </div>
        `,
    });
}
