'use client';

import { useEffect, useRef, useCallback } from 'react';
import PartySocket from 'partysocket';
import { useAvatarStore } from '../stores/avatarStore';
import { useDailyStore } from '../stores/dailyStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useChatStore } from '../stores/chatStore';
import { useCallStore } from '../stores/callStore';
import { useNotificationStore } from '../stores/notificationStore';
import { playKnockSound, playCallAcceptedSound, playCallDeclinedSound, playWelcomeSound, playChatPingSound, playCallRingSound, playRoomEnterSound, playRoomLeaveSound, playJoinOfficeSound } from '../utils/sounds';

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

    // ─── Send position (50ms throttle — faster sync, 80ms CSS transition compensates) ───
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
            // Also send knock so room members hear a knock sound
            const myProfile = useAvatarStore.getState().myProfile;
            socketRef.current.send(JSON.stringify({
                type: 'knock',
                userId,
                userName: myProfile?.display_name || myProfile?.full_name || 'User',
                roomId,
            }));
            // Play knock sound for the entrant too, if the room is occupied
            const peers = useAvatarStore.getState().peers;
            const occupants = Object.values(peers).filter((p: any) => p.roomId === roomId && p.id !== userId);
            if (occupants.length > 0) {
                playKnockSound();
            }
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

    // ─── Knock broadcast ────────────────────────────────────
    const sendKnock = useCallback((roomId: string) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'knock',
                userId,
                roomId,
            }));
        }
    }, [userId]);

    // ─── Knock response broadcast ───────────────────────────
    const sendKnockResponse = useCallback((roomId: string, targetUserId: string, accepted: boolean) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'knock_response',
                userId,
                roomId,
                targetUserId,
                accepted,
            }));
        }
    }, [userId]);

    // ─── Admin command broadcast ────────────────────────────
    const sendAdminCommand = useCallback((command: string, targetUserId?: string, roomId?: string) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'admin_command',
                adminId: userId,
                command,
                targetUserId,
                roomId,
            }));
        }
    }, [userId]);

    // ─── Leave room broadcast ───────────────────────────────
    const sendLeaveRoom = useCallback(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'leave_room',
                userId,
            }));
        }
    }, [userId]);

    // ─── State update broadcast (DND/Away) ──────────────────
    const sendStateUpdate = useCallback((isDnd?: boolean, isAway?: boolean) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'update_state',
                userId,
                isDnd,
                isAway,
            }));
        }
    }, [userId]);

    // ─── Media state broadcast (mic/cam/remoteAudio) ─────────
    const sendMediaState = useCallback((audioEnabled: boolean, videoEnabled: boolean, remoteAudioEnabled: boolean) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'media_state',
                userId,
                audioEnabled,
                videoEnabled,
                remoteAudioEnabled,
            }));
        }
    }, [userId]);

    // ─── Status change broadcast (online/away/busy) ──────────
    const sendStatusChange = useCallback((status: string) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'status_change',
                userId,
                status,
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
            // Play welcome sound on office entry
            playWelcomeSound();
            // Identify self
            socket.send(JSON.stringify({
                type: 'identify',
                userId,
                name: userName,
                email,
                avatarUrl,
                status,
                role,
                isDnd: useAvatarStore.getState().myDnd,
                isAway: useAvatarStore.getState().myAway,
            }));
            // Broadcast position immediately + with retries to ensure delivery
            const broadcastPosition = () => {
                if (socket.readyState !== WebSocket.OPEN) return;
                const { myPosition, myRoomId } = useAvatarStore.getState();
                // Don't broadcast until positioned at landing pad
                if (myPosition.x < -9000 || myPosition.y < -9000) return;
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
            setTimeout(broadcastPosition, 3000); // Extra retry in case landing pad loaded late

            // Broadcast current media state so existing peers get our mic/cam status
            setTimeout(() => {
                if (socket.readyState !== WebSocket.OPEN) return;
                const ds = useDailyStore.getState();
                socket.send(JSON.stringify({
                    type: 'media_state',
                    userId,
                    audioEnabled: ds.isAudioOn,
                    videoEnabled: ds.isVideoOn,
                    remoteAudioEnabled: ds.isRemoteAudioEnabled,
                }));
            }, 800);
        };

        socket.onmessage = (ev) => {
            let msg: any;
            try { msg = JSON.parse(ev.data); } catch { return; }

            switch (msg.type) {
                case 'init': {
                    // Bulk set all peers — filter out ghosts
                    const users = msg.users as Record<string, any>;
                    Object.entries(users).forEach(([id, state]) => {
                        if (id === userId) return; // Skip self
                        // Skip ghost users with invalid position
                        if (state.x === -9999 && state.y === -9999) return;
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
                            isDnd: state.isDnd || false,
                            isAway: state.isAway || false,
                            audioEnabled: state.audioEnabled ?? false,
                            videoEnabled: state.videoEnabled ?? false,
                        });
                    });
                    break;
                }

                case 'pong': {
                    // Server confirmed heartbeat — connection is alive
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
                    // Play sound if someone entered OUR room
                    const myRoom = useAvatarStore.getState().myRoomId;
                    if (myRoom && msg.roomId === myRoom) {
                        playRoomEnterSound();
                    }
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
                    if (msg.data.isDnd !== undefined) {
                        updateData.isDnd = msg.data.isDnd;
                    }
                    if (msg.data.isAway !== undefined) {
                        updateData.isAway = msg.data.isAway;
                    }
                    useAvatarStore.getState().updatePeer(msg.userId, updateData);
                    break;
                }

                case 'leave': {
                    if (msg.userId === userId) return;
                    // Play leave sound if they were in our room
                    const leavingPeer = useAvatarStore.getState().peers[msg.userId];
                    const myRoomOnLeave = useAvatarStore.getState().myRoomId;
                    if (myRoomOnLeave && leavingPeer?.roomId === myRoomOnLeave) {
                        playRoomLeaveSound();
                    }
                    useAvatarStore.getState().removePeer(msg.userId);
                    break;
                }

                case 'speaking': {
                    if (msg.userId === userId) return;
                    useAvatarStore.getState().updatePeer(msg.userId, {
                        id: msg.userId,
                        isSpeaking: msg.isSpeaking || false,
                    });
                    break;
                }

                case 'media_state': {
                    if (msg.userId === userId) return;
                    useAvatarStore.getState().updatePeer(msg.userId, {
                        id: msg.userId,
                        audioEnabled: msg.audioEnabled || false,
                        videoEnabled: msg.videoEnabled || false,
                        remoteAudioEnabled: msg.remoteAudioEnabled !== false,
                    });
                    break;
                }

                case 'status_change': {
                    if (msg.userId === userId) return;
                    useAvatarStore.getState().updatePeer(msg.userId, {
                        id: msg.userId,
                        status: msg.status || 'online',
                    });
                    break;
                }

                case 'call_request': {
                    // Someone wants to talk to me
                    if (msg.toUserId !== userId) return;

                    const avatarState = useAvatarStore.getState();
                    // Block if DND
                    if (avatarState.myDnd) return;
                    useCallStore.getState().setIncomingCall({
                        id: msg.id,
                        fromUserId: msg.fromUserId,
                        fromName: msg.fromName,
                        fromAvatarUrl: msg.fromAvatarUrl,
                        toUserId: msg.toUserId,
                        timestamp: Date.now(),
                        status: 'pending',
                    });
                    // Receiver hears the ring
                    playCallRingSound();
                    // Add notification
                    useNotificationStore.getState().addNotification({
                        type: 'call',
                        title: msg.fromName || 'Chiamata',
                        body: 'Ti sta chiamando...',
                        avatarUrl: msg.fromAvatarUrl,
                    });
                    break;
                }

                case 'call_response': {
                    // Response to my call request
                    if (msg.toUserId !== userId) return;

                    useCallStore.getState().setOutgoingCall(null);
                    useCallStore.getState().setCallResponse({
                        type: msg.response === 'accepted' ? 'accepted' : 'declined',
                        fromName: msg.fromName,
                    });
                    if (msg.response === 'accepted') {
                        playCallAcceptedSound();
                        // I'm the CALLER — notify me to enable mic/cam
                        useNotificationStore.getState().addNotification({
                            type: 'info',
                            title: `${msg.fromName} ha accettato!`,
                            body: '🎤 Attiva microfono e webcam per parlare',
                        });
                        // Auto-enable mic for caller
                        const dailyStore = useDailyStore.getState();
                        if (!dailyStore.isAudioOn) {
                            useDailyStore.setState({ isAudioOn: true });
                        }
                    } else {
                        playCallDeclinedSound();
                    }
                    break;
                }

                case 'knock':
                case 'knock_request': {
                    // Someone entered a room — play knock if I'm in that room
                    if (msg.userId === userId) return;
                    const myRoom = useAvatarStore.getState().myRoomId;
                    if (myRoom && (msg.roomId === myRoom)) {
                        // Cooldown: max 1 knock sound per room per 10 seconds
                        const knockKey = `${msg.userId}-${msg.roomId}`;
                        const now = Date.now();
                        const lastKnock = (window as any).__lastKnockTimes?.get(knockKey) || 0;
                        if (now - lastKnock > 10000) {
                            if (!(window as any).__lastKnockTimes) (window as any).__lastKnockTimes = new Map();
                            (window as any).__lastKnockTimes.set(knockKey, now);
                            playKnockSound();
                        }
                    }
                    // Also trigger knock UI notification
                    const handleKnockFn = (window as any).__handleKnockRequest;
                    if (handleKnockFn) {
                        handleKnockFn({
                            userId: msg.userId,
                            roomId: msg.roomId,
                            name: msg.name || msg.userName,
                            avatarUrl: msg.avatarUrl,
                            timestamp: Date.now(),
                        });
                    }
                    // Add notification
                    useNotificationStore.getState().addNotification({
                        type: 'knock',
                        title: msg.name || msg.userName || 'Qualcuno',
                        body: 'È entrato nella stanza',
                        avatarUrl: msg.avatarUrl,
                        roomId: msg.roomId,
                    });
                    break;
                }

                case 'chat_message': {
                    if (msg.message && msg.message.userId !== userId) {
                        useChatStore.getState().addMessage(msg.message);
                        playChatPingSound();
                        useNotificationStore.getState().addNotification({
                            type: 'chat',
                            title: msg.message.userName || 'Messaggio',
                            body: msg.message.content?.substring(0, 80) || 'Nuovo messaggio',
                            avatarUrl: msg.message.avatarUrl,
                            roomId: msg.message.roomId,
                        });
                    }
                    break;
                }

                case 'office_chat_message': {
                    if (msg.message && msg.message.userId !== userId) {
                        useChatStore.getState().addOfficeMessage(msg.message);
                        playChatPingSound();
                        useNotificationStore.getState().addNotification({
                            type: 'office_chat',
                            title: msg.message.userName || 'Messaggio ufficio',
                            body: msg.message.content?.substring(0, 80) || 'Nuovo messaggio',
                            avatarUrl: msg.message.avatarUrl,
                        });
                    }
                    break;
                }

                case 'message_deleted': {
                    if (msg.roomId) {
                        useChatStore.getState().removeMessage(msg.messageId);
                    } else {
                        useChatStore.getState().removeOfficeMessage(msg.messageId);
                    }
                    break;
                }

                case 'chat_cleared': {
                    if (msg.roomId) {
                        useChatStore.getState().clearMessages();
                    } else {
                        useChatStore.getState().clearOfficeMessages();
                    }
                    break;
                }

                // ─── Whiteboard messages ─────────────────────
                case 'wb_stroke':
                case 'wb_cursor':
                case 'wb_clear':
                case 'wb_activity':
                case 'wb_stroke_update': {
                    window.dispatchEvent(new CustomEvent('whiteboard-message', { detail: msg }));
                    break;
                }

                case 'leave_room': {
                    if (msg.userId === userId) return;
                    // Play sound if they left OUR room
                    const myRoomOnExit = useAvatarStore.getState().myRoomId;
                    const exitingPeer = useAvatarStore.getState().peers[msg.userId];
                    if (myRoomOnExit && exitingPeer?.roomId === myRoomOnExit) {
                        playRoomLeaveSound();
                    }
                    useAvatarStore.getState().updatePeer(msg.userId, {
                        id: msg.userId,
                        roomId: undefined,
                    });
                    break;
                }

                case 'knock_accepted': {
                    const handleAcceptFn = (window as any).__handleKnockAccepted;
                    if (handleAcceptFn) handleAcceptFn(msg.roomId);
                    break;
                }
                case 'knock_rejected': {
                    const handleRejectFn = (window as any).__handleKnockRejected;
                    if (handleRejectFn) handleRejectFn(msg.roomId);
                    break;
                }

                // ─── Admin actions ───────────────────────────
                case 'admin_action': {
                    const myUserId = userId;

                    switch (msg.command) {
                        case 'mute_audio':
                            if (msg.targetUserId === myUserId) {
                                useDailyStore.getState().setAdminMutedAudio(true);
                                useAvatarStore.getState().setMyAdminMutedAudio(true);
                            } else if (msg.targetUserId) {
                                useAvatarStore.getState().updatePeer(msg.targetUserId, {
                                    id: msg.targetUserId,
                                    adminMutedAudio: true,
                                });
                            }
                            break;
                        case 'unmute_audio':
                            if (msg.targetUserId === myUserId) {
                                useDailyStore.getState().setAdminMutedAudio(false);
                                useAvatarStore.getState().setMyAdminMutedAudio(false);
                            } else if (msg.targetUserId) {
                                useAvatarStore.getState().updatePeer(msg.targetUserId, {
                                    id: msg.targetUserId,
                                    adminMutedAudio: false,
                                });
                            }
                            break;
                        case 'mute_video':
                            if (msg.targetUserId === myUserId) {
                                useDailyStore.getState().setAdminMutedVideo(true);
                                useAvatarStore.getState().setMyAdminMutedVideo(true);
                            } else if (msg.targetUserId) {
                                useAvatarStore.getState().updatePeer(msg.targetUserId, {
                                    id: msg.targetUserId,
                                    adminMutedVideo: true,
                                });
                            }
                            break;
                        case 'unmute_video':
                            if (msg.targetUserId === myUserId) {
                                useDailyStore.getState().setAdminMutedVideo(false);
                                useAvatarStore.getState().setMyAdminMutedVideo(false);
                            } else if (msg.targetUserId) {
                                useAvatarStore.getState().updatePeer(msg.targetUserId, {
                                    id: msg.targetUserId,
                                    adminMutedVideo: false,
                                });
                            }
                            break;
                        case 'kick_room':
                            if (msg.targetUserId === myUserId) {
                                // Force leave current room
                                useAvatarStore.getState().setMyRoom(undefined);
                                useDailyStore.getState().setActiveContext('none', null);
                                const leaveFn = (window as any).__leaveDailyContext;
                                if (leaveFn) leaveFn();
                            }
                            break;
                        case 'kick_office':
                            if (msg.targetUserId === myUserId) {
                                // Redirect to dashboard
                                window.location.href = '/office';
                            }
                            break;
                        case 'mute_all':
                            useDailyStore.getState().setAdminMutedAudio(true);
                            useAvatarStore.getState().setMyAdminMutedAudio(true);
                            break;
                        case 'disable_all_cams':
                            useDailyStore.getState().setAdminMutedVideo(true);
                            useAvatarStore.getState().setMyAdminMutedVideo(true);
                            break;
                        case 'block_proximity':
                            useDailyStore.getState().setProximityBlockedGlobal(true);
                            break;
                        case 'unblock_proximity':
                            useDailyStore.getState().setProximityBlockedGlobal(false);
                            break;
                        case 'lock_room':
                            if (msg.roomId) useWorkspaceStore.getState().setRoomLocked(msg.roomId, true);
                            break;
                        case 'unlock_room':
                            if (msg.roomId) useWorkspaceStore.getState().setRoomLocked(msg.roomId, false);
                            break;
                    }
                    break;
                }
            }
        };

        socket.onclose = () => {
            connectedRef.current = false;
        };

        // ─── Heartbeat ping interval (15s) ─────────────────────
        const heartbeatInterval = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN && userId) {
                socket.send(JSON.stringify({ type: 'ping', userId }));
            }
        }, 15000);

        return () => {
            connectedRef.current = false;
            clearInterval(heartbeatInterval);
            socket.close();
            socketRef.current = null;
            delete (window as any).__partykitSocket;
        };
    }, [workspaceId, userId]); // Only reconnect on workspace/user change

    // ─── Re-identify when profile/name/avatar/status/role change ─
    useEffect(() => {
        if (!connectedRef.current || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
        if (!userName || userName === 'Anonymous') return; // Don't re-identify with placeholder name
        socketRef.current.send(JSON.stringify({
            type: 'identify',
            userId,
            name: userName,
            email,
            avatarUrl,
            status,
            role,
            isDnd: useAvatarStore.getState().myDnd,
            isAway: useAvatarStore.getState().myAway,
        }));
    }, [userName, avatarUrl, status, role, userId, email]);

    // Expose functions globally for hooks
    useEffect(() => {
        (window as any).__sendChatMessage = sendChatMessage;
        (window as any).__sendOfficeChatMessage = sendOfficeChatMessage;
        (window as any).__sendDeleteMessage = sendDeleteMessage;
        (window as any).__sendClearChat = sendClearChat;
        (window as any).__sendKnock = sendKnock;
        (window as any).__sendKnockResponse = sendKnockResponse;
        (window as any).__sendAdminCommand = sendAdminCommand;
        (window as any).__sendLeaveRoom = sendLeaveRoom;
        (window as any).__sendStateUpdate = sendStateUpdate;
        (window as any).__sendMediaState = sendMediaState;
        (window as any).__sendStatusChange = sendStatusChange;
        return () => {
            delete (window as any).__sendChatMessage;
            delete (window as any).__sendOfficeChatMessage;
            delete (window as any).__sendDeleteMessage;
            delete (window as any).__sendClearChat;
            delete (window as any).__sendKnock;
            delete (window as any).__sendKnockResponse;
            delete (window as any).__sendAdminCommand;
            delete (window as any).__sendLeaveRoom;
            delete (window as any).__sendStateUpdate;
            delete (window as any).__sendMediaState;
            delete (window as any).__sendStatusChange;
        };
    }, [sendChatMessage, sendOfficeChatMessage, sendDeleteMessage, sendClearChat, sendKnock, sendKnockResponse, sendAdminCommand, sendLeaveRoom, sendStateUpdate, sendMediaState, sendStatusChange]);

    // ─── Auto-broadcast media state when dailyStore changes ──
    useEffect(() => {
        const unsubDaily = useDailyStore.subscribe((state, prevState) => {
            if (state.isAudioOn !== prevState.isAudioOn ||
                state.isVideoOn !== prevState.isVideoOn ||
                state.isRemoteAudioEnabled !== prevState.isRemoteAudioEnabled) {
                sendMediaState(state.isAudioOn, state.isVideoOn, state.isRemoteAudioEnabled);
            }
        });
        return () => unsubDaily();
    }, [sendMediaState]);

    // ─── Auto-broadcast status changes (online/away/busy) ────
    useEffect(() => {
        const unsubAvatar = useAvatarStore.subscribe((state, prevState) => {
            if (state.myStatus !== prevState.myStatus) {
                sendStatusChange(state.myStatus);
            }
        });
        return () => unsubAvatar();
    }, [sendStatusChange]);

    // ─── Presence Analytics logger (30s interval) ────────────
    useEffect(() => {
        if (!workspaceId || !userId) return;

        const interval = setInterval(async () => {
            try {
                const { myPosition, myRoomId } = useAvatarStore.getState();
                // Don't log if not positioned
                if (myPosition.x < -9000 || myPosition.y < -9000) return;

                await fetch('/api/admin/presence-analytics', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        events: [{
                            workspace_id: workspaceId,
                            user_id: userId,
                            room_id: myRoomId || null,
                            x: myPosition.x,
                            y: myPosition.y,
                        }],
                    }),
                });
            } catch {
                // Silent — analytics should never break the app
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [workspaceId, userId]);

    return { sendPosition, sendJoinRoom, sendLeaveRoom, sendChatMessage, sendOfficeChatMessage, sendDeleteMessage, sendClearChat, sendKnock, sendKnockResponse, sendAdminCommand, sendStateUpdate, sendMediaState, sendStatusChange };
}
