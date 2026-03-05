'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAvatarStore } from '../../stores/avatarStore';

// ============================================
// EmojiReactions — floating emoji above avatars
// Triggered by double-click on own avatar or toolbar
// ============================================

interface FloatingEmoji {
    id: string;
    emoji: string;
    userId: string;
    x: number;
    y: number;
    createdAt: number;
}

const EMOJI_OPTIONS = ['👏', '🎉', '❤️', '🔥', '😂', '👍', '🚀', '💡', '☕', '✨'];

interface EmojiReactionsProps {
    userId: string;
    userName: string;
}

export function EmojiReactions({ userId, userName }: EmojiReactionsProps) {
    const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
    const [showPicker, setShowPicker] = useState(false);
    const peers = useAvatarStore(s => s.peers);
    const myPosition = useAvatarStore(s => s.myPosition);

    // Send reaction via PartyKit
    const sendReaction = useCallback((emoji: string) => {
        const socket = (window as any).__partykitSocket;
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'emoji_reaction',
                userId,
                userName,
                emoji,
            }));
        }
        setShowPicker(false);
    }, [userId, userName]);

    // Listen for incoming reactions
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!detail?.userId || !detail?.emoji) return;

            // Find position of the user who reacted
            let x = 0, y = 0;
            if (detail.userId === userId) {
                x = myPosition.x;
                y = myPosition.y;
            } else {
                const peer = peers[detail.userId];
                if (peer?.position) {
                    x = peer.position.x;
                    y = peer.position.y;
                }
            }

            const newEmoji: FloatingEmoji = {
                id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                emoji: detail.emoji,
                userId: detail.userId,
                x, y,
                createdAt: Date.now(),
            };

            setFloatingEmojis(prev => [...prev, newEmoji]);

            // Remove after animation
            setTimeout(() => {
                setFloatingEmojis(prev => prev.filter(e => e.id !== newEmoji.id));
            }, 2500);
        };

        window.addEventListener('emoji-reaction', handler);
        return () => window.removeEventListener('emoji-reaction', handler);
    }, [userId, myPosition, peers]);

    // Expose sendReaction for PixiOffice double-click
    useEffect(() => {
        (window as any).__sendEmojiReaction = sendReaction;
        (window as any).__toggleEmojiPicker = () => setShowPicker(p => !p);
        return () => {
            delete (window as any).__sendEmojiReaction;
            delete (window as any).__toggleEmojiPicker;
        };
    }, [sendReaction]);

    return (
        <>
            {/* Floating emojis overlay */}
            {floatingEmojis.map((fe) => (
                <div
                    key={fe.id}
                    className="fixed pointer-events-none z-[400]"
                    style={{
                        left: `${fe.x}px`,
                        top: `${fe.y - 50}px`,
                        animation: 'emojiFloat 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
                    }}
                >
                    <span className="text-4xl drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
                        {fe.emoji}
                    </span>
                </div>
            ))}

            {/* Emoji picker popover */}
            {showPicker && (
                <div
                    className="fixed z-[500] bottom-24 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200"
                >
                    <div
                        className="flex items-center gap-1 px-3 py-2 rounded-2xl shadow-2xl border border-white/10"
                        style={{
                            background: 'rgba(15, 23, 42, 0.95)',
                            backdropFilter: 'blur(20px)',
                        }}
                    >
                        {EMOJI_OPTIONS.map((emoji) => (
                            <button
                                key={emoji}
                                onClick={() => sendReaction(emoji)}
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl hover:bg-white/10 hover:scale-125 transition-all duration-150 active:scale-90"
                            >
                                {emoji}
                            </button>
                        ))}
                        <button
                            onClick={() => setShowPicker(false)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all ml-1"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* CSS animation */}
            <style jsx global>{`
                @keyframes emojiFloat {
                    0% {
                        transform: translateY(0) scale(0.5);
                        opacity: 0;
                    }
                    15% {
                        transform: translateY(-20px) scale(1.2);
                        opacity: 1;
                    }
                    50% {
                        transform: translateY(-60px) scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(-120px) scale(0.8);
                        opacity: 0;
                    }
                }
            `}</style>
        </>
    );
}

export default EmojiReactions;
