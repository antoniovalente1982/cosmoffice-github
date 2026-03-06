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

// ─── Status colors (toolbar-synced) ──────────────────────────
const STATUS_COLOR: Record<string, string> = {
    online: '#10b981',   // green
    away: '#f59e0b',     // yellow
    busy: '#ef4444',     // red
};

const STATUS_LABEL: Record<string, string> = {
    online: 'Online',
    away: 'Assente',
    busy: 'Occupato',
};

// ─── Role badge colors ──────────────────────────────────────
const ROLE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    owner: { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.2)', label: 'OWNER' },
    admin: { color: '#22d3ee', bg: 'rgba(34, 211, 238, 0.2)', label: 'ADMIN' },
    member: { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', label: 'MEMBER' },
    guest: { color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.2)', label: 'GUEST' },
};

// ─── Perimeter color logic ──────────────────────────────────
// 🔴 Red: remoteAudio OFF + mic OFF (deaf + mute)
// 🟡 Yellow: remoteAudio ON + mic OFF (can hear, can't talk)
// 🟢 Green: remoteAudio ON + mic ON (full duplex)
function getPerimeterColor(remoteAudioEnabled: boolean, audioEnabled: boolean): string {
    if (!remoteAudioEnabled && !audioEnabled) return '#ef4444'; // red
    if (remoteAudioEnabled && !audioEnabled) return '#f59e0b';  // yellow
    if (remoteAudioEnabled && audioEnabled) return '#10b981';   // green
    // Edge case: mic ON but remote audio OFF — treat as red (unusual state)
    return '#ef4444';
}

function getPerimeterGlow(color: string, isSpeaking: boolean): string {
    if (isSpeaking && color === '#10b981') {
        return `0 0 0 3px #0f172a, 0 0 0 6px ${color}, 0 0 20px ${color}, 0 0 40px rgba(16, 185, 129, 0.3)`;
    }
    return `0 0 0 3px #0f172a, 0 0 0 6px ${color}`;
}

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

    // ─── Dimensions (zoom-scaled) ────────────────────────────
    const sz = 64 * zoom;
    const badgeSz = 18 * zoom;
    const badgeOff = 2 * zoom;
    const badgeIconSz = 10 * zoom;
    const statusDotSz = 14 * zoom;

    // ─── Perimeter color logic ───────────────────────────────
    const perimeterColor = getPerimeterColor(remoteAudioEnabled, audioEnabled);
    const perimeterShadow = getPerimeterGlow(perimeterColor, isSpeaking);

    // ─── Status color ────────────────────────────────────────
    const statusCol = STATUS_COLOR[status] ?? STATUS_COLOR.online;
    const roleConfig = role ? ROLE_CONFIG[role] : null;

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
                willChange: 'transform',
                transform: 'translateZ(0)',
            }}
            onMouseDown={(e) => {
                if (popupRef.current?.contains(e.target as Node)) return;
                if (onClick && !isMe) {
                    e.stopPropagation();
                    clickStartRef.current = { x: e.clientX, y: e.clientY };
                }
                onMouseDown?.(e);
            }}
            onMouseUp={(e) => {
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

                {/* ─── Speaking Pulse Ripple ─── */}
                {isSpeaking && audioEnabled && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: -4 * zoom,
                            borderRadius: '50%',
                            border: `2px solid #10b981`,
                            opacity: 0.5,
                            animation: 'avatar-speaking-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                        }}
                    />
                )}

                {/* ─── Avatar Circle (PHOTO ONLY — never video) ─── */}
                <div
                    style={{
                        width: sz, height: sz,
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative', overflow: 'hidden',
                        background: 'linear-gradient(to bottom right, #334155, #0f172a)',
                        boxShadow: `${perimeterShadow}, 0 8px 25px rgba(0,0,0,0.3)`,
                        transform: isSpeaking && audioEnabled ? 'scale(1.05)' : undefined,
                        transition: 'transform 0.3s ease, box-shadow 0.4s ease',
                        zIndex: 2,
                    }}
                >
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt={fullName}
                            style={{
                                width: '100%', height: '100%',
                                objectFit: 'cover',
                                borderRadius: '50%',
                            }}
                            draggable={false}
                        />
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

                {/* ─── Badge Audio/Mic (BOTTOM-LEFT) ─── */}
                <div style={{
                    position: 'absolute',
                    bottom: badgeOff, left: badgeOff,
                    width: badgeSz, height: badgeSz,
                    borderRadius: '50%',
                    border: `2px solid #0f172a`,
                    backgroundColor: !remoteAudioEnabled
                        ? '#374151'           // dark gray - audio OFF
                        : audioEnabled
                            ? '#10b981'       // green - mic ON
                            : '#ef4444',      // red - mic OFF
                    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background-color 0.3s ease',
                    zIndex: 5,
                }}>
                    {!remoteAudioEnabled ? (
                        /* Headphone crossed — audio entrata OFF */
                        <svg width={badgeIconSz} height={badgeIconSz} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
                            <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                            <line x1="2" y1="2" x2="22" y2="22" />
                        </svg>
                    ) : !audioEnabled ? (
                        /* Mic crossed — mic OFF */
                        <svg width={badgeIconSz} height={badgeIconSz} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="2" y1="2" x2="22" y2="22" />
                            <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                            <path d="M5 10v2a7 7 0 0 0 12 5" />
                            <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
                            <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                        </svg>
                    ) : (
                        /* Mic active — mic ON */
                        <svg width={badgeIconSz} height={badgeIconSz} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                    )}
                </div>

                {/* ─── Badge Stato (BOTTOM-RIGHT) — 🟢🟡🔴 ─── */}
                <div style={{
                    position: 'absolute',
                    bottom: badgeOff, right: badgeOff,
                    width: statusDotSz, height: statusDotSz,
                    borderRadius: '50%',
                    border: `2px solid #0f172a`,
                    backgroundColor: statusCol,
                    boxShadow: `0 0 8px ${statusCol}80, 0 2px 4px rgba(0,0,0,0.4)`,
                    zIndex: 5,
                    transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
                }} />

                {/* ─── Role Badge (overlapping bottom of avatar circle) ─── */}
                {roleConfig && (
                    <div
                        className="absolute left-1/2 pointer-events-none"
                        style={{
                            bottom: -3 * zoom,
                            transform: 'translateX(-50%)',
                            zIndex: 6,
                        }}
                    >
                        <span style={{
                            fontSize: Math.max(6, 7 * zoom),
                            fontWeight: 800,
                            color: '#fff',
                            backgroundColor: roleConfig.color,
                            borderRadius: 20 * zoom,
                            padding: `${1.5 * zoom}px ${7 * zoom}px`,
                            letterSpacing: '0.08em',
                            fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
                            whiteSpace: 'nowrap' as const,
                            lineHeight: 1.3,
                            display: 'inline-block',
                            textTransform: 'uppercase' as const,
                            boxShadow: `0 2px 6px rgba(0,0,0,0.4), 0 0 8px ${roleConfig.color}40`,
                        }}>
                            {roleConfig.label}
                        </span>
                    </div>
                )}

                {/* ─── Name (plain text below avatar) ─── */}
                <div
                    className="absolute left-1/2 whitespace-nowrap pointer-events-none"
                    style={{
                        top: sz + 8 * zoom,
                        transform: 'translateX(-50%)',
                    }}
                >
                    <span style={{
                        fontSize: Math.max(11, 13 * zoom),
                        fontWeight: 800,
                        color: '#f1f5f9',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase' as const,
                        fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
                        textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.5)',
                    }}>
                        {fullName || 'User'}
                    </span>
                </div>

                {/* ─── Compact Call Popup ─── */}
                {showPopup && !isMe && onClick && (
                    <div
                        ref={popupRef}
                        className="absolute left-1/2"
                        style={{
                            bottom: sz + 10 * zoom,
                            transform: 'translateX(-50%)',
                            pointerEvents: 'auto',
                            zIndex: 100,
                            animation: 'fadeIn 0.12s ease-out',
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px 8px 14px',
                            background: 'rgba(15, 23, 42, 0.97)',
                            borderRadius: 14,
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
                            whiteSpace: 'nowrap' as const,
                        }}>
                            {/* Name + Status inline */}
                            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2, minWidth: 0 }}>
                                <span style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: '#f1f5f9',
                                    fontFamily: "'Inter', system-ui, sans-serif",
                                    lineHeight: 1.2,
                                    maxWidth: 140,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}>
                                    {fullName || 'User'}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <div style={{
                                        width: 6, height: 6, borderRadius: '50%',
                                        backgroundColor: statusCol,
                                        boxShadow: `0 0 6px ${statusCol}`,
                                        flexShrink: 0,
                                    }} />
                                    <span style={{
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: statusCol,
                                        fontFamily: "'Inter', system-ui, sans-serif",
                                        letterSpacing: '0.03em',
                                        textTransform: 'uppercase' as const,
                                    }}>
                                        {STATUS_LABEL[status] ?? 'Online'}
                                    </span>

                                    {/* Mic/Audio mini indicators */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 4 }}>
                                        {/* Perimeter color dot — media state at a glance */}
                                        <div style={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            backgroundColor: perimeterColor,
                                            boxShadow: `0 0 4px ${perimeterColor}80`,
                                        }} />
                                    </div>
                                </div>
                            </div>

                            {/* Call button — round, prominent */}
                            <button
                                onClick={(e) => { e.stopPropagation(); handleCallClick(); }}
                                onMouseDown={(e) => e.stopPropagation()}
                                style={{
                                    width: 38, height: 38,
                                    borderRadius: '50%',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                                    flexShrink: 0,
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)';
                                    (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.6)';
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(16, 185, 129, 0.4)';
                                }}
                                title={`Chiama ${fullName || 'User'}`}
                            >
                                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                            </button>
                        </div>

                        {/* Arrow */}
                        <div style={{
                            position: 'absolute', bottom: -5, left: '50%',
                            transform: 'translateX(-50%) rotate(45deg)',
                            width: 10, height: 10,
                            background: 'rgba(15, 23, 42, 0.95)',
                            borderRight: '1px solid rgba(255,255,255,0.1)',
                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                        }} />
                    </div>
                )}
            </div>
        </div>
    );
}

export const UserAvatar = memo(UserAvatarInner);
