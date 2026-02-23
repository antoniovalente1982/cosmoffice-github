'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, MessageSquare, CheckSquare, BrainCircuit, Play, Pause } from 'lucide-react';
import { useOfficeStore } from '@/stores/useOfficeStore';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

export function AIAssistant() {
    const { isAIPanelOpen, toggleAIPanel } = useOfficeStore();
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState<string[]>([
        "System: AI Assistant is ready to summarize your meeting.",
        "Antonio: Let's discuss the new Konva.js implementation.",
        "AI: The Konva migration will improve rendering performance by 10x."
    ]);

    useEffect(() => {
        if (isListening) {
            const interval = setInterval(() => {
                const dummyLines = [
                    "Discussing spatial audio dampening...",
                    "Analyzing peer connection stability...",
                    "Updating the roadmap for Q2...",
                    "User moved to Meeting Room A."
                ];
                setTranscript(prev => [...prev.slice(-10), `Live: ${dummyLines[Math.floor(Math.random() * dummyLines.length)]}`]);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [isListening]);

    return (
        <AnimatePresence>
            {isAIPanelOpen && (
                <motion.div
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    className="absolute top-0 right-0 w-80 h-full border-l border-slate-700/50 glass-dark z-50 flex flex-col"
                >
                    <div className="p-4 border-b border-slate-700/50 flex items-center justify-between bg-primary-500/5">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-primary-400" />
                            <h2 className="font-semibold text-slate-100">AI Meeting Assistant</h2>
                        </div>
                        <Button variant="ghost" size="icon" onClick={toggleAIPanel}>
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div className="bg-slate-800/40 rounded-xl p-4 border border-primary-500/20">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-primary-400 uppercase tracking-wider">Live Transcription</span>
                                <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`} />
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {transcript.map((line, i) => (
                                    <p key={i} className="text-sm text-slate-300 leading-relaxed">
                                        {line}
                                    </p>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-slate-500 uppercase px-1">Smart Actions</h3>
                            <div className="grid grid-cols-1 gap-2">
                                <Button variant="ghost" className="justify-start gap-3 h-auto py-3 bg-slate-800/20 hover:bg-slate-800/40">
                                    <BrainCircuit className="w-4 h-4 text-purple-400" />
                                    <div className="text-left">
                                        <div className="text-sm font-medium">Generate Summary</div>
                                        <div className="text-[10px] text-slate-500 italic">Create a quick recap of the session</div>
                                    </div>
                                </Button>
                                <Button variant="ghost" className="justify-start gap-3 h-auto py-3 bg-slate-800/20 hover:bg-slate-800/40">
                                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                                    <div className="text-left">
                                        <div className="text-sm font-medium">Extract Action Items</div>
                                        <div className="text-[10px] text-slate-500 italic">Find all tasks mentioned</div>
                                    </div>
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-700/50 bg-slate-800/20">
                        <Button
                            className={`w-full gap-2 ${isListening ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-primary-500 text-white'}`}
                            onClick={() => setIsListening(!isListening)}
                        >
                            {isListening ? (
                                <><Pause className="w-4 h-4" /> Stop Listening</>
                            ) : (
                                <><Play className="w-4 h-4" /> Start AI Assistant</>
                            )}
                        </Button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
