'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Megaphone, X, Send } from 'lucide-react';

// ============================================
// AnnouncementSystem — admin broadcasts + display
// ============================================

interface Announcement {
    id: string;
    userId: string;
    userName: string;
    message: string;
    level: 'info' | 'warning' | 'success';
    timestamp: number;
}

const LEVEL_STYLES = {
    info: {
        bg: 'from-cyan-500/20 to-indigo-500/20',
        border: 'border-cyan-500/30',
        icon: '📢',
        glow: 'rgba(34, 211, 238, 0.15)',
    },
    warning: {
        bg: 'from-amber-500/20 to-orange-500/20',
        border: 'border-amber-500/30',
        icon: '⚠️',
        glow: 'rgba(245, 158, 11, 0.15)',
    },
    success: {
        bg: 'from-emerald-500/20 to-teal-500/20',
        border: 'border-emerald-500/30',
        icon: '🎉',
        glow: 'rgba(16, 185, 129, 0.15)',
    },
};

interface AnnouncementSystemProps {
    userId: string;
    userName: string;
    isAdmin: boolean;
}

export function AnnouncementSystem({ userId, userName, isAdmin }: AnnouncementSystemProps) {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [showComposer, setShowComposer] = useState(false);
    const [message, setMessage] = useState('');
    const [level, setLevel] = useState<'info' | 'warning' | 'success'>('info');

    // Send announcement
    const sendAnnouncement = useCallback(() => {
        if (!message.trim()) return;
        const socket = (window as any).__partykitSocket;
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'announcement',
                userId,
                userName,
                message: message.trim(),
                level,
            }));
        }
        setMessage('');
        setShowComposer(false);
    }, [userId, userName, message, level]);

    // Listen for announcements
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!detail?.message) return;

            const ann: Announcement = {
                id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                userId: detail.userId,
                userName: detail.userName,
                message: detail.message,
                level: detail.level || 'info',
                timestamp: Date.now(),
            };

            setAnnouncements(prev => [ann, ...prev]);

            // Auto-dismiss after 15 seconds
            setTimeout(() => {
                setAnnouncements(prev => prev.filter(a => a.id !== ann.id));
            }, 15000);
        };

        window.addEventListener('office-announcement', handler);
        return () => window.removeEventListener('office-announcement', handler);
    }, []);

    // Expose toggle for toolbar
    useEffect(() => {
        (window as any).__toggleAnnouncementComposer = () => setShowComposer(p => !p);
        return () => { delete (window as any).__toggleAnnouncementComposer; };
    }, []);

    const dismissAnnouncement = (id: string) => {
        setAnnouncements(prev => prev.filter(a => a.id !== id));
    };

    return (
        <>
            {/* Announcement banners — top center */}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[600] flex flex-col items-center gap-2 pointer-events-none w-full max-w-lg px-4">
                {announcements.map((ann) => {
                    const style = LEVEL_STYLES[ann.level];
                    return (
                        <div
                            key={ann.id}
                            className={`pointer-events-auto w-full rounded-2xl border ${style.border} px-5 py-4 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500`}
                            style={{
                                background: `linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.9))`,
                                backdropFilter: 'blur(30px)',
                                boxShadow: `0 0 40px ${style.glow}, 0 20px 40px rgba(0,0,0,0.3)`,
                            }}
                        >
                            <div className="flex items-start gap-3">
                                <span className="text-2xl mt-0.5">{style.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Annuncio</span>
                                        <span className="text-[10px] text-slate-600">da {ann.userName}</span>
                                    </div>
                                    <p className="text-sm text-slate-200 font-medium leading-relaxed">{ann.message}</p>
                                </div>
                                <button
                                    onClick={() => dismissAnnouncement(ann.id)}
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-all shrink-0"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Composer modal — admin only */}
            {showComposer && isAdmin && (
                <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div
                        className="w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                        style={{ background: 'rgba(15, 23, 42, 0.98)' }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Megaphone className="w-5 h-5 text-cyan-400" />
                            <h3 className="text-lg font-bold text-white">Annuncio Ufficio</h3>
                        </div>

                        {/* Level selector */}
                        <div className="flex gap-2 mb-4">
                            {(['info', 'warning', 'success'] as const).map((l) => (
                                <button
                                    key={l}
                                    onClick={() => setLevel(l)}
                                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all border ${level === l
                                        ? `bg-gradient-to-r ${LEVEL_STYLES[l].bg} ${LEVEL_STYLES[l].border} text-white`
                                        : 'border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10'
                                        }`}
                                >
                                    {LEVEL_STYLES[l].icon} {l === 'info' ? 'Info' : l === 'warning' ? 'Avviso' : 'Successo'}
                                </button>
                            ))}
                        </div>

                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Scrivi il tuo annuncio..."
                            className="w-full h-24 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500/40 resize-none transition-colors"
                            autoFocus
                        />

                        <div className="flex items-center justify-end gap-2 mt-4">
                            <button
                                onClick={() => setShowComposer(false)}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
                            >
                                Annulla
                            </button>
                            <button
                                onClick={sendAnnouncement}
                                disabled={!message.trim()}
                                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 shadow-lg shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <Send className="w-3.5 h-3.5" />
                                Invia a tutti
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default AnnouncementSystem;
