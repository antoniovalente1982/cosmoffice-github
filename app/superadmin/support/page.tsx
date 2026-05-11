'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
    Headphones, Clock, CheckCircle, XCircle, Loader2, RefreshCw, Inbox,
    MessageSquare, Phone, Mail, Building2, Crown, Shield, User, Star,
    ArrowRight, ChevronDown, Search, Filter, Send, X,
} from 'lucide-react';
import { createClient } from '../../../utils/supabase/client';
import { useT } from '../../../lib/i18n';

interface SupportTicket {
    id: string;
    user_id: string;
    workspace_id: string | null;
    workspace_name: string | null;
    workspace_owner_email: string | null;
    requester_name: string | null;
    requester_email: string | null;
    requester_phone: string | null;
    requester_role: string | null;
    requester_company: string | null;
    category: string;
    subject: string;
    description: string;
    priority: string;
    status: string;
    admin_notes: string | null;
    resolution: string | null;
    assigned_to: string | null;
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
    unreadUserCount?: number;
}

interface TicketMessage {
    id: string;
    ticket_id: string;
    sender_id: string;
    sender_name: string | null;
    sender_email: string | null;
    is_admin: boolean;
    message: string;
    created_at: string;
}

const CATEGORY_CONFIG: Record<string, { labelKey: string; color: string }> = {
    general: { labelKey: 'sa.support.general', color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/20' },
    technical: { labelKey: 'sa.support.technical', color: 'text-amber-400 bg-amber-500/15 border-amber-500/20' },
    billing: { labelKey: 'sa.support.billing', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20' },
    feature_request: { labelKey: 'sa.support.featureRequest', color: 'text-purple-400 bg-purple-500/15 border-purple-500/20' },
    upgrade: { labelKey: 'sa.support.upgrade', color: 'text-orange-400 bg-orange-500/15 border-orange-500/20' },
    bug_report: { labelKey: 'sa.support.bugReport', color: 'text-rose-400 bg-rose-500/15 border-rose-500/20' },
};

const PRIORITY_CONFIG: Record<string, { labelKey: string; color: string }> = {
    low: { labelKey: 'sa.support.priorityLow', color: 'text-slate-400' },
    normal: { labelKey: 'sa.support.priorityNormal', color: 'text-cyan-400' },
    high: { labelKey: 'sa.support.priorityHigh', color: 'text-amber-400' },
    urgent: { labelKey: 'sa.support.priorityUrgent', color: 'text-red-400' },
};

const STATUS_CONFIG: Record<string, { labelKey: string; color: string }> = {
    open: { labelKey: 'sa.support.statusOpenLabel', color: 'text-amber-400 bg-amber-500/15 border-amber-500/20' },
    in_progress: { labelKey: 'sa.support.statusInProgressLabel', color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/20' },
    resolved: { labelKey: 'sa.support.statusResolvedLabel', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20' },
    closed: { labelKey: 'sa.support.statusClosedLabel', color: 'text-slate-500 bg-slate-500/15 border-slate-500/20' },
};

const ROLE_ICONS: Record<string, typeof Crown> = {
    owner: Crown,
    admin: Shield,
    member: User,
    guest: Star,
};

export default function SupportPage() {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [processing, setProcessing] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
    const [resolutionInputs, setResolutionInputs] = useState<Record<string, string>>({});

    // Chat state
    const [chatMessages, setChatMessages] = useState<Record<string, TicketMessage[]>>({});
    const [chatInput, setChatInput] = useState<Record<string, string>>({});
    const [sendingMessage, setSendingMessage] = useState<string | null>(null);
    const [loadingMessages, setLoadingMessages] = useState<string | null>(null);
    const chatEndRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [statusCounts, setStatusCounts] = useState({ open: 0, in_progress: 0, resolved: 0, closed: 0, total: 0 });
    const [unreadByStatus, setUnreadByStatus] = useState({ open: 0, in_progress: 0, resolved: 0, closed: 0, total: 0 });
    const { t } = useT();

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter !== 'all') params.set('status', filter);
            if (categoryFilter) params.set('category', categoryFilter);
            const res = await fetch(`/api/admin/support-tickets?${params}`);
            const data = await res.json();
            setTickets(data.tickets || []);
            if (data.statusCounts) setStatusCounts(data.statusCounts);
            if (data.unreadByStatus) setUnreadByStatus(data.unreadByStatus);
        } catch { /* ignore */ }
        setLoading(false);
    }, [filter, categoryFilter]);

    useEffect(() => { fetchTickets(); }, [fetchTickets]);

    // Silent background Realtime update
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase.channel('superadmin-support-page')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
                 // refetch silently without showing loading UI
                 const refetch = async () => {
                     try {
                         const params = new URLSearchParams();
                         if (filter !== 'all') params.set('status', filter);
                         if (categoryFilter) params.set('category', categoryFilter);
                         const res = await fetch(`/api/admin/support-tickets?${params}`);
                         const data = await res.json();
                         if (data.tickets) setTickets(data.tickets);
                         if (data.statusCounts) setStatusCounts(data.statusCounts);
                         if (data.unreadByStatus) setUnreadByStatus(data.unreadByStatus);
                     } catch { /* silent */ }
                 };
                 refetch();
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages' }, () => {
                 // if the ticket is expanded, also refetch the chat messages
                 // But we can only refetch tickets for now; chat updates would require knowing `expandedId` 
                 // which is handled below, so we just run a silent refetch of tickets to update counts.
                 const refetch = async () => {
                     try {
                         const params = new URLSearchParams();
                         if (filter !== 'all') params.set('status', filter);
                         if (categoryFilter) params.set('category', categoryFilter);
                         const res = await fetch(`/api/admin/support-tickets?${params}`);
                         const data = await res.json();
                         if (data.tickets) setTickets(data.tickets);
                         if (data.statusCounts) setStatusCounts(data.statusCounts);
                         if (data.unreadByStatus) setUnreadByStatus(data.unreadByStatus);
                     } catch { /* silent */ }
                 };
                 refetch();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [filter, categoryFilter]);

    const updateTicket = async (id: string, updates: Record<string, any>) => {
        setProcessing(id);
        try {
            await fetch('/api/admin/support-tickets', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...updates }),
            });
            await fetchTickets();
        } catch { /* ignore */ }
        setProcessing(null);
    };

    // Fetch messages for a ticket
    const fetchMessages = async (ticketId: string) => {
        setLoadingMessages(ticketId);
        try {
            const res = await fetch('/api/admin/support-tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_messages', ticketId }),
            });
            const data = await res.json();
            setChatMessages(prev => ({ ...prev, [ticketId]: data.messages || [] }));
        } catch { /* ignore */ }
        setLoadingMessages(null);
    };

    // Send admin message
    const sendMessage = async (ticketId: string) => {
        const msg = chatInput[ticketId]?.trim();
        if (!msg) return;

        setSendingMessage(ticketId);
        try {
            await fetch('/api/admin/support-tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketId, message: msg }),
            });
            setChatInput(prev => ({ ...prev, [ticketId]: '' }));
            await fetchMessages(ticketId);
            await fetchTickets(); // Refresh status
            // Scroll to bottom
            setTimeout(() => {
                chatEndRefs.current[ticketId]?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } catch { /* ignore */ }
        setSendingMessage(null);
    };

    // Realtime chat messages loader
    useEffect(() => {
        if (!expandedId) return;

        // Fetch once immediately
        if (!chatMessages[expandedId]) {
            fetchMessages(expandedId);
        }

        // Listen for new messages inserted for this specific ticket
        const supabase = createClient();
        const channel = supabase.channel(`support-chat-${expandedId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${expandedId}` }, () => {
                 fetchMessages(expandedId);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [expandedId]);

    const filtered = tickets.filter(t => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (t.requester_name || '').toLowerCase().includes(q) ||
            (t.requester_email || '').toLowerCase().includes(q) ||
            (t.requester_company || '').toLowerCase().includes(q) ||
            t.subject.toLowerCase().includes(q)
        );
    });

    const openCount = statusCounts.open;
    const inProgressCount = statusCounts.in_progress;
    const resolvedCount = statusCounts.resolved;
    const closedCount = statusCounts.closed;
    const totalCount = statusCounts.total;
    const totalUnreadReplies = tickets.reduce((sum, t) => sum + (t.unreadUserCount || 0), 0);

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'ora';
        if (diffMins < 60) return `${diffMins}m fa`;
        const diffHrs = Math.floor(diffMins / 60);
        if (diffHrs < 24) return `${diffHrs}h fa`;
        return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="min-h-screen p-8" style={{ background: '#0a0e1a' }}>
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Headphones className="w-7 h-7 text-emerald-400" />
                            {t('sa.support.title')}
                            {openCount > 0 && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    {openCount} {openCount === 1 ? t('sa.support.newCount') : t('sa.support.newCountPlural')}
                                </span>
                            )}
                            {inProgressCount > 0 && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                                    {inProgressCount} {t('sa.support.inProgress')}
                                </span>
                            )}
                            {totalUnreadReplies > 0 && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                                    🔴 {totalUnreadReplies} rispost{totalUnreadReplies === 1 ? 'a' : 'e'} da leggere
                                </span>
                            )}
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">{t('sa.support.subtitle')}</p>
                    </div>
                    <button onClick={fetchTickets} className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                    </button>
                </div>

                {/* Search + Filters */}
                <div className="flex gap-3 mb-6 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input type="text" placeholder={t('sa.support.searchPlaceholder')}
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/30"
                        />
                    </div>
                    <div className="flex gap-2">
                        {(['open', 'in_progress', 'all', 'resolved', 'closed'] as const).map(f => {
                            const unreadForTab = f === 'all' ? unreadByStatus.total
                                : f === 'open' ? unreadByStatus.open
                                    : f === 'in_progress' ? unreadByStatus.in_progress
                                        : f === 'resolved' ? unreadByStatus.resolved
                                            : unreadByStatus.closed;
                            const hasUnread = unreadForTab > 0;
                            const label = f === 'open' ? `Aperti (${openCount})` : f === 'in_progress' ? `In Corso (${inProgressCount})` : f === 'all' ? `Tutti (${totalCount})` : f === 'resolved' ? `Risolti (${resolvedCount})` : `Chiusi (${closedCount})`;
                            return (
                                <button key={f} onClick={() => setFilter(f)}
                                    className={`relative px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${filter === f
                                        ? 'bg-white/10 text-white border border-white/20'
                                        : 'text-slate-500 hover:text-slate-300 border border-transparent'
                                        }`}>
                                    {label}
                                    {hasUnread && (
                                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-1">
                                            {unreadForTab}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-300 focus:outline-none">
                        <option value="">{t('sa.support.allCategories')}</option>
                        {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{t(v.labelKey as any)}</option>
                        ))}
                    </select>
                    {filter === 'all' && tickets.length > 0 && (
                        <button
                            onClick={async () => {
                                if (!confirm(t('sa.support.deleteAllConfirm'))) return;
                                if (!confirm(`Sei davvero sicuro? Verranno eliminati ${tickets.length} ticket con tutti i messaggi.`)) return;
                                try {
                                    await fetch('/api/admin/support-tickets', {
                                        method: 'DELETE',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ deleteAll: true }),
                                    });
                                    fetchTickets();
                                } catch { /* ignore */ }
                            }}
                            className="px-3 py-2 rounded-xl text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all whitespace-nowrap"
                        >
                            🗑️ Elimina Tutti ({tickets.length})
                        </button>
                    )}
                </div>

                {/* Tickets List */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <Inbox className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">
                            {filter === 'open' ? t('sa.support.noRequestsOpen') : t('sa.support.noRequestsFound')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(tk => {
                            const cat = CATEGORY_CONFIG[tk.category] || CATEGORY_CONFIG.general;
                            const pri = PRIORITY_CONFIG[tk.priority] || PRIORITY_CONFIG.normal;
                            const stat = STATUS_CONFIG[tk.status] || STATUS_CONFIG.open;
                            const isExpanded = expandedId === tk.id;
                            const RoleIcon = ROLE_ICONS[tk.requester_role || ''] || User;
                            const messages = chatMessages[tk.id] || [];

                            return (
                                <div key={tk.id}
                                    className="rounded-2xl border transition-all"
                                    style={{
                                        background: 'rgba(255,255,255,0.02)',
                                        borderColor: tk.status === 'open'
                                            ? 'rgba(16,185,129,0.2)'
                                            : tk.status === 'in_progress'
                                                ? 'rgba(6,182,212,0.2)'
                                                : 'rgba(255,255,255,0.06)',
                                    }}>
                                    {/* Ticket Header */}
                                    <div className="p-5 cursor-pointer hover:bg-white/[0.02] transition-colors rounded-2xl"
                                        onClick={() => setExpandedId(isExpanded ? null : tk.id)}>
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${cat.color}`}>
                                                        {t(cat.labelKey as any)}
                                                    </span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${stat.color}`}>
                                                        {t(stat.labelKey as any)}
                                                    </span>
                                                    <span className={`text-[10px] font-bold ${pri.color}`}>
                                                        {t(pri.labelKey as any)}
                                                    </span>
                                                    {messages.length > 0 && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-violet-400 bg-violet-500/15 border border-violet-500/20 flex items-center gap-1">
                                                            <MessageSquare className="w-3 h-3" /> {messages.length}
                                                        </span>
                                                    )}
                                                    {(tk.unreadUserCount || 0) > 0 && (
                                                         <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-red-300 bg-red-500/20 border border-red-500/30 flex items-center gap-1 animate-pulse">
                                                            🔴 {tk.unreadUserCount} {tk.unreadUserCount === 1 ? t('sa.support.newCount') : t('sa.support.newCountPlural')}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="text-sm font-bold text-white mb-1 truncate">{tk.subject}</h3>
                                                <div className="flex items-center gap-4 text-[11px] text-slate-400 flex-wrap">
                                                    <span className="flex items-center gap-1">
                                                        <RoleIcon className="w-3 h-3" /> {tk.requester_name || 'Utente'}
                                                    </span>
                                                    {tk.requester_email && (
                                                        <span className="flex items-center gap-1">
                                                            <Mail className="w-3 h-3" /> {tk.requester_email}
                                                        </span>
                                                    )}
                                                    {tk.requester_phone && (
                                                        <span className="flex items-center gap-1 text-emerald-400">
                                                            <Phone className="w-3 h-3" /> {tk.requester_phone}
                                                        </span>
                                                    )}
                                                    {tk.requester_company && (
                                                        <span className="flex items-center gap-1">
                                                            <Building2 className="w-3 h-3 text-cyan-400" /> {tk.requester_company}
                                                        </span>
                                                    )}
                                                    {tk.workspace_name && (
                                                        <span className="flex items-center gap-1 border-l border-white/10 pl-2 ml-1" title="Workspace di provenienza">
                                                            <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">WS:</span>
                                                            <span className="text-indigo-300 font-semibold">{tk.workspace_name}</span>
                                                        </span>
                                                    )}
                                                    {tk.workspace_owner_email && (
                                                        <span className="flex items-center gap-1 text-slate-400" title={`Owner: ${tk.workspace_owner_email}`}>
                                                            <Crown className="w-3 h-3 text-amber-400" />
                                                            <span className="truncate max-w-[120px]">{tk.workspace_owner_email}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-[10px] text-slate-600">{formatTime(tk.created_at)}</span>
                                                <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded: Chat + Actions */}
                                    {isExpanded && (
                                        <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-4">
                                            {/* Original Description */}
                                            <div className="bg-black/20 rounded-xl p-4">
                                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">{t('sa.support.originalRequest')}</p>
                                                <p className="text-xs text-slate-300 whitespace-pre-wrap">{tk.description}</p>
                                            </div>

                                            {/* Chat Thread */}
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5">
                                                     <MessageSquare className="w-3 h-3" /> {t('sa.support.conversation')} ({messages.length})
                                                </p>
                                                <div className="bg-black/30 rounded-xl border border-white/5 overflow-hidden">
                                                    {/* Messages */}
                                                    <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
                                                        {loadingMessages === tk.id ? (
                                                            <div className="flex items-center justify-center py-6">
                                                                <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                                                            </div>
                                                        ) : messages.length === 0 ? (
                                                            <p className="text-center text-xs text-slate-600 py-4">
                                                                {t('sa.support.noMessages')}
                                                            </p>
                                                        ) : (
                                                            messages.map((msg) => (
                                                                <div key={msg.id} className={`flex ${msg.is_admin ? 'justify-end' : 'justify-start'}`}>
                                                                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${msg.is_admin
                                                                        ? 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20'
                                                                        : 'bg-white/5 border border-white/10'
                                                                        }`}>
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <span className={`text-[10px] font-bold ${msg.is_admin ? 'text-emerald-400' : 'text-amber-300'}`}>
                                                                                {msg.is_admin ? '🛡️ ' : '👤 '}{msg.sender_name || 'Utente'}
                                                                            </span>
                                                                            {!msg.is_admin && msg.sender_email && (
                                                                                <span className="text-[9px] text-slate-500">({msg.sender_email})</span>
                                                                            )}
                                                                            <span className="text-[9px] text-slate-600">{formatTime(msg.created_at)}</span>
                                                                        </div>
                                                                        <p className="text-xs text-slate-200 whitespace-pre-wrap">{msg.message}</p>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                        <div ref={(el) => { chatEndRefs.current[tk.id] = el; }} />
                                                    </div>

                                                    {/* Input */}
                                                    {tk.status !== 'closed' && (
                                                        <div className="border-t border-white/5 p-3 flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                placeholder={t('sa.support.replyPlaceholder')}
                                                                value={chatInput[tk.id] || ''}
                                                                onChange={(e) => setChatInput(prev => ({ ...prev, [tk.id]: e.target.value }))}
                                                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(tk.id); } }}
                                                                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/30"
                                                            />
                                                            <button
                                                                onClick={() => sendMessage(tk.id)}
                                                                disabled={!chatInput[tk.id]?.trim() || sendingMessage === tk.id}
                                                                className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90 disabled:opacity-30 transition-all"
                                                            >
                                                                {sendingMessage === tk.id
                                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                                    : <Send className="w-4 h-4" />
                                                                }
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Admin Notes */}
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t('sa.support.adminNotes')}</label>
                                                <textarea
                                                    value={noteInputs[tk.id] ?? tk.admin_notes ?? ''}
                                                    onChange={(e) => setNoteInputs(p => ({ ...p, [tk.id]: e.target.value }))}
                                                    placeholder={t('sa.support.adminNotesPlaceholder')}
                                                    rows={2}
                                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/30 resize-none"
                                                />
                                            </div>

                                            {/* Actions — Trello-style status change */}
                                            <div className="flex flex-wrap gap-2 items-center">
                                                {/* Status selector */}
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{t('sa.support.moveTo')}</span>
                                                    {tk.status !== 'open' && (
                                                        <button onClick={() => updateTicket(tk.id, { status: 'open', admin_notes: noteInputs[tk.id] ?? tk.admin_notes })}
                                                            disabled={processing === tk.id}
                                                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 transition-all disabled:opacity-50">
                                                            {t('sa.support.statusOpen')}
                                                        </button>
                                                    )}
                                                    {tk.status !== 'in_progress' && (
                                                        <button onClick={() => updateTicket(tk.id, { status: 'in_progress', admin_notes: noteInputs[tk.id] ?? tk.admin_notes })}
                                                            disabled={processing === tk.id}
                                                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/25 transition-all disabled:opacity-50">
                                                            {t('sa.support.statusInProgress')}
                                                        </button>
                                                    )}
                                                    {tk.status !== 'resolved' && (
                                                        <button onClick={() => updateTicket(tk.id, { status: 'resolved', admin_notes: noteInputs[tk.id] ?? tk.admin_notes, resolution: resolutionInputs[tk.id] ?? tk.resolution })}
                                                            disabled={processing === tk.id}
                                                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all disabled:opacity-50">
                                                            {t('sa.support.statusResolved')}
                                                        </button>
                                                    )}
                                                    {tk.status !== 'closed' && (
                                                        <button onClick={() => updateTicket(tk.id, { status: 'closed', admin_notes: noteInputs[tk.id] ?? tk.admin_notes })}
                                                            disabled={processing === tk.id}
                                                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-400 border border-white/10 hover:bg-white/5 transition-all disabled:opacity-50">
                                                            {t('sa.support.statusClosed')}
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 ml-auto">
                                                    {(noteInputs[tk.id] !== undefined) && (
                                                        <button onClick={() => updateTicket(tk.id, { admin_notes: noteInputs[tk.id] ?? tk.admin_notes })}
                                                            disabled={processing === tk.id}
                                                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50">
                                                            {t('sa.support.saveNotes')}
                                                        </button>
                                                    )}
                                                    {/* Hard delete single ticket */}
                                                    <button onClick={async () => {
                                                        if (!confirm(t('sa.support.confirmDelete'))) return;
                                                        try {
                                                            await fetch('/api/admin/support-tickets', {
                                                                method: 'DELETE',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ id: tk.id }),
                                                            });
                                                            fetchTickets();
                                                        } catch { /* ignore */ }
                                                    }}
                                                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-red-400 border border-red-500/20 hover:bg-red-500/15 transition-all">
                                                        {t('sa.support.deleteTicket')}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
