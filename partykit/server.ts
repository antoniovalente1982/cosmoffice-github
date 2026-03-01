// ============================================
// PartyKit Server — Avatar position sync
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
}

type IncomingMessage =
    | { type: "move"; userId: string; x: number; y: number; roomId: string | null }
    | { type: "join_room"; userId: string; roomId: string }
    | { type: "identify"; userId: string; name: string; email: string; avatarUrl: string | null; status: string };

type OutgoingMessage =
    | { type: "init"; users: Record<string, UserState> }
    | { type: "move"; userId: string; x: number; y: number; roomId: string | null }
    | { type: "join_room"; userId: string; roomId: string }
    | { type: "leave"; userId: string }
    | { type: "user_update"; userId: string; data: Partial<UserState> };

/* eslint-disable @typescript-eslint/no-explicit-any */
export default class AvatarServer {
    private users = new Map<string, UserState>();
    private connectionToUser = new Map<string, string>(); // connection.id → userId

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
                const existing = this.users.get(userId);
                this.users.set(userId, {
                    x: existing?.x ?? 500,
                    y: existing?.y ?? 500,
                    name: parsed.name,
                    roomId: existing?.roomId ?? null,
                    status: parsed.status,
                    avatarUrl: parsed.avatarUrl,
                    email: parsed.email,
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
                    });
                    this.connectionToUser.set(sender.id, userId);
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
        }
    }

    onClose(connection: any) {
        const userId = this.connectionToUser.get(connection.id);
        if (userId) {
            this.users.delete(userId);
            this.connectionToUser.delete(connection.id);
            const leaveMsg: OutgoingMessage = { type: "leave", userId };
            this.party.broadcast(JSON.stringify(leaveMsg));
        }
    }
}
