import { create } from 'zustand';

export interface AppNotification {
    id: string;
    type: 'chat' | 'office_chat' | 'knock' | 'call' | 'system' | 'info';
    title: string;
    body: string;
    avatarUrl?: string | null;
    timestamp: number;
    read: boolean;
    /** Optional room/channel reference */
    roomId?: string | null;
}

interface NotificationStore {
    notifications: AppNotification[];
    unreadCount: number;

    addNotification: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearAll: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
    notifications: [],
    unreadCount: 0,

    addNotification: (n) => {
        const notification: AppNotification = {
            ...n,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            read: false,
        };
        set((s) => ({
            notifications: [notification, ...s.notifications].slice(0, 50), // Keep last 50
            unreadCount: s.unreadCount + 1,
        }));
    },

    markAsRead: (id) => {
        set((s) => {
            const notifications = s.notifications.map((n) =>
                n.id === id ? { ...n, read: true } : n
            );
            return {
                notifications,
                unreadCount: notifications.filter((n) => !n.read).length,
            };
        });
    },

    markAllAsRead: () => {
        set((s) => ({
            notifications: s.notifications.map((n) => ({ ...n, read: true })),
            unreadCount: 0,
        }));
    },

    clearAll: () => {
        set({ notifications: [], unreadCount: 0 });
    },
}));
