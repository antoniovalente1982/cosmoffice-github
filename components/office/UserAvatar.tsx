'use client';

import { motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface UserAvatarProps {
    id: string;
    fullName?: string;
    avatarUrl?: string;
    position: { x: number; y: number };
    status: 'online' | 'away' | 'busy' | 'offline';
    isMe?: boolean;
    audioEnabled?: boolean;
    videoEnabled?: boolean;
    isSpeaking?: boolean;
    stream?: MediaStream | null;
}

export function UserAvatar({
    fullName,
    avatarUrl,
    position,
    status,
    isMe,
    audioEnabled = false,
    videoEnabled = false,
    isSpeaking = false,
    stream
}: UserAvatarProps) {
    const initials = fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
    
    // Check if video track exists and is enabled
    const videoTrack = stream?.getVideoTracks()[0];
    const hasVideo = videoEnabled && stream && videoTrack && videoTrack.enabled && videoTrack.readyState === 'live';
    
    const videoRef = (el: HTMLVideoElement | null) => {
        if (el && stream) el.srcObject = stream;
    };

    const statusColors = {
        online: 'bg-emerald-500',
        away: 'bg-amber-500',
        busy: 'bg-red-500',
        offline: 'bg-slate-500'
    };

    return (
        <motion.div
            initial={false}
            animate={{
                x: position.x,
                y: position.y
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute z-30"
            style={{ marginLeft: -32, marginTop: -32 }}
        >
            <div className="relative group flex flex-col items-center">
                {/* Name Tag */}
                <div className="absolute -top-12 px-3 py-1 rounded-full bg-slate-900/80 border border-white/10 backdrop-blur-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all shadow-xl">
                    <span className="text-[11px] font-semibold text-slate-100 italic">
                        {fullName} {isMe && '(You)'}
                    </span>
                </div>

                {/* Avatar Container */}
                <div className={`
                    w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl
                    transition-all duration-300 relative
                    ${isSpeaking ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-[#0f172a] shadow-[0_0_20px_rgba(52,211,153,0.4)] scale-110' :
                        isMe ? 'ring-4 ring-primary-500/50 ring-offset-2 ring-offset-[#0f172a]' : 'ring-2 ring-slate-700'}
                    bg-gradient-to-br from-slate-700 to-slate-900 shadow-2xl overflow-hidden
                `}>
                    {/* Video Overlay - show when video is enabled */}
                    {hasVideo && (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`absolute inset-0 w-full h-full object-cover ${isMe ? 'scale-x-[-1]' : ''}`}
                        />
                    )}

                    {/* Image / Initials - show when video is disabled */}
                    {!hasVideo && (
                        avatarUrl ? (
                            <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                        ) : (
                            <span className="relative z-10 drop-shadow-lg">{initials}</span>
                        )
                    )}

                    {/* Media Indicators overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-center pb-1.5 gap-2">
                        {!audioEnabled && <MicOff className="w-3 h-3 text-red-500" />}
                        {!videoEnabled && <VideoOff className="w-3 h-3 text-red-500" />}
                    </div>
                </div>

                {/* Status Dot */}
                <div className={`
                    absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#0f172a] shadow-lg
                    ${statusColors[status] || statusColors.offline}
                `} />
            </div>
        </motion.div>
    );
}
