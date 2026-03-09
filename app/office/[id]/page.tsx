'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '../../../utils/supabase/client';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    Users,
    LogOut,
    Mic,
    MicOff,
    Video,
    VideoOff,
    Monitor,
    MonitorStop,
    VolumeX,
    Headphones,
    SlidersHorizontal,
    Wrench,
    Circle,
    UserPlus,
    Grid3X3,
    MessageCircle,
    PenTool,
    UsersRound,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Logo } from '../../../components/ui/logo';
// Dynamically import client-heavy components with SSR disabled
const PixiOffice = dynamic(() => import('../../../components/office/PixiOffice').then(mod => mod.PixiOffice), { ssr: false });
const VideoGrid = dynamic(() => import('../../../components/media/VideoGrid').then(mod => mod.VideoGrid), { ssr: false });
const MediaManager = dynamic(() => import('../../../components/media/MediaManager').then(mod => mod.MediaManager), { ssr: false });
const DailyErrorToast = dynamic(() => import('../../../components/media/DailyErrorToast'), { ssr: false });
const CallRequestModal = dynamic(() => import('../../../components/office/CallRequestModal'), { ssr: false });
const CallResponseToast = dynamic(() => import('../../../components/office/CallResponseToast'), { ssr: false });
const TeamList = dynamic(() => import('../../../components/office/TeamList').then(mod => mod.TeamList), { ssr: false });
const OfficeManagement = dynamic(() => import('../../../components/office/OfficeManagement'), { ssr: false });
const DeviceSettings = dynamic(() => import('../../../components/settings/DeviceSettings').then(mod => mod.DeviceSettings), { ssr: false });
const OfficeBuilder = dynamic(() => import('../../../components/office/OfficeBuilder').then(mod => mod.OfficeBuilder), { ssr: false });
const InvitePanel = dynamic(() => import('../../../components/office/InvitePanel'), { ssr: false });
const FullscreenGrid = dynamic(() => import('../../../components/media/FullscreenGrid').then(mod => mod.FullscreenGrid), { ssr: false });
const RoomChat = dynamic(() => import('../../../components/office/RoomChat').then(mod => mod.RoomChat), { ssr: false });
const Whiteboard = dynamic(() => import('../../../components/office/Whiteboard').then(mod => mod.Whiteboard), { ssr: false });
const DayNightCycle = dynamic(() => import('../../../components/office/DayNightCycle').then(mod => mod.DayNightCycle), { ssr: false });
const NotificationBell = dynamic(() => import('../../../components/office/NotificationBell'), { ssr: false });
const UserManagement = dynamic(() => import('../../../components/office/UserManagement'), { ssr: false });

import { useAvatarStore } from '../../../stores/avatarStore';
import { useDailyStore } from '../../../stores/dailyStore';
import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { useChatStore } from '../../../stores/chatStore';
import { useWhiteboardStore } from '../../../stores/whiteboardStore';
import { useOffice } from '../../../hooks/useOffice';
import { useWorkspaceRole, getWorkspaceIdFromSpace } from '../../../hooks/useWorkspaceRole';
import { useAvatarSync } from '../../../hooks/useAvatarSync';

// LiveKitManager singleton — manages LiveKit WebRTC lifecycle
const LiveKitManager = dynamic(() => import('../../../components/media/LiveKitManager').then(mod => ({ default: mod.LiveKitManager })), { ssr: false });

export default function OfficePage() {
    const supabase = createClient();
    const router = useRouter();

    // Daily store
    const isMicEnabled = useDailyStore(s => s.isAudioOn);
    const isVideoEnabled = useDailyStore(s => s.isVideoOn);
    const isScreenSharing = useDailyStore(s => s.isScreenSharing);
    const isRemoteAudioEnabled = useDailyStore(s => s.isRemoteAudioEnabled);
    const screenStreams = useDailyStore(s => s.screenStreams);
    const hasCompletedDeviceSetup = useDailyStore(s => s.hasCompletedDeviceSetup);
    const toggleMic = useDailyStore(s => s.toggleAudio);
    const toggleVideo = useDailyStore(s => s.toggleVideo);
    const toggleRemoteAudio = useDailyStore(s => s.toggleRemoteAudio);
    const addScreenStream = useDailyStore(s => s.addScreenStream);
    const clearAllScreenStreams = useDailyStore(s => s.clearAllScreenStreams);
    const isGridViewOpen = useDailyStore(s => s.isGridViewOpen);
    const toggleGridView = useDailyStore(s => s.toggleGridView);
    const isConnected = useDailyStore(s => s.isConnected);
    const activeContext = useDailyStore(s => s.activeContext);

    // Avatar store
    const myStatus = useAvatarStore(s => s.myStatus);
    const setMyStatus = useAvatarStore(s => s.setMyStatus);

    // Chat store
    const isChatOpen = useChatStore(s => s.isOpen);
    const chatUnread = useChatStore(s => s.unreadCount);
    const officeChatUnread = useChatStore(s => s.officeUnreadCount);
    const toggleChat = useChatStore(s => s.toggleChat);
    const totalChatUnread = chatUnread + officeChatUnread;

    // Whiteboard store
    const isWhiteboardOpen = useWhiteboardStore(s => s.isOpen);
    const toggleWhiteboard = useWhiteboardStore(s => s.toggleWhiteboard);
    const whiteboardActiveDrawers = useWhiteboardStore(s => s.activeDrawers);
    const wbActiveCount = whiteboardActiveDrawers.size;

    // Toast for no-proximity feedback
    const [mediaToast, setMediaToast] = useState<string | null>(null);
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showMediaToast = useCallback((msg: string) => {
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setMediaToast(msg);
        toastTimeoutRef.current = setTimeout(() => setMediaToast(null), 3500);
    }, []);

    // Smart toggle with proximity check
    // Check if there are other people in my room or in proximity
    const hasPeopleNearby = useCallback(() => {
        const { myProximityGroupId, myRoomId, peers } = useAvatarStore.getState();
        // Proximity aura detected someone
        if (myProximityGroupId) return true;
        // In a room with other people
        if (myRoomId) {
            const peersInRoom = Object.values(peers).filter((p: any) => p.roomId === myRoomId);
            return peersInRoom.length > 0;
        }
        return false;
    }, []);

    // ─── Auto-disable mic/cam when going "busy" ─────────────
    useEffect(() => {
        if (myStatus === 'busy') {
            const ds = useDailyStore.getState();
            if (ds.isAudioOn) {
                toggleMic();
            }
            if (ds.isVideoOn) {
                toggleVideo();
            }
            showMediaToast('🔴 Sei in modalità Occupato — microfono e webcam disattivati');
        }
    }, [myStatus, toggleMic, toggleVideo, showMediaToast]);

    const smartToggleMic = useCallback(async () => {
        const ds = useDailyStore.getState();
        if (ds.isAudioOn) {
            // Always allow turning OFF
            await toggleMic();
            return;
        }
        // Block if busy
        if (myStatus === 'busy') {
            showMediaToast('🔴 Cambia stato da "Occupato" per riattivare il microfono');
            return;
        }
        if (!hasPeopleNearby()) {
            showMediaToast('⚠️ Avvicinati a qualcuno o entra in una stanza con altre persone per usare il microfono');
            return;
        }
        await toggleMic();
    }, [toggleMic, showMediaToast, hasPeopleNearby, myStatus]);

    const smartToggleVideo = useCallback(async () => {
        const ds = useDailyStore.getState();
        if (ds.isVideoOn) {
            await toggleVideo();
            return;
        }
        // Block if busy
        if (myStatus === 'busy') {
            showMediaToast('🔴 Cambia stato da "Occupato" per riattivare la webcam');
            return;
        }
        if (!hasPeopleNearby()) {
            showMediaToast('⚠️ Avvicinati a qualcuno o entra in una stanza con altre persone per usare la webcam');
            return;
        }
        await toggleVideo();
    }, [toggleVideo, showMediaToast, hasPeopleNearby, myStatus]);

    const smartStartScreenShare = useCallback(async () => {
        if (!hasPeopleNearby()) {
            showMediaToast('⚠️ Avvicinati a qualcuno o entra in una stanza con altre persone per condividere lo schermo');
            return;
        }
        const room = (window as any).__livekitRoom;
        if (room?.localParticipant) {
            try {
                // Check LiveKit's actual state (not just our store) to avoid stale flags
                let actuallySharing = false;
                room.localParticipant.trackPublications.forEach((pub: any) => {
                    if (pub.source === 'screen_share' && pub.track) {
                        actuallySharing = true;
                    }
                });

                if (actuallySharing) {
                    // Stop sharing
                    await room.localParticipant.setScreenShareEnabled(false);
                    useDailyStore.getState().clearAllScreenStreams();
                } else {
                    // If store thinks we're sharing but LiveKit doesn't, clear stale state first
                    if (useDailyStore.getState().isScreenSharing) {
                        useDailyStore.getState().clearAllScreenStreams();
                    }
                    // Start sharing
                    await room.localParticipant.setScreenShareEnabled(true);
                }
            } catch (err: any) {
                // User cancelled the screen share picker — not an error
                if (err?.message?.includes('Permission denied') || err?.message?.includes('cancelled')) return;
                console.error('Screen share failed:', err);
                // Reset state on error so next attempt works
                useDailyStore.getState().clearAllScreenStreams();
                showMediaToast('⚠️ Screen share fallito, riprova');
            }
        } else {
            showMediaToast('⚠️ Connessione LiveKit non disponibile — attiva prima il microfono');
        }
    }, [showMediaToast, hasPeopleNearby]);

    // Workspace store
    const activeTab = useWorkspaceStore(s => s.activeTab);

    const setActiveSpace = useWorkspaceStore(s => s.setActiveSpace);
    const isBuilderMode = useWorkspaceStore(s => s.isBuilderMode);
    const toggleBuilderMode = useWorkspaceStore(s => s.toggleBuilderMode);
    const params = useParams();
    const spaceId = params.id as string;

    // Set active space FIRST — this resets store when switching offices
    useEffect(() => {
        if (spaceId) setActiveSpace(spaceId);
    }, [spaceId, setActiveSpace]);

    // Then fetch and sync data for this space
    useOffice(spaceId);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isManagementOpen, setIsManagementOpen] = useState(false);
    const [isDeviceSettingsOpen, setIsDeviceSettingsOpen] = useState(false);
    const [showInitialSetup, setShowInitialSetup] = useState(false);
    const [isInvitePanelOpen, setIsInvitePanelOpen] = useState(false);
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);
    const [workspaceName, setWorkspaceName] = useState('');
    const [workspaceLogoUrl, setWorkspaceLogoUrl] = useState<string | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);


    // Avatar sync via PartyKit
    const myProfile = useAvatarStore(s => s.myProfile);
    const { sendPosition, sendJoinRoom } = useAvatarSync({
        workspaceId: spaceId,
        userId: user?.id || '',
        userName: myProfile?.display_name || myProfile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.display_name || 'Ospite',
        email: user?.email || '',
        avatarUrl: myProfile?.avatar_url || null,
        status: myStatus,
        role: useAvatarStore.getState().myRole || null,
    });

    // Expose sendPosition so PixiOffice can call it when avatar moves
    useEffect(() => {
        (window as any).__sendAvatarPosition = sendPosition;
        (window as any).__sendJoinRoom = sendJoinRoom;
        (window as any).__activeSpaceId = spaceId;
        return () => {
            delete (window as any).__sendAvatarPosition;
            delete (window as any).__sendJoinRoom;
            delete (window as any).__activeSpaceId;
        };
    }, [sendPosition, sendJoinRoom, spaceId]);

    // Fetch workspace ID from space
    useEffect(() => {
        getWorkspaceIdFromSpace(spaceId).then(id => setWorkspaceId(id));
        // Fetch workspace name
        const fetchWsInfo = async () => {
            const supabaseClient = createClient();
            const { data: spaceData } = await supabaseClient.from('spaces').select('workspace_id').eq('id', spaceId).single();
            if (spaceData?.workspace_id) {
                const { data: ws } = await supabaseClient.from('workspaces').select('name, logo_url').eq('id', spaceData.workspace_id).single();
                if (ws) {
                    setWorkspaceName(ws.name);
                    setWorkspaceLogoUrl(ws.logo_url || null);
                }
            }
        };
        fetchWsInfo();
    }, [spaceId]);

    // Role-based access
    const { isAdmin, role, canInvite, invitableRoles } = useWorkspaceRole(workspaceId);

    // Check if current user is super admin
    useEffect(() => {
        const checkSuperAdmin = async () => {
            const { data: { user: u } } = await supabase.auth.getUser();
            if (!u) return;
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_super_admin')
                .eq('id', u.id)
                .single();
            if (profile?.is_super_admin) setIsSuperAdmin(true);
        };
        checkSuperAdmin();
    }, [supabase]);



    // Sync role into store for PixiOffice/UserAvatar
    useEffect(() => {
        useAvatarStore.getState().setMyRole(role as any);
    }, [role]);

    // Periodic check: detect if current user has been kicked
    useEffect(() => {
        if (!workspaceId || !user) return;
        const interval = setInterval(async () => {
            const { data: membership } = await supabase
                .from('workspace_members')
                .select('removed_at')
                .eq('workspace_id', workspaceId)
                .eq('user_id', user.id)
                .single();

            if (!membership || membership.removed_at) {
                clearInterval(interval);
                alert('Sei stato rimosso da questo workspace.');
                router.push('/');
            }
        }, 10000); // check every 10 seconds
        return () => clearInterval(interval);
    }, [workspaceId, user, supabase, router]);

    // Screen sharing via LiveKit WebRTC
    const startScreenShare = useCallback(async () => {
        try {
            const room = (window as any).__livekitRoom;
            if (room?.localParticipant) {
                await room.localParticipant.setScreenShareEnabled(true);
            } else {
                console.warn('[ScreenShare] LiveKit room not available, falling back to local share');
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: false
                });
                addScreenStream(stream);
            }
        } catch (err) {
            console.error('Failed to start screen sharing:', err);
        }
    }, [addScreenStream]);

    const stopAllScreens = useCallback(() => {
        const room = (window as any).__livekitRoom;
        if (room?.localParticipant) {
            try { room.localParticipant.setScreenShareEnabled(false); } catch { }
        }
        clearAllScreenStreams();
    }, [clearAllScreenStreams]);



    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
            } else {
                setUser(user);

                // Fetch profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    useAvatarStore.getState().setMyProfile(profile);
                }

                // Fetch landing pad position directly from DB (no race condition)
                let padX = 500, padY = 500, padScale = 1;
                const { data: space } = await supabase
                    .from('spaces')
                    .select('layout_data')
                    .eq('id', spaceId)
                    .single();
                if (space?.layout_data) {
                    const ld = space.layout_data as any;
                    if (typeof ld.landingPadX === 'number') padX = ld.landingPadX;
                    if (typeof ld.landingPadY === 'number') padY = ld.landingPadY;
                    if (typeof ld.landingPadScale === 'number') padScale = ld.landingPadScale;
                }

                // Spawn below the spaceship, in the light beam zone
                const offsetX = (Math.random() - 0.5) * 60; // ±30px
                const offsetY = (Math.random() - 0.5) * 40;
                useAvatarStore.getState().setMyPosition({
                    x: padX + offsetX,
                    y: padY + 70 * padScale + offsetY,
                });

                // Controlla se l'utente ha già completato il setup dispositivi
                const hasSetup = useDailyStore.getState().hasCompletedDeviceSetup;
                if (!hasSetup) {
                    setShowInitialSetup(true);
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
            {/* LiveKitManager singleton — manages WebRTC call lifecycle */}
            <LiveKitManager spaceId={spaceId} />
            {/* Sidebar */}
            <motion.aside
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-64 shrink-0 flex flex-col glass z-20 overflow-hidden shadow-2xl"
            >
                <div className="p-6 border-b border-white/5">
                    <Link href="/office" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        {workspaceLogoUrl ? (
                            <img
                                src={workspaceLogoUrl}
                                alt={workspaceName || 'Logo'}
                                className="w-8 h-8 rounded-xl object-contain bg-white/5 border border-white/10"
                            />
                        ) : (
                            <Logo size="sm" showText={false} variant="glow" />
                        )}
                        <span className="text-lg font-bold text-gradient truncate">
                            {workspaceName || 'Cosmoffice'}
                        </span>
                    </Link>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <TeamList spaceId={spaceId} />

                    {/* Gestione Utenti — visible to Owner and Admin */}
                    {(role === 'owner' || role === 'admin') && (
                        <Button
                            variant="ghost"
                            onClick={() => setIsUserManagementOpen(true)}
                            className="w-full justify-start gap-3 transition-all duration-300 hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-300"
                        >
                            <UsersRound className="w-5 h-5 flex-shrink-0" />
                            <span className="whitespace-nowrap">Gestione Utenti</span>
                        </Button>
                    )}
                </nav>

                <div className="p-4 border-t border-white/5 bg-black/10">
                    <div
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer"
                        onClick={() => setIsManagementOpen(true)}
                        title="Apri impostazioni profilo"
                    >
                        <div className="relative">
                            {useAvatarStore.getState().myProfile?.avatar_url ? (
                                <img
                                    src={useAvatarStore.getState().myProfile.avatar_url}
                                    alt="Avatar"
                                    className="w-10 h-10 rounded-full object-cover ring-2 ring-primary-500/30 group-hover:ring-primary-400 transition-all"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold uppercase ring-2 ring-primary-500/30 group-hover:ring-primary-400 transition-all">
                                    {useAvatarStore.getState().myProfile?.display_name?.[0] || useAvatarStore.getState().myProfile?.full_name?.[0] || user?.email?.[0] || 'U'}
                                </div>
                            )}
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${myStatus === 'online' ? 'bg-emerald-400' :
                                myStatus === 'away' ? 'bg-amber-400' :
                                    myStatus === 'busy' ? 'bg-red-400' : 'bg-slate-500'
                                }`} />
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium truncate text-slate-200">
                                {useAvatarStore.getState().myProfile?.display_name || useAvatarStore.getState().myProfile?.full_name || user?.user_metadata?.full_name || 'Ospite'}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleSignOut(); }} className="text-slate-500 hover:text-red-400 transition-colors">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className="flex-1 relative flex flex-col gap-4 min-w-0 overflow-hidden">
                {/* Top Header */}
                <motion.header
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
                    className="h-16 flex items-center justify-between px-6 glass-dark z-10 shrink-0"
                >
                    <div className="flex items-center gap-3 relative">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-sm font-bold text-slate-100">{workspaceName || 'Ufficio'}</span>
                        </div>
                        {canInvite && (
                            <>
                                <button
                                    onClick={() => setIsInvitePanelOpen(!isInvitePanelOpen)}
                                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm ${isInvitePanelOpen
                                        ? 'bg-primary-500/30 text-primary-200 shadow-primary-500/20'
                                        : 'bg-gradient-to-r from-primary-500/20 to-indigo-500/20 text-primary-300 hover:from-primary-500/30 hover:to-indigo-500/30 hover:shadow-primary-500/15 border border-primary-500/20 hover:border-primary-500/40'
                                        }`}
                                    title="Genera link di invito"
                                >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span>Invita</span>
                                </button>
                                <InvitePanel
                                    spaceId={spaceId}
                                    isOpen={isInvitePanelOpen}
                                    onClose={() => setIsInvitePanelOpen(false)}
                                    invitableRoles={invitableRoles}
                                />
                            </>
                        )}
                    </div>

                    {/* Right side: notifications */}
                    <div className="flex items-center gap-2">
                        <NotificationBell />
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
                            <PixiOffice />
                            <DayNightCycle />
                            <MediaManager />
                            <DailyErrorToast />
                            <CallRequestModal />
                            <CallResponseToast />
                            {mediaToast && (
                                <div
                                    className="fixed bottom-28 left-1/2 z-[999]"
                                    style={{
                                        transform: 'translateX(-50%)',
                                        animation: 'mediaToastIn 0.15s ease-out both',
                                    }}
                                >
                                    <div
                                        className="px-5 py-3 rounded-xl border border-amber-500/30 shadow-2xl"
                                        style={{ background: 'rgba(15, 23, 42, 0.97)' }}
                                    >
                                        <span className="text-sm font-medium text-amber-300">{mediaToast}</span>
                                    </div>
                                    <style>{`
                                        @keyframes mediaToastIn {
                                            from { opacity: 0; transform: translateY(8px) scale(0.97); }
                                            to   { opacity: 1; transform: translateY(0) scale(1); }
                                        }
                                    `}</style>
                                </div>
                            )}
                            <VideoGrid />
                            {isBuilderMode && <OfficeBuilder />}
                        </>
                    )}
                </motion.div>

                {/* Bottom Controls — centered via flex (not transform, to avoid Framer Motion conflict) */}
                {activeTab === 'office' && (
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
                            className="pointer-events-auto flex items-center gap-3 px-6 py-3 rounded-full glass border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
                        >
                            {/* Toggle Remote Audio - hear others or focus mode */}
                            <Button
                                variant={isRemoteAudioEnabled ? "secondary" : "default"}
                                size="icon"
                                className={`rounded-full w-12 h-12 transition-all glow-button ${isRemoteAudioEnabled ? 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-200' : 'bg-red-500/80 hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] text-white'}`}
                                onClick={toggleRemoteAudio}
                                title={isRemoteAudioEnabled ? 'Audio in entrata attivo - Clicca per silenziare gli altri' : 'Modalità Focus - Audio degli altri disattivato'}
                            >
                                {isRemoteAudioEnabled ? <Headphones className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                            </Button>

                            <Button
                                variant={isMicEnabled ? "secondary" : "default"}
                                size="icon"
                                className={`rounded-full w-12 h-12 transition-all glow-button ${isMicEnabled ? 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-200' : 'bg-red-500/80 hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] text-white'}`}
                                onClick={smartToggleMic}
                            >
                                {isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                            </Button>
                            <Button
                                variant={isVideoEnabled ? "secondary" : "default"}
                                size="icon"
                                className={`rounded-full w-12 h-12 transition-all glow-button ${isVideoEnabled ? 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-200' : 'bg-red-500/80 hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] text-white'}`}
                                onClick={smartToggleVideo}
                            >
                                {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                            </Button>
                            <Button
                                variant={isScreenSharing ? "default" : "secondary"}
                                size="icon"
                                className={`rounded-full w-12 h-12 transition-all glow-button ${isScreenSharing ? 'bg-primary-500/80 hover:bg-primary-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-200'}`}
                                onClick={isScreenSharing ? stopAllScreens : smartStartScreenShare}
                                title={isScreenSharing ? `Stop tutti gli schermi (${screenStreams.length})` : 'Condividi schermo'}
                            >
                                {isScreenSharing ? <MonitorStop className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                            </Button>

                            {/* Grid View Toggle */}
                            <Button
                                variant={isGridViewOpen ? "default" : "secondary"}
                                size="icon"
                                className={`rounded-full w-12 h-12 transition-all glow-button ${isGridViewOpen ? 'bg-primary-500/80 hover:bg-primary-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-200'}`}
                                onClick={toggleGridView}
                                title={isGridViewOpen ? 'Chiudi vista griglia' : 'Apri vista griglia videocall'}
                            >
                                <Grid3X3 className="w-5 h-5" />
                            </Button>

                            <div className="w-px h-8 bg-white/10 mx-1"></div>

                            {/* Status Selector */}
                            <button
                                onClick={() => {
                                    const states: Array<'online' | 'away' | 'busy'> = ['online', 'away', 'busy'];
                                    const idx = states.indexOf(myStatus as any);
                                    const next = states[(idx + 1) % states.length];
                                    setMyStatus(next);
                                }}
                                className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-700/50 hover:bg-slate-600/50 transition-all text-xs font-medium min-w-[100px] justify-center"
                                title="Cambia stato"
                            >
                                <Circle className={`w-3 h-3 fill-current ${myStatus === 'online' ? 'text-emerald-400' :
                                    myStatus === 'away' ? 'text-amber-400' :
                                        'text-red-400'
                                    }`} />
                                <span className="text-slate-300 w-[60px] text-center">
                                    {myStatus === 'online' ? 'Online' : myStatus === 'away' ? 'Assente' : 'Occupato'}
                                </span>
                            </button>

                            <div className="w-px h-8 bg-white/10 mx-1"></div>

                            {/* Builder Mode Toggle - only for admins */}
                            {isAdmin && (
                                <Button
                                    variant={isBuilderMode ? "default" : "secondary"}
                                    size="icon"
                                    className={`rounded-full w-12 h-12 transition-all glow-button ${isBuilderMode ? 'bg-amber-500/80 hover:bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-200'}`}
                                    onClick={toggleBuilderMode}
                                    title={isBuilderMode ? 'Esci dal Builder' : 'Modifica Ufficio'}
                                >
                                    <Wrench className="w-5 h-5" />
                                </Button>
                            )}

                            {/* Pulsante per aprire la Cabina di Regia */}
                            <Button
                                variant="secondary"
                                size="icon"
                                className="rounded-full w-12 h-12 bg-slate-700/50 hover:bg-indigo-500/50 text-slate-200 hover:text-white transition-all glow-button"
                                onClick={() => setIsDeviceSettingsOpen(true)}
                                title="Cabina di Regia - Cambia dispositivi"
                            >
                                <SlidersHorizontal className="w-5 h-5" />
                            </Button>
                            {/* Whiteboard Toggle */}
                            {(
                                <div className="relative">
                                    <Button
                                        variant={isWhiteboardOpen ? "default" : "secondary"}
                                        size="icon"
                                        className={`rounded-full w-12 h-12 transition-all glow-button ${isWhiteboardOpen ? 'bg-cyan-500/80 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-200'}`}
                                        onClick={toggleWhiteboard}
                                        title={isWhiteboardOpen ? 'Chiudi Lavagna' : 'Apri Lavagna'}
                                    >
                                        <PenTool className="w-5 h-5" />
                                    </Button>
                                    {wbActiveCount > 0 && !isWhiteboardOpen && (
                                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-cyan-500 text-white text-[9px] font-bold flex items-center justify-center px-1 shadow-[0_0_8px_rgba(34,211,238,0.5)] animate-pulse pointer-events-none">
                                            {wbActiveCount}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Chat Toggle */}
                            {(
                                <div className="relative">
                                    <Button
                                        variant={isChatOpen ? "default" : "secondary"}
                                        size="icon"
                                        className={`rounded-full w-12 h-12 transition-all glow-button ${isChatOpen ? 'bg-primary-500/80 hover:bg-primary-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-200'}`}
                                        onClick={toggleChat}
                                        title={isChatOpen ? 'Chiudi Chat' : 'Apri Chat'}
                                    >
                                        <MessageCircle className="w-5 h-5" />
                                    </Button>
                                    {totalChatUnread > 0 && (
                                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1 shadow-[0_0_8px_rgba(239,68,68,0.4)] animate-pulse pointer-events-none">
                                            {totalChatUnread > 99 ? '99+' : totalChatUnread}
                                        </span>
                                    )}
                                </div>
                            )}



                            {(role === 'owner' || isSuperAdmin) ? (
                                <Button className="rounded-full px-6 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all glow-button" onClick={handleLeaveOffice}>Leave Space</Button>
                            ) : (
                                <Button
                                    className="rounded-full px-6 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all glow-button"
                                    onClick={() => window.location.href = 'https://www.cosmoffice.io'}
                                >
                                    Exit
                                </Button>
                            )}
                        </motion.div>
                    </div>
                )}
                {isManagementOpen && <OfficeManagement spaceId={spaceId} onClose={() => setIsManagementOpen(false)} />}

                {/* User Management Panel — visible to Owner/Admin */}
                {workspaceId && (
                    <UserManagement
                        workspaceId={workspaceId}
                        isOpen={isUserManagementOpen}
                        onClose={() => setIsUserManagementOpen(false)}
                    />
                )}

                {/* Fullscreen Video Grid */}
                <FullscreenGrid />

                {/* Cabina di Regia - Accessibile durante la sessione */}
                <DeviceSettings
                    isOpen={isDeviceSettingsOpen}
                    onClose={() => setIsDeviceSettingsOpen(false)}
                />

                {/* Setup Iniziale - Appare solo all'ingresso */}
                <DeviceSettings
                    isOpen={showInitialSetup}
                    onClose={() => setShowInitialSetup(false)}
                    isInitialSetup={true}
                />

                {/* Room Chat via PartyKit */}
                {user && (
                    <RoomChat
                        workspaceId={workspaceId}
                        userId={user.id}
                        userName={myProfile?.display_name || myProfile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.display_name || 'Ospite'}
                        userAvatarUrl={myProfile?.avatar_url || null}
                        isAdmin={isAdmin}
                    />
                )}

                {/* Collaborative Whiteboard */}
                {user && (
                    <Whiteboard
                        workspaceId={workspaceId}
                        userId={user.id}
                        userName={myProfile?.display_name || myProfile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.display_name || 'Ospite'}
                        isAdmin={isAdmin}
                    />
                )}

            </main>
        </div >
    );
}
