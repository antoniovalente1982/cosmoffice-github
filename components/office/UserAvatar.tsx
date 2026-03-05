'use client';

import React, { useEffect, useRef, useState, memo, useCallback } from 'react';

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
    onClick?: () => void;
    isDragging?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
    online: '#10b981',
    away: '#f59e0b',
    busy: '#ef4444',
    offline: '#64748b',
};

const STATUS_LABEL: Record<string, string> = {
    online: 'Online',
    away: 'Assente',
    busy: 'Occupato',
    offline: 'Offline',
};

const ROLE_RING_COLOR: Record<string, string> = {
    owner: '#f59e0b',
    admin: '#06b6d4',
    member: '#94a3b8',
    guest: '#a855f7',
};

const ROLE_LABEL: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Membro',
    guest: 'Ospite',
};

function UserAvatarInner({
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
    onClick,
    isDragging = false,
}: UserAvatarProps) {
    const [showPopup, setShowPopup] = useState(false);
    const clickStartRef = useRef<{ x: number; y: number } | null>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const initials = fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const videoTrack = stream?.getVideoTracks()[0];
    const hasVideo = videoEnabled && stream && videoTrack && videoTrack.enabled && videoTrack.readyState === 'live';

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    // Close popup on outside click or Escape
    useEffect(() => {
        if (!showPopup) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                setShowPopup(false);
            }
        };
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowPopup(false);
        };
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEsc);
        }, 50);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [showPopup]);

    const handleAvatarClick = useCallback(() => {
        if (!isMe && onClick) {
            setShowPopup(prev => !prev);
        }
    }, [isMe, onClick]);

    const handleCallClick = useCallback(() => {
        if (onClick) {
            onClick();
            setShowPopup(false);
        }
    }, [onClick]);

    // All dimensions derived from zoom
    const sz = 64 * zoom;
    const dot = 16 * zoom;
    const dotOff = 4 * zoom;
    const mediaDotIconSz = 9 * zoom;
    const ringOff = 2 * zoom;
    const ring = 3 * zoom;

    const roleColor = role ? ROLE_RING_COLOR[role] || '#94a3b8' : '#94a3b8';

    const ringBoxShadow = isSpeaking
        ? `0 0 0 ${ringOff}px #0f172a, 0 0 0 ${ringOff + ring}px #34d399, 0 0 ${20 * zoom}px rgba(52,211,153,0.5)`
        : `0 0 0 ${ringOff}px #0f172a, 0 0 0 ${ringOff + ring}px ${roleColor}`;

    const showMediaDot = !remoteAudioEnabled || !audioEnabled;

    return (
        <div
            className="absolute z-30"
            data-avatar
            style={{
                left: position.x,
                top: position.y,
                marginLeft: -(sz / 2),
                marginTop: -(sz / 2),
                pointerEvents: (onMouseDown || onClick) ? 'auto' : 'none',
                cursor: isDragging ? 'grabbing' : onMouseDown ? 'grab' : onClick && !isMe ? 'pointer' : 'default',
                transition: 'none',
            }}
            onMouseDown={(e) => {
                // Don't treat clicks inside the popup as avatar drag/click
                if (popupRef.current?.contains(e.target as Node)) return;
                if (onClick && !isMe) {
                    e.stopPropagation();
                    clickStartRef.current = { x: e.clientX, y: e.clientY };
                }
                onMouseDown?.(e);
            }}
            onMouseUp={(e) => {
                // Don't treat clicks inside the popup as avatar click
                if (popupRef.current?.contains(e.target as Node)) return;
                if (onClick && !isMe && clickStartRef.current) {
                    const dx = Math.abs(e.clientX - clickStartRef.current.x);
                    const dy = Math.abs(e.clientY - clickStartRef.current.y);
                    if (dx < 5 && dy < 5) {
                        handleAvatarClick();
                    }
                    clickStartRef.current = null;
                }
            }}
        >
            <div className="group" style={{ position: 'relative', width: sz, height: sz }}>

                {/* Name Label */}
                <div
                    className="absolute left-1/2 whitespace-nowrap pointer-events-none"
                    style={{ top: sz + 6 * zoom, transform: 'translateX(-50%)' }}
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

                {/* Pulse Ripple when Speaking */}
                {isSpeaking && (
                    <div
                        className="absolute inset-0 rounded-full animate-ping"
                        style={{ border: '2px solid #34d399', opacity: 0.4, animationDuration: '1.5s' }}
                    />
                )}

                {/* Avatar Circle */}
                <div
                    style={{
                        width: sz, height: sz,
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative', overflow: 'hidden',
                        background: 'linear-gradient(to bottom right, #334155, #0f172a)',
                        boxShadow: `${ringBoxShadow}, 0 25px 50px -12px rgba(0,0,0,0.25)`,
                        transform: isSpeaking ? 'scale(1.05)' : undefined,
                        transition: 'transform 0.3s, box-shadow 0.3s',
                        zIndex: 2,
                    }}
                >
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
                        <img src={avatarUrl} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <span style={{
                            fontSize: 20 * zoom, fontWeight: 700, color: '#fff',
                            position: 'relative', zIndex: 10,
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
                            userSelect: 'none',
                        }}>
                            {initials}
                        </span>
                    )}
                </div>

                {/* Media Indicator Dot (LEFT) */}
                {showMediaDot && (
                    <div style={{
                        position: 'absolute', bottom: dotOff, left: dotOff,
                        width: dot, height: dot, borderRadius: '50%',
                        border: `${2 * zoom}px solid #0f172a`,
                        backgroundColor: '#ffffff',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.4), 0 0 8px rgba(255,255,255,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background-color 0.3s, box-shadow 0.3s',
                    }}>
                        {!remoteAudioEnabled ? (
                            <svg width={mediaDotIconSz} height={mediaDotIconSz} viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
                                <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                                <line x1="2" y1="2" x2="22" y2="22" />
                            </svg>
                        ) : (
                            <svg width={mediaDotIconSz} height={mediaDotIconSz} viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

                {/* Status Dot (RIGHT) */}
                <div style={{
                    position: 'absolute', bottom: dotOff, right: dotOff,
                    width: dot, height: dot, borderRadius: '50%',
                    border: `${2 * zoom}px solid #0f172a`,
                    backgroundColor: STATUS_COLOR[status] ?? STATUS_COLOR.offline,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                }} />

                {/* ─── User Info Popup Card ─── */}
                {showPopup && !isMe && onClick && (
                    <div
                        ref={popupRef}
                        className="absolute left-1/2"
                        style={{
                            bottom: sz + 12 * zoom,
                            transform: 'translateX(-50%)',
                            animation: 'fadeIn 0.15s ease-out',
                            pointerEvents: 'auto',
                            zIndex: 100,
                        }}
                    >
                        <div style={{
                            width: Math.max(180, 200 * zoom),
                            background: 'rgba(15, 23, 42, 0.92)',
                            backdropFilter: 'blur(20px)',
                            borderRadius: 16 * zoom,
                            border: '1px solid rgba(255,255,255,0.12)',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 30px rgba(6,182,212,0.1)',
                            padding: `${14 * zoom}px`,
                            display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
                            gap: 10 * zoom,
                        }}>
                            {/* Avatar in popup */}
                            <div style={{
                                width: 48 * zoom, height: 48 * zoom, borderRadius: '50%',
                                overflow: 'hidden', border: `2px solid ${roleColor}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'linear-gradient(to bottom right, #334155, #0f172a)',
                                flexShrink: 0,
                            }}>
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <span style={{ fontSize: 16 * zoom, fontWeight: 700, color: '#fff' }}>{initials}</span>
                                )}
                            </div>

                            {/* Name */}
                            <span style={{
                                fontSize: Math.max(12, 13 * zoom), fontWeight: 700, color: '#f1f5f9',
                                textAlign: 'center' as const, fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1.2,
                            }}>
                                {fullName || 'User'}
                            </span>

                            {/* Status + Role badges */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 * zoom, flexWrap: 'wrap' as const, justifyContent: 'center' }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 4 * zoom,
                                    padding: `${2 * zoom}px ${8 * zoom}px`, borderRadius: 20,
                                    background: `${STATUS_COLOR[status] ?? STATUS_COLOR.offline}22`,
                                    border: `1px solid ${STATUS_COLOR[status] ?? STATUS_COLOR.offline}44`,
                                }}>
                                    <div style={{
                                        width: 7 * zoom, height: 7 * zoom, borderRadius: '50%',
                                        backgroundColor: STATUS_COLOR[status] ?? STATUS_COLOR.offline,
                                        boxShadow: `0 0 6px ${STATUS_COLOR[status] ?? STATUS_COLOR.offline}`,
                                    }} />
                                    <span style={{
                                        fontSize: Math.max(9, 10 * zoom), fontWeight: 600,
                                        color: STATUS_COLOR[status] ?? STATUS_COLOR.offline,
                                        fontFamily: "'Inter', system-ui, sans-serif",
                                    }}>
                                        {STATUS_LABEL[status] ?? 'Offline'}
                                    </span>
                                </div>
                                {role && (
                                    <div style={{
                                        padding: `${2 * zoom}px ${8 * zoom}px`, borderRadius: 20,
                                        background: `${roleColor}22`, border: `1px solid ${roleColor}44`,
                                    }}>
                                        <span style={{
                                            fontSize: Math.max(9, 10 * zoom), fontWeight: 600, color: roleColor,
                                            fontFamily: "'Inter', system-ui, sans-serif",
                                        }}>
                                            {ROLE_LABEL[role] ?? role}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Media status icons row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 * zoom }}>
                                <div style={{ display: 'flex', alignItems: 'center', opacity: audioEnabled ? 1 : 0.4 }}>
                                    <svg width={12 * zoom} height={12 * zoom} viewBox="0 0 24 24" fill="none"
                                        stroke={audioEnabled ? '#10b981' : '#ef4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                        <line x1="12" y1="19" x2="12" y2="22" />
                                        {!audioEnabled && <line x1="2" y1="2" x2="22" y2="22" />}
                                    </svg>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', opacity: videoEnabled ? 1 : 0.4 }}>
                                    <svg width={12 * zoom} height={12 * zoom} viewBox="0 0 24 24" fill="none"
                                        stroke={videoEnabled ? '#10b981' : '#ef4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
                                        <rect x="2" y="6" width="14" height="12" rx="2" />
                                        {!videoEnabled && <line x1="2" y1="2" x2="22" y2="22" />}
                                    </svg>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', opacity: remoteAudioEnabled ? 1 : 0.4 }}>
                                    <svg width={12 * zoom} height={12 * zoom} viewBox="0 0 24 24" fill="none"
                                        stroke={remoteAudioEnabled ? '#10b981' : '#ef4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                                        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
                                        <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                                        {!remoteAudioEnabled && <line x1="2" y1="2" x2="22" y2="22" />}
                                    </svg>
                                </div>
                            </div>

                            {/* Call button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); handleCallClick(); }}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: 6 * zoom, padding: `${8 * zoom}px ${16 * zoom}px`,
                                    borderRadius: 10 * zoom, border: 'none',
                                    background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                                    color: 'white', fontSize: Math.max(11, 12 * zoom), fontWeight: 700,
                                    fontFamily: "'Inter', system-ui, sans-serif", cursor: 'pointer',
                                    transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)',
                                    letterSpacing: '0.03em',
                                }}
                                onMouseEnter={(e) => {
                                    (e.target as HTMLElement).style.background = 'linear-gradient(135deg, #22d3ee, #06b6d4)';
                                    (e.target as HTMLElement).style.transform = 'scale(1.03)';
                                }}
                                onMouseLeave={(e) => {
                                    (e.target as HTMLElement).style.background = 'linear-gradient(135deg, #06b6d4, #0891b2)';
                                    (e.target as HTMLElement).style.transform = 'scale(1)';
                                }}
                            >
                                <svg width={14 * zoom} height={14 * zoom} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                                Chiama
                            </button>

                            {/* Arrow pointer */}
                            <div style={{
                                position: 'absolute', bottom: -6 * zoom, left: '50%',
                                transform: 'translateX(-50%) rotate(45deg)',
                                width: 12 * zoom, height: 12 * zoom,
                                background: 'rgba(15, 23, 42, 0.92)',
                                borderRight: '1px solid rgba(255,255,255,0.12)',
                                borderBottom: '1px solid rgba(255,255,255,0.12)',
                            }} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export const UserAvatar = memo(UserAvatarInner);
