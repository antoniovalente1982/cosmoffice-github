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

export async function sendNewCustomerEmail(
    to: string,
    name: string,
    workspaceName: string,
    magicLink: string
) {
    const resend = getResend();
    return resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject: `🚀 Il tuo ufficio "${workspaceName}" è pronto su Cosmoffice!`,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: #0f172a;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%); padding: 40px 30px; text-align: center; border-radius: 0 0 24px 24px;">
                    <h1 style="color: white; font-size: 28px; margin: 0 0 8px; font-weight: 700;">
                        Benvenuto in Cosmoffice! 🎉
                    </h1>
                    <p style="color: rgba(255,255,255,0.85); font-size: 15px; margin: 0;">
                        Il tuo ufficio virtuale è stato creato ed è pronto per te
                    </p>
                </div>

                <!-- Body -->
                <div style="padding: 32px 30px;">
                    <p style="color: #e2e8f0; font-size: 16px; line-height: 1.7; margin: 0 0 20px;">
                        Ciao <strong style="color: #06b6d4;">${name}</strong>,
                    </p>
                    <p style="color: #cbd5e1; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
                        Il tuo spazio di lavoro <strong style="color: white;">"${workspaceName}"</strong> è stato configurato e ti aspetta.
                        Clicca il pulsante qui sotto per accedere e impostare la tua password personale.
                    </p>

                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 32px 0;">
                        <a href="${magicLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; text-decoration: none; border-radius: 14px; font-weight: 700; font-size: 17px; box-shadow: 0 4px 24px rgba(6, 182, 212, 0.4); letter-spacing: 0.5px;">
                            Accedi al tuo ufficio →
                        </a>
                    </div>

                    <!-- Info Cards -->
                    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin: 24px 0;">
                        <h3 style="color: #f8fafc; font-size: 14px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 1px;">
                            📋 Primi passi
                        </h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8; font-size: 14px; vertical-align: top; width: 28px;">1.</td>
                                <td style="padding: 8px 0; color: #cbd5e1; font-size: 14px;">Clicca il pulsante qui sopra per accedere</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8; font-size: 14px; vertical-align: top;">2.</td>
                                <td style="padding: 8px 0; color: #cbd5e1; font-size: 14px;">Imposta la tua password personale</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8; font-size: 14px; vertical-align: top;">3.</td>
                                <td style="padding: 8px 0; color: #cbd5e1; font-size: 14px;">Esplora il tuo ufficio virtuale e invita il team</td>
                            </tr>
                        </table>
                    </div>

                    <!-- Workspace Info -->
                    <div style="background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.2); border-radius: 12px; padding: 16px 20px; margin: 16px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="color: #94a3b8; font-size: 13px; padding: 4px 0;">Workspace</td>
                                <td style="color: #f8fafc; font-size: 13px; padding: 4px 0; text-align: right; font-weight: 600;">${workspaceName}</td>
                            </tr>
                            <tr>
                                <td style="color: #94a3b8; font-size: 13px; padding: 4px 0;">Email</td>
                                <td style="color: #f8fafc; font-size: 13px; padding: 4px 0; text-align: right;">${to}</td>
                            </tr>
                            <tr>
                                <td style="color: #94a3b8; font-size: 13px; padding: 4px 0;">Ruolo</td>
                                <td style="color: #06b6d4; font-size: 13px; padding: 4px 0; text-align: right; font-weight: 600;">Owner</td>
                            </tr>
                        </table>
                    </div>

                    <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 24px 0 0; text-align: center;">
                        ⏳ Questo link è valido per 24 ore. Dopo la scadenza potrai richiedere un nuovo accesso dalla pagina di login.
                    </p>
                </div>

                <!-- Footer -->
                <div style="border-top: 1px solid rgba(255,255,255,0.08); padding: 24px 30px; text-align: center;">
                    <p style="color: #475569; font-size: 12px; margin: 0 0 4px;">
                        Cosmoffice — Il tuo ufficio virtuale
                    </p>
                    <a href="https://www.cosmoffice.io" style="color: #06b6d4; font-size: 12px; text-decoration: none;">
                        www.cosmoffice.io
                    </a>
                </div>
            </div>
        `,
    });
}

