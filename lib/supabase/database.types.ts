// ============================================
// COSMOFFICE - TIPES GENERATI PER SUPABASE
// Schema v2 - RBAC + Moderation
// ============================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest' | 'viewer';

export type UserStatus = 'online' | 'away' | 'busy' | 'offline' | 'invisible';

export type RoomType = 'open' | 'meeting' | 'focus' | 'break' | 'reception' | 'private';

export type MessageType = 'text' | 'image' | 'file' | 'system' | 'join' | 'leave' | 'call_start' | 'call_end';

export type ConversationType = 'room' | 'channel' | 'direct';

export type NotificationType = 'mention' | 'invite' | 'room_enter' | 'message' | 'system' | 'kick' | 'ban' | 'mute';

// ============================================
// TABELLE
// ============================================

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  locale: string;
  status: UserStatus;
  last_seen_at: string;
  preferences: Json;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  plan_expires_at: string | null;
  max_members: number;
  max_spaces: number;
  max_rooms_per_space: number;
  storage_quota_bytes: number;
  settings: {
    allow_guest_invites?: boolean;
    allow_member_create_spaces?: boolean;
    require_approval_for_invites?: boolean;
    default_space_visibility?: 'public' | 'private';
    enable_ai_agents?: boolean;
    enable_analytics?: boolean;
    theme?: string;
  };
  branding: Json;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  permissions: Json;
  invited_by: string | null;
  invited_at: string | null;
  joined_at: string;
  last_active_at: string | null;
  removed_at: string | null;
  removed_by: string | null;
  remove_reason: string | null;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_by: string | null;
  suspend_reason: string | null;
  suspend_expires_at: string | null;
}

export interface WorkspaceRolePermission {
  id: string;
  workspace_id: string;
  role: WorkspaceRole;
  can_manage_workspace_settings: boolean;
  can_delete_workspace: boolean;
  can_manage_billing: boolean;
  can_invite_members: boolean;
  can_remove_members: boolean;
  can_manage_member_roles: boolean;
  can_ban_members: boolean;
  can_view_audit_logs: boolean;
  can_create_spaces: boolean;
  can_delete_spaces: boolean;
  can_archive_spaces: boolean;
  can_manage_space_settings: boolean;
  can_create_rooms: boolean;
  can_delete_rooms: boolean;
  can_edit_rooms: boolean;
  can_lock_rooms: boolean;
  can_enter_locked_rooms: boolean;
  can_kick_from_rooms: boolean;
  can_mute_in_rooms: boolean;
  can_manage_furniture: boolean;
  can_delete_any_message: boolean;
  can_moderate_chat: boolean;
  can_pin_messages: boolean;
  can_manage_ai_agents: boolean;
  can_manage_integrations: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceBan {
  id: string;
  workspace_id: string;
  user_id: string;
  banned_by: string | null;
  banned_at: string;
  expires_at: string | null;
  reason: string | null;
  ban_type: 'workspace' | 'space' | 'room';
  space_id: string | null;
  room_id: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
}

export interface Space {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  slug: string;
  visibility: 'public' | 'private' | 'invitation_only';
  layout_data: {
    grid_size?: number;
    show_grid?: boolean;
    background?: string;
    zoom_default?: number;
  };
  settings: {
    max_participants?: number;
    enable_chat?: boolean;
    enable_video?: boolean;
    enable_screen_share?: boolean;
    enable_reactions?: boolean;
    chat_history_days?: number;
  };
  thumbnail_url: string | null;
  archived_at: string | null;
  archived_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface SpaceMember {
  id: string;
  space_id: string;
  user_id: string;
  role: WorkspaceRole | null;
  can_create_rooms: boolean;
  can_delete_rooms: boolean;
  can_moderate_chat: boolean;
  can_manage_furniture: boolean;
  added_by: string | null;
  added_at: string;
}

export interface Room {
  id: string;
  space_id: string;
  name: string;
  type: RoomType;
  description: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  color: string;
  icon: string | null;
  background_image_url: string | null;
  capacity: number;
  is_secret: boolean;
  is_locked: boolean;
  who_can_enter: WorkspaceRole;
  who_can_moderate: WorkspaceRole;
  department: string | null;
  settings: Json;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface RoomConnection {
  id: string;
  space_id: string;
  room_a_id: string;
  room_b_id: string;
  type: 'door' | 'portal' | 'stairs' | 'elevator';
  x_a: number;
  y_a: number;
  x_b: number;
  y_b: number;
  is_locked: boolean;
  settings: Json;
  created_at: string;
}

export interface RoomParticipant {
  id: string;
  room_id: string;
  user_id: string;
  x: number;
  y: number;
  direction: number;
  audio_enabled: boolean;
  video_enabled: boolean;
  screen_sharing: boolean;
  hand_raised: boolean;
  status: 'active' | 'away' | 'dnd' | 'in_call';
  joined_at: string;
  last_activity_at: string;
  is_kicked: boolean;
  kicked_at: string | null;
  kicked_by: string | null;
  kick_reason: string | null;
  is_muted: boolean;
  muted_at: string | null;
  muted_by: string | null;
  mute_expires_at: string | null;
}

export interface RoomKick {
  id: string;
  room_id: string;
  user_id: string;
  kicked_by: string | null;
  kicked_at: string;
  reason: string | null;
  can_reenter: boolean;
  banned_until: string | null;
  notification_sent: boolean;
}

export interface RoomMute {
  id: string;
  room_id: string;
  user_id: string;
  muted_by: string | null;
  muted_at: string;
  mute_type: 'chat' | 'audio' | 'video' | 'all';
  expires_at: string | null;
  unmuted_by: string | null;
  unmuted_at: string | null;
}

export interface Furniture {
  id: string;
  room_id: string;
  type: string;
  label: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z_index: number;
  is_interactable: boolean;
  interaction_type: string | null;
  interaction_data: Json;
  color: string;
  icon: string | null;
  image_url: string | null;
  settings: Json;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  type: ConversationType;
  room_id: string | null;
  name: string | null;
  topic: string | null;
  is_private: boolean;
  is_archived: boolean;
  user_a_id: string | null;
  user_b_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  notification_settings: {
    mute?: boolean;
    mentions_only?: boolean;
  };
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_name: string | null;
  sender_avatar_url: string | null;
  content: string;
  type: MessageType;
  formatted_content: Json;
  reply_to_id: string | null;
  reactions: Array<{
    emoji: string;
    users: string[];
    count: number;
  }>;
  edited_at: string | null;
  edited_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  thread_parent_id: string | null;
  reply_count: number;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  public_url: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  icon: string | null;
  image_url: string | null;
  created_at: string;
}

export interface AiAgent {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  role: string;
  personality: string | null;
  system_prompt: string;
  capabilities: string[];
  allowed_spaces: string[] | null;
  allowed_rooms: string[] | null;
  is_active: boolean;
  messages_sent: number;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  expires_at: string;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
}

export interface WorkspaceJoinRequest {
  id: string;
  workspace_id: string;
  user_id: string;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  requested_at: string;
}

export interface UserPresence {
  user_id: string;
  workspace_id: string;
  space_id: string | null;
  room_id: string | null;
  status: 'online' | 'away' | 'busy' | 'in_call' | 'offline';
  status_message: string | null;
  last_seen_at: string;
  client_version: string | null;
  platform: 'web' | 'desktop' | 'mobile' | null;
}

export interface WorkspaceAuditLog {
  id: string;
  workspace_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Json;
  old_values: Json;
  new_values: Json;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ============================================
// VISTE
// ============================================

export interface WorkspaceStats {
  id: string;
  name: string;
  plan: string;
  created_at: string;
  member_count: number;
  space_count: number;
  room_count: number;
  total_messages: number;
}

export interface WorkspaceBanDetail {
  id: string;
  workspace_id: string;
  user_id: string;
  banned_by: string | null;
  banned_at: string;
  expires_at: string | null;
  reason: string | null;
  ban_type: string;
  space_id: string | null;
  room_id: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  banned_user_email: string;
  banned_user_name: string | null;
  banned_by_name: string | null;
}

// ============================================
// DATABASE SCHEMA
// ============================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      workspaces: {
        Row: Workspace;
        Insert: Omit<Workspace, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Workspace, 'id' | 'created_at'>>;
      };
      workspace_members: {
        Row: WorkspaceMember;
        Insert: Omit<WorkspaceMember, 'id' | 'joined_at'>;
        Update: Partial<Omit<WorkspaceMember, 'id' | 'workspace_id' | 'user_id'>>;
      };
      workspace_role_permissions: {
        Row: WorkspaceRolePermission;
        Insert: Omit<WorkspaceRolePermission, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<WorkspaceRolePermission, 'id' | 'workspace_id' | 'role'>>;
      };
      workspace_bans: {
        Row: WorkspaceBan;
        Insert: Omit<WorkspaceBan, 'id' | 'banned_at'>;
        Update: Partial<Omit<WorkspaceBan, 'id'>>;
      };
      spaces: {
        Row: Space;
        Insert: Omit<Space, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Space, 'id' | 'created_at'>>;
      };
      space_members: {
        Row: SpaceMember;
        Insert: Omit<SpaceMember, 'id' | 'added_at'>;
        Update: Partial<Omit<SpaceMember, 'id' | 'space_id' | 'user_id'>>;
      };
      rooms: {
        Row: Room;
        Insert: Omit<Room, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Room, 'id' | 'created_at'>>;
      };
      room_connections: {
        Row: RoomConnection;
        Insert: Omit<RoomConnection, 'id' | 'created_at'>;
        Update: Partial<Omit<RoomConnection, 'id'>>;
      };
      room_participants: {
        Row: RoomParticipant;
        Insert: Omit<RoomParticipant, 'id' | 'joined_at'>;
        Update: Partial<Omit<RoomParticipant, 'id' | 'room_id' | 'user_id'>>;
      };
      room_kicks: {
        Row: RoomKick;
        Insert: Omit<RoomKick, 'id' | 'kicked_at'>;
        Update: Partial<Omit<RoomKick, 'id'>>;
      };
      room_mutes: {
        Row: RoomMute;
        Insert: Omit<RoomMute, 'id' | 'muted_at'>;
        Update: Partial<Omit<RoomMute, 'id'>>;
      };
      furniture: {
        Row: Furniture;
        Insert: Omit<Furniture, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Furniture, 'id' | 'created_at'>>;
      };
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Conversation, 'id' | 'created_at'>>;
      };
      conversation_members: {
        Row: ConversationMember;
        Insert: Omit<ConversationMember, 'id' | 'joined_at'>;
        Update: Partial<Omit<ConversationMember, 'id'>>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, 'id' | 'created_at' | 'reply_count'>;
        Update: Partial<Omit<Message, 'id' | 'created_at'>>;
      };
      message_attachments: {
        Row: MessageAttachment;
        Insert: Omit<MessageAttachment, 'id' | 'uploaded_at'>;
        Update: Partial<Omit<MessageAttachment, 'id'>>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at'>;
        Update: Partial<Omit<Notification, 'id'>>;
      };
      ai_agents: {
        Row: AiAgent;
        Insert: Omit<AiAgent, 'id' | 'created_at' | 'updated_at' | 'messages_sent'>;
        Update: Partial<Omit<AiAgent, 'id' | 'created_at'>>;
      };
      workspace_invitations: {
        Row: WorkspaceInvitation;
        Insert: Omit<WorkspaceInvitation, 'id' | 'invited_at'>;
        Update: Partial<Omit<WorkspaceInvitation, 'id'>>;
      };
      workspace_join_requests: {
        Row: WorkspaceJoinRequest;
        Insert: Omit<WorkspaceJoinRequest, 'id' | 'requested_at'>;
        Update: Partial<Omit<WorkspaceJoinRequest, 'id'>>;
      };
      user_presence: {
        Row: UserPresence;
        Insert: Omit<UserPresence, 'last_seen_at'>;
        Update: Partial<UserPresence>;
      };
      workspace_audit_logs: {
        Row: WorkspaceAuditLog;
        Insert: Omit<WorkspaceAuditLog, 'id' | 'created_at'>;
        Update: never;
      };
    };
    Views: {
      workspace_stats: {
        Row: WorkspaceStats;
      };
      workspace_ban_details: {
        Row: WorkspaceBanDetail;
      };
      room_moderation_status: {
        Row: {
          room_id: string;
          room_name: string;
          active_users: number;
          muted_users: number;
          muted_list: Json;
        };
      };
    };
    Functions: {
      // Helper functions
      is_workspace_member: {
        Args: { check_workspace_id: string };
        Returns: boolean;
      };
      is_workspace_admin: {
        Args: { check_workspace_id: string };
        Returns: boolean;
      };
      is_workspace_owner: {
        Args: { check_workspace_id: string };
        Returns: boolean;
      };
      can_access_space: {
        Args: { check_space_id: string };
        Returns: boolean;
      };
      is_space_admin: {
        Args: { check_space_id: string };
        Returns: boolean;
      };
      can_enter_room: {
        Args: { check_room_id: string };
        Returns: boolean;
      };
      can_enter_room_v2: {
        Args: { check_room_id: string };
        Returns: boolean;
      };
      can_moderate_user: {
        Args: { p_workspace_id: string; p_target_user_id: string };
        Returns: boolean;
      };
      has_workspace_permission: {
        Args: { p_workspace_id: string; p_permission: string };
        Returns: boolean;
      };
      is_user_banned: {
        Args: { p_workspace_id: string; p_user_id?: string };
        Returns: boolean;
      };
      is_user_muted: {
        Args: { p_room_id: string; p_mute_type?: string };
        Returns: boolean;
      };
      // Moderation functions
      kick_user_from_room: {
        Args: { 
          p_room_id: string; 
          p_user_id: string; 
          p_reason?: string; 
          p_duration_minutes?: number 
        };
        Returns: void;
      };
      ban_user_from_workspace: {
        Args: { 
          p_workspace_id: string; 
          p_user_id: string; 
          p_reason?: string; 
          p_expires_at?: string 
        };
        Returns: void;
      };
      unban_user_from_workspace: {
        Args: { 
          p_workspace_id: string; 
          p_user_id: string; 
          p_reason?: string 
        };
        Returns: void;
      };
      mute_user_in_room: {
        Args: { 
          p_room_id: string; 
          p_user_id: string; 
          p_mute_type?: string; 
          p_duration_minutes?: number 
        };
        Returns: void;
      };
      unmute_user_in_room: {
        Args: { 
          p_room_id: string; 
          p_user_id: string; 
          p_mute_type?: string 
        };
        Returns: void;
      };
      change_user_role: {
        Args: { 
          p_workspace_id: string; 
          p_user_id: string; 
          p_new_role: WorkspaceRole 
        };
        Returns: void;
      };
      // Utility functions
      log_workspace_action: {
        Args: {
          p_workspace_id: string;
          p_user_id: string;
          p_action: string;
          p_entity_type: string;
          p_entity_id?: string;
          p_metadata?: Json;
        };
        Returns: void;
      };
    };
  };
}
