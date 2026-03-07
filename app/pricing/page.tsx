'use client';

import Link from 'next/link';
import { ArrowLeft, Check, X, Building2, Users, MessageSquare, Video, Monitor, Sparkles } from 'lucide-react';

const plans = [
    {
        name: 'Free',
        subtitle: 'Per testare Cosmoffice',
        highlight: false,
        features: [
            { text: 'Fino a 3 persone', included: true },
            { text: '1 ufficio virtuale', included: true },
            { text: '5 stanze', included: true },
            { text: 'Chat in tempo reale', included: true },
            { text: 'Avatar personalizzato', included: true },
            { text: 'Video call', included: false },
            { text: 'Microfono', included: false },
            { text: 'Screen share', included: false },
            { text: 'Guest illimitati', included: false },
        ],
        cta: 'Inizia Gratis',
        ctaLink: '/signup',
        ctaStyle: 'outline' as const,
    },
    {
        name: 'Team 10',
        subtitle: 'Fino a 10 persone',
        highlight: false,
        features: [
            { text: 'Fino a 10 persone (team + guest)', included: true },
            { text: 'Uffici multipli', included: true },
            { text: 'Stanze illimitate', included: true },
            { text: 'Chat in tempo reale', included: true },
            { text: 'Video call HD', included: true },
            { text: 'Microfono', included: true },
            { text: 'Screen share', included: true },
            { text: 'Space Builder completo', included: true },
            { text: 'Supporto email', included: true },
        ],
        cta: 'Richiedi Prezzo',
        ctaLink: 'mailto:support@cosmoffice.io?subject=Richiesta%20Piano%20Team%2010',
        ctaStyle: 'outline' as const,
    },
    {
        name: 'Team 25',
        subtitle: 'Fino a 25 persone',
        highlight: true,
        features: [
            { text: 'Fino a 25 persone (team + guest)', included: true },
            { text: 'Uffici multipli', included: true },
            { text: 'Stanze illimitate', included: true },
            { text: 'Chat in tempo reale', included: true },
            { text: 'Video call HD', included: true },
            { text: 'Microfono', included: true },
            { text: 'Screen share', included: true },
            { text: 'Space Builder completo', included: true },
            { text: 'Supporto prioritario', included: true },
        ],
        cta: 'Richiedi Prezzo',
        ctaLink: 'mailto:support@cosmoffice.io?subject=Richiesta%20Piano%20Team%2025',
        ctaStyle: 'solid' as const,
    },
    {
        name: 'Team 50',
        subtitle: 'Fino a 50 persone',
        highlight: false,
        features: [
            { text: 'Fino a 50 persone (team + guest)', included: true },
            { text: 'Uffici multipli', included: true },
            { text: 'Stanze illimitate', included: true },
            { text: 'Chat in tempo reale', included: true },
            { text: 'Video call HD', included: true },
            { text: 'Microfono', included: true },
            { text: 'Screen share', included: true },
            { text: 'Space Builder completo', included: true },
            { text: 'Supporto prioritario', included: true },
        ],
        cta: 'Richiedi Prezzo',
        ctaLink: 'mailto:support@cosmoffice.io?subject=Richiesta%20Piano%20Team%2050',
        ctaStyle: 'outline' as const,
    },
    {
        name: 'Team 100',
        subtitle: 'Fino a 100 persone',
        highlight: false,
        features: [
            { text: 'Fino a 100 persone (team + guest)', included: true },
            { text: '20 uffici virtuali', included: true },
            { text: '100 stanze', included: true },
            { text: 'Chat in tempo reale', included: true },
            { text: 'Video call HD', included: true },
            { text: 'Microfono', included: true },
            { text: 'Screen share', included: true },
            { text: 'Space Builder completo', included: true },
            { text: 'Supporto dedicato', included: true },
        ],
        cta: 'Richiedi Prezzo',
        ctaLink: 'mailto:support@cosmoffice.io?subject=Richiesta%20Piano%20Team%20100',
        ctaStyle: 'outline' as const,
    },
    {
        name: 'Enterprise',
        subtitle: 'Per grandi organizzazioni',
        highlight: false,
        features: [
            { text: 'Persone illimitate', included: true },
            { text: 'Uffici illimitati', included: true },
            { text: 'Stanze illimitate', included: true },
            { text: 'Tutte le feature incluse', included: true },
            { text: 'SLA dedicato', included: true },
            { text: 'Account manager', included: true },
            { text: 'Onboarding personalizzato', included: true },
            { text: 'Supporto dedicato 24/7', included: true },
            { text: 'Fatturazione personalizzata', included: true },
        ],
        cta: 'Contattaci',
        ctaLink: 'mailto:support@cosmoffice.io?subject=Richiesta%20Piano%20Enterprise',
        ctaStyle: 'outline' as const,
    },
];

const faqs = [
    {
        q: 'Come funziona il conteggio persone?',
        a: 'Il numero massimo include sia i membri del team che i guest invitati. Ad esempio, con Team 10 puoi avere 7 membri + 3 guest, oppure 10 membri e 0 guest.',
    },
    {
        q: "C'è un periodo di prova?",
        a: 'Il piano Free è gratuito per sempre, così puoi testare Cosmoffice senza limiti di tempo. Per i piani a pagamento, contattaci per una demo personalizzata.',
    },
    {
        q: 'Come si paga?',
        a: 'Accettiamo pagamento tramite bonifico bancario con fatturazione mensile. Contattaci per ricevere i dettagli.',
    },
    {
        q: 'Posso cambiare piano?',
        a: 'Sì, puoi passare a un piano superiore in qualsiasi momento contattando il nostro team. Il cambio è immediato.',
    },
    {
        q: 'Cosa sono i guest?',
        a: 'I guest sono persone esterne (clienti, fornitori, candidati) che inviti nel tuo ufficio virtuale. Sono inclusi nel conteggio totale del piano.',
    },
];

export default function PricingPage() {
    return (
        <div style={{
            minHeight: '100vh',
            background: '#0a0e1a',
            color: '#e2e8f0',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
            {/* Header */}
            <div style={{ padding: '20px 32px' }}>
                <Link href="/" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ArrowLeft style={{ width: 16, height: 16 }} />
                    Torna al sito
                </Link>
            </div>

            {/* Hero */}
            <div style={{ textAlign: 'center', padding: '40px 20px 60px' }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px',
                    borderRadius: 100, border: '1px solid rgba(6, 182, 212, 0.2)',
                    background: 'rgba(6, 182, 212, 0.05)', marginBottom: 24,
                }}>
                    <Sparkles style={{ width: 16, height: 16, color: '#06b6d4' }} />
                    <span style={{ fontSize: 14, color: '#06b6d4', fontWeight: 600 }}>
                        Scegli il piano giusto per il tuo team
                    </span>
                </div>
                <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, lineHeight: 1.1, margin: '0 0 16px' }}>
                    Il tuo ufficio virtuale.
                    <br />
                    <span style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Senza limiti di spazio.
                    </span>
                </h1>
                <p style={{ fontSize: 18, color: '#64748b', maxWidth: 500, margin: '0 auto' }}>
                    Gratis per testare. Contattaci per un piano su misura.
                </p>
            </div>

            {/* Plans Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 20,
                maxWidth: 1300,
                margin: '0 auto',
                padding: '0 24px 80px',
            }}>
                {plans.map((plan) => (
                    <div key={plan.name} style={{
                        background: plan.highlight ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255,255,255,0.02)',
                        border: plan.highlight ? '2px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 20,
                        padding: 28,
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                    }}>
                        {plan.highlight && (
                            <div style={{
                                position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                                background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                                padding: '4px 16px', borderRadius: 20,
                                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '0.05em', color: 'white',
                            }}>
                                Più Popolare
                            </div>
                        )}

                        <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>{plan.name}</h3>
                        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px' }}>{plan.subtitle}</p>

                        {plan.name === 'Free' ? (
                            <div style={{ marginBottom: 20 }}>
                                <span style={{ fontSize: 36, fontWeight: 800, color: '#e2e8f0' }}>€0</span>
                                <span style={{ fontSize: 14, color: '#64748b', marginLeft: 4 }}>per sempre</span>
                            </div>
                        ) : (
                            <div style={{ marginBottom: 20 }}>
                                <span style={{ fontSize: 16, color: '#94a3b8', fontWeight: 600 }}>Prezzo su richiesta</span>
                            </div>
                        )}

                        <div style={{ flex: 1, marginBottom: 24 }}>
                            {plan.features.map((f, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                    {f.included ? (
                                        <Check style={{ width: 16, height: 16, color: '#22c55e', flexShrink: 0 }} />
                                    ) : (
                                        <X style={{ width: 16, height: 16, color: '#334155', flexShrink: 0 }} />
                                    )}
                                    <span style={{ fontSize: 13, color: f.included ? '#cbd5e1' : '#475569' }}>
                                        {f.text}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <a
                            href={plan.ctaLink}
                            style={{
                                display: 'block', textAlign: 'center', padding: '14px 24px',
                                borderRadius: 14, fontSize: 14, fontWeight: 700,
                                textDecoration: 'none', transition: 'all 0.2s',
                                ...(plan.ctaStyle === 'solid' ? {
                                    background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
                                    color: 'white',
                                    border: 'none',
                                    boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)',
                                } : {
                                    background: 'transparent',
                                    color: '#e2e8f0',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                }),
                            }}
                        >
                            {plan.cta} →
                        </a>
                    </div>
                ))}
            </div>

            {/* FAQ */}
            <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px 80px' }}>
                <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 40 }}>
                    Domande Frequenti
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {faqs.map((faq, i) => (
                        <div key={i} style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 16, padding: '20px 24px',
                        }}>
                            <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px', color: '#f1f5f9' }}>
                                {faq.q}
                            </h3>
                            <p style={{ fontSize: 14, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
                                {faq.a}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
