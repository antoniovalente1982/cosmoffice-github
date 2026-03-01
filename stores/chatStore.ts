import { create } from 'zustand';

// ============================================
// CHAT STORE — Room-scoped real-time chat
// Separated from avatarStore and dailyStore
// to avoid re-render cascading
// ============================================

export interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    avatarUrl: string | null;
    content: string;
    roomId: string;
    timestamp: string;
}

interface ChatState {
    messages: ChatMessage[];
    isOpen: boolean;
    unreadCount: number;

    addMessage: (msg: ChatMessage) => void;
    setMessages: (msgs: ChatMessage[]) => void;
    clearMessages: () => void;
    toggleChat: () => void;
    openChat: () => void;
    closeChat: () => void;
    clearUnread: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
    messages: [],
    isOpen: false,
    unreadCount: 0,

    addMessage: (msg) => set((state) => ({
        messages: [...state.messages, msg],
        unreadCount: state.isOpen ? state.unreadCount : state.unreadCount + 1,
    })),

    setMessages: (messages) => set({ messages }),

    clearMessages: () => set({ messages: [], unreadCount: 0 }),

    toggleChat: () => set((state) => ({
        isOpen: !state.isOpen,
        unreadCount: !state.isOpen ? 0 : state.unreadCount,
    })),

    openChat: () => set({ isOpen: true, unreadCount: 0 }),
    closeChat: () => set({ isOpen: false }),
    clearUnread: () => set({ unreadCount: 0 }),
}));
