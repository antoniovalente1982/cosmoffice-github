'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mic, Video, Users, Compass, MessageSquare,
    ChevronRight, ChevronLeft, X, Sparkles,
} from 'lucide-react';

const STEPS = [
    {
        icon: Compass,
        title: 'Benvenuto nel tuo ufficio!',
        body: 'Muovi il tuo avatar cliccando sulla mappa. Esplora le stanze e incontra il tuo team.',
        color: 'text-cyan-400',
        bg: 'from-cyan-500/20 to-blue-500/20',
    },
    {
        icon: Mic,
        title: 'Audio e Video',
        body: 'Usa i pulsanti in basso per attivare microfono e videocamera. Funzionano solo quando sei vicino a un collega.',
        color: 'text-emerald-400',
        bg: 'from-emerald-500/20 to-green-500/20',
    },
    {
        icon: Users,
        title: 'Stanze e Prossimità',
        body: 'Entra nelle stanze per collaborare. L\'audio si attiva automaticamente quando sei vicino a qualcuno.',
        color: 'text-purple-400',
        bg: 'from-purple-500/20 to-pink-500/20',
    },
    {
        icon: MessageSquare,
        title: 'Chat e Lavagna',
        body: 'Usa la chat per messaggi rapidi e la lavagna per disegni condivisi. Ogni stanza ha la propria chat.',
        color: 'text-amber-400',
        bg: 'from-amber-500/20 to-orange-500/20',
    },
    {
        icon: Video,
        title: 'Screen Sharing',
        body: 'Condividi il tuo schermo con i colleghi nello stesso contesto audio. Perfetto per presentazioni e debug.',
        color: 'text-indigo-400',
        bg: 'from-indigo-500/20 to-violet-500/20',
    },
];

const ONBOARDING_KEY = 'cosmoffice_onboarding_done';

export function OnboardingTour() {
    const [step, setStep] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const done = localStorage.getItem(ONBOARDING_KEY);
        if (!done) {
            // Small delay to let the office load first
            const timer = setTimeout(() => setIsOpen(true), 2000);
            return () => clearTimeout(timer);
        }
    }, []);

    const complete = useCallback(() => {
        localStorage.setItem(ONBOARDING_KEY, 'true');
        setIsOpen(false);
    }, []);

    const next = useCallback(() => {
        if (step < STEPS.length - 1) setStep(s => s + 1);
        else complete();
    }, [step, complete]);

    const prev = useCallback(() => {
        if (step > 0) setStep(s => s - 1);
    }, [step]);

    if (!isOpen) return null;

    const current = STEPS[step];
    const Icon = current.icon;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center"
            >
                {/* Spotlight overlay */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={complete} />

                {/* Card */}
                <motion.div
                    key={step}
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: -20 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="relative w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                    style={{ background: 'rgba(15, 23, 42, 0.97)' }}
                >
                    {/* Top gradient accent */}
                    <div className={`h-1 bg-gradient-to-r ${current.bg}`} />

                    {/* Close button */}
                    <button
                        onClick={complete}
                        className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors z-10"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* Content */}
                    <div className="p-6 text-center">
                        {/* Icon */}
                        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${current.bg} mb-4 border border-white/5`}>
                            <Icon className={`w-7 h-7 ${current.color}`} />
                        </div>

                        <h3 className="text-lg font-bold text-white mb-2">{current.title}</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">{current.body}</p>

                        {/* Step indicator dots */}
                        <div className="flex items-center justify-center gap-1.5 mt-5">
                            {STEPS.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setStep(i)}
                                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                        i === step
                                            ? `${current.color.replace('text-', 'bg-')} w-6 shadow-lg`
                                            : i < step
                                                ? 'bg-white/30'
                                                : 'bg-white/10'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Footer navigation */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
                        <button
                            onClick={prev}
                            disabled={step === 0}
                            className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" /> Indietro
                        </button>

                        <span className="text-[10px] text-slate-600 font-medium">
                            {step + 1} / {STEPS.length}
                        </span>

                        <button
                            onClick={next}
                            className={`flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all bg-gradient-to-r ${current.bg} border border-white/10 hover:border-white/20 shadow-lg`}
                        >
                            {step === STEPS.length - 1 ? (
                                <>
                                    <Sparkles className="w-3.5 h-3.5" /> Inizia!
                                </>
                            ) : (
                                <>
                                    Avanti <ChevronRight className="w-3.5 h-3.5" />
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
