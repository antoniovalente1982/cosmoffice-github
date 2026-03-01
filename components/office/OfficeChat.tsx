'use client';

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { MessageCircle, Send, X, ArrowDown } from 'lucide-react';
import { useChatStore, ChatMessage } from '../../stores/chatStore';
import { createClient } from '../../utils/supabase/client';

// ============================================
// OfficeChat — Real-time office-wide chat via PartyKit
// Messages persisted to Supabase for history
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

interface OfficeChatProps {
    myUserId: string;
}

function OfficeChatInner({ myUserId }: OfficeChatProps) {
    const { messages, isOpen, unreadCount, toggleChat, clearUnread } = useChatStore();
    const [inputText, setInputText] = useState('');
    const [showScrollDown, setShowScrollDown] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (isOpen && !showScrollDown) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages.length, isOpen, showScrollDown]);

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
    const handleSend = useCallback(async () => {
        const text = inputText.trim();
        if (!text) return;
        setInputText('');

        // Send via PartyKit (instant broadcast)
        const sendFn = (window as any).__sendChatMessage;
        if (sendFn) sendFn(text);

        // Persist to Supabase (fire-and-forget)
        try {
            await supabase.from('office_messages').insert({
                space_id: (window as any).__activeSpaceId || null,
                user_id: myUserId,
                text,
            });
        } catch (err) {
            console.error('[Chat] Failed to persist message:', err);
        }
    }, [inputText, myUserId, supabase]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Group messages by date
    const getDateKey = (ts: string) => new Date(ts).toDateString();
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
                {!isOpen && unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 min-w-[22px] h-[22px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1.5 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-bounce">
                        {unreadCount > 99 ? '99+' : unreadCount}
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
                        className="px-5 py-3.5 flex items-center justify-between border-b border-white/5 flex-shrink-0"
                        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)' }}
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                            <h3 className="text-sm font-bold text-white tracking-wide">Chat Ufficio</h3>
                            <span className="text-[10px] text-slate-500 font-medium">• {messages.length} messaggi</span>
                        </div>
                    </div>

                    {/* Messages */}
                    <div
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar min-h-[280px]"
                    >
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                    <MessageCircle className="w-7 h-7 text-slate-600" />
                                </div>
                                <p className="text-sm text-slate-500 font-medium">Nessun messaggio</p>
                                <p className="text-xs text-slate-600 mt-1">Inizia una conversazione!</p>
                            </div>
                        )}

                        {messages.map((msg: ChatMessage) => {
                            const isMe = msg.userId === myUserId;
                            const dateKey = getDateKey(msg.timestamp);
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
                                    <div className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
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
                                            {/* Name (only for others) */}
                                            {!isMe && (
                                                <p className="text-[10px] font-semibold text-slate-400 mb-0.5 ml-1 truncate max-w-[160px]">
                                                    {msg.userName}
                                                </p>
                                            )}

                                            {/* Message bubble */}
                                            <div
                                                className={`px-3.5 py-2 rounded-2xl text-[13px] leading-relaxed break-words ${isMe
                                                        ? 'bg-gradient-to-r from-cyan-600/80 to-blue-600/80 text-white rounded-br-md'
                                                        : 'bg-white/[0.06] text-slate-200 rounded-bl-md'
                                                    }`}
                                            >
                                                {msg.text}
                                            </div>

                                            {/* Time */}
                                            <p className={`text-[9px] text-slate-600 mt-0.5 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                                                {formatTime(msg.timestamp)}
                                            </p>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}

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
                    <div className="px-4 py-3 border-t border-white/5 flex-shrink-0 bg-black/20">
                        <div className="flex items-center gap-2">
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
                    </div>
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

export const OfficeChat = memo(OfficeChatInner);
