'use client';

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { MessageCircle, Send, X, ArrowDown, Loader2, Trash2, AlertTriangle, Smile, Globe, DoorOpen } from 'lucide-react';
import { useChatStore, ChatMessage } from '../../stores/chatStore';
import { useRoomChat } from '../../hooks/useRoomChat';
import { useOfficeChat } from '../../hooks/useOfficeChat';
import { useAvatarStore } from '../../stores/avatarStore';

// ============================================
// RoomChat — Unified chat: Room + Office tabs
// Emoji picker, delete messages, clear all
// ============================================

function formatTime(timestamp: string): string {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(timestamp: string): string {
    const d = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Oggi';
    if (d.toDateString() === yesterday.toDateString()) return 'Ieri';
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

// ─── Simple Emoji Picker ────────────────────────────────
const EMOJI_LIST = [
    '😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😡', '👍', '👎',
    '❤️', '🔥', '🎉', '✅', '❌', '👋', '🙏', '💪', '🚀', '⭐',
    '😊', '🤣', '😘', '🥳', '😱', '🤝', '💯', '👀', '🎯', '💬',
];

function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    return (
        <div
            ref={ref}
            className="absolute bottom-full mb-2 left-0 p-2 rounded-xl grid grid-cols-6 gap-1 z-50 shadow-2xl"
            style={{
                background: 'rgba(15, 20, 40, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.1)',
                animation: 'chatSlideUp 0.15s ease-out forwards',
            }}
        >
            {EMOJI_LIST.map((emoji) => (
                <button
                    key={emoji}
                    onClick={() => { onSelect(emoji); onClose(); }}
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-lg"
                >
                    {emoji}
                </button>
            ))}
        </div>
    );
}

// ─── Confirm Dialog ─────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
            <div className="bg-slate-900 border border-white/10 rounded-xl p-5 max-w-[280px] shadow-2xl">
                <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <h4 className="text-sm font-bold text-white">Conferma</h4>
                </div>
                <p className="text-xs text-slate-300 mb-4 leading-relaxed">{message}</p>
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
                    >
                        Annulla
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-red-500/80 text-white hover:bg-red-500 transition-colors"
                    >
                        Elimina
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────

interface RoomChatProps {
    workspaceId: string | null;
    userId: string;
    userName: string;
    userAvatarUrl: string | null;
    isAdmin: boolean;
}

function RoomChatInner({ workspaceId, userId, userName, userAvatarUrl, isAdmin }: RoomChatProps) {
    const { isOpen, unreadCount, officeUnreadCount, activeChannel, toggleChat, clearUnread, setActiveChannel } = useChatStore();
    const myRoomId = useAvatarStore(s => s.myRoomId);
    const [inputText, setInputText] = useState('');
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);
    const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Room chat hook
    const roomChat = useRoomChat({
        workspaceId,
        roomId: myRoomId || null,
        userId,
        userName,
        userAvatarUrl,
    });

    // Office-wide chat hook
    const officeChat = useOfficeChat({
        workspaceId,
        userId,
        userName,
        userAvatarUrl,
    });

    // Active data based on current channel
    const isRoomChannel = activeChannel === 'room';
    const currentMessages = isRoomChannel ? roomChat.messages : officeChat.messages;
    const currentSend = isRoomChannel ? roomChat.sendMessage : officeChat.sendMessage;
    const currentDelete = isRoomChannel ? roomChat.deleteMessage : officeChat.deleteMessage;
    const currentClearAll = isRoomChannel ? roomChat.clearAllMessages : officeChat.clearAllMessages;
    const currentLoading = isRoomChannel ? roomChat.isLoading : officeChat.isLoading;

    // Can send in room channel only if in a room
    const canSend = isRoomChannel ? !!myRoomId : true;

    // Total unread for badge
    const totalUnread = unreadCount + officeUnreadCount;

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (isOpen && !showScrollDown) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [currentMessages.length, isOpen, showScrollDown]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen) {
            clearUnread();
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, clearUnread]);

    // Detect scroll position
    const handleScroll = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        setShowScrollDown(!nearBottom);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Send message
    const handleSend = useCallback(() => {
        const text = inputText.trim();
        if (!text || !canSend) return;
        setInputText('');
        currentSend(text);
    }, [inputText, canSend, currentSend]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Emoji selection
    const handleEmojiSelect = (emoji: string) => {
        setInputText(prev => prev + emoji);
        inputRef.current?.focus();
    };

    // Clear all confirm
    const handleConfirmClear = () => {
        currentClearAll();
        setConfirmClear(false);
    };

    // Track date separators
    let lastDateKey = '';

    return (
        <>
            {/* Chat Toggle Button */}
            <button
                onClick={toggleChat}
                className="fixed bottom-6 right-6 z-[200] w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all transform hover:scale-105 active:scale-95 group"
                style={{
                    background: isOpen
                        ? 'rgba(15, 23, 42, 0.9)'
                        : 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    boxShadow: isOpen ? 'none' : '0 0 30px rgba(6, 182, 212, 0.3)',
                }}
            >
                {isOpen ? (
                    <X className="w-5 h-5 text-slate-300" />
                ) : (
                    <MessageCircle className="w-6 h-6 text-white" />
                )}

                {/* Unread badge */}
                {!isOpen && totalUnread > 0 && (
                    <div className="absolute -top-1 -right-1 min-w-[22px] h-[22px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1.5 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-bounce">
                        {totalUnread > 99 ? '99+' : totalUnread}
                    </div>
                )}
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div
                    className="fixed bottom-24 right-6 z-[199] w-[380px] max-h-[520px] rounded-2xl flex flex-col overflow-hidden shadow-2xl"
                    style={{
                        background: 'rgba(10, 15, 30, 0.88)',
                        backdropFilter: 'blur(40px)',
                        WebkitBackdropFilter: 'blur(40px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        animation: 'chatSlideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                    }}
                >
                    {/* Header */}
                    <div
                        className="px-4 py-3 flex items-center justify-between border-b border-white/5 flex-shrink-0"
                        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)' }}
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                            <h3 className="text-sm font-bold text-white tracking-wide">Chat</h3>
                            {currentLoading && <Loader2 className="w-3 h-3 text-slate-500 animate-spin" />}
                        </div>

                        {/* Clear All Button — admin/owner only */}
                        {isAdmin && currentMessages.length > 0 && (
                            <button
                                onClick={() => setConfirmClear(true)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-red-400/80 hover:text-red-300 hover:bg-red-500/10 transition-all"
                                title="Pulisci tutta la chat"
                            >
                                <Trash2 className="w-3 h-3" />
                                Pulisci
                            </button>
                        )}
                    </div>

                    {/* Channel Tabs */}
                    <div className="flex border-b border-white/5 px-2 flex-shrink-0">
                        <button
                            onClick={() => setActiveChannel('room')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all relative ${isRoomChannel
                                    ? 'text-cyan-300'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <DoorOpen className="w-3.5 h-3.5" />
                            Stanza
                            {unreadCount > 0 && !isRoomChannel && (
                                <span className="ml-1 min-w-[16px] h-4 rounded-full bg-red-500/80 text-white text-[9px] font-bold flex items-center justify-center px-1">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                            {isRoomChannel && (
                                <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-gradient-to-r from-cyan-400 to-blue-400" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveChannel('office')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all relative ${!isRoomChannel
                                    ? 'text-cyan-300'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <Globe className="w-3.5 h-3.5" />
                            Ufficio
                            {officeUnreadCount > 0 && isRoomChannel && (
                                <span className="ml-1 min-w-[16px] h-4 rounded-full bg-red-500/80 text-white text-[9px] font-bold flex items-center justify-center px-1">
                                    {officeUnreadCount > 99 ? '99+' : officeUnreadCount}
                                </span>
                            )}
                            {!isRoomChannel && (
                                <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-gradient-to-r from-cyan-400 to-blue-400" />
                            )}
                        </button>
                    </div>

                    {/* Messages */}
                    <div
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar min-h-[220px]"
                    >
                        {isRoomChannel && !myRoomId ? (
                            <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                    <MessageCircle className="w-7 h-7 text-slate-600" />
                                </div>
                                <p className="text-sm text-slate-400 font-medium">Entra in una stanza</p>
                                <p className="text-xs text-slate-600 mt-1">Trascina il tuo avatar in una stanza per chattare</p>
                            </div>
                        ) : currentLoading ? (
                            <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                <Loader2 className="w-8 h-8 text-slate-500 animate-spin mb-3" />
                                <p className="text-sm text-slate-500">Caricamento messaggi...</p>
                            </div>
                        ) : currentMessages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                    <MessageCircle className="w-7 h-7 text-slate-600" />
                                </div>
                                <p className="text-sm text-slate-500 font-medium">Nessun messaggio</p>
                                <p className="text-xs text-slate-600 mt-1">
                                    {isRoomChannel ? 'Inizia una conversazione!' : 'Scrivi a tutto l\'ufficio!'}
                                </p>
                            </div>
                        ) : (
                            currentMessages.map((msg: ChatMessage) => {
                                const isMe = msg.userId === userId;
                                const dateKey = new Date(msg.timestamp).toDateString();
                                let dateSep: React.ReactNode = null;
                                if (dateKey !== lastDateKey) {
                                    lastDateKey = dateKey;
                                    dateSep = (
                                        <div className="flex items-center gap-3 py-3" key={`date-${dateKey}`}>
                                            <div className="flex-1 h-px bg-white/5" />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                {formatDateSeparator(msg.timestamp)}
                                            </span>
                                            <div className="flex-1 h-px bg-white/5" />
                                        </div>
                                    );
                                }

                                return (
                                    <React.Fragment key={msg.id}>
                                        {dateSep}
                                        <div
                                            className={`flex gap-2.5 group relative ${isMe ? 'flex-row-reverse' : ''}`}
                                            onMouseEnter={() => setHoveredMsgId(msg.id)}
                                            onMouseLeave={() => setHoveredMsgId(null)}
                                        >
                                            {/* Avatar */}
                                            {!isMe && (
                                                <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden bg-slate-700 flex items-center justify-center mt-0.5">
                                                    {msg.avatarUrl ? (
                                                        <img src={msg.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-300">
                                                            {msg.userName?.charAt(0)?.toUpperCase() || '?'}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                                                {/* Name + Time header — shown for ALL messages */}
                                                <div className={`flex items-center gap-1.5 mb-0.5 ${isMe ? 'flex-row-reverse mr-1' : 'ml-1'}`}>
                                                    <p className="text-[10px] font-semibold text-slate-400 truncate max-w-[120px]">
                                                        {isMe ? 'Tu' : msg.userName}
                                                    </p>
                                                    <span className="text-[9px] text-slate-600">
                                                        {formatTime(msg.timestamp)}
                                                    </span>
                                                </div>

                                                {/* Message bubble */}
                                                <div
                                                    className={`px-3.5 py-2 rounded-2xl text-[13px] leading-relaxed break-words ${isMe
                                                        ? 'bg-gradient-to-r from-cyan-600/80 to-blue-600/80 text-white rounded-br-md'
                                                        : 'bg-white/[0.06] text-slate-200 rounded-bl-md'
                                                        }`}
                                                >
                                                    {msg.content}
                                                </div>
                                            </div>

                                            {/* Delete button — admin/owner only, on hover */}
                                            {isAdmin && hoveredMsgId === msg.id && (
                                                <button
                                                    onClick={() => currentDelete(msg.id)}
                                                    className="absolute top-0 right-0 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-all transform hover:scale-110 z-10"
                                                    style={{ animation: 'chatSlideUp 0.1s ease-out forwards' }}
                                                    title="Elimina messaggio"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </React.Fragment>
                                );
                            })
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Scroll to bottom button */}
                    {showScrollDown && (
                        <button
                            onClick={scrollToBottom}
                            className="absolute bottom-[72px] left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-slate-800/90 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all shadow-lg"
                        >
                            <ArrowDown className="w-4 h-4" />
                        </button>
                    )}

                    {/* Input */}
                    <div className="px-4 py-3 border-t border-white/5 flex-shrink-0 bg-black/20 relative">
                        {canSend ? (
                            <div className="flex items-center gap-2">
                                {/* Emoji Picker */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${showEmojiPicker
                                                ? 'bg-cyan-500/20 text-cyan-300'
                                                : 'bg-white/[0.04] text-slate-500 hover:text-slate-300 hover:bg-white/[0.08]'
                                            }`}
                                        title="Emoji"
                                    >
                                        <Smile className="w-5 h-5" />
                                    </button>
                                    {showEmojiPicker && (
                                        <EmojiPicker
                                            onSelect={handleEmojiSelect}
                                            onClose={() => setShowEmojiPicker(false)}
                                        />
                                    )}
                                </div>

                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Scrivi un messaggio..."
                                    className="flex-1 bg-white/[0.04] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                                    maxLength={2000}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!inputText.trim()}
                                    className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-r from-cyan-500 to-blue-500 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all transform hover:scale-105 active:scale-95"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-600 text-center py-1">
                                Entra in una stanza per inviare messaggi
                            </p>
                        )}
                    </div>

                    {/* Confirm Clear Dialog */}
                    {confirmClear && (
                        <ConfirmDialog
                            message={isRoomChannel
                                ? 'Eliminare tutti i messaggi di questa stanza? L\'azione è irreversibile.'
                                : 'Eliminare tutti i messaggi dell\'ufficio? L\'azione è irreversibile.'
                            }
                            onConfirm={handleConfirmClear}
                            onCancel={() => setConfirmClear(false)}
                        />
                    )}
                </div>
            )}

            {/* Animation keyframes */}
            <style jsx global>{`
                @keyframes chatSlideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>
        </>
    );
}

export const RoomChat = memo(RoomChatInner);
