'use client';

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface UserAvatarProps {
    id: string;
    fullName?: string;
    avatarUrl?: string;
    position: { x: number; y: number };
    status: 'online' | 'away' | 'busy' | 'offline';
    role?: 'owner' | 'admin' | 'member' | 'guest';
    isMe?: boolean;
    audioEnabled?: boolean;
    videoEnabled?: boolean;
    remoteAudioEnabled?: boolean;
    isSpeaking?: boolean;
    stream?: MediaStream | null;
    zoom?: number;
    onMouseDown?: (e: React.MouseEvent) => void;
    isDragging?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
    online: '#10b981',
    away: '#f59e0b',
    busy: '#ef4444',
    offline: '#64748b',
};

const ROLE_RING_COLOR: Record<string, string> = {
    owner: '#f59e0b',
    admin: '#06b6d4',
    member: '#94a3b8',
    guest: '#a855f7',
};

export function UserAvatar({
    fullName,
    avatarUrl,
    position,
    status,
    role,
    isMe,
    audioEnabled = false,
    videoEnabled = false,
    remoteAudioEnabled = true,
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
    const sz = 64 * zoom;   // avatar circle diameter
    const dot = 16 * zoom;   // status dot diameter
    const dotOff = 4 * zoom;   // status dot offset from corner
    const iconSz = 12 * zoom;   // mic/video icon size
    const ringOff = 2 * zoom;   // ring-offset gap
    const ring = 3 * zoom;   // role ring thickness

    // Role color for the main ring
    const roleColor = role ? ROLE_RING_COLOR[role] || '#94a3b8' : '#94a3b8';

    // Ring = role color (speaking overrides with green)
    const ringBoxShadow = isSpeaking
        ? `0 0 0 ${ringOff}px #0f172a, 0 0 0 ${ringOff + ring}px #34d399, 0 0 ${20 * zoom}px rgba(52,211,153,0.5)`
        : `0 0 0 ${ringOff}px #0f172a, 0 0 0 ${ringOff + ring}px ${roleColor}`;

    // ─── Left-side media indicator logic ─────────────────────
    // Priority: 1) remoteAudio off (headphones) → 2) mic off → 3) hide
    const showMediaDot = !remoteAudioEnabled || !audioEnabled;
    const mediaDotIconSz = 9 * zoom;

    return (
        <motion.div
            initial={false}
            className="absolute z-30"
            style={{
                x: position.x,
                y: position.y,
                marginLeft: -(sz / 2),
                marginTop: -(sz / 2),
                pointerEvents: onMouseDown ? 'auto' : 'none',
                cursor: isDragging ? 'grabbing' : onMouseDown ? 'grab' : 'default',
            }}
            onMouseDown={onMouseDown}
        >
            {/* Outer group — exact pixel size, no scaling transforms */}
            <div className="group" style={{ position: 'relative', width: sz, height: sz }}>

                {/* Name Label — always visible below avatar */}
                <div
                    className="absolute left-1/2 whitespace-nowrap pointer-events-none"
                    style={{
                        top: sz + 6 * zoom,
                        transform: 'translateX(-50%)',
                    }}
                >
                    <span style={{
                        fontSize: Math.max(11, 12 * zoom),
                        fontWeight: 700,
                        color: '#f1f5f9',
                        letterSpacing: '0.02em',
                        textShadow: '0 1px 6px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)',
                        fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
                    }}>
                        {fullName || 'User'}
                    </span>
                </div>

                {/* Avatar Circle — ring = ROLE color */}
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


                </div>

                {/* ─── Media Indicator Dot (LEFT) — symmetrical to status dot ─── */}
                {showMediaDot && (
                    <div style={{
                        position: 'absolute',
                        bottom: dotOff,
                        left: dotOff,
                        width: dot,
                        height: dot,
                        borderRadius: '50%',
                        border: `${2 * zoom}px solid #0f172a`,
                        backgroundColor: '#ffffff',
                        boxShadow: `0 2px 6px rgba(0,0,0,0.4), 0 0 8px rgba(255,255,255,0.3)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.3s, box-shadow 0.3s',
                    }}>
                        {!remoteAudioEnabled ? (
                            /* Headphones off — SVG icon (lucide HeadphoneOff not always available) */
                            <svg
                                width={mediaDotIconSz}
                                height={mediaDotIconSz}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#f59e0b"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                {/* Headphones shape */}
                                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
                                <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                                {/* Slash line */}
                                <line x1="2" y1="2" x2="22" y2="22" />
                            </svg>
                        ) : (
                            /* Mic off icon */
                            <svg
                                width={mediaDotIconSz}
                                height={mediaDotIconSz}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="2" y1="2" x2="22" y2="22" />
                                <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                                <path d="M5 10v2a7 7 0 0 0 12 5" />
                                <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
                                <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                        )}
                    </div>
                )}

                {/* Status Dot (RIGHT) — clean, no role border */}
                <div style={{
                    position: 'absolute',
                    bottom: dotOff,
                    right: dotOff,
                    width: dot,
                    height: dot,
                    borderRadius: '50%',
                    border: `${2 * zoom}px solid #0f172a`,
                    backgroundColor: STATUS_COLOR[status] ?? STATUS_COLOR.offline,
                    boxShadow: `0 2px 6px rgba(0,0,0,0.4)`,
                }} />
            </div>
        </motion.div>
    );
}
