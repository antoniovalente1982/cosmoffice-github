'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Check, X, ArrowRight, Zap, Users, Building2,
    Shield, Sparkles, Crown, ArrowLeft,
} from 'lucide-react';

const plans = [
    {
        key: 'free',
        name: 'Free',
        price: 0,
        description: 'Per provare Cosmoffice',
        color: 'from-slate-500/20 to-slate-600/20 border-slate-500/20',
        badge: null,
        features: [
            { text: '5 membri', included: true },
            { text: '1 ufficio virtuale', included: true },
            { text: '5 stanze per ufficio', included: true },
            { text: '512 MB storage', included: true },
            { text: 'Chat in tempo reale', included: true },
            { text: 'Video call', included: true },
            { text: 'Branding personalizzato', included: false },
            { text: 'AI Agents', included: false },
            { text: 'Analytics avanzati', included: false },
            { text: 'Supporto prioritario', included: false },
        ],
    },
    {
        key: 'starter',
        name: 'Starter',
        price: 19,
        description: 'Per team in crescita',
        color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/20',
        badge: null,
        features: [
            { text: '15 membri', included: true },
            { text: '3 uffici virtuali', included: true },
            { text: '10 stanze per ufficio', included: true },
            { text: '2 GB storage', included: true },
            { text: 'Chat in tempo reale', included: true },
            { text: 'Video call', included: true },
            { text: 'Branding personalizzato', included: false },
            { text: 'AI Agents', included: false },
            { text: 'Analytics avanzati', included: false },
            { text: 'Supporto email', included: true },
        ],
    },
    {
        key: 'pro',
        name: 'Pro',
        price: 49,
        description: 'Per aziende strutturate',
        color: 'from-purple-500/20 to-indigo-500/20 border-purple-500/20',
        badge: 'Più Popolare',
        features: [
            { text: '50 membri', included: true },
            { text: '10 uffici virtuali', included: true },
            { text: '25 stanze per ufficio', included: true },
            { text: '10 GB storage', included: true },
            { text: 'Chat in tempo reale', included: true },
            { text: 'Video call HD', included: true },
            { text: 'Branding personalizzato', included: true },
            { text: 'AI Agents', included: true },
            { text: 'Analytics avanzati', included: true },
            { text: 'Supporto prioritario', included: true },
        ],
    },
    {
        key: 'enterprise',
        name: 'Enterprise',
        price: 149,
        description: 'Per grandi organizzazioni',
        color: 'from-amber-500/20 to-orange-500/20 border-amber-500/20',
        badge: null,
        features: [
            { text: '200 membri', included: true },
            { text: '50 uffici virtuali', included: true },
            { text: '100 stanze per ufficio', included: true },
            { text: '50 GB storage', included: true },
            { text: 'Chat in tempo reale', included: true },
            { text: 'Video call HD', included: true },
            { text: 'White-label completo', included: true },
            { text: 'AI Agents illimitati', included: true },
            { text: 'Analytics + export', included: true },
            { text: 'Account manager dedicato', included: true },
        ],
    },
];

export default function PricingPage() {
    const router = useRouter();
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

    const handleSelectPlan = async (planKey: string) => {
        if (planKey === 'free') {
            router.push('/signup');
            return;
        }
        // For paid plans, redirect to signup first (they'll choose a workspace to upgrade from /office)
        router.push(`/signup?plan=${planKey}`);
    };

    return (
        <div className="min-h-screen bg-[#0a0e1a] text-white">
            {/* Header */}
            <div className="max-w-7xl mx-auto px-6 pt-10 pb-4">
                <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-8">
                    <ArrowLeft className="w-4 h-4" /> Torna al sito
                </Link>
            </div>

            {/* Hero */}
            <div className="text-center max-w-3xl mx-auto px-6 mb-16">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm font-semibold mb-6">
                    <Sparkles className="w-4 h-4" /> Scegli il piano giusto per il tuo team
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-white via-cyan-100 to-purple-200 bg-clip-text text-transparent">
                    Prezzi semplici, trasparenti
                </h1>
                <p className="text-lg text-slate-400">
                    Nessun costo nascosto. Upgrade e downgrade in qualsiasi momento.
                </p>
            </div>

            {/* Plans Grid */}
            <div className="max-w-7xl mx-auto px-6 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {plans.map((plan) => (
                        <div
                            key={plan.key}
                            className={`relative rounded-2xl border bg-gradient-to-br p-6 transition-all hover:scale-[1.02] ${plan.color} ${plan.badge ? 'ring-2 ring-purple-500/50' : ''}`}
                            style={{ background: 'rgba(15, 23, 42, 0.7)' }}
                        >
                            {plan.badge && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-purple-500 text-white text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                                    {plan.badge}
                                </div>
                            )}

                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                                <p className="text-xs text-slate-400">{plan.description}</p>
                            </div>

                            <div className="mb-6">
                                <div className="flex items-end gap-1">
                                    <span className="text-4xl font-extrabold text-white">€{plan.price}</span>
                                    {plan.price > 0 && <span className="text-sm text-slate-500 mb-1">/mese</span>}
                                </div>
                                {plan.price === 0 && <span className="text-sm text-slate-500">per sempre</span>}
                            </div>

                            <div className="space-y-2.5 mb-8">
                                {plan.features.map((f, i) => (
                                    <div key={i} className={`flex items-center gap-2 text-sm ${f.included ? 'text-slate-200' : 'text-slate-600'}`}>
                                        {f.included ? (
                                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                        ) : (
                                            <X className="w-4 h-4 text-slate-700 shrink-0" />
                                        )}
                                        {f.text}
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => handleSelectPlan(plan.key)}
                                disabled={loadingPlan === plan.key}
                                className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${plan.badge
                                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-400 hover:to-indigo-400 shadow-lg shadow-purple-500/20'
                                    : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                                    }`}
                            >
                                {plan.price === 0 ? 'Inizia Gratis' : 'Scegli Piano'}
                                <ArrowRight className="w-4 h-4 inline ml-2" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* FAQ */}
                <div className="mt-20 max-w-2xl mx-auto text-center">
                    <h2 className="text-2xl font-bold text-white mb-4">Domande Frequenti</h2>
                    <div className="space-y-4 text-left">
                        {[
                            { q: 'Posso cambiare piano in qualsiasi momento?', a: 'Sì, puoi fare upgrade o downgrade dal pannello del tuo workspace. Le modifiche sono immediate.' },
                            { q: 'C\'è un periodo di prova?', a: 'Sì! Ogni nuovo workspace inizia con 14 giorni di prova del piano Starter, senza carta di credito.' },
                            { q: 'Come funziona la fatturazione?', a: 'La fatturazione è mensile e gestita tramite Stripe. Riceverai fattura via email ad ogni rinnovo.' },
                            { q: 'Cosa succede se supero i limiti del piano?', a: 'Riceverai un avviso e potrai fare upgrade. Non perderai mai dati, semplicemente non potrai aggiungere nuovi elementi.' },
                        ].map((faq, i) => (
                            <div key={i} className="p-4 rounded-xl border border-white/5" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                                <p className="text-sm font-semibold text-white">{faq.q}</p>
                                <p className="text-sm text-slate-400 mt-1">{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
