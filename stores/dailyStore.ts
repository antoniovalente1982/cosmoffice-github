import { create } from 'zustand';

// ============================================
// DAILY STORE — Video/Audio via Daily.co
// Completely isolated from avatar/workspace state
// ============================================

interface DailyParticipant {
    sessionId: string;
    odell: string;
    userName: string;
    audioEnabled: boolean;
    videoEnabled: boolean;
    audioTrack: MediaStreamTrack | null;
    videoTrack: MediaStreamTrack | null;
    supabaseId: string | null;
}

interface DailyState {
    // Participants
    participants: Record<string, DailyParticipant>;

    // Local media state
    isVideoOn: boolean;
    isAudioOn: boolean;
    isSpeaking: boolean;
    localStream: MediaStream | null;

    // Remote audio
    isRemoteAudioEnabled: boolean;

    // Screen sharing
    isScreenSharing: boolean;
    screenStreams: MediaStream[];

    // Grid view
    isGridViewOpen: boolean;

    // Device selection
    selectedAudioInput: string | null;
    selectedAudioOutput: string | null;
    selectedVideoInput: string | null;
    availableDevices: MediaDeviceInfo[];
    hasCompletedDeviceSetup: boolean;

    // Connection state
    isConnected: boolean;
    dailyError: string | null;

    // Actions — participants
    setParticipant: (id: string, data: Partial<DailyParticipant>) => void;
    removeParticipant: (id: string) => void;
    clearParticipants: () => void;

    // Actions — media
    toggleVideo: () => void;
    toggleAudio: () => void;
    setLocalStream: (stream: MediaStream | null) => void;
    setSpeaking: (isSpeaking: boolean) => void;
    toggleRemoteAudio: () => void;
    toggleGridView: () => void;

    // Screen sharing
    setScreenSharing: (isSharing: boolean) => void;
    addScreenStream: (stream: MediaStream) => void;
    removeScreenStream: (streamId: string) => void;
    clearAllScreenStreams: () => void;

    // Device actions
    setSelectedAudioInput: (deviceId: string | null) => void;
    setSelectedAudioOutput: (deviceId: string | null) => void;
    setSelectedVideoInput: (deviceId: string | null) => void;
    setAvailableDevices: (devices: MediaDeviceInfo[]) => void;
    refreshDevices: () => Promise<void>;
    setHasCompletedDeviceSetup: (completed: boolean) => void;

    // Connection
    setConnected: (connected: boolean) => void;
    setDailyError: (error: string | null) => void;
    clearDailyError: () => void;
}

export const useDailyStore = create<DailyState>((set, get) => ({
    participants: {},

    isVideoOn: false,
    isAudioOn: false,
    isSpeaking: false,
    localStream: null,
    isRemoteAudioEnabled: true,

    isScreenSharing: false,
    screenStreams: [],
    isGridViewOpen: false,

    selectedAudioInput: null,
    selectedAudioOutput: null,
    selectedVideoInput: null,
    availableDevices: [],
    hasCompletedDeviceSetup: false,

    isConnected: false,
    dailyError: null,

    // ─── Participant actions ──────────────────────────────
    setParticipant: (id, data) => {
        const current = get().participants[id];
        if (current) {
            // Shallow compare: skip if nothing changed
            const keys = Object.keys(data) as (keyof typeof data)[];
            const changed = keys.some(k => (current as any)[k] !== data[k]);
            if (!changed) return;
        }
        set((state) => ({
            participants: {
                ...state.participants,
                [id]: { ...(state.participants[id] || { sessionId: '', odell: id, userName: '', audioEnabled: false, videoEnabled: false, audioTrack: null, videoTrack: null, supabaseId: null }), ...data },
            },
        }));
    },

    removeParticipant: (id) => set((state) => {
        const { [id]: _, ...rest } = state.participants;
        return { participants: rest };
    }),

    clearParticipants: () => set({ participants: {} }),

    // ─── Media actions ────────────────────────────────────
    toggleVideo: () => set((state) => ({ isVideoOn: !state.isVideoOn })),
    toggleAudio: () => set((state) => ({ isAudioOn: !state.isAudioOn })),
    setLocalStream: (localStream) => set({ localStream }),
    setSpeaking: (isSpeaking) => set({ isSpeaking }),
    toggleRemoteAudio: () => set((state) => ({ isRemoteAudioEnabled: !state.isRemoteAudioEnabled })),
    toggleGridView: () => set((state) => ({ isGridViewOpen: !state.isGridViewOpen })),

    // ─── Screen sharing ───────────────────────────────────
    setScreenSharing: (isScreenSharing) => set({ isScreenSharing }),
    addScreenStream: (stream) => set((state) => ({ screenStreams: [...state.screenStreams, stream], isScreenSharing: true })),
    removeScreenStream: (streamId) => set((state) => {
        const newStreams = state.screenStreams.filter(s => s.id !== streamId);
        return { screenStreams: newStreams, isScreenSharing: newStreams.length > 0 };
    }),
    clearAllScreenStreams: () => set((state) => {
        state.screenStreams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
        return { screenStreams: [], isScreenSharing: false };
    }),

    // ─── Device actions ───────────────────────────────────
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

    // ─── Connection ───────────────────────────────────────
    setConnected: (isConnected) => set({ isConnected }),
    setDailyError: (error) => set({ dailyError: error }),
    clearDailyError: () => set({ dailyError: null }),
}));
