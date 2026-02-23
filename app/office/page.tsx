'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
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
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
// Dynamically import client-heavy components with SSR disabled
const KonvaOffice = dynamic(() => import('../../components/office/KonvaOffice').then(mod => mod.KonvaOffice), { ssr: false });
const VideoGrid = dynamic(() => import('../../components/media/VideoGrid').then(mod => mod.VideoGrid), { ssr: false });
const MediaManager = dynamic(() => import('../../components/media/MediaManager').then(mod => mod.MediaManager), { ssr: false });
const ChatWindow = dynamic(() => import('../../components/chat/ChatWindow').then(mod => mod.ChatWindow), { ssr: false });
const AIAssistant = dynamic(() => import('../../components/ai/AIAssistant').then(mod => mod.AIAssistant), { ssr: false });
const OfficeAnalytics = dynamic(() => import('../../components/office/OfficeAnalytics').then(mod => mod.OfficeAnalytics), { ssr: false });
const GamificationSystem = dynamic(() => import('../../components/office/GamificationSystem').then(mod => mod.GamificationSystem), { ssr: false });
const TeamList = dynamic(() => import('../../components/office/TeamList').then(mod => mod.TeamList), { ssr: false });

import { useOfficeStore } from '../../stores/useOfficeStore';

export default function OfficePage() {
    const supabase = createClient();
    const router = useRouter();
    const {
        toggleChat, toggleAIPanel, isAIPanelOpen, activeTab, setActiveTab,
        isMicEnabled, isVideoEnabled, isScreenSharing,
        toggleMic, toggleVideo, toggleScreenShare
    } = useOfficeStore();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
            } else {
                setUser(user);
            }
            setLoading(false);
        };
        getUser();
    }, [supabase, router]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dark-bg">
                <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-dark-bg overflow-hidden text-slate-100">
            {/* Sidebar */}
            <aside className="w-64 border-r border-slate-700/50 flex flex-col glass z-20">
                <div className="p-6 border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">C</span>
                        </div>
                        <span className="text-lg font-semibold">Cosmoffice</span>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <Button
                        variant="ghost"
                        className={`w-full justify-start gap-3 transition-colors ${activeTab === 'office' ? 'bg-primary-500/10 text-primary-400' : 'text-slate-400 hover:text-slate-100'}`}
                        onClick={() => setActiveTab('office')}
                    >
                        <MapIcon className="w-5 h-5" /> Virtual Office
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-3 text-slate-400 hover:text-slate-100">
                        <Users className="w-5 h-5" /> Team members
                    </Button>
                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 text-slate-400 hover:text-slate-100"
                        onClick={toggleChat}
                    >
                        <MessageSquare className="w-5 h-5" /> Chat
                    </Button>
                    <Button
                        variant="ghost"
                        className={`w-full justify-start gap-3 transition-colors ${isAIPanelOpen ? 'bg-primary-500/10 text-primary-400' : 'text-slate-400 hover:text-slate-100'}`}
                        onClick={toggleAIPanel}
                    >
                        <Sparkles className="w-5 h-5" /> AI Assistant
                    </Button>
                    <Button
                        variant="ghost"
                        className={`w-full justify-start gap-3 transition-colors ${activeTab === 'analytics' ? 'bg-primary-500/10 text-primary-400' : 'text-slate-400 hover:text-slate-100'}`}
                        onClick={() => setActiveTab('analytics')}
                    >
                        <BarChart3 className="w-5 h-5" /> Analytics
                    </Button>
                    <Button
                        variant="ghost"
                        className={`w-full justify-start gap-3 transition-colors ${activeTab === 'badges' ? 'bg-primary-500/10 text-primary-400' : 'text-slate-400 hover:text-slate-100'}`}
                        onClick={() => setActiveTab('badges')}
                    >
                        <Trophy className="w-5 h-5" /> Badges
                    </Button>

                    <TeamList />
                </nav>

                <div className="p-4 border-t border-slate-700/50">
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/30 transition-colors group">
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold uppercase ring-2 ring-primary-500/20">
                            {user?.email?.[0] || 'U'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium truncate">{user?.user_metadata?.full_name || 'Anonymous'}</p>
                            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                        </div>
                        <button onClick={handleSignOut} className="text-slate-500 hover:text-red-400 transition-colors">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 relative flex flex-col">
                {/* Top Header */}
                <header className="h-16 border-b border-slate-700/50 flex items-center justify-between px-8 glass-dark z-10">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search office..."
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" className="text-slate-400"><Bell className="w-5 h-5" /></Button>
                        <Button variant="ghost" size="icon" className="text-slate-400"><Settings className="w-5 h-5" /></Button>
                    </div>
                </header>

                {/* Office Stage (Konva Environment) */}
                <div className="flex-1 relative bg-dark-bg overflow-hidden flex items-center justify-center">
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
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-4 rounded-full glass border border-slate-700/50 shadow-2xl z-50">
                            <Button
                                variant={isMicEnabled ? "secondary" : "default"}
                                size="icon"
                                className={`rounded-full w-12 h-12 ${!isMicEnabled && 'bg-red-500 hover:bg-red-600'}`}
                                onClick={toggleMic}
                            >
                                {isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                            </Button>
                            <Button
                                variant={isVideoEnabled ? "secondary" : "default"}
                                size="icon"
                                className={`rounded-full w-12 h-12 ${!isVideoEnabled && 'bg-red-500 hover:bg-red-600'}`}
                                onClick={toggleVideo}
                            >
                                {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                            </Button>
                            <Button
                                variant="secondary"
                                size="icon"
                                className={`rounded-full w-12 h-12 ${isScreenSharing ? 'text-primary-400 bg-primary-500/10' : 'text-slate-400'}`}
                                onClick={toggleScreenShare}
                            >
                                <Monitor className="w-5 h-5" />
                            </Button>
                            <div className="w-px h-8 bg-slate-700 mx-2"></div>
                            <Button className="rounded-full px-6 bg-red-400/10 text-red-400 border border-red-400/20 hover:bg-red-400/20" onClick={handleSignOut}>Leave Room</Button>
                        </div>
                    )}
                </div>
                <ChatWindow />
                <AIAssistant />
            </main>
        </div>
    );
}
