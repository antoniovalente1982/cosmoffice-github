import { create } from 'zustand';

// ============================================
// CHAT STORE — Room + Office chat state
// Separated from avatarStore and dailyStore
// to avoid re-render cascading
// ============================================

export interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    avatarUrl: string | null;
    content: string;
    roomId: string | null;
    timestamp: string;
}

type ChatChannel = 'room' | 'office';

interface ChatState {
    // Room-scoped messages
    messages: ChatMessage[];
    // Office-wide global messages
    officeMessages: ChatMessage[];
    // Active channel tab
    activeChannel: ChatChannel;

    isOpen: boolean;
    unreadCount: number;
    officeUnreadCount: number;

    // Room messages
    addMessage: (msg: ChatMessage) => void;
    setMessages: (msgs: ChatMessage[]) => void;
    clearMessages: () => void;
    removeMessage: (id: string) => void;

    // Office messages
    addOfficeMessage: (msg: ChatMessage) => void;
    setOfficeMessages: (msgs: ChatMessage[]) => void;
    clearOfficeMessages: () => void;
    removeOfficeMessage: (id: string) => void;

    // Channel
    setActiveChannel: (ch: ChatChannel) => void;

    // UI
    toggleChat: () => void;
    openChat: () => void;
    closeChat: () => void;
    clearUnread: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
    messages: [],
    officeMessages: [],
    activeChannel: 'room',
    isOpen: false,
    unreadCount: 0,
    officeUnreadCount: 0,

    addMessage: (msg) => set((state) => {
        if (state.messages.some(m => m.id === msg.id)) return state; // Dedup
        return {
            messages: [...state.messages, msg],
            unreadCount: (state.isOpen && state.activeChannel === 'room') ? state.unreadCount : state.unreadCount + 1,
        };
    }),

    setMessages: (messages) => set({ messages }),

    clearMessages: () => set({ messages: [], unreadCount: 0 }),

    removeMessage: (id) => set((state) => ({
        messages: state.messages.filter(m => m.id !== id),
    })),

    // Office messages
    addOfficeMessage: (msg) => set((state) => {
        if (state.officeMessages.some(m => m.id === msg.id)) return state; // Dedup
        return {
            officeMessages: [...state.officeMessages, msg],
            officeUnreadCount: (state.isOpen && state.activeChannel === 'office') ? state.officeUnreadCount : state.officeUnreadCount + 1,
        };
    }),

    setOfficeMessages: (officeMessages) => set({ officeMessages }),

    clearOfficeMessages: () => set({ officeMessages: [], officeUnreadCount: 0 }),

    removeOfficeMessage: (id) => set((state) => ({
        officeMessages: state.officeMessages.filter(m => m.id !== id),
    })),

    // Channel
    setActiveChannel: (activeChannel) => set((state) => ({
        activeChannel,
        unreadCount: activeChannel === 'room' ? 0 : state.unreadCount,
        officeUnreadCount: activeChannel === 'office' ? 0 : state.officeUnreadCount,
    })),

    toggleChat: () => set((state) => ({
        isOpen: !state.isOpen,
        unreadCount: !state.isOpen ? 0 : state.unreadCount,
        officeUnreadCount: !state.isOpen ? 0 : state.officeUnreadCount,
    })),

    openChat: () => set({ isOpen: true, unreadCount: 0, officeUnreadCount: 0 }),
    closeChat: () => set({ isOpen: false }),
    clearUnread: () => set({ unreadCount: 0, officeUnreadCount: 0 }),
}));
