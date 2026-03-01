import { create } from 'zustand';

// ============================================
// WORKSPACE STORE — Rooms, config, builder state
// Persistent data and UI chrome state
// ============================================

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

interface WorkspaceState {
    // Space
    activeSpaceId?: string;

    // Rooms
    rooms: Room[];
    roomConnections: RoomConnection[];

    // Camera/View
    zoom: number;
    stagePos: { x: number; y: number };

    // UI
    isSettingsOpen: boolean;
    activeTab: 'office';
    isPerformanceMode: boolean;

    // Builder
    isBuilderMode: boolean;
    bgOpacity: number;
    officeWidth: number;
    officeHeight: number;
    selectedRoomId: string | null;
    furnitureItems: FurnitureItem[];
    roomTemplates: RoomTemplate[];

    // Actions — space
    setActiveSpace: (spaceId: string) => void;

    // Actions — rooms
    setRooms: (rooms: Room[]) => void;
    setRoomConnections: (connections: RoomConnection[]) => void;
    addRoom: (room: Room) => void;
    updateRoomPosition: (roomId: string, x: number, y: number) => void;
    updateRoomSize: (roomId: string, width: number, height: number) => void;
    removeRoom: (roomId: string) => void;

    // Actions — view
    setZoom: (zoom: number) => void;
    setStagePos: (stagePos: { x: number; y: number }) => void;

    // Actions — UI
    toggleSettings: () => void;
    setActiveTab: (tab: 'office') => void;
    togglePerformanceMode: () => void;

    // Actions — builder
    toggleBuilderMode: () => void;
    setSelectedRoom: (roomId: string | null) => void;
    setFurnitureItems: (items: FurnitureItem[]) => void;
    addFurniture: (item: FurnitureItem) => void;
    updateFurniture: (id: string, data: Partial<FurnitureItem>) => void;
    removeFurniture: (id: string) => void;
    setBgOpacity: (val: number) => void;
    setOfficeDimensions: (width: number, height: number) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
    activeSpaceId: undefined,
    rooms: [],
    roomConnections: [],
    zoom: 1,
    stagePos: { x: 0, y: 0 },
    isSettingsOpen: false,
    activeTab: 'office',
    isPerformanceMode: typeof window !== 'undefined' ? localStorage.getItem('isPerformanceMode') === 'true' : false,

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

    // ─── Space ──────────────────────────────────────────────
    setActiveSpace: (activeSpaceId) => {
        const current = get().activeSpaceId;
        if (current === activeSpaceId) return;
        set({
            activeSpaceId,
            rooms: [],
            roomConnections: [],
            furnitureItems: [],
            stagePos: { x: 0, y: 0 },
            zoom: 1,
            isBuilderMode: false,
            selectedRoomId: null,
            officeWidth: 4000,
            officeHeight: 3000,
            bgOpacity: 0.8,
        });
    },

    // ─── Rooms ──────────────────────────────────────────────
    setRooms: (rooms) => set({ rooms }),
    setRoomConnections: (roomConnections) => set({ roomConnections }),
    addRoom: (room) => set((state) => ({ rooms: [...state.rooms, room] })),
    updateRoomPosition: (roomId, x, y) => set((state) => ({
        rooms: state.rooms.map(r => r.id === roomId ? { ...r, x, y } : r),
    })),
    updateRoomSize: (roomId, width, height) => set((state) => ({
        rooms: state.rooms.map(r => r.id === roomId ? { ...r, width, height } : r),
    })),
    removeRoom: (roomId) => set((state) => ({
        rooms: state.rooms.filter(r => r.id !== roomId),
        selectedRoomId: state.selectedRoomId === roomId ? null : state.selectedRoomId,
        furnitureItems: state.furnitureItems.filter(f => f.room_id !== roomId),
    })),

    // ─── View ───────────────────────────────────────────────
    setZoom: (zoom) => set({ zoom }),
    setStagePos: (stagePos) => set({ stagePos }),

    // ─── UI ─────────────────────────────────────────────────
    toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
    setActiveTab: (tab) => set({ activeTab: tab, isSettingsOpen: false }),
    togglePerformanceMode: () => set((state) => {
        const newValue = !state.isPerformanceMode;
        if (typeof window !== 'undefined') localStorage.setItem('isPerformanceMode', String(newValue));
        return { isPerformanceMode: newValue };
    }),

    // ─── Builder ────────────────────────────────────────────
    toggleBuilderMode: () => set((state) => ({ isBuilderMode: !state.isBuilderMode, selectedRoomId: null })),
    setSelectedRoom: (roomId) => set({ selectedRoomId: roomId }),
    setFurnitureItems: (items) => set({ furnitureItems: items }),
    addFurniture: (item) => set((state) => ({ furnitureItems: [...state.furnitureItems, item] })),
    updateFurniture: (id, data) => set((state) => ({
        furnitureItems: state.furnitureItems.map(f => f.id === id ? { ...f, ...data } : f),
    })),
    removeFurniture: (id) => set((state) => ({
        furnitureItems: state.furnitureItems.filter(f => f.id !== id),
    })),
    setBgOpacity: (bgOpacity) => set({ bgOpacity }),
    setOfficeDimensions: (officeWidth, officeHeight) => set({ officeWidth, officeHeight }),
}));
