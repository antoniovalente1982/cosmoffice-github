'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MicOff, X, Grid3X3 } from 'lucide-react';
import { useOfficeStore } from '../../stores/useOfficeStore';

interface GridParticipant {
    id: string;
    stream?: MediaStream | null;
    fullName: string;
    initials: string;
    isMe?: boolean;
    audioEnabled?: boolean;
    videoEnabled?: boolean;
    isSpeaking?: boolean;
    avatarUrl?: string;
    status?: string;
}

function GridTile({ participant }: { participant: GridParticipant }) {
    const videoElRef = useRef<HTMLVideoElement | null>(null);
    const { stream, fullName, initials, isMe, audioEnabled, isSpeaking, videoEnabled, avatarUrl } = participant;

    useEffect(() => {
        if (videoElRef.current) {
            if (stream && stream !== videoElRef.current.srcObject) {
                videoElRef.current.srcObject = stream;
                videoElRef.current.play().catch(() => { });
            } else if (!stream) {
                videoElRef.current.srcObject = null;
            }
        }
    }, [stream]);

    const hasActiveVideo = videoEnabled && stream && stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');

    return (
        <div className={`
            relative w-full h-full bg-slate-900/90 overflow-hidden flex items-center justify-center
            transition-all duration-300 border-2 rounded-2xl
            ${isSpeaking
                ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                : 'border-white/10'}
        `}>
            {hasActiveVideo ? (
                <video
                    ref={videoElRef}
                    autoPlay
                    playsInline
                    muted={isMe}
                    className="w-full h-full object-cover"
                    style={{ transform: isMe ? 'scaleX(-1)' : 'none' }}
                />
            ) : (
                <div className="flex flex-col items-center gap-3">
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt={fullName}
                            className="w-20 h-20 rounded-full object-cover ring-2 ring-white/20"
                        />
                    ) : (
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center ring-2 ring-white/10">
                            <span className="text-2xl font-bold text-white/80">{initials}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Name bar at bottom */}
            <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        {isSpeaking && (
                            <div className="flex gap-0.5 items-end h-3 shrink-0">
                                <motion.div animate={{ height: [4, 12, 6] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1 bg-emerald-400 rounded-full" />
                                <motion.div animate={{ height: [6, 4, 10] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-emerald-400 rounded-full" />
                                <motion.div animate={{ height: [8, 12, 4] }} transition={{ repeat: Infinity, duration: 0.4 }} className="w-1 bg-emerald-400 rounded-full" />
                            </div>
                        )}
                        <span className="text-sm font-semibold text-white truncate">
                            {fullName} {isMe && '(Tu)'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        {!audioEnabled && (
                            <div className="bg-red-500/80 p-1 rounded-full">
                                <MicOff className="w-3 h-3 text-white" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function FullscreenGrid() {
    const {
        isGridViewOpen, toggleGridView,
        localStream, isMicEnabled, isVideoEnabled, isSpeaking,
        peers, myProfile
    } = useOfficeStore();

    const participants = useMemo(() => {
        const list: GridParticipant[] = [];

        // Always add myself
        const myName = myProfile?.display_name || myProfile?.full_name || 'You';
        const myInitials = myName.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?';
        list.push({
            id: 'me',
            fullName: myName,
            initials: myInitials,
            isMe: true,
            audioEnabled: isMicEnabled,
            videoEnabled: isVideoEnabled,
            isSpeaking: isSpeaking,
            stream: localStream,
            avatarUrl: myProfile?.avatar_url,
            status: 'online',
        });

        // Add ALL peers (not just those with video)
        Object.values(peers).forEach((peer: any) => {
            const peerName = peer.full_name || peer.email || 'User';
            const peerInitials = peerName.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?';
            list.push({
                id: peer.id,
                fullName: peerName,
                initials: peerInitials,
                isMe: false,
                audioEnabled: peer.audioEnabled,
                videoEnabled: peer.videoEnabled,
                isSpeaking: peer.isSpeaking,
                stream: peer.stream || null,
                avatarUrl: peer.avatar_url,
                status: peer.status,
            });
        });

        return list;
    }, [peers, localStream, isMicEnabled, isVideoEnabled, isSpeaking, myProfile]);

    // Calculate optimal grid layout
    const gridCols = useMemo(() => {
        const count = participants.length;
        if (count <= 1) return 1;
        if (count <= 4) return 2;
        if (count <= 9) return 3;
        if (count <= 16) return 4;
        return 5;
    }, [participants.length]);

    // Close on Escape
    useEffect(() => {
        if (!isGridViewOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') toggleGridView();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isGridViewOpen, toggleGridView]);

    return (
        <AnimatePresence>
            {isGridViewOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-[100] flex flex-col"
                    style={{
                        background: 'linear-gradient(135deg, #0a0f1e 0%, #050a15 50%, #0f172a 100%)',
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <Grid3X3 className="w-5 h-5 text-primary-400" />
                            <h2 className="text-lg font-bold text-white">
                                Video Grid
                            </h2>
                            <span className="text-sm text-slate-400">
                                {participants.length} {participants.length === 1 ? 'partecipante' : 'partecipanti'}
                            </span>
                        </div>
                        <button
                            onClick={toggleGridView}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10 hover:border-white/20"
                        >
                            <X className="w-4 h-4" />
                            <span className="text-sm font-medium">Chiudi</span>
                        </button>
                    </div>

                    {/* Grid */}
                    <div className="flex-1 p-4 overflow-hidden">
                        <div
                            className="w-full h-full grid gap-3"
                            style={{
                                gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                                gridAutoRows: '1fr',
                            }}
                        >
                            <AnimatePresence>
                                {participants.map((p, i) => (
                                    <motion.div
                                        key={p.id}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 25 }}
                                    >
                                        <GridTile participant={p} />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
