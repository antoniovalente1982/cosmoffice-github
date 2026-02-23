'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Users,
    MessageSquare,
    Settings,
    LogOut,
    Mic,
    Video,
    Monitor,
    Map as MapIcon,
    Bell,
    Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { KonvaOffice } from '@/components/office/KonvaOffice';
import { VideoGrid } from '@/components/media/VideoGrid';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { TeamList } from '@/components/office/TeamList';
import { useOfficeStore } from '@/stores/useOfficeStore';

export default function OfficePage() {
    const supabase = createClient();
    const router = useRouter();
    const { toggleChat } = useOfficeStore();
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
                    <Button variant="ghost" className="w-full justify-start gap-3 bg-primary-500/10 text-primary-400">
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
                    <KonvaOffice />
                    <VideoGrid />

                    {/* Bottom Controls */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-4 rounded-full glass border border-slate-700/50 shadow-2xl z-50">
                        <Button variant="secondary" size="icon" className="rounded-full w-12 h-12"><Mic className="w-5 h-5" /></Button>
                        <Button variant="secondary" size="icon" className="rounded-full w-12 h-12"><Video className="w-5 h-5" /></Button>
                        <Button variant="secondary" size="icon" className="rounded-full w-12 h-12 text-primary-400"><Monitor className="w-5 h-5" /></Button>
                        <div className="w-px h-8 bg-slate-700 mx-2"></div>
                        <Button className="rounded-full px-6 bg-red-500 hover:bg-red-600" onClick={handleSignOut}>Leave Room</Button>
                    </div>
                </div>
                <ChatWindow />
            </main>
        </div>
    );
}
