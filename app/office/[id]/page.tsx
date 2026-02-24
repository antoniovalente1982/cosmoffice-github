'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '../../../utils/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Users,
    MessageSquare,
    Settings,
    LogOut,
    Mic,
    MicOff,
    Video,
    VideoOff,
    Monitor,
    Map as MapIcon,
    Bell,
    Search,
    Sparkles,
    BarChart3,
    Trophy
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
// Dynamically import client-heavy components with SSR disabled
const KonvaOffice = dynamic(() => import('../../../components/office/KonvaOffice').then(mod => mod.KonvaOffice), { ssr: false });
const VideoGrid = dynamic(() => import('../../../components/media/VideoGrid').then(mod => mod.VideoGrid), { ssr: false });
const MediaManager = dynamic(() => import('../../../components/media/MediaManager').then(mod => mod.MediaManager), { ssr: false });
const ChatWindow = dynamic(() => import('../../../components/chat/ChatWindow').then(mod => mod.ChatWindow), { ssr: false });
const AIAssistant = dynamic(() => import('../../../components/ai/AIAssistant').then(mod => mod.AIAssistant), { ssr: false });
const OfficeAnalytics = dynamic(() => import('../../../components/office/OfficeAnalytics').then(mod => mod.OfficeAnalytics), { ssr: false });
const GamificationSystem = dynamic(() => import('../../../components/office/GamificationSystem').then(mod => mod.GamificationSystem), { ssr: false });
const TeamList = dynamic(() => import('../../../components/office/TeamList').then(mod => mod.TeamList), { ssr: false });
const OfficeManagement = dynamic(() => import('../../../components/office/OfficeManagement'), { ssr: false });

import { useOfficeStore } from '../../../stores/useOfficeStore';
import { useOffice } from '../../../hooks/useOffice';

export default function OfficePage() {
    const supabase = createClient();
    const router = useRouter();
    const {
        toggleChat, toggleAIPanel, isAIPanelOpen, activeTab, setActiveTab,
        isMicEnabled, isVideoEnabled, isScreenSharing,
        toggleMic, toggleVideo, toggleScreenShare,
        setActiveSpace
    } = useOfficeStore();
    const params = useParams();
    const spaceId = params.id as string;

    // Use the office hook to fetch and sync data
    useOffice(spaceId);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isManagementOpen, setIsManagementOpen] = useState(false);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
            } else {
                setUser(user);
                if (spaceId) {
                    setActiveSpace(spaceId);
                }
            }
            setLoading(false);
        };
        getUser();
    }, [supabase, router, spaceId, setActiveSpace]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    const handleLeaveOffice = () => {
        router.push('/office');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dark-bg">
                <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-transparent overflow-hidden text-slate-100 p-4 gap-4">
            {/* Sidebar */}
            <motion.aside
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-64 shrink-0 flex flex-col glass z-20 overflow-hidden shadow-2xl"
            >
                <div className="p-6 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                            <span className="text-white font-bold text-sm">C</span>
                        </div>
                        <span className="text-lg font-bold text-gradient">Cosmoffice</span>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <Button
                        variant="ghost"
                        className={`w-full justify-start gap-3 transition-all duration-300 ${activeTab === 'office' ? 'bg-primary-500/20 text-primary-300 shadow-[inset_0_0_20px_rgba(99,102,241,0.2)]' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`}
                        onClick={() => setActiveTab('office')}
                    >
                        <MapIcon className="w-5 h-5" /> Virtual Office
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-3 text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors">
                        <Users className="w-5 h-5" /> Team members
                    </Button>
                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
                        onClick={toggleChat}
                    >
                        <MessageSquare className="w-5 h-5" /> Chat
                    </Button>
                    <Button
                        variant="ghost"
                        className={`w-full justify-start gap-3 transition-all duration-300 ${isAIPanelOpen ? 'bg-primary-500/20 text-primary-300 shadow-[inset_0_0_20px_rgba(99,102,241,0.2)]' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`}
                        onClick={toggleAIPanel}
                    >
                        <Sparkles className="w-5 h-5" /> AI Assistant
                    </Button>
                    <Button
                        variant="ghost"
                        className={`w-full justify-start gap-3 transition-all duration-300 ${activeTab === 'analytics' ? 'bg-primary-500/20 text-primary-300 shadow-[inset_0_0_20px_rgba(99,102,241,0.2)]' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`}
                        onClick={() => setActiveTab('analytics')}
                    >
                        <BarChart3 className="w-5 h-5" /> Analytics
                    </Button>
                    <Button
                        variant="ghost"
                        className={`w-full justify-start gap-3 transition-all duration-300 ${activeTab === 'badges' ? 'bg-primary-500/20 text-primary-300 shadow-[inset_0_0_20px_rgba(99,102,241,0.2)]' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`}
                        onClick={() => setActiveTab('badges')}
                    >
                        <Trophy className="w-5 h-5" /> Badges
                    </Button>

                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 text-slate-400 hover:text-primary-300 hover:bg-primary-500/5 transition-all"
                        onClick={() => setIsManagementOpen(true)}
                    >
                        <Settings className="w-5 h-5" /> Management
                    </Button>

                    <TeamList />
                </nav>

                <div className="p-4 border-t border-white/5 bg-black/10">
                    <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold uppercase ring-2 ring-primary-500/30 group-hover:ring-primary-400 transition-all">
                            {user?.email?.[0] || 'U'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium truncate text-slate-200">{user?.user_metadata?.full_name || 'Anonymous'}</p>
                            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                        </div>
                        <button onClick={handleSignOut} className="text-slate-500 hover:text-red-400 transition-colors">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className="flex-1 relative flex flex-col gap-4 min-w-0">
                {/* Top Header */}
                <motion.header
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
                    className="h-16 flex items-center justify-between px-6 glass-dark z-10 shrink-0"
                >
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <div className="relative w-full group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search office..."
                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all text-slate-200 placeholder:text-slate-500"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary-300 hover:bg-primary-500/10 transition-colors rounded-full glow-button"><Bell className="w-5 h-5" /></Button>
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary-300 hover:bg-primary-500/10 transition-colors rounded-full glow-button"><Settings className="w-5 h-5" /></Button>
                    </div>
                </motion.header>

                {/* Office Stage (Konva Environment) */}
                <motion.div
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                    className="flex-1 relative bg-slate-900/30 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden flex items-center justify-center shadow-2xl"
                >
                    {activeTab === 'office' && (
                        <>
                            <KonvaOffice />
                            <MediaManager />
                            <VideoGrid />
                        </>
                    )}

                    {activeTab === 'analytics' && (
                        <div className="flex-1 w-full h-full overflow-y-auto">
                            <OfficeAnalytics />
                        </div>
                    )}

                    {activeTab === 'badges' && (
                        <div className="flex-1 w-full h-full overflow-y-auto">
                            <GamificationSystem />
                        </div>
                    )}

                    {/* Bottom Controls */}
                    {activeTab === 'office' && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
                            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-full glass border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50"
                        >
                            <Button
                                variant={isMicEnabled ? "secondary" : "default"}
                                size="icon"
                                className={`rounded-full w-12 h-12 transition-all glow-button ${isMicEnabled ? 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-200' : 'bg-red-500/80 hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] text-white'}`}
                                onClick={toggleMic}
                            >
                                {isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                            </Button>
                            <Button
                                variant={isVideoEnabled ? "secondary" : "default"}
                                size="icon"
                                className={`rounded-full w-12 h-12 transition-all glow-button ${isVideoEnabled ? 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-200' : 'bg-red-500/80 hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] text-white'}`}
                                onClick={toggleVideo}
                            >
                                {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                            </Button>
                            <Button
                                variant="secondary"
                                size="icon"
                                className={`rounded-full w-12 h-12 transition-all glow-button ${isScreenSharing ? 'bg-primary-500/20 text-primary-400 glow-primary' : 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-200'}`}
                                onClick={toggleScreenShare}
                            >
                                <Monitor className="w-5 h-5" />
                            </Button>
                            <div className="w-px h-8 bg-white/10 mx-2"></div>
                            <Button className="rounded-full px-6 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all glow-button" onClick={handleLeaveOffice}>Leave Space</Button>
                        </motion.div>
                    )}
                </motion.div>
                {isManagementOpen && <OfficeManagement spaceId={spaceId} onClose={() => setIsManagementOpen(false)} />}
                <ChatWindow />
                <AIAssistant />
            </main>
        </div>
    );
}
