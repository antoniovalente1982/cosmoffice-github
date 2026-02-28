'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles, X, Send, Bot, BrainCircuit,
    CheckSquare, ChevronDown, Loader2, MapPin,
} from 'lucide-react';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { useAIAgents, AIMessage } from '../../hooks/useAIAgents';
import { Button } from '../ui/button';

export function AIAssistant() {
    const { isAIPanelOpen, toggleAIPanel, rooms } = useOfficeStore();
    const {
        agents,
        activeAgentId,
        setActiveAgentId,
        messages,
        isLoading,
        sendMessage,
        assignToRoom,
    } = useAIAgents();

    const [input, setInput] = useState('');
    const [showAgentPicker, setShowAgentPicker] = useState(false);
    const [showRoomPicker, setShowRoomPicker] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const activeAgent = agents.find((a) => a.id === activeAgentId);
    const currentMessages = activeAgentId ? messages[activeAgentId] || [] : [];

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentMessages]);

    // Focus input when panel opens
    useEffect(() => {
        if (isAIPanelOpen) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isAIPanelOpen]);

    const handleSend = async () => {
        if (!input.trim() || !activeAgentId || isLoading) return;
        const msg = input;
        setInput('');
        await sendMessage(activeAgentId, msg);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleQuickAction = (action: string) => {
        if (!activeAgentId) return;
        sendMessage(activeAgentId, action);
    };

    return (
        <AnimatePresence>
            {isAIPanelOpen && (
                <motion.div
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
                    className="absolute top-0 right-0 w-[340px] h-full z-50 flex flex-col overflow-hidden"
                    style={{
                        background: 'rgba(8, 12, 24, 0.92)',
                        backdropFilter: 'blur(24px)',
                        borderLeft: '1px solid rgba(99, 102, 241, 0.15)',
                    }}
                >
                    {/* ─── Header ───────────────────────────── */}
                    <div className="p-4 flex items-center justify-between"
                        style={{ borderBottom: '1px solid rgba(99, 102, 241, 0.12)' }}>
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.3))' }}>
                                <Sparkles className="w-4 h-4 text-indigo-400" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-slate-100">AI Assistant</h2>
                                <p className="text-[10px] text-slate-500">
                                    {agents.length} agent{agents.length !== 1 ? 's' : ''} available
                                </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={toggleAIPanel}
                            className="text-slate-400 hover:text-slate-200 w-7 h-7">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* ─── Agent Selector ───────────────────── */}
                    <div className="px-4 py-2" style={{ borderBottom: '1px solid rgba(99, 102, 241, 0.08)' }}>
                        <div className="relative">
                            <button
                                onClick={() => setShowAgentPicker(!showAgentPicker)}
                                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all"
                                style={{
                                    background: 'rgba(99, 102, 241, 0.08)',
                                    border: '1px solid rgba(99, 102, 241, 0.15)',
                                }}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                        style={{
                                            background: activeAgent
                                                ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                                : 'rgba(100, 116, 139, 0.3)',
                                        }}>
                                        <Bot className="w-3 h-3 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-xs font-medium text-slate-200 truncate">
                                            {activeAgent?.display_name || activeAgent?.name || 'Select an agent'}
                                        </div>
                                        {activeAgent && (
                                            <div className="text-[10px] text-slate-500 truncate">
                                                {activeAgent.role} • {activeAgent.provider}/{activeAgent.model}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0 ${showAgentPicker ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Agent dropdown */}
                            <AnimatePresence>
                                {showAgentPicker && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-10"
                                        style={{
                                            background: 'rgba(15, 23, 42, 0.98)',
                                            border: '1px solid rgba(99, 102, 241, 0.2)',
                                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                                        }}
                                    >
                                        {agents.length === 0 ? (
                                            <div className="px-3 py-4 text-center text-xs text-slate-500">
                                                No AI agents configured.<br />
                                                Create one in Settings → AI Agents.
                                            </div>
                                        ) : (
                                            agents.map((agent) => (
                                                <button
                                                    key={agent.id}
                                                    onClick={() => {
                                                        setActiveAgentId(agent.id);
                                                        setShowAgentPicker(false);
                                                    }}
                                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-indigo-500/10 ${activeAgentId === agent.id ? 'bg-indigo-500/15' : ''}`}
                                                >
                                                    <div
                                                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                                        style={{
                                                            background: agent.status === 'responding'
                                                                ? 'linear-gradient(135deg, #f59e0b, #f97316)'
                                                                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                        }}
                                                    >
                                                        <Bot className="w-3 h-3 text-white" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-xs font-medium text-slate-200 truncate">
                                                            {agent.display_name || agent.name}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 truncate">
                                                            {agent.type} • {agent.status}
                                                        </div>
                                                    </div>
                                                    {agent.status === 'responding' && (
                                                        <Loader2 className="w-3 h-3 text-amber-400 animate-spin flex-shrink-0" />
                                                    )}
                                                </button>
                                            ))
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Room assignment */}
                        {activeAgent && (
                            <div className="mt-2 relative">
                                <button
                                    onClick={() => setShowRoomPicker(!showRoomPicker)}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                                    style={{ background: 'rgba(100, 116, 139, 0.1)' }}
                                >
                                    <MapPin className="w-3 h-3" />
                                    {activeAgent.current_room_id
                                        ? rooms.find((r) => r.id === activeAgent.current_room_id)?.name || 'Room'
                                        : 'Assign to room'}
                                </button>

                                <AnimatePresence>
                                    {showRoomPicker && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            className="absolute top-full left-0 mt-1 rounded-lg overflow-hidden z-10 min-w-[180px]"
                                            style={{
                                                background: 'rgba(15, 23, 42, 0.98)',
                                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                                            }}
                                        >
                                            <button
                                                onClick={() => {
                                                    assignToRoom(activeAgent.id, null);
                                                    setShowRoomPicker(false);
                                                }}
                                                className="w-full px-3 py-2 text-left text-[11px] text-slate-400 hover:bg-indigo-500/10"
                                            >
                                                ✕ Unassign
                                            </button>
                                            {rooms.map((room) => (
                                                <button
                                                    key={room.id}
                                                    onClick={() => {
                                                        assignToRoom(activeAgent.id, room.id);
                                                        setShowRoomPicker(false);
                                                    }}
                                                    className={`w-full px-3 py-2 text-left text-[11px] hover:bg-indigo-500/10 ${activeAgent.current_room_id === room.id ? 'text-indigo-400' : 'text-slate-300'}`}
                                                >
                                                    {room.name}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>

                    {/* ─── Messages ─────────────────────────── */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar">
                        {currentMessages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-4">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                                    style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))' }}>
                                    <BrainCircuit className="w-6 h-6 text-indigo-400/70" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-slate-400">Start a conversation</p>
                                    <p className="text-[10px] text-slate-600 mt-1">
                                        {activeAgent
                                            ? `Ask ${activeAgent.name} anything, or use a quick action below.`
                                            : 'Select an AI agent to begin.'}
                                    </p>
                                </div>

                                {/* Quick actions */}
                                <div className="grid grid-cols-1 gap-1.5 w-full mt-2">
                                    <button
                                        onClick={() => handleQuickAction('Generate a summary of the current meeting discussion')}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all text-[11px]"
                                        style={{
                                            background: 'rgba(99, 102, 241, 0.06)',
                                            border: '1px solid rgba(99, 102, 241, 0.12)',
                                        }}
                                    >
                                        <BrainCircuit className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                                        <span className="text-slate-300">Generate Summary</span>
                                    </button>
                                    <button
                                        onClick={() => handleQuickAction('Extract action items and tasks from our discussion')}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all text-[11px]"
                                        style={{
                                            background: 'rgba(16, 185, 129, 0.06)',
                                            border: '1px solid rgba(16, 185, 129, 0.12)',
                                        }}
                                    >
                                        <CheckSquare className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                        <span className="text-slate-300">Extract Action Items</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {currentMessages.map((msg: AIMessage) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${msg.role === 'user'
                                        ? 'text-white'
                                        : 'text-slate-200'
                                        }`}
                                    style={{
                                        background:
                                            msg.role === 'user'
                                                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.5), rgba(139, 92, 246, 0.4))'
                                                : 'rgba(30, 41, 59, 0.6)',
                                        border:
                                            msg.role === 'user'
                                                ? '1px solid rgba(99, 102, 241, 0.3)'
                                                : '1px solid rgba(100, 116, 139, 0.15)',
                                    }}
                                >
                                    {msg.content.split('\n').map((line, i) => (
                                        <React.Fragment key={i}>
                                            {line}
                                            {i < msg.content.split('\n').length - 1 && <br />}
                                        </React.Fragment>
                                    ))}
                                    <div className="text-[9px] text-slate-500 mt-1">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </motion.div>
                        ))}

                        {isLoading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-2 text-xs text-slate-500"
                            >
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>{activeAgent?.name || 'AI'} is thinking...</span>
                            </motion.div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* ─── Input ────────────────────────────── */}
                    <div className="p-3" style={{ borderTop: '1px solid rgba(99, 102, 241, 0.1)' }}>
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={activeAgent ? `Message ${activeAgent.name}...` : 'Select an agent first'}
                                disabled={!activeAgent || isLoading}
                                className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-600 outline-none px-3 py-2.5 rounded-lg"
                                style={{
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    border: '1px solid rgba(99, 102, 241, 0.12)',
                                }}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || !activeAgent || isLoading}
                                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                                style={{
                                    background: input.trim() && activeAgent
                                        ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                        : 'rgba(100, 116, 139, 0.15)',
                                }}
                            >
                                <Send className="w-3.5 h-3.5 text-white" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
