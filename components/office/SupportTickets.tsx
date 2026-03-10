'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, MessageSquare, Send, Loader2, Headphones, ChevronLeft,
    Clock, CheckCircle, AlertCircle, XCircle,
} from 'lucide-react';

interface SupportTicketsProps {
    isOpen: boolean;
    onClose: () => void;
    workspaceId?: string | null;
}

interface Ticket {
    id: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    created_at: string;
    updated_at: string;
    unreadCount: number;
}

interface Message {
    id: string;
    ticket_id: string;
    sender_id: string;
    sender_name: string | null;
    is_admin: boolean;
    message: string;
    created_at: string;
}

const STATUS_STYLES: Record<string, { label: string; icon: typeof Clock; color: string }> = {
    open: { label: 'Aperto', icon: Clock, color: 'text-amber-400' },
    in_progress: { label: 'In Lavorazione', icon: AlertCircle, color: 'text-cyan-400' },
    resolved: { label: 'Risolto', icon: CheckCircle, color: 'text-emerald-400' },
    closed: { label: 'Chiuso', icon: XCircle, color: 'text-slate-500' },
};

export default function SupportTickets({ isOpen, onClose, workspaceId }: SupportTicketsProps) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchTickets = useCallback(async () => {
        try {
            const params = workspaceId ? `?workspaceId=${workspaceId}` : '';
            const res = await fetch(`/api/support/messages${params}`);
            const data = await res.json();
            setTickets(data.tickets || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, [workspaceId]);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            fetchTickets();
        }
    }, [isOpen, fetchTickets]);

    const openTicketChat = async (ticket: Ticket) => {
        setSelectedTicket(ticket);
        setLoadingMessages(true);
        setChatInput('');
        try {
            const res = await fetch(`/api/support/messages?ticketId=${ticket.id}`);
            const data = await res.json();
            setMessages(data.messages || []);
        } catch { /* ignore */ }
        setLoadingMessages(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const sendReply = async () => {
        if (!chatInput.trim() || !selectedTicket) return;
        setSending(true);
        try {
            await fetch('/api/support/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketId: selectedTicket.id, message: chatInput.trim() }),
            });
            setChatInput('');
            // Refresh messages
            const res = await fetch(`/api/support/messages?ticketId=${selectedTicket.id}`);
            const data = await res.json();
            setMessages(data.messages || []);
            await fetchTickets(); // Refresh unread counts
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch { /* ignore */ }
        setSending(false);
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'ora';
        if (mins < 60) return `${mins}m fa`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h fa`;
        return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const totalUnread = tickets.reduce((sum, t) => sum + t.unreadCount, 0);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-lg max-h-[80vh] rounded-3xl overflow-hidden flex flex-col"
                        style={{ background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)', border: '1px solid rgba(139,92,246,0.15)' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                {selectedTicket && (
                                    <button onClick={() => setSelectedTicket(null)}
                                        className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-all">
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                )}
                                <Headphones className="w-5 h-5 text-violet-400" />
                                <div>
                                    <h2 className="text-sm font-bold text-white">
                                        {selectedTicket ? selectedTicket.subject : 'I tuoi Ticket'}
                                    </h2>
                                    <p className="text-[10px] text-slate-500">
                                        {selectedTicket
                                            ? STATUS_STYLES[selectedTicket.status]?.label || selectedTicket.status
                                            : `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}${totalUnread > 0 ? ` · ${totalUnread} nuovi messaggi` : ''}`
                                        }
                                    </p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-slate-400">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto">
                            {!selectedTicket ? (
                                /* Ticket List */
                                loading ? (
                                    <div className="flex items-center justify-center py-16">
                                        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                                    </div>
                                ) : tickets.length === 0 ? (
                                    <div className="text-center py-16 px-8">
                                        <Headphones className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                                        <p className="text-sm text-slate-500">Nessun ticket di assistenza</p>
                                        <p className="text-xs text-slate-600 mt-1">Usa il pulsante Assistenza per aprire un nuovo ticket</p>
                                    </div>
                                ) : (
                                    <div className="p-3 space-y-2">
                                        {tickets.map((t) => {
                                            const status = STATUS_STYLES[t.status] || STATUS_STYLES.open;
                                            const StatusIcon = status.icon;
                                            return (
                                                <button
                                                    key={t.id}
                                                    onClick={() => openTicketChat(t)}
                                                    className="w-full text-left p-4 rounded-2xl hover:bg-white/5 transition-all border border-transparent hover:border-violet-500/20 group"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
                                                                <span className={`text-[10px] font-bold ${status.color}`}>{status.label}</span>
                                                            </div>
                                                            <h3 className="text-xs font-bold text-white truncate group-hover:text-violet-300 transition-colors">
                                                                {t.subject}
                                                            </h3>
                                                            <p className="text-[10px] text-slate-600 mt-1">{formatTime(t.updated_at)}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {t.unreadCount > 0 && (
                                                                <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white px-1.5 animate-pulse">
                                                                    {t.unreadCount}
                                                                </span>
                                                            )}
                                                            <MessageSquare className="w-3.5 h-3.5 text-slate-600 group-hover:text-violet-400 transition-colors" />
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )
                            ) : (
                                /* Chat View */
                                <div className="flex flex-col h-full">
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
                                        {loadingMessages ? (
                                            <div className="flex items-center justify-center py-10">
                                                <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                                            </div>
                                        ) : messages.length === 0 ? (
                                            <div className="text-center py-10">
                                                <MessageSquare className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                                                <p className="text-xs text-slate-500">Nessun messaggio — in attesa di risposta dal supporto</p>
                                            </div>
                                        ) : (
                                            messages.map((msg) => (
                                                <div key={msg.id} className={`flex ${msg.is_admin ? 'justify-start' : 'justify-end'}`}>
                                                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${msg.is_admin
                                                        ? 'bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border border-violet-500/15'
                                                        : 'bg-white/5 border border-white/10'
                                                        }`}>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-[10px] font-bold ${msg.is_admin ? 'text-violet-400' : 'text-slate-400'}`}>
                                                                {msg.is_admin ? '🛡️ Supporto' : '👤 Tu'}
                                                            </span>
                                                            <span className="text-[9px] text-slate-600">{formatTime(msg.created_at)}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-200 whitespace-pre-wrap">{msg.message}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input area (only in chat view and if ticket is not closed) */}
                        {selectedTicket && selectedTicket.status !== 'closed' && (
                            <div className="border-t border-white/5 p-4 flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder="Scrivi un messaggio..."
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                                    className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/30"
                                />
                                <button
                                    onClick={sendReply}
                                    disabled={!chatInput.trim() || sending}
                                    className="p-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:opacity-90 disabled:opacity-30 transition-all"
                                >
                                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </div>
                        )}

                        {selectedTicket && selectedTicket.status === 'closed' && (
                            <div className="border-t border-white/5 p-4 text-center">
                                <p className="text-xs text-slate-500">Questo ticket è stato chiuso</p>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
