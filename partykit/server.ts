// ============================================
// PartyKit Server — Avatar sync + Room Chat + Office Chat
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
}

interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    avatarUrl: string | null;
    content: string;
    roomId: string | null;
    timestamp: string;
}

type IncomingMessage =
    | { type: "move"; userId: string; x: number; y: number; roomId: string | null }
    | { type: "join_room"; userId: string; roomId: string }
    | { type: "identify"; userId: string; name: string; email: string; avatarUrl: string | null; status: string; role?: string | null }
    | { type: "chat"; userId: string; content: string; roomId: string }
    | { type: "office_chat"; userId: string; content: string }
    | { type: "delete_message"; userId: string; messageId: string; roomId: string | null }
    | { type: "clear_chat"; userId: string; roomId: string | null };

type OutgoingMessage =
    | { type: "init"; users: Record<string, UserState> }
    | { type: "move"; userId: string; x: number; y: number; roomId: string | null }
    | { type: "join_room"; userId: string; roomId: string }
    | { type: "leave"; userId: string }
    | { type: "user_update"; userId: string; data: Partial<UserState> }
    | { type: "chat_message"; message: ChatMessage }
    | { type: "office_chat_message"; message: ChatMessage }
    | { type: "message_deleted"; messageId: string; roomId: string | null }
    | { type: "chat_cleared"; roomId: string | null };

/* eslint-disable @typescript-eslint/no-explicit-any */
export default class AvatarServer {
    private users = new Map<string, UserState>();
    private connectionToUser = new Map<string, string>(); // connection.id → userId
    private userToConnection = new Map<string, string>(); // userId → connection.id

    constructor(public party: any) { }

    onConnect(connection: any) {
        // Send current state of all users to new connection
        const usersObj: Record<string, UserState> = {};
        this.users.forEach((state, id) => {
            usersObj[id] = state;
        });
        const initMsg: OutgoingMessage = { type: "init", users: usersObj };
        connection.send(JSON.stringify(initMsg));
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
                this.connectionToUser.set(sender.id, userId);
                this.userToConnection.set(userId, sender.id);
                const existing = this.users.get(userId);
                this.users.set(userId, {
                    x: existing?.x ?? 500,
                    y: existing?.y ?? 500,
                    name: parsed.name,
                    roomId: existing?.roomId ?? null,
                    status: parsed.status,
                    avatarUrl: parsed.avatarUrl,
                    email: parsed.email,
                    role: parsed.role || existing?.role || null,
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

                // Broadcast ONLY to users in the same roomId
                const outMsg: OutgoingMessage = { type: "chat_message", message: chatMsg };
                const payload = JSON.stringify(outMsg);

                // Find all connection IDs for users in this room
                for (const [connId, uid] of this.connectionToUser.entries()) {
                    const u = this.users.get(uid);
                    if (u && u.roomId === targetRoomId) {
                        // Get the connection object and send directly
                        const conn = this.party.getConnection(connId);
                        if (conn) conn.send(payload);
                    }
                }
                break;
            }

            case "office_chat": {
                // Global office-wide chat → broadcast to ALL connections
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
                this.party.broadcast(JSON.stringify(outMsg));
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
            this.users.delete(userId);
            this.connectionToUser.delete(connection.id);
            this.userToConnection.delete(userId);
            const leaveMsg: OutgoingMessage = { type: "leave", userId };
            this.party.broadcast(JSON.stringify(leaveMsg));
        }
    }
}
