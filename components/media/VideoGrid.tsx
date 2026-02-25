'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MicOff, Settings, Video, VideoOff } from 'lucide-react';
import { Card } from '../ui/card';
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

function VideoTile({ stream, fullName, isMe, audioEnabled, videoEnabled, isSpeaking }: VideoTileProps) {
    const videoElRef = useRef<HTMLVideoElement | null>(null);

    // Update video srcObject when stream changes
    useEffect(() => {
        if (videoElRef.current && stream) {
            videoElRef.current.srcObject = stream;
        }
    }, [stream]);

    // Check if video track exists and is enabled
    const videoTrack = stream?.getVideoTracks()[0];
    const hasVideo = videoEnabled && stream && videoTrack && videoTrack.enabled && videoTrack.readyState === 'live';

    return (
        <Card className={`relative aspect-video bg-slate-950 overflow-hidden flex items-center justify-center transition-all duration-300 border-2 ${isSpeaking ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-[1.02]' : 'border-white/10'} group rounded-2xl`}>
            {hasVideo ? (
                <video
                    ref={videoElRef}
                    autoPlay
                    playsInline
                    muted={isMe}
                    className="w-full h-full object-cover"
                    style={{ transform: isMe ? 'scaleX(-1)' : 'none' }}
                />
            ) : (
                <div className="w-16 h-16 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-slate-400 font-bold text-2xl uppercase shadow-inner">
                    {fullName?.[0] || '?'}
                </div>
            )}

            <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <div className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-semibold text-white flex items-center gap-1.5 border border-white/10">
                    <div className={`w-1.5 h-1.5 rounded-full ${isSpeaking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                    {fullName} {isMe && '(You)'}
                </div>
                {!audioEnabled && (
                    <div className="bg-red-500/80 backdrop-blur-md p-1.5 rounded-full border border-red-400/20">
                        <MicOff className="w-3 h-3 text-white" />
                    </div>
                )}
            </div>

            {/* Video status indicator */}
            <div className="absolute top-3 left-3 flex items-center gap-1">
                {hasVideo ? (
                    <div className="bg-emerald-500/80 backdrop-blur-md p-1 rounded-full border border-emerald-400/20">
                        <Video className="w-3 h-3 text-white" />
                    </div>
                ) : (
                    <div className="bg-red-500/80 backdrop-blur-md p-1 rounded-full border border-red-400/20">
                        <VideoOff className="w-3 h-3 text-white" />
                    </div>
                )}
            </div>

            {isSpeaking && (
                <div className="absolute top-3 right-10">
                    <div className="flex gap-0.5 items-end h-3">
                        <motion.div animate={{ height: [4, 12, 6] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1 bg-emerald-400 rounded-full" />
                        <motion.div animate={{ height: [6, 4, 10] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-emerald-400 rounded-full" />
                        <motion.div animate={{ height: [8, 12, 4] }} transition={{ repeat: Infinity, duration: 0.4 }} className="w-1 bg-emerald-400 rounded-full" />
                    </div>
                </div>
            )}

            <button className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 hover:bg-black/60 opacity-0 group-hover:opacity-100 transition-all border border-white/5 backdrop-blur-md">
                <Settings className="w-3.5 h-3.5 text-white" />
            </button>
        </Card>
    );
}

export function VideoGrid() {
    const {
        localStream, isMicEnabled, isVideoEnabled, isSpeaking, peers, myProfile
    } = useOfficeStore();

    // Only show "me" tile when video is enabled
    const videoTrack = localStream?.getVideoTracks()[0];
    const showMyVideo = isVideoEnabled && localStream && videoTrack && videoTrack.enabled;

    const participants = [
        ...(showMyVideo ? [{
            id: 'me',
            fullName: myProfile?.full_name || 'You',
            isMe: true,
            audioEnabled: isMicEnabled,
            videoEnabled: isVideoEnabled,
            isSpeaking: isSpeaking,
            stream: localStream
        }] : []),
        ...Object.values(peers).map(peer => ({
            id: peer.id,
            fullName: peer.full_name || peer.email,
            isMe: false,
            audioEnabled: peer.audioEnabled,
            videoEnabled: peer.videoEnabled,
            isSpeaking: peer.isSpeaking,
            stream: null
        }))
    ];

    // Don't render the container if no participants to show
    if (participants.length === 0) return null;

    return (
        <div className="absolute top-6 right-6 w-72 space-y-4 pointer-events-auto z-40">
            <AnimatePresence>
                {participants.map((p, i) => (
                    <motion.div
                        key={p.id}
                        initial={{ opacity: 0, scale: 0.9, x: 20 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9, x: 20 }}
                        transition={{ delay: i * 0.1, type: "spring", stiffness: 200, damping: 20 }}
                    >
                        <VideoTile {...p} />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
