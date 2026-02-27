'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send,
    X,
    MessageSquare,
    Trash2,
    Shield,
    Crown,
    MoreHorizontal,
    Smile,
    Image as ImageIcon,
    Eraser,
    Bot
} from 'lucide-react';
import { Button } from '../ui/button';
import { createClient } from '../../utils/supabase/client';
import { useOfficeStore } from '../../stores/useOfficeStore';
import type { Message, AiAgent } from '@/lib/supabase/database.types';

// Stable Supabase client — created once outside component
const supabase = createClient();

export function ChatWindow() {
    const { isChatOpen, toggleChat, activeSpaceId, myRoomId, rooms } = useOfficeStore();
    const [chatTab, setChatTab] = useState<'office' | 'room'>('office');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member' | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [messageMenuOpen, setMessageMenuOpen] = useState<string | null>(null);
    const [spaceName, setSpaceName] = useState<string>('Chat Workspace');
    const [isClearingChat, setIsClearingChat] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);
    const [agents, setAgents] = useState<AiAgent[]>([]);
    const [showAgentMenu, setShowAgentMenu] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Switch automatico a stanza quando l'utente entra in una stanza
    useEffect(() => {
        if (myRoomId) {
            setChatTab('room');
        } else {
            setChatTab('office');
        }
    }, [myRoomId, isChatOpen]);

    // Carica utente corrente e ruolo
    useEffect(() => {
        if (!isChatOpen) return;

        let cancelled = false;
        const loadUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (cancelled || !user) return;
            setCurrentUser(user);

            // Carica profilo completo
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (cancelled || !profile || !activeSpaceId) return;

            // Determina ruolo utente nello spazio
            const { data: spaceData } = await supabase
                .from('spaces')
                .select('workspace_id')
                .eq('id', activeSpaceId)
                .single();

            if (cancelled || !spaceData) return;

            setWorkspaceId(spaceData.workspace_id);

            const { data: wsData } = await supabase
                .from('workspaces')
                .select('created_by')
                .eq('id', spaceData.workspace_id)
                .single();

            const { data: memberData } = await supabase
                .from('workspace_members')
                .select('role')
                .eq('workspace_id', spaceData.workspace_id)
                .eq('user_id', user.id)
                .is('removed_at', null)
                .single();

            if (cancelled) return;

            if (wsData?.created_by === user.id) {
                setUserRole('owner');
            } else if (memberData) {
                setUserRole(memberData.role as 'admin' | 'member');
            }

            // Carica nome dello space
            const { data: spaceInfo } = await supabase
                .from('spaces')
                .select('name')
                .eq('id', activeSpaceId)
                .single();
            if (!cancelled && spaceInfo) setSpaceName(spaceInfo.name);

            // Carica agenti AI attivi per il workspace
            const { data: agentData } = await supabase
                .from('ai_agents')
                .select('*')
                .eq('workspace_id', spaceData.workspace_id)
                .eq('is_active', true);
            if (!cancelled && agentData) setAgents(agentData);
        };

        loadUser();
        return () => { cancelled = true; };
    }, [isChatOpen, activeSpaceId]);

    // Trova o crea la conversation per la chat
    const getOrCreateConversation = useCallback(async (): Promise<string | null> => {
        if (!workspaceId) return null;

        const targetRoomId = chatTab === 'room' ? myRoomId : null;

        // Cerca conversation esistente
        let query = supabase
            .from('conversations')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('type', targetRoomId ? 'room' : 'channel');

        if (targetRoomId) {
            query = query.eq('room_id', targetRoomId);
        } else {
            query = query.is('room_id', null);
        }

        const { data: existingConv } = await query.single();

        if (existingConv) {
            return existingConv.id;
        }

        // Se non esiste, crea una nuova conversation
        const { data: newConv, error } = await supabase
            .from('conversations')
            .insert({
                workspace_id: workspaceId,
                type: targetRoomId ? 'room' : 'channel',
                room_id: targetRoomId,
                name: targetRoomId ? null : 'general',
                created_by: currentUser?.id
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating conversation:', error);
            return null;
        }

        return newConv?.id || null;
    }, [workspaceId, chatTab, myRoomId, currentUser?.id]);

    // Carica messaggi dal database
    const loadMessages = useCallback(async () => {
        if (!workspaceId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        const convId = await getOrCreateConversation();
        if (!convId) {
            setMessages([]);
            setIsLoading(false);
            return;
        }

        setConversationId(convId);

        const { data, error } = await supabase
            .from('messages')
            .select(`
                *,
                attachments:message_attachments(*)
            `)
            .eq('conversation_id', convId)
            .is('deleted_at', null)
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) {
            console.error('Error loading messages:', error);
            setMessages([]);
        } else {
            setMessages(data || []);
        }
        setIsLoading(false);
    }, [workspaceId, getOrCreateConversation]);

    useEffect(() => {
        if (isChatOpen && workspaceId) {
            loadMessages();
        }
    }, [isChatOpen, workspaceId, chatTab, myRoomId, loadMessages]);

    // Sottoscrizione realtime ai nuovi messaggi
    useEffect(() => {
        if (!conversationId || !isChatOpen) return;

        const channel = supabase
            .channel(`messages:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    const newMessage = payload.new as Message;
                    setMessages((prev) => {
                        // Evita duplicati (inclusi messaggi ottimistici)
                        if (prev.find(m => m.id === newMessage.id)) {
                            // Aggiorna il messaggio ottimistico con quello reale
                            return prev.map(m => m.id === newMessage.id ? newMessage : m);
                        }
                        return [...prev, newMessage];
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    const updatedMessage = payload.new as Message;
                    // Se il messaggio è stato soft-deleted, rimuovilo
                    if (updatedMessage.deleted_at) {
                        setMessages((prev) => prev.filter(m => m.id !== updatedMessage.id));
                    } else {
                        setMessages((prev) =>
                            prev.map(m => m.id === updatedMessage.id ? updatedMessage : m)
                        );
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    const deletedMessage = payload.old as Message;
                    if (deletedMessage?.id) {
                        setMessages((prev) => prev.filter(m => m.id !== deletedMessage.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversationId, isChatOpen]);

    // Auto-scroll ai nuovi messaggi
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Focus input quando si apre la chat
    useEffect(() => {
        if (isChatOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isChatOpen]);

    // Chiudi menu messaggio quando si clicca fuori
    useEffect(() => {
        const handleClickOutside = () => setMessageMenuOpen(null);
        if (messageMenuOpen) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [messageMenuOpen]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || !currentUser || !conversationId || isSending) return;

        const content = inputValue.trim();
        setInputValue('');
        setIsSending(true);

        // Ottieni profilo completo
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, display_name, avatar_url')
            .eq('id', currentUser.id)
            .single();

        const senderName = profile?.display_name || profile?.full_name || currentUser.email || 'Anonymous';

        const newMessage = {
            conversation_id: conversationId,
            sender_id: currentUser.id,
            sender_name: senderName,
            sender_avatar_url: profile?.avatar_url,
            content,
            type: 'text' as const
        };

        // Salva nel database
        const { error } = await supabase
            .from('messages')
            .insert(newMessage);

        if (error) {
            console.error('Error sending message:', error);
            setInputValue(content); // Ripristina input in caso di errore
        }
        setIsSending(false);
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!confirm('Sei sicuro di voler eliminare questo messaggio?')) return;

        // Soft delete
        const { error } = await supabase
            .from('messages')
            .update({
                deleted_at: new Date().toISOString(),
                deleted_by: currentUser?.id
            })
            .eq('id', messageId);

        if (error) {
            console.error('Error deleting message:', error);
            alert('Errore durante l\'eliminazione del messaggio');
        } else {
            // Aggiorna localmente
            setMessages(prev => prev.filter(m => m.id !== messageId));
        }
        setMessageMenuOpen(null);
    };

    const canDeleteMessage = (msg: Message) => {
        // Admin/owner possono cancellare qualsiasi messaggio
        if (userRole === 'owner' || userRole === 'admin') return true;
        // L'utente può cancellare i propri messaggi
        if (msg.sender_id === currentUser?.id) return true;
        return false;
    };

    const handleClearChat = async () => {
        if (!conversationId) return;
        const confirmMsg = chatTab === 'room'
            ? 'Sei sicuro di voler eliminare tutta la chat di questa stanza? Questa operazione non può essere annullata.'
            : 'Sei sicuro di voler eliminare tutta la chat dell\'ufficio? Questa operazione non può essere annullata.';

        if (!confirm(confirmMsg)) return;

        setIsClearingChat(true);

        // Soft delete di tutti i messaggi della conversation
        const { error } = await supabase
            .from('messages')
            .update({
                deleted_at: new Date().toISOString(),
                deleted_by: currentUser?.id
            })
            .eq('conversation_id', conversationId);

        if (error) {
            console.error('Error clearing chat:', error);
            alert('Errore durante la cancellazione della chat');
        } else {
            setMessages([]); // Aggiorna subito il frontend
        }
        setIsClearingChat(false);
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Oggi';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Ieri';
        } else {
            return date.toLocaleDateString('it-IT', {
                day: 'numeric',
                month: 'short',
                year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
            });
        }
    };

    // Raggruppa messaggi per data
    const groupedMessages = useMemo(() => {
        return messages.reduce((groups, msg) => {
            const date = new Date(msg.created_at).toDateString();
            if (!groups[date]) groups[date] = [];
            groups[date].push(msg);
            return groups;
        }, {} as Record<string, Message[]>);
    }, [messages]);

    const isOwnMessage = (msg: Message) => msg.sender_id === currentUser?.id;
    const isAgentMessage = (msg: Message) => !!msg.agent_id;

    // Determina se il sender è admin/owner (per il badge)
    const getSenderBadge = useCallback((msg: Message): 'owner' | 'admin' | 'agent' | null => {
        if (msg.agent_id) return 'agent';
        // Per ora mostriamo il badge solo se il messaggio è dell'utente corrente e ha il ruolo
        // In futuro si potrebbe fare un lookup dei ruoli per tutti i sender
        if (msg.sender_id === currentUser?.id) {
            if (userRole === 'owner') return 'owner';
            if (userRole === 'admin') return 'admin';
        }
        return null;
    }, [currentUser?.id, userRole]);

    // Handle @agent mention in input
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value);
        // Show agent menu when typing @
        if (value.endsWith('@') && agents.length > 0) {
            setShowAgentMenu(true);
        } else {
            setShowAgentMenu(false);
        }
    };

    const insertAgentMention = (agent: AiAgent) => {
        setInputValue(prev => prev.replace(/@$/, `@${agent.name} `));
        setShowAgentMenu(false);
        inputRef.current?.focus();
    };

    return (
        <AnimatePresence>
            {isChatOpen && (
                <motion.div
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="absolute right-4 top-4 bottom-4 w-96 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-3xl flex flex-col z-50 shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-white/5 flex flex-col gap-3 bg-gradient-to-r from-slate-800/50 to-transparent">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center shadow-lg">
                                    <MessageSquare className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-100">
                                        {chatTab === 'room' && myRoomId
                                            ? rooms.find(r => r.id === myRoomId)?.name || 'Stanza'
                                            : spaceName || 'Office'}
                                    </h3>
                                    <p className="text-xs text-slate-400">{messages.length} messaggi</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {(userRole === 'owner' || userRole === 'admin') && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleClearChat}
                                        disabled={isClearingChat || messages.length === 0}
                                        className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-full disabled:opacity-30"
                                        title="Cancella tutta la chat"
                                    >
                                        <Eraser className="w-4 h-4" />
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={toggleChat}
                                    className="h-8 w-8 text-slate-400 hover:text-slate-100 hover:bg-white/10 rounded-full"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex items-center gap-2 p-1 bg-slate-900/50 rounded-lg">
                            <button
                                onClick={() => setChatTab('office')}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${chatTab === 'office'
                                    ? 'bg-slate-700 text-white shadow'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                    }`}
                            >
                                Ufficio
                            </button>
                            <button
                                onClick={() => setChatTab('room')}
                                disabled={!myRoomId}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${!myRoomId ? 'opacity-40 cursor-not-allowed' : ''
                                    } ${chatTab === 'room'
                                        ? 'bg-slate-700 text-white shadow'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                    }`}
                                title={!myRoomId ? 'Entra in una stanza per usare la chat' : ''}
                            >
                                Stanza
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
                    >
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 opacity-60">
                                <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center">
                                    <MessageSquare className="w-8 h-8" />
                                </div>
                                <p className="text-sm">Nessun messaggio ancora</p>
                                <p className="text-xs">Sii il primo a scrivere!</p>
                            </div>
                        ) : (
                            Object.entries(groupedMessages).map(([date, dateMessages]) => (
                                <div key={date} className="space-y-3">
                                    {/* Data separator */}
                                    <div className="flex items-center justify-center my-4">
                                        <div className="px-3 py-1 rounded-full bg-slate-800/80 text-xs text-slate-500 font-medium">
                                            {formatDate(dateMessages[0].created_at)}
                                        </div>
                                    </div>

                                    {dateMessages.map((msg, index) => {
                                        const own = isOwnMessage(msg);
                                        const isAgent = isAgentMessage(msg);
                                        const showAvatar = index === 0 ||
                                            dateMessages[index - 1].sender_id !== msg.sender_id ||
                                            dateMessages[index - 1].agent_id !== msg.agent_id;
                                        const badge = getSenderBadge(msg);

                                        return (
                                            <motion.div
                                                key={msg.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`group flex gap-3 ${own ? 'flex-row-reverse' : ''}`}
                                            >
                                                {/* Avatar */}
                                                <div className="flex-shrink-0 w-8">
                                                    {showAvatar ? (
                                                        <div className="relative">
                                                            {isAgent ? (
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white ring-2 ring-emerald-700/50">
                                                                    <Bot className="w-4 h-4" />
                                                                </div>
                                                            ) : msg.sender_avatar_url ? (
                                                                <img
                                                                    src={msg.sender_avatar_url}
                                                                    alt={msg.sender_name || 'User'}
                                                                    className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-700"
                                                                />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 ring-2 ring-slate-700">
                                                                    {(msg.sender_name || '?')[0]?.toUpperCase()}
                                                                </div>
                                                            )}
                                                            {/* Badge admin/owner/agent */}
                                                            {badge && (
                                                                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${badge === 'owner' ? 'bg-amber-500' :
                                                                        badge === 'agent' ? 'bg-emerald-500' :
                                                                            'bg-primary-500'
                                                                    }`}>
                                                                    {badge === 'owner' ? (
                                                                        <Crown className="w-2.5 h-2.5 text-white" />
                                                                    ) : badge === 'agent' ? (
                                                                        <Bot className="w-2.5 h-2.5 text-white" />
                                                                    ) : (
                                                                        <Shield className="w-2.5 h-2.5 text-white" />
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="w-8" />
                                                    )}
                                                </div>

                                                {/* Message Content */}
                                                <div className={`flex-1 ${own ? 'items-end' : 'items-start'} flex flex-col`}>
                                                    {showAvatar && (
                                                        <div className={`flex items-center gap-2 mb-1 ${own ? 'flex-row-reverse' : ''}`}>
                                                            <span className={`text-xs font-semibold ${isAgent ? 'text-emerald-400' : 'text-slate-300'}`}>
                                                                {isAgent ? (msg.agent_name || 'AI Agent') : (msg.sender_name || 'Utente')}
                                                            </span>
                                                            {isAgent && (
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium uppercase tracking-wider">
                                                                    Bot
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] text-slate-600">
                                                                {formatTime(msg.created_at)}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className={`relative max-w-[85%] group/message ${isAgent
                                                            ? 'bg-emerald-500/10 border-emerald-500/20'
                                                            : own
                                                                ? 'bg-primary-500/20 border-primary-500/30'
                                                                : 'bg-slate-800/80 border-white/5'
                                                        } rounded-2xl px-4 py-2.5 border ${isAgent
                                                            ? 'rounded-tl-sm'
                                                            : own
                                                                ? 'rounded-tr-sm'
                                                                : 'rounded-tl-sm'
                                                        }`}>
                                                        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                                                            {msg.content}
                                                        </p>

                                                        {/* Menu azioni messaggio */}
                                                        {canDeleteMessage(msg) && (
                                                            <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover/message:opacity-100 transition-opacity ${own ? '-left-8' : '-right-8'}`}>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setMessageMenuOpen(messageMenuOpen === msg.id ? null : msg.id);
                                                                    }}
                                                                    className="p-1.5 rounded-full hover:bg-slate-700/50 text-slate-500 hover:text-slate-300"
                                                                >
                                                                    <MoreHorizontal className="w-4 h-4" />
                                                                </button>

                                                                {messageMenuOpen === msg.id && (
                                                                    <div className={`absolute top-full mt-1 ${own ? 'right-0' : 'left-0'} w-32 bg-slate-800 border border-white/10 rounded-xl shadow-xl z-20 py-1`}>
                                                                        <button
                                                                            onClick={() => handleDeleteMessage(msg.id)}
                                                                            className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-white/5 flex items-center gap-2"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" /> Elimina
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-slate-800/30 border-t border-white/5">
                        {/* Agent mention dropdown */}
                        <AnimatePresence>
                            {showAgentMenu && agents.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="mb-2 p-1 bg-slate-800 border border-white/10 rounded-xl shadow-xl"
                                >
                                    <div className="text-[10px] text-slate-500 px-2 py-1 uppercase tracking-wider font-medium">
                                        Agenti AI disponibili
                                    </div>
                                    {agents.map(agent => (
                                        <button
                                            key={agent.id}
                                            onClick={() => insertAgentMention(agent)}
                                            className="w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-white/5 rounded-lg transition-colors"
                                        >
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                                                {agent.avatar_url ? (
                                                    <img src={agent.avatar_url} alt={agent.name} className="w-6 h-6 rounded-full object-cover" />
                                                ) : (
                                                    <Bot className="w-3.5 h-3.5 text-white" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-emerald-400">{agent.name}</p>
                                                <p className="text-[10px] text-slate-500">{agent.role}</p>
                                            </div>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <form onSubmit={handleSendMessage} className="relative">
                            <div className="flex items-center gap-2 bg-slate-950/80 border border-white/10 rounded-2xl px-4 py-2.5 focus-within:border-primary-500/50 focus-within:ring-1 focus-within:ring-primary-500/30 transition-all">
                                <button
                                    type="button"
                                    className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    <Smile className="w-5 h-5" />
                                </button>

                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={handleInputChange}
                                    placeholder={agents.length > 0 ? 'Scrivi un messaggio... (@ per agenti)' : 'Scrivi un messaggio...'}
                                    className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none"
                                    maxLength={1000}
                                />

                                <button
                                    type="button"
                                    className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    <ImageIcon className="w-5 h-5" />
                                </button>

                                <button
                                    type="submit"
                                    disabled={!inputValue.trim() || (chatTab === 'room' && !myRoomId) || isSending}
                                    className="p-2 rounded-xl bg-primary-500 hover:bg-primary-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all active:scale-95"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </form>

                        {/* Ruolo indicator */}
                        {userRole && (
                            <div className="mt-2 flex items-center justify-center gap-1.5">
                                {userRole === 'owner' && (
                                    <>
                                        <Crown className="w-3 h-3 text-amber-500" />
                                        <span className="text-[10px] text-amber-500/80 uppercase tracking-wider font-medium">Proprietario</span>
                                    </>
                                )}
                                {userRole === 'admin' && (
                                    <>
                                        <Shield className="w-3 h-3 text-primary-400" />
                                        <span className="text-[10px] text-primary-400/80 uppercase tracking-wider font-medium">Admin</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default ChatWindow;
