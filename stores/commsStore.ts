import { create } from 'zustand';

// ============================================
// COMMS STORE — Communication Bridge
// Replaces all (window as any).__xxx globals
// with typed, centralized function references.
// ============================================

// ─── PartyKit Messaging Functions ─────────────────────────
type SendChatMessageFn = (content: string, roomId: string) => void;
type SendOfficeChatMessageFn = (content: string, replyToId?: string) => void;
type SendDeleteMessageFn = (messageId: string, scope: string | null) => void;
type SendClearChatFn = (scope: string | null) => void;
type SendKnockFn = (roomId: string) => void;
type SendKnockResponseFn = (userId: string, roomId: string, accepted: boolean) => void;
type SendAdminCommandFn = (command: string, targetUserId: string, payload?: any) => void;
type SendLeaveRoomFn = () => void;
type SendStateUpdateFn = (isDnd?: boolean, isAway?: boolean) => void;
type SendMediaStateFn = (audioEnabled: boolean, videoEnabled: boolean, remoteAudioEnabled: boolean) => void;
type SendStatusChangeFn = (status: string) => void;

// ─── Avatar/Room Functions ────────────────────────────────
type SendAvatarPositionFn = (x: number, y: number, roomId: string | null) => void;
type SendJoinRoomFn = (roomId: string) => void;

// ─── LiveKit Context Functions ────────────────────────────
type JoinContextFn = (contextType: 'room' | 'proximity', contextId: string) => Promise<void> | void;
type LeaveContextFn = () => Promise<void> | void;

// ─── Knock System Handlers ───────────────────────────────
type KnockRequestData = {
    userId: string;
    roomId: string;
    name: string;
    avatarUrl?: string;
    timestamp: number;
};
type HandleKnockRequestFn = (data: KnockRequestData) => void;
type HandleKnockAcceptedFn = (roomId: string) => void;
type HandleKnockRejectedFn = (roomId: string) => void;

interface CommsState {
    // ─── Raw socket reference ─────────────────────────────
    partykitSocket: any | null;

    // ─── PartyKit messaging functions ─────────────────────
    sendChatMessage: SendChatMessageFn | null;
    sendOfficeChatMessage: SendOfficeChatMessageFn | null;
    sendDeleteMessage: SendDeleteMessageFn | null;
    sendClearChat: SendClearChatFn | null;
    sendKnock: SendKnockFn | null;
    sendKnockResponse: SendKnockResponseFn | null;
    sendAdminCommand: SendAdminCommandFn | null;
    sendLeaveRoom: SendLeaveRoomFn | null;
    sendStateUpdate: SendStateUpdateFn | null;
    sendMediaState: SendMediaStateFn | null;
    sendStatusChange: SendStatusChangeFn | null;

    // ─── Avatar/room position ─────────────────────────────
    sendAvatarPosition: SendAvatarPositionFn | null;
    sendJoinRoom: SendJoinRoomFn | null;

    // ─── LiveKit context (join/leave media calls) ─────────
    joinContext: JoinContextFn | null;
    leaveContext: LeaveContextFn | null;

    // ─── LiveKit room ref (for screen sharing etc) ────────
    livekitRoom: any | null;

    // ─── Knock system handlers ────────────────────────────
    handleKnockRequest: HandleKnockRequestFn | null;
    handleKnockAccepted: HandleKnockAcceptedFn | null;
    handleKnockRejected: HandleKnockRejectedFn | null;

    // ─── Knock rate limiting ──────────────────────────────
    lastKnockTimes: Record<string, number>;

    // ─── Active space ID ──────────────────────────────────
    activeSpaceId: string | null;

    // ─── Setters ──────────────────────────────────────────
    setPartykitSocket: (socket: any | null) => void;
    setSendChatMessage: (fn: SendChatMessageFn | null) => void;
    setSendOfficeChatMessage: (fn: SendOfficeChatMessageFn | null) => void;
    setSendDeleteMessage: (fn: SendDeleteMessageFn | null) => void;
    setSendClearChat: (fn: SendClearChatFn | null) => void;
    setSendKnock: (fn: SendKnockFn | null) => void;
    setSendKnockResponse: (fn: SendKnockResponseFn | null) => void;
    setSendAdminCommand: (fn: SendAdminCommandFn | null) => void;
    setSendLeaveRoom: (fn: SendLeaveRoomFn | null) => void;
    setSendStateUpdate: (fn: SendStateUpdateFn | null) => void;
    setSendMediaState: (fn: SendMediaStateFn | null) => void;
    setSendStatusChange: (fn: SendStatusChangeFn | null) => void;
    setSendAvatarPosition: (fn: SendAvatarPositionFn | null) => void;
    setSendJoinRoom: (fn: SendJoinRoomFn | null) => void;
    setJoinContext: (fn: JoinContextFn | null) => void;
    setLeaveContext: (fn: LeaveContextFn | null) => void;
    setLivekitRoom: (room: any | null) => void;
    setHandleKnockRequest: (fn: HandleKnockRequestFn | null) => void;
    setHandleKnockAccepted: (fn: HandleKnockAcceptedFn | null) => void;
    setHandleKnockRejected: (fn: HandleKnockRejectedFn | null) => void;
    setLastKnockTime: (key: string, time: number) => void;
    getLastKnockTime: (key: string) => number;
    setActiveSpaceId: (id: string | null) => void;

    // ─── Bulk cleanup ─────────────────────────────────────
    clearAll: () => void;
}

export const useCommsStore = create<CommsState>((set, get) => ({
    partykitSocket: null,
    sendChatMessage: null,
    sendOfficeChatMessage: null,
    sendDeleteMessage: null,
    sendClearChat: null,
    sendKnock: null,
    sendKnockResponse: null,
    sendAdminCommand: null,
    sendLeaveRoom: null,
    sendStateUpdate: null,
    sendMediaState: null,
    sendStatusChange: null,
    sendAvatarPosition: null,
    sendJoinRoom: null,
    joinContext: null,
    leaveContext: null,
    livekitRoom: null,
    handleKnockRequest: null,
    handleKnockAccepted: null,
    handleKnockRejected: null,
    lastKnockTimes: {},
    activeSpaceId: null,

    // ─── Setters ──────────────────────────────────────────
    setPartykitSocket: (socket) => set({ partykitSocket: socket }),
    setSendChatMessage: (fn) => set({ sendChatMessage: fn }),
    setSendOfficeChatMessage: (fn) => set({ sendOfficeChatMessage: fn }),
    setSendDeleteMessage: (fn) => set({ sendDeleteMessage: fn }),
    setSendClearChat: (fn) => set({ sendClearChat: fn }),
    setSendKnock: (fn) => set({ sendKnock: fn }),
    setSendKnockResponse: (fn) => set({ sendKnockResponse: fn }),
    setSendAdminCommand: (fn) => set({ sendAdminCommand: fn }),
    setSendLeaveRoom: (fn) => set({ sendLeaveRoom: fn }),
    setSendStateUpdate: (fn) => set({ sendStateUpdate: fn }),
    setSendMediaState: (fn) => set({ sendMediaState: fn }),
    setSendStatusChange: (fn) => set({ sendStatusChange: fn }),
    setSendAvatarPosition: (fn) => set({ sendAvatarPosition: fn }),
    setSendJoinRoom: (fn) => set({ sendJoinRoom: fn }),
    setJoinContext: (fn) => set({ joinContext: fn }),
    setLeaveContext: (fn) => set({ leaveContext: fn }),
    setLivekitRoom: (room) => set({ livekitRoom: room }),
    setHandleKnockRequest: (fn) => set({ handleKnockRequest: fn }),
    setHandleKnockAccepted: (fn) => set({ handleKnockAccepted: fn }),
    setHandleKnockRejected: (fn) => set({ handleKnockRejected: fn }),
    setLastKnockTime: (key, time) => set((state) => ({
        lastKnockTimes: { ...state.lastKnockTimes, [key]: time },
    })),
    getLastKnockTime: (key) => get().lastKnockTimes[key] || 0,
    setActiveSpaceId: (id) => set({ activeSpaceId: id }),

    clearAll: () => set({
        partykitSocket: null,
        sendChatMessage: null,
        sendOfficeChatMessage: null,
        sendDeleteMessage: null,
        sendClearChat: null,
        sendKnock: null,
        sendKnockResponse: null,
        sendAdminCommand: null,
        sendLeaveRoom: null,
        sendStateUpdate: null,
        sendMediaState: null,
        sendStatusChange: null,
        sendAvatarPosition: null,
        sendJoinRoom: null,
        joinContext: null,
        leaveContext: null,
        livekitRoom: null,
        handleKnockRequest: null,
        handleKnockAccepted: null,
        handleKnockRejected: null,
        lastKnockTimes: {},
        activeSpaceId: null,
    }),
}));
