'use client';

import { useState } from 'react';
import {
    CreditCard, ExternalLink, CheckCircle2, XCircle, AlertTriangle,
    ArrowRight, Zap, Shield, Globe, Copy, Check,
} from 'lucide-react';

interface ProviderCard {
    id: string;
    name: string;
    description: string;
    logo: string;
    color: string;
    dashboardUrl: string;
    docsUrl: string;
    envKeys: string[];
    webhookPath: string;
    features: string[];
}

const providers: ProviderCard[] = [
    {
        id: 'stripe',
        name: 'Stripe',
        description: 'Gestisci abbonamenti, fatture e pagamenti ricorrenti con la piattaforma leader del settore.',
        logo: '💳',
        color: 'from-indigo-500/20 to-purple-500/20 border-indigo-500/20',
        dashboardUrl: 'https://dashboard.stripe.com',
        docsUrl: 'https://stripe.com/docs/billing/subscriptions/overview',
        envKeys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
        webhookPath: '/api/webhooks/stripe',
        features: ['Abbonamenti ricorrenti', 'Fatturazione automatica', 'Prorate & upgrade', 'Portal cliente'],
    },
    {
        id: 'paypal',
        name: 'PayPal',
        description: 'Accetta pagamenti globali attraverso PayPal, una delle soluzioni di pagamento più diffuse al mondo.',
        logo: '🅿️',
        color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/20',
        dashboardUrl: 'https://developer.paypal.com/dashboard',
        docsUrl: 'https://developer.paypal.com/docs/subscriptions/',
        envKeys: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
        webhookPath: '/api/webhooks/paypal',
        features: ['Pagamenti globali', 'Checkout rapido', 'Subscription plans', 'Supporto multi-valuta'],
    },
];

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

export default function PaymentsPage() {
    return (
        <div className="p-8 space-y-8 max-w-5xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Pagamenti</h1>
                <p className="text-sm text-slate-400 mt-1">Collega un payment provider per iniziare a ricevere pagamenti dai piani a pagamento</p>
            </div>

            {/* Quick Setup Banner */}
            <div className="rounded-2xl border border-cyan-500/20 p-5 bg-gradient-to-r from-cyan-500/5 to-purple-500/5">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white">Setup Rapido</h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Scegli un provider, crea un account se non ne hai uno, copia le API keys nelle variabili d'ambiente del progetto
                            e configura il webhook. I pagamenti inizieranno ad essere tracciati nella tab <strong className="text-cyan-300">Revenue</strong>.
                        </p>
                    </div>
                </div>
            </div>

            {/* Provider Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {providers.map(provider => (
                    <div
                        key={provider.id}
                        className={`rounded-2xl border bg-gradient-to-br p-6 space-y-5 transition-all hover:scale-[1.01] ${provider.color}`}
                        style={{ background: 'rgba(15, 23, 42, 0.6)' }}
                    >
                        {/* Provider Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">{provider.logo}</span>
                                <div>
                                    <h3 className="text-lg font-bold text-white">{provider.name}</h3>
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/20">
                                        <XCircle className="w-3 h-3" /> Non collegato
                                    </span>
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed">{provider.description}</p>

                        {/* Features */}
                        <div className="grid grid-cols-2 gap-2">
                            {provider.features.map(f => (
                                <div key={f} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                    {f}
                                </div>
                            ))}
                        </div>

                        {/* Setup Steps */}
                        <div className="space-y-3 pt-2 border-t border-white/5">
                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Setup</p>

                            {/* Step 1: Create Account */}
                            <div className="flex items-start gap-3">
                                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                                <div className="flex-1">
                                    <p className="text-xs text-slate-300">Crea o accedi al tuo account</p>
                                    <a href={provider.dashboardUrl} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 mt-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors">
                                        <Globe className="w-3 h-3" /> {provider.dashboardUrl} <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>

                            {/* Step 2: API Keys */}
                            <div className="flex items-start gap-3">
                                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                                <div className="flex-1">
                                    <p className="text-xs text-slate-300">Aggiungi le API keys al file <code className="text-cyan-400 text-[11px]">.env.local</code></p>
                                    <div className="mt-2 space-y-1.5">
                                        {provider.envKeys.map(key => (
                                            <div key={key} className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1.5 font-mono text-[11px]">
                                                <span className="text-amber-300">{key}</span>
                                                <span className="text-slate-600">=</span>
                                                <span className="text-slate-500 flex-1">your_key_here</span>
                                                <CopyButton text={`${key}=`} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Step 3: Webhook */}
                            <div className="flex items-start gap-3">
                                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                                <div className="flex-1">
                                    <p className="text-xs text-slate-300">Configura il Webhook URL nel dashboard del provider</p>
                                    <div className="flex items-center gap-2 mt-2 bg-black/30 rounded-lg px-3 py-1.5 font-mono text-[11px]">
                                        <span className="text-emerald-300 flex-1">https://tuodominio.com{provider.webhookPath}</span>
                                        <CopyButton text={provider.webhookPath} />
                                    </div>
                                </div>
                            </div>

                            {/* Step 4: Docs */}
                            <div className="flex items-start gap-3">
                                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                                <div className="flex-1">
                                    <p className="text-xs text-slate-300">Consulta la documentazione per configurare i piani</p>
                                    <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 mt-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors">
                                        Documentazione <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Action */}
                        <a
                            href={provider.dashboardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                        >
                            Vai al Dashboard {provider.name} <ArrowRight className="w-4 h-4" />
                        </a>
                    </div>
                ))}
            </div>

            {/* Info */}
            <div className="rounded-2xl border border-white/5 p-5 text-center" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                <Shield className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                <p className="text-sm text-slate-400 max-w-lg mx-auto">
                    Le chiavi API non vengono mai salvate nel database. Sono gestite esclusivamente come variabili d'ambiente sul server.
                    I dati di pagamento vengono salvati nella tabella <code className="text-cyan-400">billing_events</code> tramite webhook.
                </p>
            </div>
        </div>
    );
}
