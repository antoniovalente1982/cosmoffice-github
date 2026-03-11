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

// ─── Email i18n ────────────────────────────────────────
type Lang = 'it' | 'en' | 'es';

const emailStrings: Record<Lang, Record<string, string>> = {
    it: {
        // Welcome
        'welcome.subject': 'Benvenuto in Cosmoffice! 🚀',
        'welcome.title': 'Benvenuto in Cosmoffice!',
        'welcome.hello': 'Ciao',
        'welcome.body': 'Il tuo account è stato creato con successo. Sei pronto per creare il tuo ufficio virtuale e collaborare con il tuo team in tempo reale.',
        'welcome.cta': 'Entra nel tuo ufficio →',
        'welcome.footer': 'Cosmoffice — Il tuo ufficio virtuale',
        // Invite
        'invite.subject_suffix': 'ti ha invitato in',
        'invite.subject_on': 'su Cosmoffice',
        'invite.title': 'Sei stato invitato! 🎉',
        'invite.body_prefix': 'ti ha invitato a unirti al workspace',
        'invite.body_suffix': 'su Cosmoffice.',
        'invite.cta': "Accetta l'invito →",
        // Plan upgrade
        'plan.subject_prefix': 'Piano aggiornato a',
        'plan.title': 'Upgrade completato! 🚀',
        'plan.body': 'Il tuo piano è stato aggiornato a',
        'plan.body_suffix': 'Ora hai accesso a tutti i vantaggi del nuovo piano.',
        // Trial
        'trial.subject_prefix': 'Il tuo trial scade tra',
        'trial.subject_suffix': 'giorni',
        'trial.title': 'Il tuo trial sta per scadere ⏳',
        'trial.body_prefix': 'Il tuo periodo di prova scade tra',
        'trial.body_suffix': 'Scegli un piano per continuare a usare tutte le funzionalità.',
        'trial.cta': 'Scegli un piano →',
        // New customer
        'newcust.subject_prefix': '🚀 Il tuo ufficio',
        'newcust.subject_suffix': 'è pronto su Cosmoffice!',
        'newcust.title': 'Benvenuto in Cosmoffice! 🎉',
        'newcust.subtitle': 'Il tuo ufficio virtuale è stato creato ed è pronto per te',
        'newcust.body': 'Il tuo spazio di lavoro',
        'newcust.body2': 'è stato configurato e ti aspetta.',
        'newcust.body3': 'Clicca il pulsante qui sotto per accedere e impostare la tua password personale.',
        'newcust.cta': 'Accedi al tuo ufficio →',
        'newcust.steps_title': '📋 Primi passi',
        'newcust.step1': 'Clicca il pulsante qui sopra per accedere',
        'newcust.step2': 'Imposta la tua password personale',
        'newcust.step3': 'Esplora il tuo ufficio virtuale e invita il team',
        'newcust.role': 'Ruolo',
        'newcust.link_expiry': '⏳ Questo link è valido per 24 ore. Dopo la scadenza potrai richiedere un nuovo accesso dalla pagina di login.',
    },
    en: {
        'welcome.subject': 'Welcome to Cosmoffice! 🚀',
        'welcome.title': 'Welcome to Cosmoffice!',
        'welcome.hello': 'Hi',
        'welcome.body': 'Your account has been created successfully. You\'re ready to create your virtual office and collaborate with your team in real time.',
        'welcome.cta': 'Enter your office →',
        'welcome.footer': 'Cosmoffice — Your virtual office',
        'invite.subject_suffix': 'invited you to',
        'invite.subject_on': 'on Cosmoffice',
        'invite.title': 'You\'ve been invited! 🎉',
        'invite.body_prefix': 'invited you to join the workspace',
        'invite.body_suffix': 'on Cosmoffice.',
        'invite.cta': 'Accept invite →',
        'plan.subject_prefix': 'Plan upgraded to',
        'plan.title': 'Upgrade complete! 🚀',
        'plan.body': 'Your plan has been upgraded to',
        'plan.body_suffix': 'You now have access to all the benefits of the new plan.',
        'trial.subject_prefix': 'Your trial expires in',
        'trial.subject_suffix': 'days',
        'trial.title': 'Your trial is expiring ⏳',
        'trial.body_prefix': 'Your trial period expires in',
        'trial.body_suffix': 'Choose a plan to continue using all features.',
        'trial.cta': 'Choose a plan →',
        'newcust.subject_prefix': '🚀 Your office',
        'newcust.subject_suffix': 'is ready on Cosmoffice!',
        'newcust.title': 'Welcome to Cosmoffice! 🎉',
        'newcust.subtitle': 'Your virtual office has been created and is ready for you',
        'newcust.body': 'Your workspace',
        'newcust.body2': 'has been set up and is waiting for you.',
        'newcust.body3': 'Click the button below to access and set your personal password.',
        'newcust.cta': 'Access your office →',
        'newcust.steps_title': '📋 First steps',
        'newcust.step1': 'Click the button above to access',
        'newcust.step2': 'Set your personal password',
        'newcust.step3': 'Explore your virtual office and invite your team',
        'newcust.role': 'Role',
        'newcust.link_expiry': '⏳ This link is valid for 24 hours. After expiration, you can request a new access from the login page.',
    },
    es: {
        'welcome.subject': '¡Bienvenido a Cosmoffice! 🚀',
        'welcome.title': '¡Bienvenido a Cosmoffice!',
        'welcome.hello': 'Hola',
        'welcome.body': 'Tu cuenta ha sido creada con éxito. Estás listo para crear tu oficina virtual y colaborar con tu equipo en tiempo real.',
        'welcome.cta': 'Entra a tu oficina →',
        'welcome.footer': 'Cosmoffice — Tu oficina virtual',
        'invite.subject_suffix': 'te invitó a',
        'invite.subject_on': 'en Cosmoffice',
        'invite.title': '¡Has sido invitado! 🎉',
        'invite.body_prefix': 'te invitó a unirte al workspace',
        'invite.body_suffix': 'en Cosmoffice.',
        'invite.cta': 'Aceptar invitación →',
        'plan.subject_prefix': 'Plan actualizado a',
        'plan.title': '¡Actualización completada! 🚀',
        'plan.body': 'Tu plan ha sido actualizado a',
        'plan.body_suffix': 'Ahora tienes acceso a todos los beneficios del nuevo plan.',
        'trial.subject_prefix': 'Tu prueba expira en',
        'trial.subject_suffix': 'días',
        'trial.title': 'Tu prueba está por expirar ⏳',
        'trial.body_prefix': 'Tu período de prueba expira en',
        'trial.body_suffix': 'Elige un plan para seguir usando todas las funciones.',
        'trial.cta': 'Elegir un plan →',
        'newcust.subject_prefix': '🚀 Tu oficina',
        'newcust.subject_suffix': '¡está lista en Cosmoffice!',
        'newcust.title': '¡Bienvenido a Cosmoffice! 🎉',
        'newcust.subtitle': 'Tu oficina virtual ha sido creada y está lista para ti',
        'newcust.body': 'Tu espacio de trabajo',
        'newcust.body2': 'ha sido configurado y te espera.',
        'newcust.body3': 'Haz clic en el botón de abajo para acceder y configurar tu contraseña personal.',
        'newcust.cta': 'Accede a tu oficina →',
        'newcust.steps_title': '📋 Primeros pasos',
        'newcust.step1': 'Haz clic en el botón de arriba para acceder',
        'newcust.step2': 'Configura tu contraseña personal',
        'newcust.step3': 'Explora tu oficina virtual e invita a tu equipo',
        'newcust.role': 'Rol',
        'newcust.link_expiry': '⏳ Este enlace es válido por 24 horas. Después de la expiración, puedes solicitar un nuevo acceso desde la página de inicio de sesión.',
    },
};

function et(lang: Lang, key: string): string {
    return emailStrings[lang]?.[key] || emailStrings.it[key] || key;
}

// ─── Email Templates ───────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string, lang: Lang = 'it') {
    const resend = getResend();
    return resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject: et(lang, 'welcome.subject'),
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #0f172a; font-size: 28px; margin: 0;">${et(lang, 'welcome.title')}</h1>
                </div>
                <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                    ${et(lang, 'welcome.hello')} <strong>${name}</strong>,
                </p>
                <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                    ${et(lang, 'welcome.body')}
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://www.cosmoffice.io/office" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
                        ${et(lang, 'welcome.cta')}
                    </a>
                </div>
                <p style="color: #94a3b8; font-size: 13px; text-align: center; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                    ${et(lang, 'welcome.footer')}<br>
                    <a href="https://www.cosmoffice.io" style="color: #06b6d4;">www.cosmoffice.io</a>
                </p>
            </div>
        `,
    });
}

export async function sendInviteEmail(to: string, inviterName: string, workspaceName: string, inviteLink: string, lang: Lang = 'it') {
    const resend = getResend();
    return resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject: `${inviterName} ${et(lang, 'invite.subject_suffix')} ${workspaceName} ${et(lang, 'invite.subject_on')}`,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="color: #0f172a; font-size: 24px; text-align: center;">${et(lang, 'invite.title')}</h1>
                <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                    <strong>${inviterName}</strong> ${et(lang, 'invite.body_prefix')} <strong>"${workspaceName}"</strong> ${et(lang, 'invite.body_suffix')}
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
                        ${et(lang, 'invite.cta')}
                    </a>
                </div>
                <p style="color: #94a3b8; font-size: 13px; text-align: center; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                    ${et(lang, 'welcome.footer')}<br>
                    <a href="https://www.cosmoffice.io" style="color: #06b6d4;">www.cosmoffice.io</a>
                </p>
            </div>
        `,
    });
}

export async function sendPlanUpgradeEmail(to: string, name: string, planName: string, lang: Lang = 'it') {
    const resend = getResend();
    return resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject: `${et(lang, 'plan.subject_prefix')} ${planName} ✨`,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="color: #0f172a; font-size: 24px; text-align: center;">${et(lang, 'plan.title')}</h1>
                <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                    ${et(lang, 'welcome.hello')} <strong>${name}</strong>,
                </p>
                <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                    ${et(lang, 'plan.body')} <strong>${planName}</strong>. ${et(lang, 'plan.body_suffix')}
                </p>
                <p style="color: #94a3b8; font-size: 13px; text-align: center; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                    ${et(lang, 'welcome.footer')}<br>
                    <a href="https://www.cosmoffice.io" style="color: #06b6d4;">www.cosmoffice.io</a>
                </p>
            </div>
        `,
    });
}

export async function sendTrialExpiringEmail(to: string, name: string, daysLeft: number, lang: Lang = 'it') {
    const resend = getResend();
    return resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject: `${et(lang, 'trial.subject_prefix')} ${daysLeft} ${et(lang, 'trial.subject_suffix')}`,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="color: #0f172a; font-size: 24px; text-align: center;">${et(lang, 'trial.title')}</h1>
                <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                    ${et(lang, 'welcome.hello')} <strong>${name}</strong>,
                </p>
                <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                    ${et(lang, 'trial.body_prefix')} <strong>${daysLeft} ${et(lang, 'trial.subject_suffix')}</strong>. ${et(lang, 'trial.body_suffix')}
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://www.cosmoffice.io/pricing" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
                        ${et(lang, 'trial.cta')}
                    </a>
                </div>
                <p style="color: #94a3b8; font-size: 13px; text-align: center; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                    ${et(lang, 'welcome.footer')}<br>
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
    magicLink: string,
    lang: Lang = 'it'
) {
    const resend = getResend();
    return resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject: `${et(lang, 'newcust.subject_prefix')} "${workspaceName}" ${et(lang, 'newcust.subject_suffix')}`,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background: #0f172a;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%); padding: 40px 30px; text-align: center; border-radius: 0 0 24px 24px;">
                    <h1 style="color: white; font-size: 28px; margin: 0 0 8px; font-weight: 700;">
                        ${et(lang, 'newcust.title')}
                    </h1>
                    <p style="color: rgba(255,255,255,0.85); font-size: 15px; margin: 0;">
                        ${et(lang, 'newcust.subtitle')}
                    </p>
                </div>

                <!-- Body -->
                <div style="padding: 32px 30px;">
                    <p style="color: #e2e8f0; font-size: 16px; line-height: 1.7; margin: 0 0 20px;">
                        ${et(lang, 'welcome.hello')} <strong style="color: #06b6d4;">${name}</strong>,
                    </p>
                    <p style="color: #cbd5e1; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
                        ${et(lang, 'newcust.body')} <strong style="color: white;">"${workspaceName}"</strong> ${et(lang, 'newcust.body2')}
                        ${et(lang, 'newcust.body3')}
                    </p>

                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 32px 0;">
                        <a href="${magicLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: white; text-decoration: none; border-radius: 14px; font-weight: 700; font-size: 17px; box-shadow: 0 4px 24px rgba(6, 182, 212, 0.4); letter-spacing: 0.5px;">
                            ${et(lang, 'newcust.cta')}
                        </a>
                    </div>

                    <!-- Info Cards -->
                    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin: 24px 0;">
                        <h3 style="color: #f8fafc; font-size: 14px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 1px;">
                            ${et(lang, 'newcust.steps_title')}
                        </h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8; font-size: 14px; vertical-align: top; width: 28px;">1.</td>
                                <td style="padding: 8px 0; color: #cbd5e1; font-size: 14px;">${et(lang, 'newcust.step1')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8; font-size: 14px; vertical-align: top;">2.</td>
                                <td style="padding: 8px 0; color: #cbd5e1; font-size: 14px;">${et(lang, 'newcust.step2')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #94a3b8; font-size: 14px; vertical-align: top;">3.</td>
                                <td style="padding: 8px 0; color: #cbd5e1; font-size: 14px;">${et(lang, 'newcust.step3')}</td>
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
                                <td style="color: #94a3b8; font-size: 13px; padding: 4px 0;">${et(lang, 'newcust.role')}</td>
                                <td style="color: #06b6d4; font-size: 13px; padding: 4px 0; text-align: right; font-weight: 600;">Owner</td>
                            </tr>
                        </table>
                    </div>

                    <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 24px 0 0; text-align: center;">
                        ${et(lang, 'newcust.link_expiry')}
                    </p>
                </div>

                <!-- Footer -->
                <div style="border-top: 1px solid rgba(255,255,255,0.08); padding: 24px 30px; text-align: center;">
                    <p style="color: #475569; font-size: 12px; margin: 0 0 4px;">
                        ${et(lang, 'welcome.footer')}
                    </p>
                    <a href="https://www.cosmoffice.io" style="color: #06b6d4; font-size: 12px; text-decoration: none;">
                        www.cosmoffice.io
                    </a>
                </div>
            </div>
        `,
    });
}
