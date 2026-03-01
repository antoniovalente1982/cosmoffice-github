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
    remoteAudioEnabled?: boolean; // Whether the user can hear others (headphones on/off)
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
    myRole: 'owner' | 'admin' | 'member' | 'guest' | null;

    // Camera/View state
    stagePos: { x: number; y: number };

    // Peers state
    peers: Record<string, Peer>;

    // Rooms and Connections
    activeSpaceId?: string;
    rooms: Room[];
    roomConnections: RoomConnection[];

    // UI State
    isSettingsOpen: boolean;
    activeTab: 'office';
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
    isGridViewOpen: boolean; // Fullscreen video grid view

    // Daily.co error state
    dailyError: string | null;

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
    setMyRole: (role: 'owner' | 'admin' | 'member' | 'guest' | null) => void;
    updatePeer: (id: string, data: Partial<Peer>) => void;
    removePeer: (id: string) => void;
    toggleSettings: () => void;
    togglePerformanceMode: () => void;
    setActiveTab: (tab: 'office') => void;
    toggleMic: () => Promise<void>;
    toggleVideo: () => Promise<void>;
    setScreenSharing: (isSharing: boolean) => void;
    toggleRemoteAudio: () => void;  // Toggle hearing other users
    toggleGridView: () => void;  // Toggle fullscreen grid view
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
    setDailyError: (error: string | null) => void;
    clearDailyError: () => void;
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
    myRole: null,
    stagePos: { x: 0, y: 0 },
    peers: {},
    activeSpaceId: undefined,
    rooms: [],
    roomConnections: [],
    isSettingsOpen: false,
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
    isPerformanceMode: typeof window !== 'undefined' ? localStorage.getItem('isPerformanceMode') === 'true' : false,
    isGridViewOpen: false,
    dailyError: null,

    // Builder defaults
    isBuilderMode: false,
    bgOpacity: 0.8,
    officeWidth: 4000,
    officeHeight: 3000,
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

    setMyPosition: (position) => {
        const peers = get().peers;
        const AVATAR_RADIUS = 25; // Half of 50px minimum distance between avatar centers
        let resolved = { ...position };

        // Resolve collisions with all peers (push out if overlapping)
        const peerList = Object.values(peers);
        // Run up to 3 iterations to handle multi-peer collisions
        for (let iter = 0; iter < 3; iter++) {
            let pushed = false;
            for (const peer of peerList) {
                if (!peer.position) continue;
                const dx = resolved.x - peer.position.x;
                const dy = resolved.y - peer.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = AVATAR_RADIUS * 2;

                if (dist < minDist && dist > 0.01) {
                    // Push outward along the collision vector
                    const overlap = minDist - dist;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    resolved.x += nx * overlap;
                    resolved.y += ny * overlap;
                    pushed = true;
                } else if (dist <= 0.01) {
                    // Exactly on top — push in a random-ish direction
                    resolved.x += minDist * 0.7;
                    resolved.y += minDist * 0.7;
                    pushed = true;
                }
            }
            if (!pushed) break;
        }

        set({ myPosition: resolved });
    },
    setMyStatus: (status) => set({ myStatus: status }),
    setMyRoom: (roomId) => set({ myRoomId: roomId }),
    setMyProfile: (myProfile) => set({ myProfile }),
    setMyRole: (myRole) => set({ myRole }),

    updatePeer: (id, data) => {
        const current = get().peers[id];
        if (current) {
            // Shallow compare: skip update if nothing changed
            const keys = Object.keys(data) as (keyof typeof data)[];
            const changed = keys.some(k => {
                const oldVal = (current as any)[k];
                const newVal = data[k];
                // Special case: position object — compare x/y
                if (k === 'position' && oldVal && newVal && typeof oldVal === 'object' && typeof newVal === 'object') {
                    return (oldVal as any).x !== (newVal as any).x || (oldVal as any).y !== (newVal as any).y;
                }
                return oldVal !== newVal;
            });
            if (!changed) return; // Nothing changed, skip re-render
        }
        set((state) => ({
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
        }));
    },

    removePeer: (id) => set((state) => {
        const { [id]: removed, ...rest } = state.peers;
        return { peers: rest };
    }),

    toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
    togglePerformanceMode: () => set((state) => {
        const newValue = !state.isPerformanceMode;
        if (typeof window !== 'undefined') {
            localStorage.setItem('isPerformanceMode', String(newValue));
        }
        return { isPerformanceMode: newValue };
    }),
    setActiveTab: (tab) => set({ activeTab: tab, isSettingsOpen: false }),
    // Camera/mic hardware is managed by Daily.co (useDaily.ts).
    // These toggles just set the flag — useDaily syncs it to call.setLocalVideo/Audio().
    toggleMic: async () => {
        set((state) => ({ isMicEnabled: !state.isMicEnabled }));
    },
    toggleVideo: async () => {
        set((state) => ({ isVideoEnabled: !state.isVideoEnabled }));
    },
    setScreenSharing: (isScreenSharing) => set({ isScreenSharing }),
    toggleRemoteAudio: () => set((state) => ({ isRemoteAudioEnabled: !state.isRemoteAudioEnabled })),
    toggleGridView: () => set((state) => ({ isGridViewOpen: !state.isGridViewOpen })),
    setDailyError: (error) => set({ dailyError: error }),
    clearDailyError: () => set({ dailyError: null }),
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
    setActiveSpace: (activeSpaceId) => {
        const current = get().activeSpaceId;
        if (current === activeSpaceId) return; // same space, no reset needed
        // Reset all space-specific state when switching offices
        set({
            activeSpaceId,
            rooms: [],
            roomConnections: [],
            peers: {},
            furnitureItems: [],
            myPosition: { x: 500, y: 500 },
            myRoomId: undefined,
            stagePos: { x: 0, y: 0 },
            zoom: 1,
            isBuilderMode: false,
            selectedRoomId: null,
            officeWidth: 4000,
            officeHeight: 3000,
            bgOpacity: 0.8,
        });
    },
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
