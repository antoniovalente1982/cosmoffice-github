'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
    Eraser
} from 'lucide-react';
import { Button } from '../ui/button';
import { createClient } from '../../utils/supabase/client';
import { useOfficeStore } from '../../stores/useOfficeStore';

interface ChatMessage {
    id: string;
    space_id: string;
    sender_id: string;
    sender_name: string;
    sender_avatar_url?: string;
    content: string;
    type: 'text' | 'image' | 'file' | 'system';
    created_at: string;
    is_admin?: boolean;
    is_owner?: boolean;
}

export function ChatWindow() {
    const { isChatOpen, toggleChat, activeSpaceId } = useOfficeStore();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member' | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [messageMenuOpen, setMessageMenuOpen] = useState<string | null>(null);
    const [spaceName, setSpaceName] = useState<string>('Chat Workspace');
    const [isClearingChat, setIsClearingChat] = useState(false);
    const supabase = createClient();
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Carica utente corrente e ruolo
    useEffect(() => {
        const loadUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUser(user);
                
                // Carica profilo completo
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (profile && activeSpaceId) {
                    // Determina ruolo utente nello spazio
                    const { data: spaceData } = await supabase
                        .from('spaces')
                        .select('org_id')
                        .eq('id', activeSpaceId)
                        .single();
                    
                    if (spaceData) {
                        const { data: orgData } = await supabase
                            .from('organizations')
                            .select('created_by')
                            .eq('id', spaceData.org_id)
                            .single();
                        
                        const { data: memberData } = await supabase
                            .from('organization_members')
                            .select('role')
                            .eq('org_id', spaceData.org_id)
                            .eq('user_id', user.id)
                            .single();

                        if (orgData?.created_by === user.id) {
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
                        if (spaceInfo) setSpaceName(spaceInfo.name);
                    }
                }
            }
        };

        if (isChatOpen) {
            loadUser();
        }
    }, [isChatOpen, activeSpaceId, supabase]);

    // Carica messaggi dal database
    const loadMessages = useCallback(async () => {
        if (!activeSpaceId) return;
        
        setIsLoading(true);
        const { data, error } = await supabase
            .from('space_chat_messages')
            .select('*')
            .eq('space_id', activeSpaceId)
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) {
            console.error('Error loading messages:', error);
        } else {
            setMessages(data || []);
        }
        setIsLoading(false);
    }, [activeSpaceId, supabase]);

    useEffect(() => {
        if (isChatOpen && activeSpaceId) {
            loadMessages();
        }
    }, [isChatOpen, activeSpaceId, loadMessages]);

    // Sottoscrizione realtime ai nuovi messaggi
    useEffect(() => {
        if (!activeSpaceId || !isChatOpen) return;

        const channel = supabase
            .channel(`space_chat:${activeSpaceId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'space_chat_messages',
                    filter: `space_id=eq.${activeSpaceId}`
                },
                (payload) => {
                    const newMessage = payload.new as ChatMessage;
                    setMessages((prev) => {
                        // Evita duplicati
                        if (prev.find(m => m.id === newMessage.id)) return prev;
                        return [...prev, newMessage];
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'space_chat_messages'
                    // Nessun filtro: senza REPLICA IDENTITY FULL Supabase non invia
                    // space_id nei DELETE events. Filtriamo nel callback via id.
                },
                (payload) => {
                    const deletedId = payload.old.id;
                    setMessages((prev) => prev.filter(m => m.id !== deletedId));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeSpaceId, isChatOpen, supabase]);

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
        if (!inputValue.trim() || !currentUser || !activeSpaceId) return;

        const content = inputValue.trim();
        setInputValue('');

        // Ottieni profilo completo
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', currentUser.id)
            .single();

        const newMessage = {
            space_id: activeSpaceId,
            sender_id: currentUser.id,
            sender_name: profile?.full_name || currentUser.email || 'Anonymous',
            sender_avatar_url: profile?.avatar_url,
            content,
            type: 'text' as const
        };

        // Salva nel database
        const { error } = await supabase
            .from('space_chat_messages')
            .insert(newMessage);

        if (error) {
            console.error('Error sending message:', error);
            setInputValue(content); // Ripristina input in caso di errore
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!confirm('Sei sicuro di voler eliminare questo messaggio?')) return;
        
        const { error } = await supabase
            .from('space_chat_messages')
            .delete()
            .eq('id', messageId);

        if (error) {
            console.error('Error deleting message:', error);
            alert('Errore durante l\'eliminazione del messaggio');
        }
        setMessageMenuOpen(null);
    };

    const canDeleteMessage = () => {
        // Solo admin/owner possono cancellare messaggi (allineato alla RLS policy)
        return userRole === 'owner' || userRole === 'admin';
    };

    const handleClearChat = async () => {
        if (!activeSpaceId) return;
        if (!confirm('Sei sicuro di voler eliminare tutta la chat? Questa operazione non può essere annullata.')) return;

        setIsClearingChat(true);
        const { error } = await supabase
            .from('space_chat_messages')
            .delete()
            .eq('space_id', activeSpaceId);

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
    const groupedMessages = messages.reduce((groups, msg) => {
        const date = new Date(msg.created_at).toDateString();
        if (!groups[date]) groups[date] = [];
        groups[date].push(msg);
        return groups;
    }, {} as Record<string, ChatMessage[]>);

    const isOwnMessage = (msg: ChatMessage) => msg.sender_id === currentUser?.id;

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
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-slate-800/50 to-transparent">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center shadow-lg">
                                <MessageSquare className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-100">{spaceName}</h3>
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
                                        const showAvatar = index === 0 || 
                                            dateMessages[index - 1].sender_id !== msg.sender_id;
                                        
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
                                                            {msg.sender_avatar_url ? (
                                                                <img 
                                                                    src={msg.sender_avatar_url} 
                                                                    alt={msg.sender_name}
                                                                    className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-700"
                                                                />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 ring-2 ring-slate-700">
                                                                    {msg.sender_name[0]?.toUpperCase()}
                                                                </div>
                                                            )}
                                                            {/* Badge admin/owner */}
                                                            {(msg.is_admin || msg.is_owner) && (
                                                                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${msg.is_owner ? 'bg-amber-500' : 'bg-primary-500'}`}>
                                                                    {msg.is_owner ? (
                                                                        <Crown className="w-2.5 h-2.5 text-white" />
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
                                                            <span className="text-xs font-semibold text-slate-300">
                                                                {msg.sender_name}
                                                            </span>
                                                            <span className="text-[10px] text-slate-600">
                                                                {formatTime(msg.created_at)}
                                                            </span>
                                                        </div>
                                                    )}
                                                    
                                                    <div className={`relative max-w-[85%] group/message ${own ? 'bg-primary-500/20' : 'bg-slate-800/80'} rounded-2xl px-4 py-2.5 border ${own ? 'border-primary-500/30 rounded-tr-sm' : 'border-white/5 rounded-tl-sm'}`}>
                                                        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                                                            {msg.content}
                                                        </p>
                                                        
                                                        {/* Menu azioni messaggio */}
                                                        {canDeleteMessage() && (
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
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Scrivi un messaggio..."
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
                                    disabled={!inputValue.trim()}
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
