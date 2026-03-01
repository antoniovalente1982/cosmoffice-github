'use client';

import { useEffect, useRef, useCallback } from 'react';
import PartySocket from 'partysocket';
import { useAvatarStore } from '../stores/avatarStore';

// ============================================
// useAvatarSync — PartyKit client for avatar sync
// Replaces Supabase Presence for real-time positions
// ============================================

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999';

// Throttle helper
function throttle<F extends (...args: any[]) => void>(fn: F, ms: number): F {
    let lastCall = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    return ((...args: any[]) => {
        const now = Date.now();
        const remaining = ms - (now - lastCall);
        if (remaining <= 0) {
            if (timer) { clearTimeout(timer); timer = null; }
            lastCall = now;
            fn(...args);
        } else if (!timer) {
            timer = setTimeout(() => {
                lastCall = Date.now();
                timer = null;
                fn(...args);
            }, remaining);
        }
    }) as F;
}

interface UseAvatarSyncOptions {
    workspaceId: string;
    userId: string;
    userName: string;
    email: string;
    avatarUrl: string | null;
    status: string;
}

export function useAvatarSync({ workspaceId, userId, userName, email, avatarUrl, status }: UseAvatarSyncOptions) {
    const socketRef = useRef<PartySocket | null>(null);
    const connectedRef = useRef(false);

    // ─── Send position (50ms throttle) ──────────────────────
    const sendPosition = useCallback(
        throttle((x: number, y: number, roomId: string | null) => {
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({
                    type: 'move',
                    userId,
                    x, y, roomId,
                }));
            }
        }, 50),
        [userId]
    );

    // ─── Join room notification ─────────────────────────────
    const sendJoinRoom = useCallback((roomId: string) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'join_room',
                userId,
                roomId,
            }));
        }
    }, [userId]);

    // ─── Connect ────────────────────────────────────────────
    useEffect(() => {
        if (!workspaceId || !userId) return;

        const socket = new PartySocket({
            host: PARTYKIT_HOST,
            room: workspaceId,
        });
        socketRef.current = socket;

        socket.onopen = () => {
            connectedRef.current = true;
            // Identify self
            socket.send(JSON.stringify({
                type: 'identify',
                userId,
                name: userName,
                email,
                avatarUrl,
                status,
            }));
            // Immediately send current position so other users see us at the right spot
            const { myPosition, myRoomId } = useAvatarStore.getState();
            socket.send(JSON.stringify({
                type: 'move',
                userId,
                x: myPosition.x,
                y: myPosition.y,
                roomId: myRoomId || null,
            }));
        };

        socket.onmessage = (ev) => {
            let msg: any;
            try { msg = JSON.parse(ev.data); } catch { return; }

            switch (msg.type) {
                case 'init': {
                    // Bulk set all peers
                    const users = msg.users as Record<string, any>;
                    Object.entries(users).forEach(([id, state]) => {
                        if (id === userId) return; // Skip self
                        useAvatarStore.getState().updatePeer(id, {
                            id,
                            email: state.email || '',
                            full_name: state.name,
                            avatar_url: state.avatarUrl,
                            position: { x: state.x, y: state.y },
                            status: state.status || 'online',
                            last_seen: new Date().toISOString(),
                            roomId: state.roomId,
                        });
                    });
                    break;
                }

                case 'move': {
                    if (msg.userId === userId) return;
                    useAvatarStore.getState().updatePeer(msg.userId, {
                        id: msg.userId,
                        position: { x: msg.x, y: msg.y },
                        roomId: msg.roomId,
                    });
                    break;
                }

                case 'join_room': {
                    if (msg.userId === userId) return;
                    useAvatarStore.getState().updatePeer(msg.userId, {
                        id: msg.userId,
                        roomId: msg.roomId,
                    });
                    break;
                }

                case 'user_update': {
                    if (msg.userId === userId) return;
                    useAvatarStore.getState().updatePeer(msg.userId, {
                        id: msg.userId,
                        ...msg.data,
                        full_name: msg.data.name,
                        avatar_url: msg.data.avatarUrl,
                    });
                    break;
                }

                case 'leave': {
                    if (msg.userId === userId) return;
                    useAvatarStore.getState().removePeer(msg.userId);
                    break;
                }
            }
        };

        socket.onclose = () => {
            connectedRef.current = false;
        };

        return () => {
            connectedRef.current = false;
            socket.close();
            socketRef.current = null;
        };
    }, [workspaceId, userId]); // Only reconnect on workspace/user change

    return { sendPosition, sendJoinRoom };
}
