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

// ── Browser Notification type icons ──
const BROWSER_NOTIFICATION_ICONS: Record<string, string> = {
    chat: '💬',
    office_chat: '🏢',
    knock: '🚪',
    call: '📞',
    system: '🔔',
    info: 'ℹ️',
};

interface NotificationStore {
    notifications: AppNotification[];
    unreadCount: number;
    /** Whether browser notifications are enabled by the user */
    browserNotificationsEnabled: boolean;
    /** Current browser permission state */
    browserPermission: NotificationPermission | 'unsupported';

    addNotification: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearAll: () => void;
    /** Request browser notification permission */
    requestBrowserPermission: () => Promise<void>;
    /** Toggle browser notifications on/off */
    setBrowserNotifications: (enabled: boolean) => void;
}

/** Fire a native browser notification if conditions are met */
function fireBrowserNotification(n: AppNotification, state: NotificationStore) {
    // Only fire when tab is hidden, permission granted, and user enabled it
    if (
        typeof document === 'undefined' ||
        !document.hidden ||
        !state.browserNotificationsEnabled ||
        state.browserPermission !== 'granted'
    ) return;

    try {
        const icon = BROWSER_NOTIFICATION_ICONS[n.type] || '🔔';
        const notification = new Notification(`${icon} ${n.title}`, {
            body: n.body,
            icon: '/logo.png',
            tag: n.id, // Prevent duplicate notifications
            silent: false,
        });

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);

        // Focus the tab when clicked
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    } catch {
        // Silent — browser notification should never break the app
    }
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    browserNotificationsEnabled: typeof window !== 'undefined'
        ? localStorage.getItem('browser_notifications') !== 'false'
        : true,
    browserPermission: typeof window !== 'undefined' && 'Notification' in window
        ? Notification.permission
        : 'unsupported',

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

        // Fire native browser notification when tab is in background
        fireBrowserNotification(notification, get());
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

    requestBrowserPermission: async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            set({ browserPermission: 'unsupported' });
            return;
        }
        try {
            const permission = await Notification.requestPermission();
            set({
                browserPermission: permission,
                browserNotificationsEnabled: permission === 'granted',
            });
            if (permission === 'granted') {
                localStorage.setItem('browser_notifications', 'true');
            }
        } catch {
            set({ browserPermission: 'denied' });
        }
    },

    setBrowserNotifications: (enabled) => {
        set({ browserNotificationsEnabled: enabled });
        if (typeof window !== 'undefined') {
            localStorage.setItem('browser_notifications', String(enabled));
        }
    },
}));
