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
    ImageIcon,
    Eraser,
    Bot,
    Loader2,
    ZoomIn
} from 'lucide-react';
import { Button } from '../ui/button';
import { createClient } from '../../utils/supabase/client';
import { useOfficeStore } from '../../stores/useOfficeStore';
import type { Message, AiAgent } from '@/lib/supabase/database.types';

const supabase = createClient();

// ── Emoji Data (lightweight, no external lib) ──
const EMOJI_CATEGORIES = [
    {
        name: '😀', label: 'Faccine',
        emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🫢', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '🥹', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖'],
    },
    {
        name: '👋', label: 'Gesti',
        emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄'],
    },
    {
        name: '❤️', label: 'Cuori',
        emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '🫶', '😍', '🥰', '😘', '💋', '💏', '💑'],
    },
    {
        name: '🎉', label: 'Oggetti',
        emojis: ['🎉', '🎊', '🎈', '🎁', '🎀', '🎗️', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🎯', '🎮', '🕹️', '🎲', '🧩', '🎨', '🎭', '🎪', '🎬', '🎤', '🎧', '🎵', '🎶', '🎹', '🎸', '🎺', '🎻', '🪘', '🥁', '🔔', '🔕', '📢', '📣', '💡', '🔋', '💻', '🖥️', '⌨️', '🖱️', '📱', '📧', '📎', '📁', '📂', '✏️', '📝', '📌', '📍', '🔑', '🔒', '🔓'],
    },
    {
        name: '🍕', label: 'Cibo',
        emojis: ['🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲', '🫕', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🥡', '🦀', '🦞', '🦐', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', '🥠', '🥧', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '☕', '🍵', '🧃', '🥤', '🧋', '🍺', '🍻', '🥂', '🍷', '🥃', '🍹', '🍸', '🧉', '🫗'],
    },
];

export function ChatWindow() {
    const { isChatOpen, toggleChat, activeSpaceId, myRoomId, rooms } = useOfficeStore();
    const [chatTab, setChatTab] = useState<'office' | 'room'>('office');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member' | 'guest' | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [messageMenuOpen, setMessageMenuOpen] = useState<string | null>(null);
    const [spaceName, setSpaceName] = useState<string>('Chat');
    const [isClearingChat, setIsClearingChat] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);
    const [agents, setAgents] = useState<AiAgent[]>([]);
    const [showAgentMenu, setShowAgentMenu] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (myRoomId) setChatTab('room');
        else setChatTab('office');
    }, [myRoomId, isChatOpen]);

    useEffect(() => {
        if (!isChatOpen) return;
        let cancelled = false;
        const loadUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (cancelled || !user) return;
            setCurrentUser(user);

            const { data: spaceData } = await supabase
                .from('spaces')
                .select('workspace_id, name')
                .eq('id', activeSpaceId)
                .single();

            if (cancelled || !spaceData) return;
            setWorkspaceId(spaceData.workspace_id);
            setSpaceName(spaceData.name || 'Chat');

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
            if (wsData?.created_by === user.id) setUserRole('owner');
            else if (memberData) setUserRole(memberData.role as 'admin' | 'member');

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

    const getOrCreateConversation = useCallback(async (): Promise<string | null> => {
        if (!workspaceId) return null;
        const targetRoomId = chatTab === 'room' ? myRoomId : null;

        let query = supabase
            .from('conversations')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('type', targetRoomId ? 'room' : 'channel');

        if (targetRoomId) query = query.eq('room_id', targetRoomId);
        else query = query.is('room_id', null);

        const { data: existingConv } = await query.single();
        if (existingConv) return existingConv.id;

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

        if (error) { console.error('Error creating conversation:', error); return null; }
        return newConv?.id || null;
    }, [workspaceId, chatTab, myRoomId, currentUser?.id]);

    const loadMessages = useCallback(async () => {
        if (!workspaceId) { setIsLoading(false); return; }
        setIsLoading(true);

        const convId = await getOrCreateConversation();
        if (!convId) { setMessages([]); setIsLoading(false); return; }
        setConversationId(convId);

        const { data, error } = await supabase
            .from('messages')
            .select('*, attachments:message_attachments(*)')
            .eq('conversation_id', convId)
            .is('deleted_at', null)
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) { console.error('Error loading messages:', error); setMessages([]); }
        else setMessages(data || []);
        setIsLoading(false);
    }, [workspaceId, getOrCreateConversation]);

    useEffect(() => {
        if (isChatOpen && workspaceId) loadMessages();
    }, [isChatOpen, workspaceId, chatTab, myRoomId, loadMessages]);

    // Realtime subscription
    useEffect(() => {
        if (!conversationId || !isChatOpen) return;
        const channel = supabase
            .channel(`messages:${conversationId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
                (payload) => {
                    const newMsg = payload.new as Message;
                    setMessages(prev => prev.find(m => m.id === newMsg.id) ? prev.map(m => m.id === newMsg.id ? newMsg : m) : [...prev, newMsg]);
                })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
                (payload) => {
                    const upd = payload.new as Message;
                    if (upd.deleted_at) setMessages(prev => prev.filter(m => m.id !== upd.id));
                    else setMessages(prev => prev.map(m => m.id === upd.id ? upd : m));
                })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
                (payload) => {
                    const del = payload.old as Message;
                    if (del?.id) setMessages(prev => prev.filter(m => m.id !== del.id));
                })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [conversationId, isChatOpen]);

    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);
    useEffect(() => { if (isChatOpen && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100); }, [isChatOpen]);
    useEffect(() => {
        if (messageMenuOpen) {
            const handler = () => setMessageMenuOpen(null);
            document.addEventListener('click', handler);
            return () => document.removeEventListener('click', handler);
        }
    }, [messageMenuOpen]);

    // Close emoji picker when clicking outside
    useEffect(() => {
        if (showEmojiPicker) {
            const handler = (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                if (!target.closest('.emoji-picker-container')) setShowEmojiPicker(false);
            };
            setTimeout(() => document.addEventListener('click', handler), 10);
            return () => document.removeEventListener('click', handler);
        }
    }, [showEmojiPicker]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || !currentUser || !conversationId || isSending) return;

        const content = inputValue.trim();
        setInputValue('');
        setIsSending(true);
        setShowEmojiPicker(false);

        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, display_name, avatar_url')
            .eq('id', currentUser.id)
            .single();

        const { error } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                sender_id: currentUser.id,
                sender_name: profile?.display_name || profile?.full_name || currentUser.email || 'Anonymous',
                sender_avatar_url: profile?.avatar_url,
                content,
                type: 'text' as const
            });

        if (error) { console.error('Error sending message:', error); setInputValue(content); }
        setIsSending(false);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length || !currentUser || !conversationId) return;
        setUploadingImage(true);

        try {
            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop() || 'jpg';
            const filePath = `${currentUser.id}/${conversationId}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('chat-attachments')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('chat-attachments')
                .getPublicUrl(filePath);

            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, display_name, avatar_url')
                .eq('id', currentUser.id)
                .single();

            // Send as image message
            const { data: msgData, error: msgError } = await supabase
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: currentUser.id,
                    sender_name: profile?.display_name || profile?.full_name || currentUser.email || 'Anonymous',
                    sender_avatar_url: profile?.avatar_url,
                    content: `📷 Immagine`,
                    type: 'image' as const
                })
                .select()
                .single();

            if (msgError) throw msgError;

            // Create attachment record
            if (msgData) {
                await supabase.from('message_attachments').insert({
                    message_id: msgData.id,
                    file_name: file.name,
                    file_size: file.size,
                    mime_type: file.type,
                    storage_path: filePath,
                    public_url: publicUrl,
                    uploaded_by: currentUser.id,
                });
            }
        } catch (err) {
            console.error('Error uploading image:', err);
        }
        setUploadingImage(false);
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const handleDeleteMessage = async (messageId: string) => {
        const { error } = await supabase
            .from('messages')
            .update({ deleted_at: new Date().toISOString(), deleted_by: currentUser?.id })
            .eq('id', messageId);
        if (!error) setMessages(prev => prev.filter(m => m.id !== messageId));
        setMessageMenuOpen(null);
    };

    const canDeleteMessage = (msg: Message) =>
        userRole === 'owner' || userRole === 'admin' || msg.sender_id === currentUser?.id;

    const handleClearChat = async () => {
        if (!conversationId) return;
        if (!confirm('Sei sicuro di voler cancellare tutta la chat?')) return;
        setIsClearingChat(true);
        const { error } = await supabase.from('messages')
            .update({ deleted_at: new Date().toISOString(), deleted_by: currentUser?.id })
            .eq('conversation_id', conversationId);
        if (!error) setMessages([]);
        setIsClearingChat(false);
    };

    const insertEmoji = (emoji: string) => {
        setInputValue(prev => prev + emoji);
        inputRef.current?.focus();
    };

    const formatTime = (d: string) => new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    const formatDate = (d: string) => {
        const date = new Date(d);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === today.toDateString()) return 'Oggi';
        if (date.toDateString() === yesterday.toDateString()) return 'Ieri';
        return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    };

    const groupedMessages = useMemo(() =>
        messages.reduce((groups, msg) => {
            const date = new Date(msg.created_at).toDateString();
            if (!groups[date]) groups[date] = [];
            groups[date].push(msg);
            return groups;
        }, {} as Record<string, Message[]>),
        [messages]);

    const isOwnMessage = (msg: Message) => msg.sender_id === currentUser?.id;
    const isAgentMessage = (msg: Message) => !!msg.agent_id;

    const getSenderBadge = useCallback((msg: Message): 'owner' | 'admin' | 'agent' | null => {
        if (msg.agent_id) return 'agent';
        if (msg.sender_id === currentUser?.id) {
            if (userRole === 'owner') return 'owner';
            if (userRole === 'admin') return 'admin';
        }
        return null;
    }, [currentUser?.id, userRole]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value);
        setShowAgentMenu(value.endsWith('@') && agents.length > 0);
    };

    const insertAgentMention = (agent: AiAgent) => {
        setInputValue(prev => prev.replace(/@$/, `@${agent.name} `));
        setShowAgentMenu(false);
        inputRef.current?.focus();
    };

    // Get attachments for a message (image URL)
    const getMessageImage = (msg: Message): string | null => {
        const attachments = (msg as any).attachments;
        if (attachments?.length > 0) return attachments[0].public_url;
        return null;
    };

    return (
        <AnimatePresence>
            {isChatOpen && (
                <motion.div
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="absolute right-4 top-4 bottom-4 w-[420px] bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-3xl flex flex-col z-50 shadow-2xl overflow-hidden"
                >
                    {/* ── Header ── */}
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
                                            : spaceName}
                                    </h3>
                                    <p className="text-xs text-slate-400">{messages.length} messaggi</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {(userRole === 'owner' || userRole === 'admin') && (
                                    <Button variant="ghost" size="icon" onClick={handleClearChat}
                                        disabled={isClearingChat || messages.length === 0}
                                        className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-full disabled:opacity-30"
                                        title="Cancella chat">
                                        <Eraser className="w-4 h-4" />
                                    </Button>
                                )}
                                <Button variant="ghost" size="icon" onClick={toggleChat}
                                    className="h-8 w-8 text-slate-400 hover:text-slate-100 hover:bg-white/10 rounded-full">
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex items-center gap-2 p-1 bg-slate-900/50 rounded-xl">
                            <button onClick={() => setChatTab('office')}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${chatTab === 'office' ? 'bg-primary-500/20 text-primary-300 shadow' : 'text-slate-400 hover:text-slate-200'}`}>
                                Ufficio
                            </button>
                            <button onClick={() => setChatTab('room')} disabled={!myRoomId}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${!myRoomId ? 'opacity-40 cursor-not-allowed' : ''} ${chatTab === 'room' ? 'bg-primary-500/20 text-primary-300 shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                title={!myRoomId ? 'Entra in una stanza' : ''}>
                                Stanza
                            </button>
                        </div>
                    </div>

                    {/* ── Messages ── */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60 space-y-3">
                                <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center">
                                    <MessageSquare className="w-8 h-8" />
                                </div>
                                <p className="text-sm">Nessun messaggio</p>
                                <p className="text-xs">Sii il primo a scrivere! 💬</p>
                            </div>
                        ) : (
                            Object.entries(groupedMessages).map(([date, dateMessages]) => (
                                <div key={date} className="space-y-2">
                                    <div className="flex items-center justify-center my-3">
                                        <div className="px-3 py-1 rounded-full bg-slate-800/80 text-[10px] text-slate-500 font-medium">
                                            {formatDate(dateMessages[0].created_at)}
                                        </div>
                                    </div>
                                    {dateMessages.map((msg, index) => {
                                        const own = isOwnMessage(msg);
                                        const isAgent = isAgentMessage(msg);
                                        const showAvatar = index === 0 || dateMessages[index - 1].sender_id !== msg.sender_id;
                                        const badge = getSenderBadge(msg);
                                        const imageUrl = getMessageImage(msg);

                                        return (
                                            <motion.div key={msg.id}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`group flex gap-2.5 ${own ? 'flex-row-reverse' : ''}`}>
                                                {/* Avatar */}
                                                <div className="flex-shrink-0 w-8">
                                                    {showAvatar ? (
                                                        <div className="relative">
                                                            {isAgent ? (
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center ring-2 ring-emerald-700/50">
                                                                    <Bot className="w-4 h-4 text-white" />
                                                                </div>
                                                            ) : msg.sender_avatar_url ? (
                                                                <img src={msg.sender_avatar_url} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-700" />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 ring-2 ring-slate-700">
                                                                    {(msg.sender_name || '?')[0]?.toUpperCase()}
                                                                </div>
                                                            )}
                                                            {badge && (
                                                                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${badge === 'owner' ? 'bg-amber-500' : badge === 'agent' ? 'bg-emerald-500' : 'bg-primary-500'
                                                                    }`}>
                                                                    {badge === 'owner' ? <Crown className="w-2.5 h-2.5 text-white" /> :
                                                                        badge === 'agent' ? <Bot className="w-2.5 h-2.5 text-white" /> :
                                                                            <Shield className="w-2.5 h-2.5 text-white" />}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : <div className="w-8" />}
                                                </div>

                                                {/* Message */}
                                                <div className={`flex-1 flex flex-col ${own ? 'items-end' : 'items-start'}`}>
                                                    {showAvatar && (
                                                        <div className={`flex items-center gap-2 mb-1 ${own ? 'flex-row-reverse' : ''}`}>
                                                            <span className={`text-[11px] font-semibold ${isAgent ? 'text-emerald-400' : 'text-slate-300'}`}>
                                                                {isAgent ? (msg.agent_name || 'AI') : (msg.sender_name || 'Utente')}
                                                            </span>
                                                            {isAgent && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">BOT</span>}
                                                            <span className="text-[10px] text-slate-600">{formatTime(msg.created_at)}</span>
                                                        </div>
                                                    )}
                                                    <div className={`relative max-w-[85%] group/message ${isAgent ? 'bg-emerald-500/10 border-emerald-500/20' :
                                                        own ? 'bg-primary-500/15 border-primary-500/20' :
                                                            'bg-slate-800/70 border-white/5'
                                                        } rounded-2xl px-3.5 py-2 border ${isAgent ? 'rounded-tl-md' : own ? 'rounded-tr-md' : 'rounded-tl-md'
                                                        }`}>
                                                        {/* Image attachment */}
                                                        {imageUrl && (
                                                            <div className="mb-2 -mx-1 -mt-0.5 cursor-pointer" onClick={() => setLightboxUrl(imageUrl)}>
                                                                <img src={imageUrl} alt="" className="rounded-xl max-w-full max-h-48 object-cover hover:opacity-90 transition-opacity" />
                                                                <div className="absolute top-2 right-2 opacity-0 group-hover/message:opacity-100 transition-opacity">
                                                                    <ZoomIn className="w-4 h-4 text-white drop-shadow-lg" />
                                                                </div>
                                                            </div>
                                                        )}
                                                        {(!imageUrl || msg.content !== '📷 Immagine') && (
                                                            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                                                        )}

                                                        {/* Delete menu */}
                                                        {canDeleteMessage(msg) && (
                                                            <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover/message:opacity-100 transition-opacity ${own ? '-left-8' : '-right-8'}`}>
                                                                <button onClick={(e) => { e.stopPropagation(); setMessageMenuOpen(messageMenuOpen === msg.id ? null : msg.id); }}
                                                                    className="p-1.5 rounded-full hover:bg-slate-700/50 text-slate-500 hover:text-slate-300">
                                                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                                                </button>
                                                                {messageMenuOpen === msg.id && (
                                                                    <div className={`absolute top-full mt-1 ${own ? 'right-0' : 'left-0'} w-28 bg-slate-800 border border-white/10 rounded-xl shadow-xl z-20 py-1`}>
                                                                        <button onClick={() => handleDeleteMessage(msg.id)}
                                                                            className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-white/5 flex items-center gap-2">
                                                                            <Trash2 className="w-3 h-3" /> Elimina
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

                    {/* ── Input Area ── */}
                    <div className="p-3 bg-slate-800/30 border-t border-white/5">
                        {/* Agent mention dropdown */}
                        <AnimatePresence>
                            {showAgentMenu && agents.length > 0 && (
                                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                                    className="mb-2 p-1 bg-slate-800 border border-white/10 rounded-xl shadow-xl">
                                    <div className="text-[10px] text-slate-500 px-2 py-1 uppercase tracking-wider font-medium">Agenti AI</div>
                                    {agents.map(agent => (
                                        <button key={agent.id} onClick={() => insertAgentMention(agent)}
                                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-white/5 rounded-lg">
                                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                                                <Bot className="w-3 h-3 text-white" />
                                            </div>
                                            <span className="text-xs font-medium text-emerald-400">{agent.name}</span>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Emoji Picker */}
                        <AnimatePresence>
                            {showEmojiPicker && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="emoji-picker-container mb-2 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                                >
                                    <EmojiPicker onSelect={insertEmoji} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Upload progress */}
                        {uploadingImage && (
                            <div className="mb-2 flex items-center gap-2 text-xs text-primary-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Caricamento immagine...
                            </div>
                        )}

                        <form onSubmit={handleSendMessage} className="relative">
                            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-white/8 rounded-2xl px-3 py-2 focus-within:border-primary-500/40 focus-within:ring-1 focus-within:ring-primary-500/20 focus-within:shadow-[0_0_20px_rgba(99,102,241,0.1)] transition-all">
                                <button type="button"
                                    onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); }}
                                    className={`p-1.5 rounded-lg transition-colors ${showEmojiPicker ? 'text-primary-400 bg-primary-500/10' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                                    <Smile className="w-5 h-5" />
                                </button>

                                <input ref={inputRef} type="text" value={inputValue}
                                    onChange={handleInputChange}
                                    placeholder={agents.length > 0 ? 'Messaggio... (@ per agenti)' : 'Scrivi un messaggio...'}
                                    className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none min-w-0"
                                    maxLength={2000} />

                                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}
                                    className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-40">
                                    <ImageIcon className="w-5 h-5" />
                                </button>

                                <button type="submit"
                                    disabled={!inputValue.trim() || (chatTab === 'room' && !myRoomId) || isSending}
                                    className="p-2 rounded-xl bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-400 hover:to-purple-400 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all active:scale-95 shadow-lg shadow-primary-500/20">
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </form>

                        {userRole && (
                            <div className="mt-1.5 flex items-center justify-center gap-1.5">
                                {userRole === 'owner' && <><Crown className="w-3 h-3 text-amber-500" /><span className="text-[10px] text-amber-500/70 uppercase tracking-wider font-medium">Proprietario</span></>}
                                {userRole === 'admin' && <><Shield className="w-3 h-3 text-primary-400" /><span className="text-[10px] text-primary-400/70 uppercase tracking-wider font-medium">Admin</span></>}
                            </div>
                        )}
                    </div>

                    {/* ── Lightbox ── */}
                    <AnimatePresence>
                        {lightboxUrl && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-6 cursor-pointer"
                                onClick={() => setLightboxUrl(null)}>
                                <img src={lightboxUrl} alt="" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
                                <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ── Inline Emoji Picker Component ──
function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
    const [activeCategory, setActiveCategory] = useState(0);

    return (
        <div className="w-full">
            {/* Category tabs */}
            <div className="flex items-center gap-0.5 px-2 pt-2 pb-1 border-b border-white/5">
                {EMOJI_CATEGORIES.map((cat, i) => (
                    <button key={i} onClick={() => setActiveCategory(i)}
                        className={`px-2.5 py-1.5 rounded-lg text-sm transition-all ${activeCategory === i ? 'bg-primary-500/15 scale-110' : 'hover:bg-white/5 opacity-60 hover:opacity-100'}`}>
                        {cat.name}
                    </button>
                ))}
            </div>
            {/* Emoji grid */}
            <div className="p-2 max-h-44 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                <div className="grid grid-cols-8 gap-0.5">
                    {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, i) => (
                        <button key={i} onClick={() => onSelect(emoji)}
                            className="w-9 h-9 flex items-center justify-center rounded-lg text-lg hover:bg-white/10 hover:scale-110 active:scale-95 transition-all">
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default ChatWindow;
