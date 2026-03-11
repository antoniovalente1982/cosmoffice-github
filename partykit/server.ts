// ============================================
// PartyKit Server — Avatar sync + Room Chat + Office Chat + Knock + Admin
// Each "room" = one workspace
// NOTE: PartyKit compiles this file separately.
//       Types are inlined to avoid TS module-resolution conflicts.
// ============================================

interface UserState {
    x: number;
    y: number;
    name: string;
    roomId: string | null;
    status: string;
    avatarUrl: string | null;
    email: string;
    role: string | null;
    isDnd: boolean;
    isAway: boolean;
    audioEnabled: boolean;
    videoEnabled: boolean;
    lastSeen: number; // timestamp ms — for heartbeat cleanup
}

const HEARTBEAT_INTERVAL_MS = 20_000; // purge check every 20s
const STALE_THRESHOLD_MS = 45_000;     // user is ghost if no ping for 45s

interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    avatarUrl: string | null;
    content: string;
    roomId: string | null;
    timestamp: string;
}

type AdminCommand =
    | 'mute_audio'
    | 'mute_video'
    | 'unmute_audio'
    | 'unmute_video'
    | 'kick_room'
    | 'kick_office'
    | 'mute_all'
    | 'disable_all_cams'
    | 'block_proximity'
    | 'unblock_proximity'
    | 'lock_room'
    | 'unlock_room';

type IncomingMessage =
    | { type: "move"; userId: string; x: number; y: number; roomId: string | null }
    | { type: "join_room"; userId: string; roomId: string }
    | { type: "leave_room"; userId: string }
    | { type: "identify"; userId: string; name: string; email: string; avatarUrl: string | null; status: string; role?: string | null; isDnd?: boolean; isAway?: boolean }
    | { type: "chat"; userId: string; content: string; roomId: string }
    | { type: "office_chat"; userId: string; content: string }
    | { type: "delete_message"; userId: string; messageId: string; roomId: string | null }
    | { type: "clear_chat"; userId: string; roomId: string | null }
    | { type: "knock"; userId: string; roomId: string; userName?: string }
    | { type: "knock_response"; userId: string; roomId: string; targetUserId: string; accepted: boolean }
    | { type: "admin_command"; adminId: string; command: AdminCommand; targetUserId?: string; roomId?: string }
    | { type: "update_state"; userId: string; isDnd?: boolean; isAway?: boolean }
    | { type: "speaking"; userId: string; isSpeaking: boolean }
    | { type: "media_state"; userId: string; audioEnabled: boolean; videoEnabled: boolean; remoteAudioEnabled: boolean }
    | { type: "status_change"; userId: string; status: string }
    | { type: "ping"; userId: string }
    | { type: "call_request"; id: string; fromUserId: string; fromName: string; fromAvatarUrl?: string; toUserId: string }
    | { type: "call_response"; id: string; fromUserId: string; fromName: string; toUserId: string; response: string }
    | { type: "wb_stroke"; scope: string; roomId: string | null; stroke: any }
    | { type: "wb_cursor"; scope: string; roomId: string | null; cursor: any }
    | { type: "wb_clear"; scope: string; roomId: string | null }
    | { type: "wb_activity"; scope: string; roomId: string | null; userId: string; userName: string; color: string; action: string }
    | { type: "wb_stroke_update"; scope: string; roomId: string | null; strokeId: string; updates: any };

type OutgoingMessage =
    | { type: "init"; users: Record<string, UserState> }
    | { type: "move"; userId: string; x: number; y: number; roomId: string | null }
    | { type: "join_room"; userId: string; roomId: string }
    | { type: "leave_room"; userId: string }
    | { type: "leave"; userId: string }
    | { type: "user_update"; userId: string; data: Partial<UserState> }
    | { type: "chat_message"; message: ChatMessage }
    | { type: "office_chat_message"; message: ChatMessage }
    | { type: "message_deleted"; messageId: string; roomId: string | null }
    | { type: "chat_cleared"; roomId: string | null }
    | { type: "knock_request"; userId: string; roomId: string; name: string; avatarUrl: string | null }
    | { type: "knock_accepted"; userId: string; roomId: string }
    | { type: "knock_rejected"; userId: string; roomId: string }
    | { type: "admin_action"; command: AdminCommand; adminId: string; targetUserId?: string; roomId?: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
export default class AvatarServer {
    private users = new Map<string, UserState>();
    private connectionToUser = new Map<string, string>(); // connection.id → userId
    private userToConnection = new Map<string, string>(); // userId → connection.id
    private pendingLeaves = new Map<string, ReturnType<typeof setTimeout>>(); // userId → delayed leave timer

    constructor(public party: any) {
        // Start periodic heartbeat alarm — with fallback if storage.setAlarm fails
        // (storage is wiped every 24h on free plan, so setAlarm may silently fail)
        this.scheduleAlarm();
    }

    private scheduleAlarm() {
        try {
            this.party.storage?.setAlarm?.(Date.now() + HEARTBEAT_INTERVAL_MS);
        } catch (e) {
            console.warn('[PartyKit] setAlarm failed (free plan storage wipe?), using fallback');
        }
    }

    // ─── Periodic cleanup of stale/ghost users ──────────────
    async onAlarm() {
        const now = Date.now();
        const toRemove: string[] = [];

        // 1. Clean orphaned connection→user entries (connection no longer exists)
        for (const [connId, uid] of Array.from(this.connectionToUser.entries())) {
            const conn = this.party.getConnection(connId);
            if (!conn) {
                this.connectionToUser.delete(connId);
                if (this.userToConnection.get(uid) === connId) {
                    this.userToConnection.delete(uid);
                }
            }
        }

        // 2. Remove stale users (no active connection AND no recent heartbeat)
        this.users.forEach((state, userId) => {
            if (now - state.lastSeen > STALE_THRESHOLD_MS) {
                const connId = this.userToConnection.get(userId);
                const conn = connId ? this.party.getConnection(connId) : null;
                if (!conn) {
                    toRemove.push(userId);
                }
            }
        });

        for (const userId of toRemove) {
            const connId = this.userToConnection.get(userId);
            if (connId) this.connectionToUser.delete(connId);
            this.userToConnection.delete(userId);
            this.users.delete(userId);
            // Cancel any pending leave timer
            const timer = this.pendingLeaves.get(userId);
            if (timer) { clearTimeout(timer); this.pendingLeaves.delete(userId); }
            const leaveMsg: OutgoingMessage = { type: "leave", userId };
            this.party.broadcast(JSON.stringify(leaveMsg));
            console.log(`[PartyKit] Purged stale user: ${userId.slice(0, 8)}`);
        }

        // Schedule next alarm
        this.scheduleAlarm();
    }

    onConnect(connection: any) {
        // Re-schedule alarm on every new connection to ensure heartbeat stays alive
        // (critical after free-plan storage wipe which kills the alarm)
        this.scheduleAlarm();

        // Clean up orphaned connection mappings first
        for (const [connId, uid] of Array.from(this.connectionToUser.entries())) {
            const conn = this.party.getConnection(connId);
            if (!conn) {
                this.connectionToUser.delete(connId);
                if (this.userToConnection.get(uid) === connId) {
                    this.userToConnection.delete(uid);
                }
            }
        }

        // Send current state of all LIVE users to new connection
        const usersObj: Record<string, UserState> = {};
        const now = Date.now();
        this.users.forEach((state, id) => {
            // Skip ghosts: no recent activity and invalid position
            if (state.x === -9999 && state.y === -9999) return;
            // Skip stale users with no active connection
            const connId = this.userToConnection.get(id);
            if (!connId) return;
            const conn = this.party.getConnection(connId);
            if (!conn && (now - state.lastSeen > STALE_THRESHOLD_MS)) return;
            usersObj[id] = state;
        });
        const initMsg: OutgoingMessage = { type: "init", users: usersObj };
        connection.send(JSON.stringify(initMsg));
    }

    private isAdminOrOwner(userId: string): boolean {
        const user = this.users.get(userId);
        return user?.role === 'owner' || user?.role === 'admin';
    }

    private sendToUser(userId: string, msg: OutgoingMessage) {
        const connId = this.userToConnection.get(userId);
        if (connId) {
            const conn = this.party.getConnection(connId);
            if (conn) conn.send(JSON.stringify(msg));
        }
    }

    private sendToRoomOccupants(roomId: string, msg: OutgoingMessage, excludeSenderId?: string) {
        const payload = JSON.stringify(msg);
        const sentToUsers = new Set<string>(); // Dedup: only send once per user
        for (const [connId, uid] of Array.from(this.connectionToUser.entries())) {
            if (excludeSenderId && uid === excludeSenderId) continue;
            if (sentToUsers.has(uid)) continue; // Already sent to this user
            const u = this.users.get(uid);
            if (u && u.roomId === roomId) {
                const conn = this.party.getConnection(connId);
                if (conn) {
                    conn.send(payload);
                    sentToUsers.add(uid);
                }
            }
        }
    }

    onMessage(message: string, sender: any) {
        let parsed: IncomingMessage;
        try {
            parsed = JSON.parse(message);
        } catch {
            return;
        }

        switch (parsed.type) {
            case "identify": {
                const userId = parsed.userId;

                // Cancel any pending leave timer — user is reconnecting
                const pendingLeave = this.pendingLeaves.get(userId);
                if (pendingLeave) {
                    clearTimeout(pendingLeave);
                    this.pendingLeaves.delete(userId);
                }

                // If this userId already has an active connection, close the old one
                const existingConnId = this.userToConnection.get(userId);
                if (existingConnId && existingConnId !== sender.id) {
                    // Remove old connection mapping (don't delete user state — we're replacing it)
                    this.connectionToUser.delete(existingConnId);
                    // Try to close old connection gracefully
                    try {
                        const oldConn = this.party.getConnection(existingConnId);
                        if (oldConn) oldConn.close();
                    } catch { }
                }

                // Clean up any OTHER stale connectionToUser entries pointing to this userId
                for (const [connId, uid] of Array.from(this.connectionToUser.entries())) {
                    if (uid === userId && connId !== sender.id) {
                        this.connectionToUser.delete(connId);
                    }
                }

                this.connectionToUser.set(sender.id, userId);
                this.userToConnection.set(userId, sender.id);
                const existing = this.users.get(userId);
                this.users.set(userId, {
                    x: existing?.x ?? -9999,
                    y: existing?.y ?? -9999,
                    name: parsed.name,
                    roomId: existing?.roomId ?? null,
                    status: parsed.status,
                    avatarUrl: parsed.avatarUrl,
                    email: parsed.email,
                    role: parsed.role || existing?.role || null,
                    isDnd: parsed.isDnd || false,
                    isAway: parsed.isAway || false,
                    audioEnabled: existing?.audioEnabled ?? false,
                    videoEnabled: existing?.videoEnabled ?? false,
                    lastSeen: Date.now(),
                });
                // Broadcast updated user info (including position)
                const state = this.users.get(userId)!;
                const updateMsg: OutgoingMessage = {
                    type: "user_update",
                    userId,
                    data: {
                        name: parsed.name,
                        status: parsed.status,
                        avatarUrl: parsed.avatarUrl,
                        email: parsed.email,
                        role: state.role,
                        x: state.x,
                        y: state.y,
                        roomId: state.roomId,
                        isDnd: state.isDnd,
                        isAway: state.isAway,
                    },
                };
                this.party.broadcast(JSON.stringify(updateMsg), [sender.id]);
                break;
            }

            case "move": {
                const userId = parsed.userId;
                const user = this.users.get(userId);
                if (user) {
                    user.x = parsed.x;
                    user.y = parsed.y;
                    user.roomId = parsed.roomId;
                    user.lastSeen = Date.now();
                } else {
                    this.users.set(userId, {
                        x: parsed.x,
                        y: parsed.y,
                        name: "",
                        roomId: parsed.roomId,
                        status: "online",
                        avatarUrl: null,
                        email: "",
                        role: null,
                        isDnd: false,
                        isAway: false,
                        audioEnabled: false,
                        videoEnabled: false,
                        lastSeen: Date.now(),
                    });
                    this.connectionToUser.set(sender.id, userId);
                    this.userToConnection.set(userId, sender.id);
                }
                const moveMsg: OutgoingMessage = {
                    type: "move",
                    userId,
                    x: parsed.x,
                    y: parsed.y,
                    roomId: parsed.roomId,
                };
                this.party.broadcast(JSON.stringify(moveMsg), [sender.id]);
                break;
            }

            case "ping": {
                // Heartbeat: update lastSeen timestamp
                const userId = parsed.userId;
                const user = this.users.get(userId);
                if (user) {
                    user.lastSeen = Date.now();
                }
                // Also update connection mapping in case of reconnect
                if (userId) {
                    this.connectionToUser.set(sender.id, userId);
                    this.userToConnection.set(userId, sender.id);
                }
                // Respond with pong so client knows connection is alive
                sender.send(JSON.stringify({ type: "pong" }));
                break;
            }

            case "join_room": {
                const userId = parsed.userId;
                const user = this.users.get(userId);
                if (user) user.roomId = parsed.roomId;
                const roomMsg: OutgoingMessage = {
                    type: "join_room",
                    userId,
                    roomId: parsed.roomId,
                };
                this.party.broadcast(JSON.stringify(roomMsg), [sender.id]);
                break;
            }

            case "leave_room": {
                const userId = parsed.userId;
                const user = this.users.get(userId);
                if (user) user.roomId = null;
                const leaveRoomMsg: OutgoingMessage = {
                    type: "leave_room",
                    userId,
                };
                this.party.broadcast(JSON.stringify(leaveRoomMsg), [sender.id]);
                break;
            }

            // ─── Knock to Enter ──────────────────────────────
            case "knock": {
                const userId = parsed.userId;
                const user = this.users.get(userId);

                // Send knock notification to all occupants of the room
                const knockMsg: OutgoingMessage = {
                    type: "knock_request",
                    userId,
                    roomId: parsed.roomId,
                    name: user?.name || 'Anonymous',
                    avatarUrl: user?.avatarUrl || null,
                };
                this.sendToRoomOccupants(parsed.roomId, knockMsg);
                break;
            }

            case "knock_response": {
                const targetId = parsed.targetUserId;

                if (parsed.accepted) {
                    // Notify the knocking user they've been accepted
                    this.sendToUser(targetId, {
                        type: "knock_accepted",
                        userId: targetId,
                        roomId: parsed.roomId,
                    });
                } else {
                    this.sendToUser(targetId, {
                        type: "knock_rejected",
                        userId: targetId,
                        roomId: parsed.roomId,
                    });
                }
                break;
            }

            // ─── Admin Commands ──────────────────────────────
            case "admin_command": {
                const adminId = parsed.adminId;

                // Validate admin/owner role
                if (!this.isAdminOrOwner(adminId)) {
                    console.warn(`[PartyKit] Non-admin user ${adminId} tried admin command: ${parsed.command}`);
                    break;
                }

                const adminMsg: OutgoingMessage = {
                    type: "admin_action",
                    command: parsed.command,
                    adminId,
                    targetUserId: parsed.targetUserId,
                    roomId: parsed.roomId,
                };

                switch (parsed.command) {
                    case 'mute_audio':
                    case 'mute_video':
                    case 'unmute_audio':
                    case 'unmute_video':
                    case 'kick_room':
                    case 'kick_office':
                        // Send to specific target user
                        if (parsed.targetUserId) {
                            this.sendToUser(parsed.targetUserId, adminMsg);
                        }
                        // Also broadcast to everyone so UIs update
                        this.party.broadcast(JSON.stringify(adminMsg));
                        break;

                    case 'mute_all':
                    case 'disable_all_cams':
                    case 'block_proximity':
                    case 'unblock_proximity':
                        // Broadcast to all users
                        this.party.broadcast(JSON.stringify(adminMsg));
                        break;

                    case 'lock_room':
                    case 'unlock_room':
                        // Broadcast to all users (need to update room UI)
                        this.party.broadcast(JSON.stringify(adminMsg));
                        break;
                }
                break;
            }

            // ─── DND/Away state update ───────────────────────
            case "update_state": {
                const userId = parsed.userId;
                const user = this.users.get(userId);
                if (user) {
                    if (parsed.isDnd !== undefined) user.isDnd = parsed.isDnd;
                    if (parsed.isAway !== undefined) user.isAway = parsed.isAway;
                }
                const stateMsg: OutgoingMessage = {
                    type: "user_update",
                    userId,
                    data: {
                        isDnd: parsed.isDnd,
                        isAway: parsed.isAway,
                    },
                };
                this.party.broadcast(JSON.stringify(stateMsg), [sender.id]);
                break;
            }

            // ─── Speaking state relay ────────────────────────
            case "speaking": {
                // Relay speaking state to all other clients
                this.party.broadcast(JSON.stringify({
                    type: "speaking",
                    userId: parsed.userId,
                    isSpeaking: parsed.isSpeaking,
                }), [sender.id]);
                break;
            }

            // ─── Media state relay (mic/cam/remoteAudio) ────
            case "media_state": {
                // Store media state on the server for init broadcasts
                const user = this.users.get(parsed.userId);
                if (user) {
                    user.audioEnabled = parsed.audioEnabled;
                    user.videoEnabled = parsed.videoEnabled;
                }
                // Relay media state to all other clients
                this.party.broadcast(JSON.stringify({
                    type: "media_state",
                    userId: parsed.userId,
                    audioEnabled: parsed.audioEnabled,
                    videoEnabled: parsed.videoEnabled,
                    remoteAudioEnabled: parsed.remoteAudioEnabled,
                }), [sender.id]);
                break;
            }

            // ─── Status change relay (online/away/busy) ─────
            case "status_change": {
                const user = this.users.get(parsed.userId);
                if (user) user.status = parsed.status;
                this.party.broadcast(JSON.stringify({
                    type: "status_change",
                    userId: parsed.userId,
                    status: parsed.status,
                }), [sender.id]);
                break;
            }

            // ─── Call request (routed to specific user) ─────
            case "call_request": {
                const targetConn = this.userToConnection.get(parsed.toUserId);
                if (targetConn) {
                    // Send directly to the target user
                    for (const conn of this.party.getConnections()) {
                        if (conn.id === targetConn) {
                            conn.send(JSON.stringify({
                                type: "call_request",
                                id: parsed.id,
                                fromUserId: parsed.fromUserId,
                                fromName: parsed.fromName,
                                fromAvatarUrl: parsed.fromAvatarUrl,
                                toUserId: parsed.toUserId,
                            }));
                            break;
                        }
                    }
                }
                break;
            }

            // ─── Call response (routed back to caller) ─────
            case "call_response": {
                const callerConn = this.userToConnection.get(parsed.toUserId);
                if (callerConn) {
                    for (const conn of this.party.getConnections()) {
                        if (conn.id === callerConn) {
                            conn.send(JSON.stringify({
                                type: "call_response",
                                id: parsed.id,
                                fromUserId: parsed.fromUserId,
                                fromName: parsed.fromName,
                                toUserId: parsed.toUserId,
                                response: parsed.response, // 'accepted' | 'declined'
                            }));
                            break;
                        }
                    }
                }
                break;
            }


            case "chat": {
                const userId = parsed.userId;
                const user = this.users.get(userId);
                const targetRoomId = parsed.roomId;

                if (!targetRoomId) break; // No room → no chat

                const chatMsg: ChatMessage = {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    userId,
                    userName: user?.name || 'Anonymous',
                    avatarUrl: user?.avatarUrl || null,
                    content: parsed.content.slice(0, 2000),
                    roomId: targetRoomId,
                    timestamp: new Date().toISOString(),
                };

                // Broadcast to room occupants EXCLUDING the sender (they already have the optimistic message)
                this.sendToRoomOccupants(targetRoomId, { type: "chat_message", message: chatMsg }, userId);
                break;
            }

            case "office_chat": {
                // Global office-wide chat → broadcast to ALL connections EXCEPT sender
                const userId = parsed.userId;
                const user = this.users.get(userId);

                const chatMsg: ChatMessage = {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    userId,
                    userName: user?.name || 'Anonymous',
                    avatarUrl: user?.avatarUrl || null,
                    content: parsed.content.slice(0, 2000),
                    roomId: null,
                    timestamp: new Date().toISOString(),
                };

                const outMsg: OutgoingMessage = { type: "office_chat_message", message: chatMsg };
                this.party.broadcast(JSON.stringify(outMsg), [sender.id]);
                break;
            }

            case "delete_message": {
                // Broadcast message deletion to relevant users
                const deleteMsg: OutgoingMessage = {
                    type: "message_deleted",
                    messageId: parsed.messageId,
                    roomId: parsed.roomId,
                };
                this.party.broadcast(JSON.stringify(deleteMsg));
                break;
            }

            // ─── Whiteboard relay ────────────────────────────
            case "wb_stroke": {
                const payload = JSON.stringify(parsed);
                if (parsed.scope === 'room' && parsed.roomId) {
                    // Send to room occupants only
                    for (const [connId, uid] of Array.from(this.connectionToUser.entries())) {
                        if (uid === (parsed as any).stroke?.userId) continue;
                        const u = this.users.get(uid);
                        if (u && u.roomId === parsed.roomId) {
                            const conn = this.party.getConnection(connId);
                            if (conn) conn.send(payload);
                        }
                    }
                } else {
                    // Office-wide: broadcast to all
                    this.party.broadcast(payload, [sender.id]);
                }
                break;
            }

            case "wb_cursor": {
                const cursorPayload = JSON.stringify(parsed);
                if (parsed.scope === 'room' && parsed.roomId) {
                    for (const [connId, uid] of Array.from(this.connectionToUser.entries())) {
                        if (uid === (parsed as any).cursor?.userId) continue;
                        const u = this.users.get(uid);
                        if (u && u.roomId === parsed.roomId) {
                            const conn = this.party.getConnection(connId);
                            if (conn) conn.send(cursorPayload);
                        }
                    }
                } else {
                    this.party.broadcast(cursorPayload, [sender.id]);
                }
                break;
            }

            case "wb_clear": {
                const clearWbPayload = JSON.stringify(parsed);
                if (parsed.scope === 'room' && parsed.roomId) {
                    for (const [connId, uid] of Array.from(this.connectionToUser.entries())) {
                        const u = this.users.get(uid);
                        if (u && u.roomId === parsed.roomId) {
                            const conn = this.party.getConnection(connId);
                            if (conn) conn.send(clearWbPayload);
                        }
                    }
                } else {
                    this.party.broadcast(clearWbPayload, [sender.id]);
                }
                break;
            }

            case "wb_activity": {
                const actPayload = JSON.stringify(parsed);
                if (parsed.scope === 'room' && parsed.roomId) {
                    for (const [connId, uid] of Array.from(this.connectionToUser.entries())) {
                        if (uid === parsed.userId) continue;
                        const u = this.users.get(uid);
                        if (u && u.roomId === parsed.roomId) {
                            const conn = this.party.getConnection(connId);
                            if (conn) conn.send(actPayload);
                        }
                    }
                } else {
                    this.party.broadcast(actPayload, [sender.id]);
                }
                break;
            }

            case "wb_stroke_update": {
                const updatePayload = JSON.stringify(parsed);
                if (parsed.scope === 'room' && parsed.roomId) {
                    for (const [connId, uid] of Array.from(this.connectionToUser.entries())) {
                        const u = this.users.get(uid);
                        if (u && u.roomId === parsed.roomId) {
                            const conn = this.party.getConnection(connId);
                            if (conn) conn.send(updatePayload);
                        }
                    }
                } else {
                    this.party.broadcast(updatePayload, [sender.id]);
                }
                break;
            }

            case "clear_chat": {
                // Broadcast chat cleared event
                const clearMsg: OutgoingMessage = {
                    type: "chat_cleared",
                    roomId: parsed.roomId,
                };
                this.party.broadcast(JSON.stringify(clearMsg));
                break;
            }
        }
    }

    onClose(connection: any) {
        const userId = this.connectionToUser.get(connection.id);
        if (userId) {
            this.connectionToUser.delete(connection.id);

            // Only process leave if this connection was the ACTIVE one for this userId
            const activeConnId = this.userToConnection.get(userId);
            if (activeConnId === connection.id) {
                // Cancel any existing pending leave for this user
                const existingTimer = this.pendingLeaves.get(userId);
                if (existingTimer) clearTimeout(existingTimer);

                // Grace period: wait 3 seconds before broadcasting leave.
                // If the user reconnects quickly (room switch, page navigation, network hiccup),
                // the identify message will cancel this timer and prevent ghost flicker.
                const timer = setTimeout(() => {
                    this.pendingLeaves.delete(userId);
                    // Re-check: has the user reconnected during the grace period?
                    const currentConnId = this.userToConnection.get(userId);
                    if (currentConnId) {
                        const conn = this.party.getConnection(currentConnId);
                        if (conn) {
                            // User reconnected — do NOT broadcast leave
                            return;
                        }
                    }
                    // User truly left — clean up and broadcast
                    this.users.delete(userId);
                    this.userToConnection.delete(userId);
                    const leaveMsg: OutgoingMessage = { type: "leave", userId };
                    this.party.broadcast(JSON.stringify(leaveMsg));
                    console.log(`[PartyKit] User left after grace period: ${userId.slice(0, 8)}`);
                }, 3000);
                this.pendingLeaves.set(userId, timer);
            }

            // Clean up orphaned connectionToUser entries for this userId
            for (const [connId, uid] of Array.from(this.connectionToUser.entries())) {
                if (uid === userId && !this.party.getConnection(connId)) {
                    this.connectionToUser.delete(connId);
                }
            }
        }
    }
}
