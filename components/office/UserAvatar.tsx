'use client';

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MicOff, VideoOff } from 'lucide-react';

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
    zoom?: number;
    onMouseDown?: (e: React.MouseEvent) => void;
    isDragging?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
    online: '#10b981',
    away:   '#f59e0b',
    busy:   '#ef4444',
    offline:'#64748b',
};

export function UserAvatar({
    fullName,
    avatarUrl,
    position,
    status,
    isMe,
    audioEnabled = false,
    videoEnabled = false,
    isSpeaking = false,
    stream,
    zoom = 1,
    onMouseDown,
    isDragging = false,
}: UserAvatarProps) {
    const initials = fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const videoTrack = stream?.getVideoTracks()[0];
    const hasVideo = videoEnabled && stream && videoTrack && videoTrack.enabled && videoTrack.readyState === 'live';

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    // All dimensions derived from zoom — no CSS zoom, no transform scale
    const sz      = 64 * zoom;   // avatar circle diameter
    const dot     = 16 * zoom;   // status dot diameter
    const dotOff  = 4  * zoom;   // status dot offset from corner
    const iconSz  = 12 * zoom;   // mic/video icon size
    const ringOff = 2  * zoom;   // ring-offset gap
    const ring    = 4  * zoom;   // ring thickness

    const ringBoxShadow = isSpeaking
        ? `0 0 0 ${ringOff}px #0f172a, 0 0 0 ${ringOff + ring}px #34d399, 0 0 ${20 * zoom}px rgba(52,211,153,0.4)`
        : isMe
        ? `0 0 0 ${ringOff}px #0f172a, 0 0 0 ${ringOff + ring}px rgba(99,102,241,0.5)`
        : `0 0 0 ${2 * zoom}px #334155`;

    return (
        <motion.div
            initial={false}
            animate={{ x: position.x, y: position.y }}
            transition={isDragging ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute z-30"
            style={{
                marginLeft: -(sz / 2),
                marginTop:  -(sz / 2),
                pointerEvents: onMouseDown ? 'auto' : 'none',
                cursor: isDragging ? 'grabbing' : onMouseDown ? 'grab' : 'default',
            }}
            onMouseDown={onMouseDown}
        >
            {/* Outer group — exact pixel size, no scaling transforms */}
            <div className="group" style={{ position: 'relative', width: sz, height: sz }}>

                {/* Name Tag */}
                <div
                    className="absolute left-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all rounded-full border border-white/10 backdrop-blur-md shadow-xl"
                    style={{
                        bottom: sz + 4,
                        transform: 'translateX(-50%)',
                        background: 'rgba(15,23,42,0.8)',
                        padding: `${4 * zoom}px ${12 * zoom}px`,
                    }}
                >
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#f1f5f9', fontStyle: 'italic' }}>
                        {fullName} {isMe && '(You)'}
                    </span>
                </div>

                {/* Avatar Circle */}
                <div
                    style={{
                        width: sz,
                        height: sz,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        background: 'linear-gradient(to bottom right, #334155, #0f172a)',
                        boxShadow: `${ringBoxShadow}, 0 25px 50px -12px rgba(0,0,0,0.25)`,
                        transform: isSpeaking ? 'scale(1.1)' : undefined,
                        transition: 'transform 0.3s, box-shadow 0.3s',
                    }}
                >
                    {/* Video / Image / Initials */}
                    {hasVideo ? (
                        <video
                            ref={videoRef}
                            autoPlay playsInline muted
                            style={{
                                position: 'absolute', inset: 0,
                                width: '100%', height: '100%', objectFit: 'cover',
                                transform: isMe ? 'scaleX(-1)' : undefined,
                            }}
                        />
                    ) : avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt={fullName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <span style={{
                            fontSize: 20 * zoom,
                            fontWeight: 700,
                            color: '#fff',
                            position: 'relative',
                            zIndex: 10,
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
                            userSelect: 'none',
                        }}>
                            {initials}
                        </span>
                    )}

                    {/* Media indicators */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        paddingBottom: 6 * zoom,
                        gap: 4 * zoom,
                    }}>
                        {!audioEnabled && <MicOff  style={{ width: iconSz, height: iconSz, color: '#ef4444' }} />}
                        {!videoEnabled && <VideoOff style={{ width: iconSz, height: iconSz, color: '#ef4444' }} />}
                    </div>
                </div>

                {/* Status Dot */}
                <div style={{
                    position: 'absolute',
                    bottom: dotOff,
                    right:  dotOff,
                    width:  dot,
                    height: dot,
                    borderRadius: '50%',
                    border: `${2 * zoom}px solid #0f172a`,
                    backgroundColor: STATUS_COLOR[status] ?? STATUS_COLOR.offline,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }} />
            </div>
        </motion.div>
    );
}
