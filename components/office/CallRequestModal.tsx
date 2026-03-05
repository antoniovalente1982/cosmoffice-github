'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, X } from 'lucide-react';
import { useCallStore } from '../../stores/callStore';
import { useAvatarStore } from '../../stores/avatarStore';
import { useDailyStore } from '../../stores/dailyStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { playCallRingSound, playCallAcceptedSound, playCallDeclinedSound } from '../../utils/sounds';

const CALL_TIMEOUT_MS = 30000; // 30 seconds

export function CallRequestModal() {
    const incomingCall = useCallStore(s => s.incomingCall);
    const setIncomingCall = useCallStore(s => s.setIncomingCall);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Play ring sound when a call comes in
    useEffect(() => {
        if (!incomingCall || incomingCall.status !== 'pending') return;

        playCallRingSound();
        // Play again after 3s for emphasis
        const ring2 = setTimeout(() => playCallRingSound(), 3000);

        // Auto-timeout after 30s
        timeoutRef.current = setTimeout(() => {
            handleDecline('timeout');
        }, CALL_TIMEOUT_MS);

        return () => {
            clearTimeout(ring2);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [incomingCall?.id]);

    const sendResponse = (response: 'accepted' | 'declined') => {
        if (!incomingCall) return;
        const socket = (window as any).__partykitSocket;
        const myProfile = useAvatarStore.getState().myProfile;
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'call_response',
                id: incomingCall.id,
                fromUserId: myProfile?.id || '',
                fromName: myProfile?.display_name || myProfile?.full_name || 'User',
                toUserId: incomingCall.fromUserId,
                response,
            }));
        }
    };

    const handleAccept = () => {
        if (!incomingCall) return;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        playCallAcceptedSound();
        sendResponse('accepted');

        // ─── Teleport receiver near the caller ────────────────
        const callerPeer = useAvatarStore.getState().peers[incomingCall.fromUserId];
        if (callerPeer?.position) {
            const newX = callerPeer.position.x + 80; // 80px to the right of caller
            const newY = callerPeer.position.y;
            useAvatarStore.getState().setMyPosition({ x: newX, y: newY });
            // Broadcast position update via PartyKit
            const socket = (window as any).__partykitSocket;
            const myProfile = useAvatarStore.getState().myProfile;
            if (socket?.readyState === WebSocket.OPEN && myProfile?.id) {
                socket.send(JSON.stringify({
                    type: 'move',
                    userId: myProfile.id,
                    x: newX,
                    y: newY,
                    roomId: useAvatarStore.getState().myRoomId || null,
                }));
            }
        }

        // ─── Auto-enable mic for receiver ─────────────────────
        if (!useDailyStore.getState().isAudioOn) {
            useDailyStore.setState({ isAudioOn: true });
        }

        // ─── Notify receiver to enable webcam ────────────────
        useNotificationStore.getState().addNotification({
            type: 'info',
            title: 'Chiamata accettata!',
            body: '🎤📷 Attiva microfono e webcam per parlare',
        });

        setIncomingCall(null);
    };

    const handleDecline = (reason: 'declined' | 'timeout' = 'declined') => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (reason === 'declined') playCallDeclinedSound();
        sendResponse('declined');
        setIncomingCall(null);
    };

    if (!incomingCall || incomingCall.status !== 'pending') return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999]"
            >
                <div
                    className="px-6 py-4 rounded-2xl border border-primary-500/30 shadow-2xl min-w-[320px]"
                    style={{ background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(20px)' }}
                >
                    {/* Pulsing ring animation */}
                    <div className="absolute -top-1 -right-1">
                        <span className="relative flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-primary-500" />
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ring-2 ring-primary-400/30">
                            {incomingCall.fromAvatarUrl ? (
                                <img src={incomingCall.fromAvatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                                incomingCall.fromName?.charAt(0)?.toUpperCase() || '?'
                            )}
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">
                                🔔 {incomingCall.fromName}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                                vuole parlare con te
                            </p>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={handleAccept}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-400/40"
                        >
                            <Phone className="w-4 h-4" />
                            Accetta
                        </button>
                        <button
                            onClick={() => handleDecline('declined')}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 text-white font-semibold text-sm transition-all"
                        >
                            <PhoneOff className="w-4 h-4" />
                            Non ora
                        </button>
                    </div>

                    {/* Timeout bar */}
                    <div className="mt-3 h-0.5 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: '100%' }}
                            animate={{ width: '0%' }}
                            transition={{ duration: CALL_TIMEOUT_MS / 1000, ease: 'linear' }}
                            className="h-full bg-primary-500/50 rounded-full"
                        />
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

export default CallRequestModal;
