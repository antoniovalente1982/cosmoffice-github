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
}

interface Room {
    id: string;
    name: string;
    type: 'open_space' | 'meeting' | 'focus' | 'social';
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
}

interface OfficeState {
    // Current user state
    myPosition: UserPosition;
    myStatus: 'online' | 'away' | 'busy' | 'offline';
    myRoomId?: string;

    // Peers state
    peers: Record<string, Peer>;

    // Rooms
    rooms: Room[];

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

    // Actions
    setMyPosition: (position: UserPosition) => void;
    setMyStatus: (status: 'online' | 'away' | 'busy' | 'offline') => void;
    setMyRoom: (roomId?: string) => void;
    updatePeer: (id: string, data: Partial<Peer>) => void;
    removePeer: (id: string) => void;
    toggleChat: () => void;
    toggleSettings: () => void;
    toggleAIPanel: () => void;
    setActiveTab: (tab: 'office' | 'analytics' | 'badges') => void;
    toggleMic: () => void;
    toggleVideo: () => void;
    toggleScreenShare: () => void;
    setZoom: (zoom: number) => void;
}

export const useOfficeStore = create<OfficeState>((set) => ({
    myPosition: { x: 500, y: 500 }, // Default center
    myStatus: 'online',
    myRoomId: 'open-space',
    peers: {},
    rooms: [
        { id: 'open-space', name: 'Open Space', type: 'open_space', x: 100, y: 100, width: 800, height: 600, color: '#1e293b' },
        { id: 'meeting-1', name: 'Meeting Room A', type: 'meeting', x: 1000, y: 100, width: 400, height: 300, color: '#1e3a8a' },
        { id: 'focus-zone', name: 'Focus Zone', type: 'focus', x: 1000, y: 500, width: 400, height: 400, color: '#312e81' },
    ],
    isChatOpen: false,
    isSettingsOpen: false,
    isAIPanelOpen: false,
    activeTab: 'office',
    zoom: 1,
    isMicEnabled: true,
    isVideoEnabled: true,
    isScreenSharing: false,

    setMyPosition: (position) => set({ myPosition: position }),
    setMyStatus: (status) => set({ myStatus: status }),
    setMyRoom: (roomId) => set({ myRoomId: roomId }),

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
    toggleScreenShare: () => set((state) => ({ isScreenSharing: !state.isScreenSharing })),
    setZoom: (zoom) => set({ zoom }),
}));
