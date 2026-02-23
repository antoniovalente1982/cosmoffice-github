'use client';

import { motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface UserAvatarProps {
    id: string;
    fullName?: string;
    position: { x: number; y: number };
    status: 'online' | 'away' | 'busy' | 'offline';
    isMe?: boolean;
    audioEnabled?: boolean;
    videoEnabled?: boolean;
}

export function UserAvatar({
    fullName,
    position,
    status,
    isMe,
    audioEnabled = false,
    videoEnabled = false
}: UserAvatarProps) {
    const initials = fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';

    const statusColors = {
        online: 'bg-emerald-500',
        away: 'bg-amber-500',
        busy: 'bg-red-500',
        offline: 'bg-slate-500'
    };

    return (
        <motion.div
            initial={false}
            animate={{
                x: position.x,
                y: position.y
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute z-30"
            style={{ marginLeft: -24, marginTop: -24 }}
        >
            <div className="relative group flex flex-col items-center">
                {/* Name Tag */}
                <div className="absolute -top-10 px-2 py-1 rounded bg-slate-900/80 border border-slate-700 backdrop-blur whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-medium text-slate-100 italic">
                        {fullName} {isMe && '(You)'}
                    </span>
                </div>

                {/* Avatar Circle */}
                <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg
                    ${isMe ? 'ring-4 ring-primary-500 ring-offset-4 ring-offset-transparent' : 'ring-2 ring-slate-700'}
                    bg-gradient-to-br from-slate-600 to-slate-800 shadow-xl relative overflow-hidden
                `}>
                    {initials}

                    {/* Media Indicators overlay */}
                    <div className="absolute inset-0 bg-black/20 flex items-end justify-center pb-1 gap-1">
                        {audioEnabled ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5 text-red-400" />}
                        {videoEnabled ? <Video className="w-2.5 h-2.5" /> : <VideoOff className="w-2.5 h-2.5 text-red-400" />}
                    </div>
                </div>

                {/* Status Dot */}
                <div className={`
                    absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-900
                    ${statusColors[status] || statusColors.offline}
                `} />
            </div>
        </motion.div>
    );
}
