import { create } from 'zustand';

// ============================================
// AVATAR STORE — User positions & presence
// Isolated from Daily.co and workspace config
// ============================================

interface UserPosition {
    x: number;
    y: number;
}

export interface Peer {
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
    remoteAudioEnabled?: boolean;
    isSpeaking?: boolean;
    stream?: MediaStream | null;
}

interface AvatarState {
    // Current user
    myPosition: UserPosition;
    myStatus: 'online' | 'away' | 'busy' | 'offline';
    myRoomId?: string;
    myProfile: any;
    myRole: 'owner' | 'admin' | 'member' | 'guest' | null;

    // Peers
    peers: Record<string, Peer>;

    // Actions
    setMyPosition: (position: UserPosition) => void;
    setMyStatus: (status: 'online' | 'away' | 'busy' | 'offline') => void;
    setMyRoom: (roomId?: string) => void;
    setMyProfile: (profile: any) => void;
    setMyRole: (role: 'owner' | 'admin' | 'member' | 'guest' | null) => void;
    updatePeer: (id: string, data: Partial<Peer>) => void;
    removePeer: (id: string) => void;
    clearPeers: () => void;
}

const AVATAR_RADIUS = 25; // Half of 50px minimum distance between avatar centers

export const useAvatarStore = create<AvatarState>((set, get) => ({
    myPosition: { x: 500, y: 500 },
    myStatus: 'online',
    myRoomId: undefined,
    myProfile: null,
    myRole: null,
    peers: {},

    setMyPosition: (position) => {
        const peers = get().peers;
        let resolved = { ...position };

        // Resolve collisions with all peers (push out if overlapping)
        const peerList = Object.values(peers);
        for (let iter = 0; iter < 3; iter++) {
            let pushed = false;
            for (const peer of peerList) {
                if (!peer.position) continue;
                const dx = resolved.x - peer.position.x;
                const dy = resolved.y - peer.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = AVATAR_RADIUS * 2;
                if (dist < minDist && dist > 0.01) {
                    const overlap = minDist - dist;
                    resolved.x += (dx / dist) * overlap;
                    resolved.y += (dy / dist) * overlap;
                    pushed = true;
                } else if (dist <= 0.01) {
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
            const keys = Object.keys(data) as (keyof typeof data)[];
            const changed = keys.some(k => {
                const oldVal = (current as any)[k];
                const newVal = data[k];
                if (k === 'position' && oldVal && newVal && typeof oldVal === 'object' && typeof newVal === 'object') {
                    return (oldVal as any).x !== (newVal as any).x || (oldVal as any).y !== (newVal as any).y;
                }
                return oldVal !== newVal;
            });
            if (!changed) return;
        }
        set((state) => ({
            peers: {
                ...state.peers,
                [id]: {
                    ...(state.peers[id] || { id, email: '', position: { x: 0, y: 0 }, status: 'online' as const, last_seen: new Date().toISOString() }),
                    ...data,
                },
            },
        }));
    },

    removePeer: (id) => set((state) => {
        const { [id]: _, ...rest } = state.peers;
        return { peers: rest };
    }),

    clearPeers: () => set({ peers: {} }),
}));
