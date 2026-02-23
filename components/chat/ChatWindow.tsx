'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, MessageSquare, User } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { createClient } from '../../utils/supabase/client';
import { useOfficeStore } from '../../stores/useOfficeStore';

interface Message {
    id: string;
    sender_id: string;
    sender_name: string;
    content: string;
    created_at: string;
}

export function ChatWindow() {
    const { isChatOpen, toggleChat } = useOfficeStore();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const supabase = createClient();
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        const channel = supabase.channel('office_chat')
            .on('broadcast', { event: 'message' }, ({ payload }) => {
                setMessages(prev => [...prev, payload]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const newMessage: Message = {
            id: crypto.randomUUID(),
            sender_id: user.id,
            sender_name: user.user_metadata?.full_name || user.email || 'Anonymous',
            content: inputValue,
            created_at: new Date().toISOString(),
        };

        await supabase.channel('office_chat').send({
            type: 'broadcast',
            event: 'message',
            payload: newMessage,
        });

        setMessages(prev => [...prev, newMessage]);
        setInputValue('');
    };

    return (
        <AnimatePresence>
            {isChatOpen && (
                <motion.div
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    className="absolute right-0 top-0 bottom-0 w-80 bg-slate-900/90 backdrop-blur-xl border-l border-slate-700/50 flex flex-col z-50 shadow-2xl"
                >
                    <div className="p-4 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/20">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-primary-400" />
                            <h3 className="font-semibold text-slate-100 italic">Office Chat</h3>
                        </div>
                        <Button variant="ghost" size="icon" onClick={toggleChat} className="h-8 w-8 text-slate-400">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 opacity-50">
                                <MessageSquare className="w-12 h-12" />
                                <p className="text-sm">No messages yet. Say hi!</p>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div key={msg.id} className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider">{msg.sender_name}</span>
                                        <span className="text-[8px] text-slate-500">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="bg-slate-800/50 p-3 rounded-2xl rounded-tl-none border border-slate-700/30 text-sm text-slate-200 shadow-sm">
                                        {msg.content}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <form onSubmit={handleSendMessage} className="p-4 bg-slate-800/30 border-t border-slate-700/50">
                        <div className="relative">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Type a message..."
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                            />
                            <button
                                type="submit"
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary-400 hover:text-primary-300 transition-colors"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
