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
    online: '#10b981',
    away: '#f59e0b',
    busy: '#ef4444',
};

const STATUS_LABEL: Record<string, string> = {
    online: 'Online',
    away: 'Assente',
    busy: 'Occupato',
};

// ─── Role badge colors ──────────────────────────────────────
const ROLE_CONFIG: Record<string, { color: string; textColor: string; label: string }> = {
    owner: { color: '#fbbf24', textColor: '#1e293b', label: 'OWNER' },   // gold bg → dark text
    admin: { color: '#22d3ee', textColor: '#0f172a', label: 'ADMIN' },   // cyan bg → dark text
    member: { color: '#94a3b8', textColor: '#fff', label: 'MEMBER' },    // gray bg → white text
    guest: { color: '#a78bfa', textColor: '#fff', label: 'GUEST' },      // purple bg → white text
};

// ─── FIXED dimensions (never scale with zoom) ───────────────
const SZ = 56;             // avatar circle
const BADGE_SZ = 18;       // audio badge
const BADGE_OFF = 1;       // badge offset from edge
const BADGE_ICON = 10;     // icon inside badge
const STATUS_DOT = 14;     // status dot

// ─── Perimeter color logic ──────────────────────────────────
function getPerimeterColor(remoteAudioEnabled: boolean, audioEnabled: boolean): string {
    if (!remoteAudioEnabled && !audioEnabled) return '#ef4444';
    if (remoteAudioEnabled && !audioEnabled) return '#f59e0b';
    if (remoteAudioEnabled && audioEnabled) return '#10b981';
    return '#ef4444';
}

function getPerimeterGlow(color: string, isSpeaking: boolean): string {
    if (isSpeaking && color === '#10b981') {
        return `0 0 0 2.5px #0f172a, 0 0 0 5px ${color}, 0 0 16px ${color}, 0 0 32px rgba(16,185,129,0.3)`;
    }
    return `0 0 0 2.5px #0f172a, 0 0 0 5px ${color}`;
}

function UserAvatarInner({
    fullName,
    avatarUrl,
    position,
    status,
    role,
    isMe,
    audioEnabled = false,
    remoteAudioEnabled = true,
    isSpeaking = false,
    onMouseDown,
    onClick,
    isDragging = false,
}: UserAvatarProps) {
    const [showPopup, setShowPopup] = useState(false);
    const clickStartRef = useRef<{ x: number; y: number } | null>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const initials = fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';

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
        if (!isMe && onClick) setShowPopup(prev => !prev);
    }, [isMe, onClick]);

    const handleCallClick = useCallback(() => {
        if (onClick) { onClick(); setShowPopup(false); }
    }, [onClick]);

    const perimeterColor = getPerimeterColor(remoteAudioEnabled, audioEnabled);
    const perimeterShadow = getPerimeterGlow(perimeterColor, isSpeaking);
    const statusCol = STATUS_COLOR[status] ?? STATUS_COLOR.online;
    const roleConfig = role ? ROLE_CONFIG[role] : null;

    return (
        <div
            className="absolute z-30"
            data-avatar
            style={{
                left: position.x,
                top: position.y,
                marginLeft: -(SZ / 2),
                marginTop: -(SZ / 2),
                pointerEvents: (onMouseDown || onClick) ? 'auto' : 'none',
                cursor: isDragging ? 'grabbing' : onMouseDown ? 'grab' : onClick && !isMe ? 'pointer' : 'default',
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
                    if (dx < 5 && dy < 5) handleAvatarClick();
                    clickStartRef.current = null;
                }
            }}
        >
            <div style={{ position: 'relative', width: SZ, height: SZ }}>

                {/* ─── Speaking Pulse Ripple ─── */}
                {isSpeaking && audioEnabled && (
                    <div style={{
                        position: 'absolute', inset: -5,
                        borderRadius: '50%',
                        border: '2px solid #10b981',
                        opacity: 0.5,
                        animation: 'avatar-speaking-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                    }} />
                )}

                {/* ─── Avatar Circle (PHOTO ONLY) ─── */}
                <div style={{
                    width: SZ, height: SZ,
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', overflow: 'hidden',
                    background: 'linear-gradient(to bottom right, #334155, #0f172a)',
                    boxShadow: `${perimeterShadow}, 0 6px 20px rgba(0,0,0,0.3)`,
                    transform: isSpeaking && audioEnabled ? 'scale(1.05)' : undefined,
                    transition: 'transform 0.3s ease, box-shadow 0.4s ease',
                    zIndex: 2,
                }}>
                    {avatarUrl ? (
                        <img
                            src={avatarUrl} alt={fullName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                            draggable={false}
                        />
                    ) : (
                        <span style={{
                            fontSize: 20, fontWeight: 700, color: '#fff',
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
                    bottom: BADGE_OFF, left: BADGE_OFF,
                    width: BADGE_SZ, height: BADGE_SZ,
                    borderRadius: '50%',
                    border: '2px solid #0f172a',
                    backgroundColor: !remoteAudioEnabled ? '#374151' : audioEnabled ? '#10b981' : '#ef4444',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background-color 0.3s ease',
                    zIndex: 5,
                }}>
                    {!remoteAudioEnabled ? (
                        <svg width={BADGE_ICON} height={BADGE_ICON} viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
                            <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                            <line x1="2" y1="2" x2="22" y2="22" />
                        </svg>
                    ) : !audioEnabled ? (
                        <svg width={BADGE_ICON} height={BADGE_ICON} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="2" y1="2" x2="22" y2="22" />
                            <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                            <path d="M5 10v2a7 7 0 0 0 12 5" />
                            <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
                            <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                        </svg>
                    ) : (
                        <svg width={BADGE_ICON} height={BADGE_ICON} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                    )}
                </div>

                {/* ─── Badge Stato (BOTTOM-RIGHT) ─── */}
                <div style={{
                    position: 'absolute',
                    bottom: BADGE_OFF, right: BADGE_OFF,
                    width: STATUS_DOT, height: STATUS_DOT,
                    borderRadius: '50%',
                    border: '2px solid #0f172a',
                    backgroundColor: statusCol,
                    boxShadow: `0 0 8px ${statusCol}80, 0 2px 4px rgba(0,0,0,0.4)`,
                    zIndex: 5,
                    transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
                }} />

                {/* ─── Role Badge (just below circle) ─── */}
                {roleConfig && (
                    <div className="absolute left-1/2 pointer-events-none" style={{
                        top: SZ + 4,
                        transform: 'translateX(-50%)',
                        zIndex: 6,
                    }}>
                        <span style={{
                            fontSize: 7,
                            fontWeight: 800,
                            color: roleConfig.textColor,
                            backgroundColor: roleConfig.color,
                            borderRadius: 20,
                            padding: '1.5px 7px',
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

                {/* ─── Name (below role, colored pill) ─── */}
                <div className="absolute left-1/2 whitespace-nowrap pointer-events-none" style={{
                    top: roleConfig ? SZ + 22 : SZ + 6,
                    transform: 'translateX(-50%)',
                }}>
                    <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: roleConfig ? roleConfig.textColor : '#fff',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase' as const,
                        fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
                        backgroundColor: roleConfig ? roleConfig.color : 'rgba(15, 23, 42, 0.85)',
                        borderRadius: 20,
                        padding: '2px 8px',
                        display: 'inline-block',
                        boxShadow: `0 2px 6px rgba(0,0,0,0.4)${roleConfig ? `, 0 0 8px ${roleConfig.color}40` : ''}`,
                    }}>
                        {fullName || 'User'}
                    </span>
                </div>

                {/* ─── Compact Call Popup ─── */}
                {showPopup && !isMe && onClick && (
                    <div ref={popupRef} className="absolute left-1/2" style={{
                        bottom: SZ + 12,
                        transform: 'translateX(-50%)',
                        pointerEvents: 'auto',
                        zIndex: 100,
                        animation: 'fadeIn 0.12s ease-out',
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 10px 8px 14px',
                            background: 'rgba(15, 23, 42, 0.97)',
                            borderRadius: 14,
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
                            whiteSpace: 'nowrap' as const,
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2, minWidth: 0 }}>
                                <span style={{
                                    fontSize: 13, fontWeight: 700, color: '#f1f5f9',
                                    fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1.2,
                                    maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>
                                    {fullName || 'User'}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <div style={{
                                        width: 6, height: 6, borderRadius: '50%',
                                        backgroundColor: statusCol, boxShadow: `0 0 6px ${statusCol}`,
                                        flexShrink: 0,
                                    }} />
                                    <span style={{
                                        fontSize: 10, fontWeight: 600, color: statusCol,
                                        fontFamily: "'Inter', system-ui, sans-serif",
                                        letterSpacing: '0.03em', textTransform: 'uppercase' as const,
                                    }}>
                                        {STATUS_LABEL[status] ?? 'Online'}
                                    </span>
                                    <div style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        backgroundColor: perimeterColor,
                                        boxShadow: `0 0 4px ${perimeterColor}80`,
                                        marginLeft: 4,
                                    }} />
                                </div>
                            </div>

                            <button
                                onClick={(e) => { e.stopPropagation(); handleCallClick(); }}
                                onMouseDown={(e) => e.stopPropagation()}
                                style={{
                                    width: 38, height: 38, borderRadius: '50%', border: 'none',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', transition: 'all 0.2s',
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
