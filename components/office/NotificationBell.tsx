'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, MessageCircle, DoorOpen, Phone } from 'lucide-react';
import { useNotificationStore, AppNotification } from '@/stores/notificationStore';

const TYPE_ICON: Record<string, React.ReactNode> = {
    chat: <MessageCircle className="w-3.5 h-3.5 text-cyan-400" />,
    office_chat: <MessageCircle className="w-3.5 h-3.5 text-indigo-400" />,
    knock: <DoorOpen className="w-3.5 h-3.5 text-amber-400" />,
    call: <Phone className="w-3.5 h-3.5 text-emerald-400" />,
    system: <Bell className="w-3.5 h-3.5 text-slate-400" />,
};

function timeAgo(ts: number): string {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'ora';
    if (diff < 3600) return `${Math.floor(diff / 60)}m fa`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
    return `${Math.floor(diff / 86400)}g fa`;
}

export default function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const notifications = useNotificationStore(s => s.notifications);
    const unreadCount = useNotificationStore(s => s.unreadCount);
    const markAllAsRead = useNotificationStore(s => s.markAllAsRead);
    const markAsRead = useNotificationStore(s => s.markAsRead);
    const clearAll = useNotificationStore(s => s.clearAll);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handle = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        setTimeout(() => document.addEventListener('mousedown', handle), 50);
        return () => document.removeEventListener('mousedown', handle);
    }, [isOpen]);

    // Mark as read when opening
    useEffect(() => {
        if (isOpen && unreadCount > 0) {
            // Don't auto-mark — user decides
        }
    }, [isOpen, unreadCount]);

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
                title="Notifiche"
            >
                <Bell className="w-5 h-5 text-slate-300" />
                {unreadCount > 0 && (
                    <span
                        className="absolute -top-0.5 -right-0.5 flex items-center justify-center"
                        style={{
                            minWidth: 18, height: 18, borderRadius: 9,
                            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                            fontSize: 10, fontWeight: 800, color: 'white',
                            padding: '0 5px',
                            boxShadow: '0 2px 8px rgba(239,68,68,0.5)',
                            animation: 'pulse 2s infinite',
                        }}
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div
                    className="absolute right-0 mt-2 z-[200]"
                    style={{
                        width: 320,
                        maxHeight: 420,
                        background: 'rgba(15, 23, 42, 0.98)',
                        borderRadius: 16,
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-bold text-slate-200">Notifiche</span>
                            {unreadCount > 0 && (
                                <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-emerald-400"
                                    title="Segna tutte come lette"
                                >
                                    <CheckCheck className="w-4 h-4" />
                                </button>
                            )}
                            {notifications.length > 0 && (
                                <button
                                    onClick={() => { clearAll(); setIsOpen(false); }}
                                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-red-400"
                                    title="Cancella tutte"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto flex-1" style={{ maxHeight: 360 }}>
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                                <Bell className="w-8 h-8 mb-2 opacity-30" />
                                <span className="text-xs">Nessuna notifica</span>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <NotificationItem
                                    key={n.id}
                                    notification={n}
                                    onRead={() => markAsRead(n.id)}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function NotificationItem({ notification: n, onRead }: { notification: AppNotification; onRead: () => void }) {
    return (
        <div
            className={`flex items-start gap-3 px-4 py-3 border-b border-white/3 transition-colors cursor-pointer ${n.read ? 'opacity-50 hover:opacity-70' : 'hover:bg-white/5'
                }`}
            onClick={onRead}
        >
            {/* Icon */}
            <div className="mt-0.5 flex-shrink-0">
                {TYPE_ICON[n.type] || TYPE_ICON.system}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200 truncate">{n.title}</span>
                    {!n.read && (
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0"
                            style={{ boxShadow: '0 0 6px rgba(34,211,238,0.6)' }} />
                    )}
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{n.body}</p>
                <span className="text-[10px] text-slate-500 mt-1 block">{timeAgo(n.timestamp)}</span>
            </div>

            {/* Read indicator */}
            {!n.read && (
                <button
                    onClick={(e) => { e.stopPropagation(); onRead(); }}
                    className="mt-1 p-1 rounded hover:bg-white/10 text-slate-500 hover:text-emerald-400 transition-colors flex-shrink-0"
                    title="Segna come letta"
                >
                    <Check className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}
