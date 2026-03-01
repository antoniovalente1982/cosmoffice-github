'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MicOff, Video } from 'lucide-react';
import { useAvatarStore } from '../../stores/avatarStore';
import { useDailyStore } from '../../stores/dailyStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';

interface VideoTileProps {
    id: string;
    stream?: MediaStream | null;
    fullName: string;
    isMe?: boolean;
    audioEnabled?: boolean;
    videoEnabled?: boolean;
    isSpeaking?: boolean;
}

function VideoTile({ stream, fullName, isMe, audioEnabled, isSpeaking }: VideoTileProps) {
    const videoElRef = useRef<HTMLVideoElement | null>(null);

    // Update video srcObject when stream changes — robust autoplay for WebRTC
    useEffect(() => {
        const el = videoElRef.current;
        if (!el) return;

        if (stream && stream !== el.srcObject) {
            el.srcObject = stream;
            // WebRTC streams should autoplay — retry on failure
            const tryPlay = () => {
                el.play().catch(() => {
                    // Autoplay blocked: retry once after any user interaction
                    const retryOnInteraction = () => {
                        el.play().catch(() => { });
                        document.removeEventListener('click', retryOnInteraction);
                        document.removeEventListener('keydown', retryOnInteraction);
                    };
                    document.addEventListener('click', retryOnInteraction, { once: true });
                    document.addEventListener('keydown', retryOnInteraction, { once: true });
                });
            };
            tryPlay();
        } else if (!stream) {
            el.srcObject = null;
        }
    }, [stream]);

    const hasVideo = stream && stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');
    const initials = fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';

    return (
        <div className={`
            relative aspect-square bg-slate-950 overflow-hidden flex items-center justify-center
            transition-all duration-300 border-2 rounded-2xl group
            ${isSpeaking
                ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-[1.02]'
                : 'border-white/10 hover:border-white/20'}
        `}>
            {hasVideo ? (
                <video
                    ref={videoElRef}
                    autoPlay
                    playsInline
                    muted={isMe}
                    controls={false}
                    disablePictureInPicture
                    className="w-full h-full object-cover"
                    style={{ transform: isMe ? 'scaleX(-1)' : 'none' }}
                />
            ) : (
                /* No video — show initials instead of black box */
                <div className="flex flex-col items-center justify-center gap-1">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center ring-2 ring-white/10">
                        <span className="text-lg font-bold text-white/80">{initials}</span>
                    </div>
                    {/* Hidden video element for when stream becomes available */}
                    <video ref={videoElRef} autoPlay playsInline muted={isMe} controls={false} className="hidden" />
                </div>
            )}

            {/* Name + indicators overlay */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                <div className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-semibold text-white flex items-center gap-1.5 border border-white/10 truncate max-w-[80%]">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSpeaking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                    <span className="truncate">{fullName} {isMe && '(You)'}</span>
                </div>
                <div className="flex items-center gap-1">
                    {!audioEnabled && (
                        <div className="bg-red-500/80 backdrop-blur-md p-1 rounded-full border border-red-400/20">
                            <MicOff className="w-2.5 h-2.5 text-white" />
                        </div>
                    )}
                </div>
            </div>

            {/* Live indicator */}
            {hasVideo && (
                <div className="absolute top-2 left-2">
                    <div className="bg-emerald-500/80 backdrop-blur-md p-1 rounded-full border border-emerald-400/20">
                        <Video className="w-2.5 h-2.5 text-white" />
                    </div>
                </div>
            )}

            {/* Speaking animation */}
            {isSpeaking && (
                <div className="absolute top-2 right-2">
                    <div className="flex gap-0.5 items-end h-3">
                        <motion.div animate={{ height: [4, 12, 6] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1 bg-emerald-400 rounded-full" />
                        <motion.div animate={{ height: [6, 4, 10] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-emerald-400 rounded-full" />
                        <motion.div animate={{ height: [8, 12, 4] }} transition={{ repeat: Infinity, duration: 0.4 }} className="w-1 bg-emerald-400 rounded-full" />
                    </div>
                </div>
            )}
        </div>
    );
}

// Max tiles per row before wrapping
const MAX_PER_ROW = 4;
// Tile size in pixels
const TILE_SIZE = 160;

export function VideoGrid() {
    const localStream = useDailyStore(s => s.localStream);
    const isMicEnabled = useDailyStore(s => s.isAudioOn);
    const isVideoEnabled = useDailyStore(s => s.isVideoOn);
    const isSpeaking = useDailyStore(s => s.isSpeaking);
    const dailyParticipants = useDailyStore(s => s.participants); // REACTIVE — re-renders on track changes
    const peers = useAvatarStore(s => s.peers);
    const myProfile = useAvatarStore(s => s.myProfile);
    const isPerformanceMode = useWorkspaceStore(s => s.isPerformanceMode);

    // Build participants — only include users with active video
    let participants: VideoTileProps[] = [];

    // Add myself only if my video is enabled and the track is live
    const currentStream = localStream;
    const videoTrack = currentStream?.getVideoTracks()[0] ?? null;
    const myVideoActive = isVideoEnabled && videoTrack?.enabled && videoTrack?.readyState === 'live';

    if (myVideoActive && currentStream) {
        participants.push({
            id: 'me',
            fullName: myProfile?.full_name || 'You',
            isMe: true,
            audioEnabled: isMicEnabled,
            videoEnabled: true,
            isSpeaking: isSpeaking,
            stream: currentStream
        });
    }

    // Add peers with video enabled (from avatarStore — populated by DailyManager track events)
    const seenIds = new Set<string>();
    Object.values(peers).forEach((peer: any) => {
        if (peer.videoEnabled && peer.stream) {
            seenIds.add(peer.id);
            participants.push({
                id: peer.id,
                fullName: peer.full_name || peer.email || 'Peer',
                isMe: false,
                audioEnabled: peer.audioEnabled,
                videoEnabled: true,
                isSpeaking: peer.isSpeaking,
                stream: peer.stream,
            });
        }
    });

    // Also check dailyStore participants for any video tracks we might have missed
    Object.entries(dailyParticipants).forEach(([id, info]: [string, any]) => {
        if (!info.videoEnabled || !info.videoTrack) return;
        const supabaseId = info.supabaseId || id;
        if (seenIds.has(supabaseId) || seenIds.has(id)) return; // Already shown
        participants.push({
            id: supabaseId,
            fullName: info.userName || 'Peer',
            isMe: false,
            audioEnabled: info.audioEnabled,
            videoEnabled: true,
            isSpeaking: false,
            stream: new MediaStream([info.videoTrack]),
        });
    });

    // --- GRACEFUL DEGRADATION: VIDEO DECIMATION ---
    // In Performance Mode, limit max concurrent video decodes to save CPU/GPU.
    // We prioritize people who are currently speaking.
    const maxVisibleVideos = isPerformanceMode ? 4 : 8;

    if (participants.length > maxVisibleVideos) {
        // Sort: speaking first, then 'me', then random/others
        participants.sort((a, b) => {
            if (a.isSpeaking && !b.isSpeaking) return -1;
            if (!a.isSpeaking && b.isSpeaking) return 1;
            if (a.isMe && !b.isMe) return -1;
            if (!a.isMe && b.isMe) return 1;
            return 0;
        });

        // Keep only top N active speakers
        participants = participants.slice(0, maxVisibleVideos);
    }

    // If nobody has video on, don't render anything
    if (participants.length === 0) {
        return null;
    }

    // Calculate grid columns (max MAX_PER_ROW, or fewer if less participants)
    const cols = Math.min(participants.length, MAX_PER_ROW);

    return (
        <div
            className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto z-40"
            style={{ width: cols * (TILE_SIZE + 8) }}
        >
            <div
                className="flex flex-wrap justify-center gap-2"
            >
                <AnimatePresence>
                    {participants.map((p, i) => (
                        <motion.div
                            key={p.id}
                            initial={{ opacity: 0, scale: 0.8, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: -20 }}
                            transition={{ delay: i * 0.05, type: "spring", stiffness: 250, damping: 20 }}
                            style={{ width: TILE_SIZE, height: TILE_SIZE }}
                        >
                            <VideoTile {...p} />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
