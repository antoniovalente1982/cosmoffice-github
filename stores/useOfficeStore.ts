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
    isSpeaking: boolean;
    localStream: MediaStream | null;
    screenStreams: MediaStream[];  // Supporto per multipli schermi
    
    // Device Selection
    selectedAudioInput: string | null;  // deviceId del microfono
    selectedAudioOutput: string | null;  // deviceId dell'audio in uscita
    selectedVideoInput: string | null;  // deviceId della webcam
    availableDevices: MediaDeviceInfo[];
    hasCompletedDeviceSetup: boolean;  // Se l'utente ha completato la configurazione iniziale
    
    // Audio State
    isRemoteAudioEnabled: boolean;  // Mute/unmute audio from other users

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
    setScreenSharing: (isSharing: boolean) => void;
    toggleRemoteAudio: () => void;  // Toggle hearing other users
    addScreenStream: (stream: MediaStream) => void;
    removeScreenStream: (streamId: string) => void;
    clearAllScreenStreams: () => void;
    
    // Device Actions
    setSelectedAudioInput: (deviceId: string | null) => void;
    setSelectedAudioOutput: (deviceId: string | null) => void;
    setSelectedVideoInput: (deviceId: string | null) => void;
    setAvailableDevices: (devices: MediaDeviceInfo[]) => void;
    refreshDevices: () => Promise<void>;
    setHasCompletedDeviceSetup: (completed: boolean) => void;
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
    // Default: all media OFF when entering - user must enable manually
    isMicEnabled: false,
    isVideoEnabled: false,
    isScreenSharing: false,
    isSpeaking: false,
    localStream: null,
    screenStreams: [],
    
    // Device defaults (verranno impostati dopo il setup)
    selectedAudioInput: null,
    selectedAudioOutput: null,
    selectedVideoInput: null,
    availableDevices: [],
    hasCompletedDeviceSetup: false,
    isRemoteAudioEnabled: true,  // Default: hear others (can be muted for focus mode)

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
    setScreenSharing: (isScreenSharing) => set({ isScreenSharing }),
    toggleRemoteAudio: () => set((state) => ({ isRemoteAudioEnabled: !state.isRemoteAudioEnabled })),
    addScreenStream: (stream) => set((state) => ({ 
        screenStreams: [...state.screenStreams, stream],
        isScreenSharing: true 
    })),
    removeScreenStream: (streamId) => set((state) => {
        const newStreams = state.screenStreams.filter(s => s.id !== streamId);
        return { 
            screenStreams: newStreams,
            isScreenSharing: newStreams.length > 0
        };
    }),
    clearAllScreenStreams: () => set((state) => {
        state.screenStreams.forEach(stream => {
            stream.getTracks().forEach(track => track.stop());
        });
        return { screenStreams: [], isScreenSharing: false };
    }),
    
    // Device Actions
    setSelectedAudioInput: (deviceId) => set({ selectedAudioInput: deviceId }),
    setSelectedAudioOutput: (deviceId) => set({ selectedAudioOutput: deviceId }),
    setSelectedVideoInput: (deviceId) => set({ selectedVideoInput: deviceId }),
    setAvailableDevices: (devices) => set({ availableDevices: devices }),
    refreshDevices: async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            set({ availableDevices: devices });
        } catch (err) {
            console.error('Failed to enumerate devices:', err);
        }
    },
    setHasCompletedDeviceSetup: (completed) => set({ hasCompletedDeviceSetup: completed }),
    setSpeaking: (isSpeaking) => set({ isSpeaking }),
    setLocalStream: (localStream) => set({ localStream }),
    setZoom: (zoom) => set({ zoom }),
    setActiveSpace: (activeSpaceId) => set({ activeSpaceId }),
    setRooms: (rooms) => set({ rooms }),
    setRoomConnections: (roomConnections) => set({ roomConnections }),
}));
