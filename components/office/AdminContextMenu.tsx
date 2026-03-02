'use client';

// ============================================
// AdminContextMenu — Right-click context menu on avatars
// Shows moderation actions for admin/owner users
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import {
    MicOff,
    Mic,
    VideoOff,
    Video,
    DoorOpen,
    LogOut,
    Shield,
    ShieldAlert,
    Volume2,
    VolumeX,
    Lock,
    Unlock,
    Wifi,
    WifiOff,
} from 'lucide-react';

interface AdminContextMenuProps {
    isOpen: boolean;
    position: { x: number; y: number };
    targetUserId: string;
    targetUserName: string;
    targetRoom?: string;
    myRole: 'owner' | 'admin' | 'member' | 'guest' | null;
    onClose: () => void;
}

type AdminCommand =
    | 'mute_audio'
    | 'mute_video'
    | 'unmute_audio'
    | 'unmute_video'
    | 'kick_room'
    | 'kick_office'
    | 'mute_all'
    | 'disable_all_cams'
    | 'block_proximity'
    | 'unblock_proximity'
    | 'lock_room'
    | 'unlock_room';

export function AdminContextMenu({
    isOpen,
    position,
    targetUserId,
    targetUserName,
    targetRoom,
    myRole,
    onClose,
}: AdminContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen, onClose]);

    if (!isOpen || (myRole !== 'owner' && myRole !== 'admin')) return null;

    const sendCommand = (command: AdminCommand) => {
        const sendFn = (window as any).__sendAdminCommand;
        if (sendFn) {
            sendFn(command, targetUserId, targetRoom);
        }
        onClose();
    };

    const items = [
        { type: 'header' as const, label: targetUserName },
        { type: 'divider' as const },
        {
            type: 'action' as const,
            label: 'Muta microfono',
            icon: <MicOff className="w-4 h-4" />,
            command: 'mute_audio' as AdminCommand,
            color: 'text-amber-400',
        },
        {
            type: 'action' as const,
            label: 'Attiva microfono',
            icon: <Mic className="w-4 h-4" />,
            command: 'unmute_audio' as AdminCommand,
            color: 'text-emerald-400',
        },
        {
            type: 'action' as const,
            label: 'Disattiva camera',
            icon: <VideoOff className="w-4 h-4" />,
            command: 'mute_video' as AdminCommand,
            color: 'text-amber-400',
        },
        {
            type: 'action' as const,
            label: 'Attiva camera',
            icon: <Video className="w-4 h-4" />,
            command: 'unmute_video' as AdminCommand,
            color: 'text-emerald-400',
        },
        { type: 'divider' as const },
        {
            type: 'action' as const,
            label: 'Rimuovi dalla stanza',
            icon: <DoorOpen className="w-4 h-4" />,
            command: 'kick_room' as AdminCommand,
            color: 'text-orange-400',
        },
        {
            type: 'action' as const,
            label: 'Espelli dall\'ufficio',
            icon: <LogOut className="w-4 h-4" />,
            command: 'kick_office' as AdminCommand,
            color: 'text-red-400',
        },
    ];

    return (
        <div
            ref={menuRef}
            className="fixed z-[9999] w-56 bg-slate-900/98 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/40 py-1 overflow-hidden"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
            }}
        >
            {items.map((item, i) => {
                if (item.type === 'header') {
                    return (
                        <div key={i} className="px-3 py-2 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-cyan-400" />
                            <span className="text-xs font-bold text-white truncate">{item.label}</span>
                        </div>
                    );
                }
                if (item.type === 'divider') {
                    return <div key={i} className="border-t border-white/5 my-1" />;
                }
                return (
                    <button
                        key={i}
                        className={`w-full px-3 py-2 flex items-center gap-2 text-sm hover:bg-white/5 transition-colors ${item.color}`}
                        onClick={() => sendCommand(item.command)}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

// ─── Global Admin Controls Panel ─────────────────────────────
export function AdminGlobalControls({
    isOpen,
    onClose,
    myRole,
}: {
    isOpen: boolean;
    onClose: () => void;
    myRole: 'owner' | 'admin' | 'member' | 'guest' | null;
}) {
    if (!isOpen || (myRole !== 'owner' && myRole !== 'admin')) return null;

    const sendGlobalCommand = (command: AdminCommand) => {
        const sendFn = (window as any).__sendAdminCommand;
        if (sendFn) sendFn(command);
    };

    const globalActions = [
        {
            label: 'Muta Tutti',
            icon: <VolumeX className="w-5 h-5" />,
            command: 'mute_all' as AdminCommand,
            color: 'from-amber-500/20 to-amber-600/20 border-amber-500/20 hover:border-amber-500/40 text-amber-400',
        },
        {
            label: 'Disattiva Tutte le Cam',
            icon: <VideoOff className="w-5 h-5" />,
            command: 'disable_all_cams' as AdminCommand,
            color: 'from-orange-500/20 to-orange-600/20 border-orange-500/20 hover:border-orange-500/40 text-orange-400',
        },
        {
            label: 'Blocca Prossimità',
            icon: <WifiOff className="w-5 h-5" />,
            command: 'block_proximity' as AdminCommand,
            color: 'from-red-500/20 to-red-600/20 border-red-500/20 hover:border-red-500/40 text-red-400',
        },
        {
            label: 'Sblocca Prossimità',
            icon: <Wifi className="w-5 h-5" />,
            command: 'unblock_proximity' as AdminCommand,
            color: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400',
        },
    ];

    return (
        <div className="fixed right-4 top-20 z-[9998] w-72 bg-slate-900/98 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">Admin Controls</h3>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                    ✕
                </button>
            </div>

            <div className="space-y-2">
                {globalActions.map((action, i) => (
                    <button
                        key={i}
                        onClick={() => sendGlobalCommand(action.command)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r border transition-all ${action.color}`}
                    >
                        {action.icon}
                        <span className="text-sm font-semibold">{action.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
