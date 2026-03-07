'use client';

import { useState } from 'react';
import {
    Mail, ExternalLink, CheckCircle2, XCircle, Copy, Check,
    Shield, Globe, Zap, ArrowRight, AlertTriangle, Send,
    FileText, Key, Server,
} from 'lucide-react';

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="p-1 rounded hover:bg-white/10 transition-colors text-slate-500 hover:text-slate-300"
            title="Copia"
        >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    );
}

const smtpConfig = {
    host: 'smtp.resend.com',
    port: '465',
    username: 'resend',
    password: 're_xxxxxxxxxxxxx (la tua API Key)',
    sender: 'noreply@tuodominio.com',
};

const dnsRecords = [
    { type: 'TXT', name: 'resend._domainkey', value: '(generato da Resend)', purpose: 'DKIM' },
    { type: 'TXT', name: '@', value: 'v=spf1 include:amazonses.com ~all', purpose: 'SPF' },
];

const emailTemplates = [
    { id: 'confirm_signup', name: 'Conferma Registrazione', description: 'Inviata quando un utente si registra', icon: '📧' },
    { id: 'reset_password', name: 'Reset Password', description: 'Inviata quando un utente richiede il reset', icon: '🔑' },
    { id: 'magic_link', name: 'Magic Link', description: 'Login senza password', icon: '✨' },
    { id: 'invite', name: 'Invito Workspace', description: 'Inviata quando qualcuno viene invitato', icon: '📨' },
    { id: 'email_change', name: 'Cambio Email', description: 'Conferma cambio indirizzo email', icon: '📬' },
];

export default function EmailConfigPage() {
    return (
        <div className="p-8 space-y-8 max-w-5xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Email & Resend</h1>
                <p className="text-sm text-slate-400 mt-1">Configura il provider email per le notifiche transazionali (login, reset password, inviti)</p>
            </div>

            {/* Status Banner */}
            <div className="rounded-2xl border border-amber-500/20 p-5 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white">Configurazione Richiesta</h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Attualmente le email vengono inviate dal servizio built-in di Supabase con limiti restrittivi.
                            Configura <strong className="text-amber-300">Resend</strong> per email personalizzate dal <strong className="text-amber-300">tuo dominio</strong> con alta deliverability.
                        </p>
                    </div>
                </div>
            </div>

            {/* Resend Provider Card */}
            <div className="rounded-2xl border border-emerald-500/15 p-6 space-y-5"
                style={{ background: 'rgba(15, 23, 42, 0.6)' }}>

                {/* Provider Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20 flex items-center justify-center">
                            <Send className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Resend</h3>
                            <p className="text-xs text-slate-400">Provider email transazionale raccomandato</p>
                        </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/20">
                        <XCircle className="w-3 h-3" /> Non collegato
                    </span>
                </div>

                {/* Why Resend */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { icon: Zap, label: 'Alta Deliverability', desc: 'Le email non finiscono in spam' },
                        { icon: Globe, label: 'Dominio Custom', desc: 'Invia da noreply@tuodominio.com' },
                        { icon: Shield, label: 'DKIM & SPF', desc: 'Autenticazione email completa' },
                    ].map(({ icon: Icon, label, desc }) => (
                        <div key={label} className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                            <Icon className="w-4 h-4 text-emerald-400 mb-2" />
                            <p className="text-xs font-bold text-white">{label}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
                        </div>
                    ))}
                </div>

                {/* Setup Steps */}
                <div className="space-y-4 pt-4 border-t border-white/5">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Setup in 4 passi</p>

                    {/* Step 1 */}
                    <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                        <div className="flex-1">
                            <p className="text-sm text-slate-200 font-medium">Crea account Resend e genera API Key</p>
                            <a href="https://resend.com/signup" target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                                <Globe className="w-3 h-3" /> resend.com/signup <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                        <div className="flex-1">
                            <p className="text-sm text-slate-200 font-medium">Verifica dominio su Hostinger</p>
                            <p className="text-xs text-slate-400 mt-1">Aggiungi questi record DNS nel pannello Hostinger:</p>
                            <div className="mt-2 space-y-2">
                                {dnsRecords.map((record, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-black/30 rounded-lg px-3 py-2">
                                        <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded">{record.type}</span>
                                        <span className="text-xs text-amber-300 font-mono">{record.name}</span>
                                        <span className="text-xs text-slate-500 flex-1 font-mono truncate">{record.value}</span>
                                        <span className="text-[10px] text-slate-600">{record.purpose}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                        <div className="flex-1">
                            <p className="text-sm text-slate-200 font-medium">Configura SMTP in Supabase Dashboard</p>
                            <p className="text-xs text-slate-400 mt-1 mb-2">
                                Vai su <strong className="text-white">Authentication → Email Templates → SMTP Settings</strong> e inserisci:
                            </p>
                            <div className="space-y-1.5">
                                {Object.entries(smtpConfig).map(([key, value]) => (
                                    <div key={key} className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 font-mono text-[11px]">
                                        <span className="text-amber-300 w-20 shrink-0">{key}</span>
                                        <span className="text-slate-600">:</span>
                                        <span className="text-slate-300 flex-1">{value}</span>
                                        <CopyButton text={value} />
                                    </div>
                                ))}
                            </div>
                            <a href="https://supabase.com/dashboard/project/_/auth/templates" target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                                Apri Supabase Auth Settings <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                        <div className="flex-1">
                            <p className="text-sm text-slate-200 font-medium">Testa l&apos;invio email</p>
                            <p className="text-xs text-slate-400 mt-1">
                                Registra un account di test oppure usa &quot;Reset Password&quot; per verificare che le email arrivino dal tuo dominio.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                    <a
                        href="https://resend.com/domains"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                    >
                        <Key className="w-4 h-4" /> Dashboard Resend <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <a
                        href="https://resend.com/docs/send-with-supabase-smtp"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                    >
                        <FileText className="w-4 h-4" /> Guida Resend + Supabase <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                </div>
            </div>

            {/* Email Templates */}
            <div className="rounded-2xl border border-white/5 p-6 space-y-4"
                style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Template Email</h3>
                </div>
                <p className="text-xs text-slate-400">
                    I template si configurano dal <strong className="text-slate-200">Supabase Dashboard</strong> → Authentication → Email Templates.
                    Una volta collegato Resend, tutte le email useranno il tuo dominio e branding.
                </p>
                <div className="space-y-2">
                    {emailTemplates.map(t => (
                        <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                            <span className="text-xl">{t.icon}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white">{t.name}</p>
                                <p className="text-[11px] text-slate-500">{t.description}</p>
                            </div>
                            <a
                                href="https://supabase.com/dashboard/project/_/auth/templates"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 shrink-0"
                            >
                                Modifica <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    ))}
                </div>
            </div>

            {/* Support Email */}
            <div className="rounded-2xl border border-white/5 p-6 space-y-4"
                style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Email di Supporto</h3>
                </div>
                <p className="text-xs text-slate-400">
                    L&apos;email di supporto viene gestita dal tuo provider di hosting (Hostinger).
                    Usala per le comunicazioni con i clienti e il supporto tecnico.
                </p>
                <div className="flex items-center gap-3 bg-black/30 rounded-xl px-4 py-3 border border-white/5">
                    <Server className="w-5 h-5 text-amber-400" />
                    <div className="flex-1">
                        <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">Hostinger</p>
                        <p className="text-sm text-white font-mono">support@tuodominio.com</p>
                    </div>
                    <a
                        href="https://hpanel.hostinger.com/email"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                    >
                        Gestisci <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            </div>

            {/* Pricing */}
            <div className="rounded-2xl border border-white/5 p-5 text-center" style={{ background: 'rgba(15, 23, 42, 0.4)' }}>
                <p className="text-sm text-slate-400">
                    <strong className="text-white">Resend Piano Gratuito</strong>: 3.000 email/mese · 100 email/giorno · 1 dominio.
                    <br />
                    <span className="text-slate-500">Sufficiente per ~100 utenti attivi. Piano Pro da $20/mese per scaling.</span>
                </p>
            </div>
        </div>
    );
}
