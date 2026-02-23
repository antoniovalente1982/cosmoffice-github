'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { MicOff, Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface VideoTileProps {
    id: string;
    stream?: MediaStream;
    fullName: string;
    isMe?: boolean;
    audioEnabled?: boolean;
}

function VideoTile({ stream, fullName, isMe, audioEnabled }: VideoTileProps) {
    const videoRef = (el: HTMLVideoElement | null) => {
        if (el && stream) el.srcObject = stream;
    };

    return (
        <Card className="relative aspect-video bg-slate-900 overflow-hidden flex items-center justify-center border-slate-700 group">
            {stream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isMe}
                    className="w-full h-full object-cover mirror"
                    style={{ transform: isMe ? 'scaleX(-1)' : 'none' }}
                />
            ) : (
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-2xl uppercase">
                    {fullName[0]}
                </div>
            )}

            <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <div className="bg-black/40 backdrop-blur px-2 py-1 rounded text-[10px] font-medium text-white flex items-center gap-1.5 border border-white/10">
                    {fullName} {isMe && '(You)'}
                </div>
                {!audioEnabled && (
                    <div className="bg-red-500/80 backdrop-blur p-1 rounded border border-red-400/20">
                        <MicOff className="w-3 h-3 text-white" />
                    </div>
                )}
            </div>

            <button className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 hover:bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Settings className="w-3.5 h-3.5 text-white/70" />
            </button>
        </Card>
    );
}

export function VideoGrid() {
    // This will eventually consume the media store
    const participants = [
        { id: 'me', fullName: 'Antonio Valente', isMe: true, audioEnabled: true },
        // Dummy data for visual layout
        { id: '2', fullName: 'AI Assistant', isMe: false, audioEnabled: false },
    ];

    return (
        <div className="absolute top-6 right-6 w-80 space-y-4 pointer-events-auto z-40">
            <AnimatePresence>
                {participants.map((p, i) => (
                    <motion.div
                        key={p.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: i * 0.1 }}
                    >
                        <VideoTile {...p} />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
