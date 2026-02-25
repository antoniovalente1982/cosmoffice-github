import { create } from 'zustand';

interface UserPosition {
    x: number;
    y: number;
}

interface Peer {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
    position: UserPosition;
    status: 'online' | 'away' | 'busy' | 'offline';
    last_seen: string;
    roomId?: string;
    audioEnabled?: boolean;
    videoEnabled?: boolean;
    isSpeaking?: boolean;
}

interface Room {
    id: string;
    space_id: string;
    name: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    is_secret: boolean;
    settings: any;
}

interface RoomConnection {
    id: string;
    space_id: string;
    room_a_id: string;
    room_b_id: string;
    type: 'portal' | 'door';
    x_a: number;
    y_a: number;
    x_b: number;
    y_b: number;
    settings: any;
}

interface OfficeState {
    // Current user state
    myPosition: UserPosition;
    myStatus: 'online' | 'away' | 'busy' | 'offline';
    myRoomId?: string;
    myProfile: any;

    // Peers state
    peers: Record<string, Peer>;

    // Rooms and Connections
    activeSpaceId?: string;
    rooms: Room[];
    roomConnections: RoomConnection[];

    // UI State
    isChatOpen: boolean;
    isSettingsOpen: boolean;
    isAIPanelOpen: boolean;
    activeTab: 'office' | 'analytics' | 'badges';
    zoom: number;

    // Media State
    isMicEnabled: boolean;
    isVideoEnabled: boolean;
    isScreenSharing: boolean;
    isSystemAudioEnabled: boolean;
    isSpeaking: boolean;
    localStream: MediaStream | null;
    screenStream: MediaStream | null;

    // Actions
    setMyPosition: (position: UserPosition) => void;
    setMyStatus: (status: 'online' | 'away' | 'busy' | 'offline') => void;
    setMyRoom: (roomId?: string) => void;
    setMyProfile: (profile: any) => void;
    updatePeer: (id: string, data: Partial<Peer>) => void;
    removePeer: (id: string) => void;
    toggleChat: () => void;
    toggleSettings: () => void;
    toggleAIPanel: () => void;
    setActiveTab: (tab: 'office' | 'analytics' | 'badges') => void;
    toggleMic: () => void;
    toggleVideo: () => void;
    startScreenShare: () => Promise<void>;
    stopScreenShare: () => void;
    toggleSystemAudio: () => void;
    setSpeaking: (isSpeaking: boolean) => void;
    setLocalStream: (stream: MediaStream | null) => void;
    setZoom: (zoom: number) => void;
    setActiveSpace: (spaceId: string) => void;
    setRooms: (rooms: Room[]) => void;
    setRoomConnections: (connections: RoomConnection[]) => void;
}

export const useOfficeStore = create<OfficeState>((set) => ({
    myPosition: { x: 500, y: 500 }, // Default center
    myStatus: 'online',
    myRoomId: undefined,
    myProfile: null,
    peers: {},
    activeSpaceId: undefined,
    rooms: [],
    roomConnections: [],
    isChatOpen: false,
    isSettingsOpen: false,
    isAIPanelOpen: false,
    activeTab: 'office',
    zoom: 1,
    isMicEnabled: true,
    isVideoEnabled: true,
    isScreenSharing: false,
    isSystemAudioEnabled: true,
    isSpeaking: false,
    localStream: null,
    screenStream: null,

    setMyPosition: (position) => set({ myPosition: position }),
    setMyStatus: (status) => set({ myStatus: status }),
    setMyRoom: (roomId) => set({ myRoomId: roomId }),
    setMyProfile: (myProfile) => set({ myProfile }),

    updatePeer: (id, data) => set((state) => ({
        peers: {
            ...state.peers,
            [id]: {
                ...(state.peers[id] || {
                    id,
                    email: '',
                    position: { x: 0, y: 0 },
                    status: 'online',
                    last_seen: new Date().toISOString()
                }),
                ...data,
            }
        }
    })),

    removePeer: (id) => set((state) => {
        const { [id]: removed, ...rest } = state.peers;
        return { peers: rest };
    }),

    toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen, isSettingsOpen: false, isAIPanelOpen: false })),
    toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen, isChatOpen: false, isAIPanelOpen: false })),
    toggleAIPanel: () => set((state) => ({ isAIPanelOpen: !state.isAIPanelOpen, isChatOpen: false, isSettingsOpen: false })),
    setActiveTab: (tab) => set({ activeTab: tab, isChatOpen: false, isSettingsOpen: false, isAIPanelOpen: false }),
    toggleMic: () => set((state) => ({ isMicEnabled: !state.isMicEnabled })),
    toggleVideo: () => set((state) => ({ isVideoEnabled: !state.isVideoEnabled })),
    startScreenShare: async () => {
        try {
            const state = useOfficeStore.getState();
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: state.isSystemAudioEnabled
            });
            
            // Handle user clicking "Stop sharing" in browser UI
            screenStream.getVideoTracks()[0]?.addEventListener('ended', () => {
                set({ isScreenSharing: false, screenStream: null });
            });
            
            set({ isScreenSharing: true, screenStream });
        } catch (err) {
            console.error('Failed to start screen sharing:', err);
            set({ isScreenSharing: false, screenStream: null });
        }
    },
    stopScreenShare: () => set((state) => {
        if (state.screenStream) {
            state.screenStream.getTracks().forEach(track => track.stop());
        }
        return { isScreenSharing: false, screenStream: null };
    }),
    toggleSystemAudio: () => set((state) => {
        // If screen sharing is active, restart with new audio setting
        if (state.isScreenSharing && state.screenStream) {
            state.screenStream.getTracks().forEach(track => track.stop());
            // Will need to restart screen share with new audio setting
            setTimeout(() => {
                useOfficeStore.getState().startScreenShare();
            }, 0);
        }
        return { isSystemAudioEnabled: !state.isSystemAudioEnabled };
    }),
    setSpeaking: (isSpeaking) => set({ isSpeaking }),
    setLocalStream: (localStream) => set({ localStream }),
    setZoom: (zoom) => set({ zoom }),
    setActiveSpace: (activeSpaceId) => set({ activeSpaceId }),
    setRooms: (rooms) => set({ rooms }),
    setRoomConnections: (roomConnections) => set({ roomConnections }),
}));
