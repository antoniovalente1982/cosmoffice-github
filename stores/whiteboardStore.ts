import { create } from 'zustand';

// ============================================
// WHITEBOARD STORE — Collaborative drawing state
// Room-scoped + Office-wide whiteboards
// Tools: pen, eraser, shapes, laser pointer
// ============================================

export type WhiteboardTool = 'pen' | 'eraser' | 'select' | 'rect' | 'circle' | 'line' | 'arrow' | 'laser' | 'text';

export interface WhiteboardStroke {
    id: string;
    userId: string;
    userName: string;
    color: string;
    fillColor?: string | null;
    width: number;
    points: number[]; // pen/eraser: [x1,y1,...], shapes: [x1,y1,x2,y2], text: [x,y]
    tool: WhiteboardTool;
    text?: string;    // text content (tool='text' only)
    timestamp: string;
}

export interface RemoteCursor {
    userId: string;
    userName: string;
    color: string;
    x: number;
    y: number;
    lastUpdate: number;
}

export interface ActiveDrawer {
    userId: string;
    userName: string;
    color: string;
    timestamp: number;
}

type WhiteboardChannel = 'room' | 'office';

interface WhiteboardState {
    // Drawing state
    roomStrokes: WhiteboardStroke[];
    officeStrokes: WhiteboardStroke[];
    activeChannel: WhiteboardChannel;

    // Remote cursors
    remoteCursors: Map<string, RemoteCursor>;

    // Active drawers (for notifications)
    activeDrawers: Map<string, ActiveDrawer>;

    // UI state
    isOpen: boolean;
    isFullscreen: boolean;
    selectedColor: string;
    selectedFillColor: string | null;
    selectedWidth: number;
    selectedTool: WhiteboardTool;
    isDrawing: boolean;

    // Shape selection
    selectedStrokeId: string | null;

    // Undo/Redo
    undoStack: WhiteboardStroke[];
    redoStack: WhiteboardStroke[];

    // Actions — Strokes
    addStroke: (stroke: WhiteboardStroke) => void;
    addOfficeStroke: (stroke: WhiteboardStroke) => void;
    setRoomStrokes: (strokes: WhiteboardStroke[]) => void;
    setOfficeStrokes: (strokes: WhiteboardStroke[]) => void;
    clearRoomStrokes: () => void;
    clearOfficeStrokes: () => void;
    removeStroke: (id: string) => void;
    removeOfficeStroke: (id: string) => void;
    updateStroke: (id: string, updates: Partial<WhiteboardStroke>) => void;
    updateOfficeStroke: (id: string, updates: Partial<WhiteboardStroke>) => void;

    // Actions — Tools
    setColor: (color: string) => void;
    setFillColor: (color: string | null) => void;
    setWidth: (width: number) => void;
    setTool: (tool: WhiteboardTool) => void;
    setDrawing: (drawing: boolean) => void;

    // Actions — UI
    toggleWhiteboard: () => void;
    openWhiteboard: () => void;
    closeWhiteboard: () => void;
    toggleFullscreen: () => void;
    setActiveChannel: (ch: WhiteboardChannel) => void;
    setSelectedStrokeId: (id: string | null) => void;

    // Actions — Cursors
    updateRemoteCursor: (cursor: RemoteCursor) => void;
    removeRemoteCursor: (userId: string) => void;

    // Actions — Activity
    setActiveDrawer: (drawer: ActiveDrawer) => void;
    removeActiveDrawer: (userId: string) => void;

    // Actions — Undo/Redo
    undo: () => WhiteboardStroke | null;
    redo: () => WhiteboardStroke | null;
}

export const WHITEBOARD_COLORS = [
    '#22d3ee', // Cyan
    '#f43f5e', // Rose
    '#a3e635', // Lime
    '#f97316', // Orange
    '#a855f7', // Purple
    '#ffffff', // White
    '#facc15', // Yellow
    '#34d399', // Emerald
];

export const WHITEBOARD_FILL_COLORS = [
    null,          // No fill (transparent)
    '#22d3ee20',   // Cyan 12%
    '#f43f5e20',   // Rose 12%
    '#a3e63520',   // Lime 12%
    '#f9731620',   // Orange 12%
    '#a855f720',   // Purple 12%
    '#ffffff10',   // White 6%
    '#facc1520',   // Yellow 12%
    '#34d39920',   // Emerald 12%
];

export const WHITEBOARD_WIDTHS = [2, 4, 8];

export const SHAPE_TOOLS: WhiteboardTool[] = ['rect', 'circle', 'line', 'arrow'];
export const isShapeTool = (tool: WhiteboardTool) => SHAPE_TOOLS.includes(tool);

export const useWhiteboardStore = create<WhiteboardState>((set, get) => ({
    roomStrokes: [],
    officeStrokes: [],
    activeChannel: 'room',
    remoteCursors: new Map(),
    activeDrawers: new Map(),
    isOpen: false,
    isFullscreen: false,
    selectedColor: '#22d3ee',
    selectedFillColor: null,
    selectedWidth: 4,
    selectedTool: 'pen',
    isDrawing: false,
    selectedStrokeId: null,
    undoStack: [],
    redoStack: [],

    // Strokes
    addStroke: (stroke) => set((state) => ({
        roomStrokes: [...state.roomStrokes, stroke],
        undoStack: [...state.undoStack, stroke],
        redoStack: [],
    })),

    addOfficeStroke: (stroke) => set((state) => ({
        officeStrokes: [...state.officeStrokes, stroke],
        undoStack: [...state.undoStack, stroke],
        redoStack: [],
    })),

    setRoomStrokes: (roomStrokes) => set({ roomStrokes }),
    setOfficeStrokes: (officeStrokes) => set({ officeStrokes }),

    clearRoomStrokes: () => set({ roomStrokes: [], undoStack: [], redoStack: [], selectedStrokeId: null }),
    clearOfficeStrokes: () => set({ officeStrokes: [], undoStack: [], redoStack: [], selectedStrokeId: null }),

    removeStroke: (id) => set((state) => ({
        roomStrokes: state.roomStrokes.filter(s => s.id !== id),
        selectedStrokeId: state.selectedStrokeId === id ? null : state.selectedStrokeId,
    })),

    removeOfficeStroke: (id) => set((state) => ({
        officeStrokes: state.officeStrokes.filter(s => s.id !== id),
        selectedStrokeId: state.selectedStrokeId === id ? null : state.selectedStrokeId,
    })),

    updateStroke: (id, updates) => set((state) => ({
        roomStrokes: state.roomStrokes.map(s => s.id === id ? { ...s, ...updates } : s),
    })),

    updateOfficeStroke: (id, updates) => set((state) => ({
        officeStrokes: state.officeStrokes.map(s => s.id === id ? { ...s, ...updates } : s),
    })),

    // Tools
    setColor: (selectedColor) => set({ selectedColor }),
    setFillColor: (selectedFillColor) => set({ selectedFillColor }),
    setWidth: (selectedWidth) => set({ selectedWidth }),
    setTool: (selectedTool) => set({ selectedTool, selectedStrokeId: null }),
    setDrawing: (isDrawing) => set({ isDrawing }),

    // UI
    toggleWhiteboard: () => set((state) => ({ isOpen: !state.isOpen })),
    openWhiteboard: () => set({ isOpen: true }),
    closeWhiteboard: () => set({ isOpen: false, isFullscreen: false }),
    toggleFullscreen: () => set((state) => ({ isFullscreen: !state.isFullscreen })),
    setActiveChannel: (activeChannel) => set({ activeChannel, undoStack: [], redoStack: [], selectedStrokeId: null }),
    setSelectedStrokeId: (selectedStrokeId) => set({ selectedStrokeId }),

    // Cursors
    updateRemoteCursor: (cursor) => set((state) => {
        const newCursors = new Map(state.remoteCursors);
        newCursors.set(cursor.userId, cursor);
        return { remoteCursors: newCursors };
    }),

    removeRemoteCursor: (userId) => set((state) => {
        const newCursors = new Map(state.remoteCursors);
        newCursors.delete(userId);
        return { remoteCursors: newCursors };
    }),

    // Activity
    setActiveDrawer: (drawer) => set((state) => {
        const newDrawers = new Map(state.activeDrawers);
        newDrawers.set(drawer.userId, drawer);
        return { activeDrawers: newDrawers };
    }),

    removeActiveDrawer: (userId) => set((state) => {
        const newDrawers = new Map(state.activeDrawers);
        newDrawers.delete(userId);
        return { activeDrawers: newDrawers };
    }),

    // Undo/Redo
    undo: () => {
        const state = get();
        const isRoom = state.activeChannel === 'room';
        const strokes = isRoom ? state.roomStrokes : state.officeStrokes;
        if (strokes.length === 0) return null;

        const lastStroke = strokes[strokes.length - 1];
        const newStrokes = strokes.slice(0, -1);

        set({
            ...(isRoom ? { roomStrokes: newStrokes } : { officeStrokes: newStrokes }),
            undoStack: state.undoStack.slice(0, -1),
            redoStack: [...state.redoStack, lastStroke],
            selectedStrokeId: null,
        });

        return lastStroke;
    },

    redo: () => {
        const state = get();
        const isRoom = state.activeChannel === 'room';
        const { redoStack } = state;
        if (redoStack.length === 0) return null;

        const strokeToRedo = redoStack[redoStack.length - 1];

        set({
            ...(isRoom
                ? { roomStrokes: [...state.roomStrokes, strokeToRedo] }
                : { officeStrokes: [...state.officeStrokes, strokeToRedo] }
            ),
            undoStack: [...state.undoStack, strokeToRedo],
            redoStack: redoStack.slice(0, -1),
        });

        return strokeToRedo;
    },
}));
