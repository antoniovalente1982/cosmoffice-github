'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Loader2, Mic, Video } from 'lucide-react';
import { useCallStore } from '../../stores/callStore';

export function CallResponseToast() {
    const outgoingCall = useCallStore(s => s.outgoingCall);
    const callResponse = useCallStore(s => s.callResponse);
    const setOutgoingCall = useCallStore(s => s.setOutgoingCall);
    const setCallResponse = useCallStore(s => s.setCallResponse);

    // Auto-dismiss response toast after 5s
    useEffect(() => {
        if (!callResponse) return;
        const t = setTimeout(() => setCallResponse(null), 5000);
        return () => clearTimeout(t);
    }, [callResponse, setCallResponse]);

    // ─── Outgoing call "waiting" toast ──
    const showWaiting = outgoingCall && outgoingCall.status === 'pending';

    // ─── Response toast ──
    const showResponse = !!callResponse;

    if (!showWaiting && !showResponse) return null;

    return (
        <AnimatePresence>
            {showWaiting && (
                <motion.div
                    key="waiting"
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[9999]"
                >
                    <div
                        className="px-5 py-3.5 rounded-xl border border-primary-500/20 shadow-2xl flex items-center gap-3"
                        style={{ background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(20px)' }}
                    >
                        <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
                        <span className="text-sm font-medium text-slate-200">
                            Chiamata a <span className="text-primary-300 font-bold">{outgoingCall.toUserId.slice(0, 8)}</span>...
                        </span>
                        <button
                            onClick={() => setOutgoingCall(null)}
                            className="ml-2 px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-300 text-xs font-semibold transition-colors"
                        >
                            Annulla
                        </button>
                    </div>
                </motion.div>
            )}

            {showResponse && (
                <motion.div
                    key="response"
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[9999]"
                >
                    <div
                        className={`px-5 py-3.5 rounded-xl border shadow-2xl flex items-center gap-3 ${callResponse.type === 'accepted'
                                ? 'border-emerald-500/30'
                                : 'border-amber-500/30'
                            }`}
                        style={{ background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(20px)' }}
                    >
                        {callResponse.type === 'accepted' ? (
                            <>
                                <Phone className="w-4 h-4 text-emerald-400" />
                                <div>
                                    <span className="text-sm font-bold text-emerald-300">
                                        {callResponse.fromName} ha accettato!
                                    </span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-slate-400">Attiva:</span>
                                        <span className="text-xs text-emerald-300 flex items-center gap-1">
                                            <Mic className="w-3 h-3" /> Mic
                                        </span>
                                        <span className="text-xs text-emerald-300 flex items-center gap-1">
                                            <Video className="w-3 h-3" /> Webcam
                                        </span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <PhoneOff className="w-4 h-4 text-amber-400" />
                                <span className="text-sm font-medium text-amber-300">
                                    {callResponse.fromName} è occupato al momento
                                </span>
                            </>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default CallResponseToast;
