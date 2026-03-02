'use client';

import { useEffect, useRef, useCallback } from 'react';
import PartySocket from 'partysocket';
import { useAvatarStore } from '../stores/avatarStore';
import { useChatStore } from '../stores/chatStore';

// ============================================
// useAvatarSync — PartyKit client for avatar sync + room chat + office chat
// Single socket connection shared across the app
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
    role: string | null;
}

export function useAvatarSync({ workspaceId, userId, userName, email, avatarUrl, status, role }: UseAvatarSyncOptions) {
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

    // ─── Send chat message (room-scoped) ────────────────────
    const sendChatMessage = useCallback((content: string, roomId: string) => {
        if (!content.trim() || !roomId) return;
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'chat',
                userId,
                content: content.trim(),
                roomId,
            }));
        }
    }, [userId]);

    // ─── Send office-wide chat message (global) ─────────────
    const sendOfficeChatMessage = useCallback((content: string) => {
        if (!content.trim()) return;
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'office_chat',
                userId,
                content: content.trim(),
            }));
        }
    }, [userId]);

    // ─── Delete message broadcast ───────────────────────────
    const sendDeleteMessage = useCallback((messageId: string, roomId: string | null) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'delete_message',
                userId,
                messageId,
                roomId,
            }));
        }
    }, [userId]);

    // ─── Clear chat broadcast ───────────────────────────────
    const sendClearChat = useCallback((roomId: string | null) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'clear_chat',
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

        // Expose socket ref globally so useRoomChat can reuse it
        (window as any).__partykitSocket = socket;

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
                role,
            }));
            // Broadcast position immediately + with retries to ensure delivery
            const broadcastPosition = () => {
                if (socket.readyState !== WebSocket.OPEN) return;
                const { myPosition, myRoomId } = useAvatarStore.getState();
                socket.send(JSON.stringify({
                    type: 'move',
                    userId,
                    x: myPosition.x,
                    y: myPosition.y,
                    roomId: myRoomId || null,
                }));
            };
            broadcastPosition();
            setTimeout(broadcastPosition, 500);
            setTimeout(broadcastPosition, 1500);
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
                            role: state.role || undefined,
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
                    const updateData: any = {
                        id: msg.userId,
                        ...msg.data,
                        full_name: msg.data.name,
                        avatar_url: msg.data.avatarUrl,
                        role: msg.data.role || undefined,
                    };
                    // Include position if server sent it
                    if (typeof msg.data.x === 'number' && typeof msg.data.y === 'number') {
                        updateData.position = { x: msg.data.x, y: msg.data.y };
                    }
                    if (msg.data.roomId !== undefined) {
                        updateData.roomId = msg.data.roomId;
                    }
                    useAvatarStore.getState().updatePeer(msg.userId, updateData);
                    break;
                }

                case 'leave': {
                    if (msg.userId === userId) return;
                    useAvatarStore.getState().removePeer(msg.userId);
                    break;
                }

                case 'chat_message': {
                    // Room-scoped chat message from server (skip own — already added optimistically)
                    if (msg.message && msg.message.userId !== userId) {
                        useChatStore.getState().addMessage(msg.message);
                    }
                    break;
                }

                case 'office_chat_message': {
                    // Office-wide global chat message (skip own — already added optimistically)
                    if (msg.message && msg.message.userId !== userId) {
                        useChatStore.getState().addOfficeMessage(msg.message);
                    }
                    break;
                }

                case 'message_deleted': {
                    // A message was deleted — remove from correct store
                    if (msg.roomId) {
                        useChatStore.getState().removeMessage(msg.messageId);
                    } else {
                        useChatStore.getState().removeOfficeMessage(msg.messageId);
                    }
                    break;
                }

                case 'chat_cleared': {
                    // All messages cleared for a room or office
                    if (msg.roomId) {
                        useChatStore.getState().clearMessages();
                    } else {
                        useChatStore.getState().clearOfficeMessages();
                    }
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
            delete (window as any).__partykitSocket;
        };
    }, [workspaceId, userId]); // Only reconnect on workspace/user change

    // Expose functions globally for hooks
    useEffect(() => {
        (window as any).__sendChatMessage = sendChatMessage;
        (window as any).__sendOfficeChatMessage = sendOfficeChatMessage;
        (window as any).__sendDeleteMessage = sendDeleteMessage;
        (window as any).__sendClearChat = sendClearChat;
        return () => {
            delete (window as any).__sendChatMessage;
            delete (window as any).__sendOfficeChatMessage;
            delete (window as any).__sendDeleteMessage;
            delete (window as any).__sendClearChat;
        };
    }, [sendChatMessage, sendOfficeChatMessage, sendDeleteMessage, sendClearChat]);

    return { sendPosition, sendJoinRoom, sendChatMessage, sendOfficeChatMessage, sendDeleteMessage, sendClearChat };
}
