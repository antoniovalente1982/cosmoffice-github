'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, MessageSquare, DoorOpen,
    Mic, MicOff, Video, VideoOff,
    LogOut, Monitor, ChevronRight,
} from 'lucide-react';
import { useAvatarStore, Peer } from '../../stores/avatarStore';
import { useMediaStore } from '../../stores/mediaStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';

type TabId = 'rooms' | 'team' | 'chat';

interface MobileOfficeViewProps {
    workspaceName: string;
    spaceId: string;
    userId: string;
    onLeave: () => void;
    onEnterRoom: (roomId: string) => void;
    onLeaveRoom: () => void;
    activeTab: TabId;
    setActiveTab: (tab: TabId) => void;
}

export function MobileOfficeView({
    workspaceName,
    spaceId,
    userId,
    onLeave,
    onEnterRoom,
    onLeaveRoom,
    activeTab,
    setActiveTab,
}: MobileOfficeViewProps) {
    const peers = useAvatarStore(s => s.peers);
    const myRoomId = useAvatarStore(s => s.myRoomId);
    const rooms = useWorkspaceStore(s => s.rooms);
    const isAudioOn = useMediaStore(s => s.isAudioOn);
    const isVideoOn = useMediaStore(s => s.isVideoOn);
    const toggleAudio = useMediaStore(s => s.toggleAudio);
    const toggleVideo = useMediaStore(s => s.toggleVideo);

    const onlinePeers = useMemo(() =>
        Object.values(peers).filter((p: Peer) => p.status !== 'offline'),
    [peers]);

    const tabs = [
        { id: 'rooms' as TabId, icon: DoorOpen, label: 'Stanze' },
        { id: 'team' as TabId, icon: Users, label: 'Team' },
        { id: 'chat' as TabId, icon: MessageSquare, label: 'Chat' },
    ];

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-white safe-area-inset">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-white/5 backdrop-blur-md">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center text-xs font-bold">
                        {workspaceName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-sm font-bold text-white truncate">{workspaceName}</h1>
                        <p className="text-[10px] text-slate-400">{onlinePeers.length} online</p>
                    </div>
                </div>
                <button
                    onClick={onLeave}
                    className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                </button>
            </header>

            {/* Current Room Bar (if in a room) */}
            <AnimatePresence>
                {myRoomId && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <DoorOpen className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-xs font-semibold text-emerald-300">
                                {rooms.find(r => r.id === myRoomId)?.name || 'Stanza'}
                            </span>
                        </div>
                        <button
                            onClick={onLeaveRoom}
                            className="text-[10px] font-bold text-emerald-400/70 hover:text-emerald-300 transition-colors"
                        >
                            Esci
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'rooms' && (
                    <div className="p-4 space-y-2">
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                            Stanze ({rooms.length})
                        </h2>
                        {rooms.map(room => {
                            const peersInRoom = onlinePeers.filter(p => p.roomId === room.id);
                            const isCurrentRoom = myRoomId === room.id;
                            return (
                                <motion.button
                                    key={room.id}
                                    onClick={() => isCurrentRoom ? onLeaveRoom() : onEnterRoom(room.id)}
                                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                                        isCurrentRoom
                                            ? 'bg-emerald-500/10 border-emerald-500/20'
                                            : 'bg-slate-800/30 border-white/5 hover:bg-slate-800/50'
                                    }`}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                            isCurrentRoom
                                                ? 'bg-emerald-500/20'
                                                : 'bg-slate-700/50'
                                        }`}>
                                            <DoorOpen className={`w-5 h-5 ${isCurrentRoom ? 'text-emerald-400' : 'text-slate-400'}`} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-semibold text-slate-200">{room.name}</p>
                                            <p className="text-[10px] text-slate-500">
                                                {peersInRoom.length > 0
                                                    ? `${peersInRoom.length} present${peersInRoom.length > 1 ? 'i' : 'e'}`
                                                    : 'Vuota'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {peersInRoom.length > 0 && (
                                            <div className="flex -space-x-1.5">
                                                {peersInRoom.slice(0, 3).map(p => (
                                                    <div key={p.id} className="w-6 h-6 rounded-full bg-slate-600 border-2 border-slate-900 flex items-center justify-center text-[8px] font-bold text-slate-300"
                                                        style={{ backgroundImage: p.avatar_url ? `url(${p.avatar_url})` : undefined, backgroundSize: 'cover' }}
                                                    >
                                                        {!p.avatar_url && (p.full_name || p.email || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <ChevronRight className="w-4 h-4 text-slate-600" />
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'team' && (
                    <div className="p-4 space-y-2">
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                            Online ({onlinePeers.length})
                        </h2>
                        {onlinePeers.map(peer => (
                            <div key={peer.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-800/30 border border-white/5">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300"
                                        style={{ backgroundImage: peer.avatar_url ? `url(${peer.avatar_url})` : undefined, backgroundSize: 'cover' }}
                                    >
                                        {!peer.avatar_url && (peer.full_name || peer.email || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${
                                        peer.status === 'busy' ? 'bg-red-500'
                                        : peer.status === 'away' ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                                    }`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-200 truncate">{peer.full_name || peer.email || 'Anonimo'}</p>
                                    <p className="text-[10px] text-slate-500">
                                        {peer.roomId
                                            ? rooms.find(r => r.id === peer.roomId)?.name || 'In stanza'
                                            : 'Nell\'ufficio'}
                                    </p>
                                </div>
                                <span className="text-[10px] font-bold text-slate-600 uppercase">{peer.role || 'member'}</span>
                            </div>
                        ))}
                        {onlinePeers.length === 0 && (
                            <p className="text-center text-sm text-slate-500 py-8">Nessuno online</p>
                        )}
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="p-4 flex items-center justify-center h-full text-center">
                        <div>
                            <MessageSquare className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                            <p className="text-sm text-slate-400 font-medium">Chat disponibile</p>
                            <p className="text-xs text-slate-600 mt-1">Usa la chat del pannello laterale</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Media Controls */}
            <div className="flex items-center justify-center gap-3 px-4 py-3 bg-slate-900/90 border-t border-white/5 backdrop-blur-md">
                <button
                    onClick={toggleAudio}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        isAudioOn
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                >
                    {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                <button
                    onClick={toggleVideo}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        isVideoOn
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-700/50 text-slate-400 border border-slate-600/30'
                    }`}
                >
                    {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
                <button
                    className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-700/50 text-slate-400 border border-slate-600/30 opacity-50 cursor-not-allowed"
                    title="Screen sharing non disponibile su mobile"
                >
                    <Monitor className="w-5 h-5" />
                </button>
            </div>

            {/* Tab Bar */}
            <nav className="flex items-center justify-around px-2 py-2 bg-slate-900/95 border-t border-white/5 backdrop-blur-md pb-safe">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${
                            activeTab === tab.id
                                ? 'text-primary-400'
                                : 'text-slate-500'
                        }`}
                    >
                        <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-primary-400' : ''}`} />
                        <span className="text-[10px] font-bold">{tab.label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
}
