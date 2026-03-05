import { create } from 'zustand';

// ============================================
// WHITEBOARD STORE — Collaborative drawing state
// Room-scoped + Office-wide whiteboards
// ============================================

export interface WhiteboardStroke {
    id: string;
    userId: string;
    userName: string;
    color: string;
    width: number;
    points: number[]; // [x1, y1, x2, y2, ...]
    tool: 'pen' | 'eraser';
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

type WhiteboardChannel = 'room' | 'office';

interface WhiteboardState {
    // Drawing state
    roomStrokes: WhiteboardStroke[];
    officeStrokes: WhiteboardStroke[];
    activeChannel: WhiteboardChannel;

    // Remote cursors
    remoteCursors: Map<string, RemoteCursor>;

    // UI state
    isOpen: boolean;
    isFullscreen: boolean;
    selectedColor: string;
    selectedWidth: number;
    selectedTool: 'pen' | 'eraser';
    isDrawing: boolean;

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

    // Actions — Tools
    setColor: (color: string) => void;
    setWidth: (width: number) => void;
    setTool: (tool: 'pen' | 'eraser') => void;
    setDrawing: (drawing: boolean) => void;

    // Actions — UI
    toggleWhiteboard: () => void;
    openWhiteboard: () => void;
    closeWhiteboard: () => void;
    toggleFullscreen: () => void;
    setActiveChannel: (ch: WhiteboardChannel) => void;

    // Actions — Cursors
    updateRemoteCursor: (cursor: RemoteCursor) => void;
    removeRemoteCursor: (userId: string) => void;

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

export const WHITEBOARD_WIDTHS = [2, 4, 8];

export const useWhiteboardStore = create<WhiteboardState>((set, get) => ({
    roomStrokes: [],
    officeStrokes: [],
    activeChannel: 'room',
    remoteCursors: new Map(),
    isOpen: false,
    isFullscreen: false,
    selectedColor: '#22d3ee',
    selectedWidth: 4,
    selectedTool: 'pen',
    isDrawing: false,
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

    clearRoomStrokes: () => set({ roomStrokes: [], undoStack: [], redoStack: [] }),
    clearOfficeStrokes: () => set({ officeStrokes: [], undoStack: [], redoStack: [] }),

    removeStroke: (id) => set((state) => ({
        roomStrokes: state.roomStrokes.filter(s => s.id !== id),
    })),

    removeOfficeStroke: (id) => set((state) => ({
        officeStrokes: state.officeStrokes.filter(s => s.id !== id),
    })),

    // Tools
    setColor: (selectedColor) => set({ selectedColor }),
    setWidth: (selectedWidth) => set({ selectedWidth }),
    setTool: (selectedTool) => set({ selectedTool }),
    setDrawing: (isDrawing) => set({ isDrawing }),

    // UI
    toggleWhiteboard: () => set((state) => ({ isOpen: !state.isOpen })),
    openWhiteboard: () => set({ isOpen: true }),
    closeWhiteboard: () => set({ isOpen: false, isFullscreen: false }),
    toggleFullscreen: () => set((state) => ({ isFullscreen: !state.isFullscreen })),
    setActiveChannel: (activeChannel) => set({ activeChannel, undoStack: [], redoStack: [] }),

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
