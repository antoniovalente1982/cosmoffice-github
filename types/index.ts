// ============================================
// Shared Types — Central type definitions
// Eliminates 'as any' casts across the codebase
// ============================================

// ─── User / Profile ───
export interface UserProfile {
    id: string;
    email: string;
    full_name?: string;
    display_name?: string;
    avatar_url?: string;
    timezone?: string;
    created_at?: string;
}

// ─── Workspace ───
export interface Workspace {
    id: string;
    name: string;
    owner_id: string;
    max_seats: number;
    plan?: string;
    created_at: string;
    layout_data?: LayoutData;
    theme?: 'space' | 'corporate' | 'medical';
    status?: 'active' | 'suspended' | 'deleted';
}

// ─── Layout / Room ───
export interface LayoutData {
    rooms: RoomData[];
    landingPad?: { x: number; y: number };
    connections?: RoomConnection[];
}

export interface RoomData {
    id: string;
    name: string;
    type: 'meeting' | 'focus' | 'social' | 'break' | 'custom';
    x: number;
    y: number;
    width: number;
    height: number;
    capacity?: number;
    color?: string;
    isPrivate?: boolean;
    knockRequired?: boolean;
}

export interface RoomConnection {
    from: string;
    to: string;
    label?: string;
}

// ─── Position ───
export interface Position {
    x: number;
    y: number;
}

// ─── Custom Events ───
// Used to type custom window events that replace 'as any' casts

export interface PartykitDataChangedEvent extends Event {
    type: 'partykit-data-changed';
}

export interface WhiteboardMessageEvent extends Event {
    type: 'whiteboard-message';
    detail?: {
        action: string;
        data?: unknown;
    };
}

// ─── Membership ───
export type MemberRole = 'owner' | 'admin' | 'member' | 'guest';
export type UserStatus = 'online' | 'away' | 'busy' | 'offline';

export interface WorkspaceMember {
    id: string;
    user_id: string;
    workspace_id: string;
    role: MemberRole;
    invited_by?: string;
    created_at: string;
    removed_at?: string;
    profile?: UserProfile;
}

// ─── PartyKit Message Types ───
export type PartykitMessageType =
    | 'identify'
    | 'move'
    | 'enter_room'
    | 'leave_room'
    | 'chat'
    | 'office_chat'
    | 'delete_message'
    | 'clear_chat'
    | 'knock'
    | 'knock_response'
    | 'admin_command'
    | 'call_request'
    | 'call_response'
    | 'update_state'
    | 'screenshare_started'
    | 'screenshare_stopped'
    | 'ping'
    | 'pong'
    | 'sync'
    | 'request_sync'
    | 'whiteboard_action';

export interface PartykitMessage {
    type: PartykitMessageType;
    userId?: string;
    [key: string]: unknown;
}
