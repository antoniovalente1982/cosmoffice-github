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
}

interface OfficeState {
    // Current user state
    myPosition: UserPosition;
    myStatus: 'online' | 'away' | 'busy' | 'offline';

    // Peers state
    peers: Record<string, Peer>;

    // UI State
    isChatOpen: boolean;
    isSettingsOpen: boolean;
    zoom: number;

    // Actions
    setMyPosition: (position: UserPosition) => void;
    setMyStatus: (status: 'online' | 'away' | 'busy' | 'offline') => void;
    updatePeer: (id: string, data: Partial<Peer>) => void;
    removePeer: (id: string) => void;
    toggleChat: () => void;
    toggleSettings: () => void;
    setZoom: (zoom: number) => void;
}

export const useOfficeStore = create<OfficeState>((set) => ({
    myPosition: { x: 500, y: 500 }, // Default center
    myStatus: 'online',
    peers: {},
    isChatOpen: false,
    isSettingsOpen: false,
    zoom: 1,

    setMyPosition: (position) => set({ myPosition: position }),
    setMyStatus: (status) => set({ myStatus: status }),

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

    toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
    toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
    setZoom: (zoom) => set({ zoom }),
}));
