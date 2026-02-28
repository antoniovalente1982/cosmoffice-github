'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MicOff, Video } from 'lucide-react';
import { useOfficeStore } from '../../stores/useOfficeStore';

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

    // Update video srcObject when stream changes
    useEffect(() => {
        if (videoElRef.current) {
            if (stream && stream !== videoElRef.current.srcObject) {
                videoElRef.current.srcObject = stream;
                videoElRef.current.play().catch(err => {
                    console.warn('Video play failed:', err);
                });
            } else if (!stream) {
                videoElRef.current.srcObject = null;
            }
        }
    }, [stream]);

    return (
        <div className={`
            relative aspect-square bg-slate-950 overflow-hidden flex items-center justify-center
            transition-all duration-300 border-2 rounded-2xl group
            ${isSpeaking
                ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-[1.02]'
                : 'border-white/10 hover:border-white/20'}
        `}>
            <video
                ref={videoElRef}
                autoPlay
                playsInline
                muted={isMe}
                className="w-full h-full object-cover"
                style={{ transform: isMe ? 'scaleX(-1)' : 'none' }}
            />

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
            <div className="absolute top-2 left-2">
                <div className="bg-emerald-500/80 backdrop-blur-md p-1 rounded-full border border-emerald-400/20">
                    <Video className="w-2.5 h-2.5 text-white" />
                </div>
            </div>

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
    const {
        localStream, isMicEnabled, isVideoEnabled, isSpeaking, peers, myProfile
    } = useOfficeStore();

    // Stato locale per forzare il re-render
    const [streamVersion, setStreamVersion] = useState(0);

    useEffect(() => {
        const checkStream = () => {
            setStreamVersion(v => v + 1);
        };
        const interval = setInterval(checkStream, 500);
        return () => clearInterval(interval);
    }, []);

    // Build participants — only include users with active video
    const participants: VideoTileProps[] = [];

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

    // Add peers only if they have video enabled
    Object.values(peers).forEach((peer: any) => {
        if (peer.videoEnabled) {
            participants.push({
                id: peer.id,
                fullName: peer.full_name || peer.email,
                isMe: false,
                audioEnabled: peer.audioEnabled,
                videoEnabled: true,
                isSpeaking: peer.isSpeaking,
                stream: peer.stream || null, // Daily.co remote video stream
            });
        }
    });

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
