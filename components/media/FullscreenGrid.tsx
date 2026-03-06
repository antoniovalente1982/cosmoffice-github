'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MicOff, X, Grid3X3, Video, VideoOff } from 'lucide-react';
import { useAvatarStore } from '../../stores/avatarStore';
import { useDailyStore } from '../../stores/dailyStore';

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
        const el = videoElRef.current;
        if (!el) return;
        if (stream && stream !== el.srcObject) {
            el.srcObject = stream;
            el.play().catch(() => {
                const retry = () => { el.play().catch(() => { }); document.removeEventListener('click', retry); };
                document.addEventListener('click', retry, { once: true });
            });
        } else if (!stream) {
            el.srcObject = null;
        }
    }, [stream]);

    // Simple check: show video if stream has live video tracks
    const hasActiveVideo = videoEnabled && stream && stream.getVideoTracks().length > 0;

    return (
        <div className={`
            relative w-full h-full bg-slate-900/90 overflow-hidden flex items-center justify-center
            transition-all duration-300 border-2 rounded-xl
            ${isSpeaking
                ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                : 'border-white/10'}
        `}>
            {/* Always mount video element, toggle visibility */}
            <video
                ref={videoElRef}
                autoPlay
                playsInline
                muted={isMe}
                controls={false}
                disablePictureInPicture
                className="w-full h-full object-cover"
                style={{
                    transform: isMe ? 'scaleX(-1)' : 'none',
                    display: hasActiveVideo ? 'block' : 'none',
                }}
            />
            {!hasActiveVideo && (
                <div className="flex flex-col items-center gap-2">
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt={fullName}
                            className="w-16 h-16 rounded-full object-cover ring-2 ring-white/20"
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center ring-2 ring-white/10">
                            <span className="text-xl font-bold text-white/80">{initials}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Name bar at bottom */}
            <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-gradient-to-t from-black/70 to-transparent">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        {isSpeaking && (
                            <div className="flex gap-0.5 items-end h-3 shrink-0">
                                <motion.div animate={{ height: [4, 12, 6] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1 bg-emerald-400 rounded-full" />
                                <motion.div animate={{ height: [6, 4, 10] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-emerald-400 rounded-full" />
                                <motion.div animate={{ height: [8, 12, 4] }} transition={{ repeat: Infinity, duration: 0.4 }} className="w-1 bg-emerald-400 rounded-full" />
                            </div>
                        )}
                        <span className="text-xs font-semibold text-white truncate">
                            {fullName} {isMe && '(You)'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {!audioEnabled && (
                            <div className="bg-red-500/80 p-0.5 rounded-full">
                                <MicOff className="w-2.5 h-2.5 text-white" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function FullscreenGrid() {
    const isGridViewOpen = useDailyStore(s => s.isGridViewOpen);
    const toggleGridView = useDailyStore(s => s.toggleGridView);
    const localStream = useDailyStore(s => s.localStream);
    const isMicEnabled = useDailyStore(s => s.isAudioOn);
    const isVideoEnabled = useDailyStore(s => s.isVideoOn);
    const isSpeaking = useDailyStore(s => s.isSpeaking);
    const toggleVideo = useDailyStore(s => s.toggleVideo);
    const peers = useAvatarStore(s => s.peers);
    const myProfile = useAvatarStore(s => s.myProfile);

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

    // Check if anyone has active video
    const anyVideoActive = useMemo(() => {
        return participants.some(p => {
            if (p.stream) {
                return p.videoEnabled && p.stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');
            }
            return false;
        });
    }, [participants]);

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
                    className="fixed inset-x-0 top-0 bottom-24 z-[40]"
                    style={{
                        background: 'linear-gradient(135deg, #0a0f1e 0%, #050a15 50%, #0f172a 100%)',
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 shrink-0">
                        <div className="flex items-center gap-3">
                            <Grid3X3 className="w-4 h-4 text-primary-400" />
                            <h2 className="text-sm font-bold text-white">
                                Video Grid
                            </h2>
                            <span className="text-xs text-slate-400">
                                {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
                            </span>
                        </div>
                        <button
                            onClick={toggleGridView}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10 hover:border-white/20"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">Close</span>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-3 overflow-hidden" style={{ height: 'calc(100% - 48px)' }}>
                        {!anyVideoActive ? (
                            /* Empty state — no one has video on */
                            <div className="w-full h-full flex items-center justify-center">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2, duration: 0.5 }}
                                    className="flex flex-col items-center gap-4 text-center max-w-md"
                                >
                                    <div className="w-20 h-20 rounded-full bg-slate-800/80 border-2 border-white/10 flex items-center justify-center">
                                        <VideoOff className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold text-white">
                                            No active webcams
                                        </h3>
                                        <p className="text-slate-400 text-sm">
                                            Turn on your webcam to start the video call.
                                        </p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            const { myProximityGroupId, myRoomId, peers } = useAvatarStore.getState();
                                            const hasNearby = myProximityGroupId || (myRoomId && Object.values(peers).some((p: any) => p.roomId === myRoomId));
                                            if (!hasNearby) return;
                                            await toggleVideo();
                                        }}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-500 hover:bg-primary-400 text-white font-semibold transition-all text-sm shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                                    >
                                        <Video className="w-4 h-4" />
                                        <span>Turn on webcam</span>
                                    </button>
                                </motion.div>
                            </div>
                        ) : (
                            /* Grid with participants */
                            <div
                                className="w-full h-full grid gap-2"
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
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

