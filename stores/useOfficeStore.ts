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
    stream?: MediaStream | null; // Daily.co remote video stream
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

interface FurnitureItem {
    id: string;
    room_id: string;
    type: string;
    label?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    settings: any;
}

interface RoomTemplate {
    name: string;
    type: string;
    department?: string;
    width: number;
    height: number;
    color: string;
    icon: string;
    capacity: number;
}

interface OfficeState {
    // Current user state
    myPosition: UserPosition;
    myStatus: 'online' | 'away' | 'busy' | 'offline';
    myRoomId?: string;
    myProfile: any;

    // Camera/View state
    stagePos: { x: number; y: number };

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
    isPerformanceMode: boolean; // Disables expensive CSS and limits videos for older PCs

    // Builder State
    isBuilderMode: boolean;
    bgOpacity: number;
    officeWidth: number;
    officeHeight: number;
    selectedRoomId: string | null;
    furnitureItems: FurnitureItem[];
    roomTemplates: RoomTemplate[];

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
    togglePerformanceMode: () => void;
    setActiveTab: (tab: 'office' | 'analytics' | 'badges') => void;
    toggleMic: () => Promise<void>;
    toggleVideo: () => Promise<void>;
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
    setStagePos: (stagePos: { x: number; y: number }) => void;
    setActiveSpace: (spaceId: string) => void;
    setRooms: (rooms: Room[]) => void;
    setRoomConnections: (connections: RoomConnection[]) => void;

    // Builder Actions
    toggleBuilderMode: () => void;
    setSelectedRoom: (roomId: string | null) => void;
    addRoom: (room: Room) => void;
    updateRoomPosition: (roomId: string, x: number, y: number) => void;
    updateRoomSize: (roomId: string, width: number, height: number) => void;
    removeRoom: (roomId: string) => void;
    setFurnitureItems: (items: FurnitureItem[]) => void;
    addFurniture: (item: FurnitureItem) => void;
    updateFurniture: (id: string, data: Partial<FurnitureItem>) => void;
    removeFurniture: (id: string) => void;
    setBgOpacity: (val: number) => void;
    setOfficeDimensions: (width: number, height: number) => void;
}

export const useOfficeStore = create<OfficeState>((set, get) => ({
    myPosition: { x: 500, y: 500 }, // Default center
    myStatus: 'online',
    myRoomId: undefined,
    myProfile: null,
    stagePos: { x: 0, y: 0 },
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
    isPerformanceMode: typeof window !== 'undefined' ? localStorage.getItem('isPerformanceMode') === 'true' : false, // Default high performance

    // Builder defaults
    isBuilderMode: false,
    bgOpacity: 0.8,
    officeWidth: 4000,
    officeHeight: 4000,
    selectedRoomId: null,
    furnitureItems: [],
    roomTemplates: [
        { name: 'Open Space', type: 'open', width: 400, height: 300, color: '#3b82f6', icon: '🏢', capacity: 20 },
        { name: 'Meeting Room', type: 'meeting', width: 250, height: 200, color: '#8b5cf6', icon: '🤝', capacity: 8 },
        { name: 'Focus Zone', type: 'focus', width: 150, height: 150, color: '#06b6d4', icon: '🎯', capacity: 4 },
        { name: 'Break Room', type: 'break', width: 200, height: 180, color: '#10b981', icon: '☕', capacity: 10 },
        { name: 'Reception', type: 'reception', width: 300, height: 150, color: '#f59e0b', icon: '🛎️', capacity: 5 },
        { name: 'Dev Team', type: 'open', department: 'engineering', width: 350, height: 280, color: '#14b8a6', icon: '💻', capacity: 15 },
        { name: 'Marketing', type: 'open', department: 'marketing', width: 300, height: 250, color: '#a855f7', icon: '📊', capacity: 12 },
        { name: 'Sales', type: 'open', department: 'sales', width: 300, height: 250, color: '#ef4444', icon: '📞', capacity: 12 },
        { name: 'Design Studio', type: 'open', department: 'design', width: 300, height: 250, color: '#f97316', icon: '🎨', capacity: 10 },
    ],

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

    toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen, isAIPanelOpen: state.isChatOpen ? state.isAIPanelOpen : false })),
    toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
    toggleAIPanel: () => set((state) => ({ isAIPanelOpen: !state.isAIPanelOpen, isChatOpen: state.isAIPanelOpen ? state.isChatOpen : false })),
    togglePerformanceMode: () => set((state) => {
        const newValue = !state.isPerformanceMode;
        if (typeof window !== 'undefined') {
            localStorage.setItem('isPerformanceMode', String(newValue));
        }
        return { isPerformanceMode: newValue };
    }),
    setActiveTab: (tab) => set({ activeTab: tab, isChatOpen: false, isSettingsOpen: false, isAIPanelOpen: false }),
    toggleMic: async () => {
        const state = get();
        const newMicEnabled = !state.isMicEnabled;

        if (newMicEnabled) {
            // Turning ON — acquire mic if no audio track exists
            const currentStream = state.localStream;
            const existingAudio = currentStream?.getAudioTracks()[0];
            if (existingAudio && existingAudio.readyState === 'live') {
                existingAudio.enabled = true;
                set({ isMicEnabled: true });
            } else {
                try {
                    const audioConstraints = state.selectedAudioInput && state.selectedAudioInput !== 'default'
                        ? { deviceId: { exact: state.selectedAudioInput } }
                        : true;
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
                    const newAudioTrack = stream.getAudioTracks()[0];
                    if (newAudioTrack) {
                        // Merge into existing stream or create new one
                        if (currentStream) {
                            currentStream.addTrack(newAudioTrack);
                            set({ isMicEnabled: true, localStream: new MediaStream(currentStream.getTracks()) });
                        } else {
                            set({ isMicEnabled: true, localStream: stream });
                        }
                    }
                } catch (err) {
                    console.error('Failed to access microphone:', err);
                }
            }
        } else {
            // Turning OFF — stop all audio tracks to release hardware
            const currentStream = state.localStream;
            if (currentStream) {
                currentStream.getAudioTracks().forEach(t => t.stop());
                // Keep video tracks if any
                const remainingTracks = currentStream.getVideoTracks().filter(t => t.readyState === 'live');
                set({
                    isMicEnabled: false,
                    localStream: remainingTracks.length > 0 ? new MediaStream(remainingTracks) : null,
                });
            } else {
                set({ isMicEnabled: false });
            }
        }
    },
    toggleVideo: async () => {
        const state = get();
        const newVideoEnabled = !state.isVideoEnabled;

        if (newVideoEnabled) {
            // Turning ON — acquire camera
            try {
                const videoConstraints: MediaStreamConstraints['video'] = state.selectedVideoInput && state.selectedVideoInput !== 'default'
                    ? { deviceId: { exact: state.selectedVideoInput }, width: { ideal: 1280 }, height: { ideal: 720 } }
                    : { width: { ideal: 1280 }, height: { ideal: 720 } };

                const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
                const newVideoTrack = stream.getVideoTracks()[0];
                if (newVideoTrack) {
                    const currentStream = state.localStream;
                    if (currentStream) {
                        currentStream.addTrack(newVideoTrack);
                        set({ isVideoEnabled: true, localStream: new MediaStream(currentStream.getTracks()) });
                    } else {
                        set({ isVideoEnabled: true, localStream: stream });
                    }
                }
            } catch (err: any) {
                console.error('Failed to access camera:', err);
                let msg = 'Impossibile accedere alla telecamera.';
                if (err.name === 'NotReadableError') msg = 'La telecamera è in uso da un\'altra applicazione.';
                else if (err.name === 'NotAllowedError') msg = 'Permesso negato per la telecamera.';
                else if (err.name === 'NotFoundError') msg = 'Telecamera non trovata.';
                alert(msg);
            }
        } else {
            // Turning OFF — STOP all video tracks to fully release camera hardware
            const currentStream = state.localStream;
            if (currentStream) {
                currentStream.getVideoTracks().forEach(t => t.stop());
                // Keep audio tracks if any
                const remainingTracks = currentStream.getAudioTracks().filter(t => t.readyState === 'live');
                set({
                    isVideoEnabled: false,
                    localStream: remainingTracks.length > 0 ? new MediaStream(remainingTracks) : null,
                });
            } else {
                set({ isVideoEnabled: false });
            }
        }
    },
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
    setStagePos: (stagePos) => set({ stagePos }),
    setActiveSpace: (activeSpaceId) => set({ activeSpaceId }),
    setRooms: (rooms) => set({ rooms }),
    setRoomConnections: (roomConnections) => set({ roomConnections }),

    // Builder Actions
    toggleBuilderMode: () => set((state) => ({ isBuilderMode: !state.isBuilderMode, selectedRoomId: null })),
    setSelectedRoom: (roomId) => set({ selectedRoomId: roomId }),
    addRoom: (room) => set((state) => ({ rooms: [...state.rooms, room] })),
    updateRoomPosition: (roomId, x, y) => set((state) => ({
        rooms: state.rooms.map(r => r.id === roomId ? { ...r, x, y } : r)
    })),
    updateRoomSize: (roomId, width, height) => set((state) => ({
        rooms: state.rooms.map(r => r.id === roomId ? { ...r, width, height } : r)
    })),
    removeRoom: (roomId) => set((state) => ({
        rooms: state.rooms.filter(r => r.id !== roomId),
        selectedRoomId: state.selectedRoomId === roomId ? null : state.selectedRoomId,
        furnitureItems: state.furnitureItems.filter(f => f.room_id !== roomId)
    })),
    setFurnitureItems: (items) => set({ furnitureItems: items }),
    addFurniture: (item) => set((state) => ({ furnitureItems: [...state.furnitureItems, item] })),
    updateFurniture: (id, data) => set((state) => ({
        furnitureItems: state.furnitureItems.map(f => f.id === id ? { ...f, ...data } : f)
    })),
    removeFurniture: (id) => set((state) => ({ furnitureItems: state.furnitureItems.filter(f => f.id !== id) })),
    setBgOpacity: (bgOpacity) => set({ bgOpacity }),
    setOfficeDimensions: (officeWidth, officeHeight) => set({ officeWidth, officeHeight }),
}));
