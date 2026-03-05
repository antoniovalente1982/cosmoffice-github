'use client';

// ============================================
// KnockNotification — Popup UI for knock-to-enter requests
// Shows when someone knocks at a room you're in
// Also shows knock status when you're trying to enter a room
// ============================================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DoorOpen, X, Check, Clock, Ban } from 'lucide-react';
import { useKnockToEnter, type KnockRequest } from '../../hooks/useKnockToEnter';

export function KnockNotification() {
    const { pendingKnocks, knockStatus, respondToKnock, cancelKnock } = useKnockToEnter();

    return (
        <>
            {/* ─── Incoming Knock Requests ─── */}
            <AnimatePresence>
                {pendingKnocks.map((knock) => (
                    <IncomingKnockCard
                        key={`${knock.userId}-${knock.roomId}`}
                        knock={knock}
                        onAccept={() => respondToKnock(knock, true)}
                        onReject={() => respondToKnock(knock, false)}
                    />
                ))}
            </AnimatePresence>

            {/* ─── Outgoing Knock Status ─── */}
            <AnimatePresence>
                {knockStatus !== 'idle' && (
                    <OutgoingKnockStatus
                        status={knockStatus}
                        onCancel={cancelKnock}
                    />
                )}
            </AnimatePresence>
        </>
    );
}

// ─── Incoming request card ─────────────────────────────────
function IncomingKnockCard({
    knock,
    onAccept,
    onReject,
}: {
    knock: KnockRequest;
    onAccept: () => void;
    onReject: () => void;
}) {
    const [remainingMs, setRemainingMs] = useState(30_000);

    useEffect(() => {
        const interval = setInterval(() => {
            const elapsed = Date.now() - knock.timestamp;
            setRemainingMs(Math.max(0, 30_000 - elapsed));
        }, 1000);
        return () => clearInterval(interval);
    }, [knock.timestamp]);

    const seconds = Math.ceil(remainingMs / 1000);

    return (
        <motion.div
            initial={{ opacity: 0, x: 50, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-4 right-4 z-[9999] w-80"
        >
            <div className="bg-slate-900/98 border border-cyan-500/30 rounded-2xl p-4 shadow-2xl shadow-cyan-500/10">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                        <DoorOpen className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-white">
                            {knock.name}
                        </p>
                        <p className="text-xs text-slate-400">Sta bussando alla porta</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        {seconds}s
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1 bg-slate-800 rounded-full mb-3 overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
                        initial={{ width: '100%' }}
                        animate={{ width: `${(remainingMs / 30_000) * 100}%` }}
                        transition={{ duration: 1, ease: 'linear' }}
                    />
                </div>

                {/* Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={onAccept}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm font-semibold transition-all border border-emerald-500/20 hover:border-emerald-500/40"
                    >
                        <Check className="w-4 h-4" />
                        Accetta
                    </button>
                    <button
                        onClick={onReject}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-semibold transition-all border border-red-500/20 hover:border-red-500/40"
                    >
                        <X className="w-4 h-4" />
                        Rifiuta
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Outgoing knock status ─────────────────────────────────
function OutgoingKnockStatus({
    status,
    onCancel,
}: {
    status: 'waiting' | 'accepted' | 'rejected' | 'timeout';
    onCancel: () => void;
}) {
    const getConfig = () => {
        switch (status) {
            case 'waiting':
                return {
                    icon: <Clock className="w-5 h-5 text-cyan-400 animate-pulse" />,
                    text: 'In attesa di risposta...',
                    subText: 'Hai bussato alla porta',
                    color: 'border-cyan-500/30 bg-cyan-500/5',
                    showCancel: true,
                };
            case 'accepted':
                return {
                    icon: <Check className="w-5 h-5 text-emerald-400" />,
                    text: 'Accesso concesso!',
                    subText: 'Benvenuto nella stanza',
                    color: 'border-emerald-500/30 bg-emerald-500/5',
                    showCancel: false,
                };
            case 'rejected':
                return {
                    icon: <Ban className="w-5 h-5 text-red-400" />,
                    text: 'Accesso negato',
                    subText: 'La tua richiesta è stata rifiutata',
                    color: 'border-red-500/30 bg-red-500/5',
                    showCancel: false,
                };
            case 'timeout':
                return {
                    icon: <Clock className="w-5 h-5 text-amber-400" />,
                    text: 'Tempo scaduto',
                    subText: 'Nessuna risposta ricevuta',
                    color: 'border-amber-500/30 bg-amber-500/5',
                    showCancel: false,
                };
        }
    };

    const config = getConfig();

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999]"
        >
            <div className={`border rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3 bg-slate-900/98 ${config.color}`}>
                {config.icon}
                <div>
                    <p className="text-sm font-semibold text-white">{config.text}</p>
                    <p className="text-xs text-slate-400">{config.subText}</p>
                </div>
                {config.showCancel && (
                    <button
                        onClick={onCancel}
                        className="ml-3 px-3 py-1 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 text-xs font-medium transition-colors border border-white/5"
                    >
                        Annulla
                    </button>
                )}
            </div>
        </motion.div>
    );
}
