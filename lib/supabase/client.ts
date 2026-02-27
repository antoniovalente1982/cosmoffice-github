// ============================================
// COSMOFFICE - SUPABASE CLIENT
// Configurazione con tipi e helpers
// ============================================

import { createClient } from '@supabase/supabase-js';
import type { Database, WorkspaceRole } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// ============================================
// HELPERS AUTH
// ============================================

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  return data;
}

// ============================================
// HELPERS WORKSPACE
// ============================================

export async function getUserWorkspaces() {
  const user = await getCurrentUser();
  if (!user) return [];
  
  const { data } = await supabase
    .from('workspace_members')
    .select(`
      *,
      workspace:workspaces(*)
    `)
    .eq('user_id', user.id)
    .is('removed_at', null)
    .is('is_suspended', false)
    .order('joined_at', { ascending: false });
  
  return data || [];
}

export async function getWorkspaceBySlug(slug: string) {
  const { data } = await supabase
    .from('workspaces')
    .select('*')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();
  
  return data;
}

export async function getWorkspaceMembers(workspaceId: string) {
  const { data } = await supabase
    .from('workspace_members')
    .select(`
      *,
      profile:profiles(id, email, full_name, display_name, avatar_url, status)
    `)
    .eq('workspace_id', workspaceId)
    .is('removed_at', null)
    .order('joined_at', { ascending: false });
  
  return data || [];
}

export async function getWorkspaceRolePermissions(workspaceId: string) {
  const { data } = await supabase
    .from('workspace_role_permissions')
    .select('*')
    .eq('workspace_id', workspaceId);
  
  return data || [];
}

// ============================================
// HELPERS SPACE
// ============================================

export async function getWorkspaceSpaces(workspaceId: string) {
  const { data } = await supabase
    .from('spaces')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  
  return data || [];
}

export async function getSpaceBySlug(workspaceId: string, slug: string) {
  const { data } = await supabase
    .from('spaces')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();
  
  return data;
}

// ============================================
// HELPERS ROOM
// ============================================

export async function getSpaceRooms(spaceId: string) {
  const { data } = await supabase
    .from('rooms')
    .select('*')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  
  return data || [];
}

export async function getRoomById(roomId: string) {
  const { data } = await supabase
    .from('rooms')
    .select(`
      *,
      space:spaces(*)
    `)
    .eq('id', roomId)
    .is('deleted_at', null)
    .single();
  
  return data;
}

export async function getRoomParticipants(roomId: string) {
  const { data } = await supabase
    .from('room_participants')
    .select(`
      *,
      profile:profiles(id, email, full_name, display_name, avatar_url, status)
    `)
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });
  
  return data || [];
}

export async function joinRoom(roomId: string, x: number = 100, y: number = 100) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  
  const { error } = await supabase
    .from('room_participants')
    .upsert({
      room_id: roomId,
      user_id: user.id,
      x,
      y,
      status: 'active',
    });
  
  if (error) throw error;
}

export async function leaveRoom(roomId: string) {
  const user = await getCurrentUser();
  if (!user) return;
  
  await supabase
    .from('room_participants')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', user.id);
}

export async function updateParticipantPosition(
  roomId: string, 
  x: number, 
  y: number, 
  direction?: number
) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  
  const update: any = { x, y, last_activity_at: new Date().toISOString() };
  if (direction !== undefined) update.direction = direction;
  
  await supabase
    .from('room_participants')
    .update(update)
    .eq('room_id', roomId)
    .eq('user_id', user.id);
}

// ============================================
// HELPERS CHAT
// ============================================

export async function getRoomConversation(roomId: string) {
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .eq('room_id', roomId)
    .eq('type', 'room')
    .single();
  
  return data;
}

export async function getConversationMessages(
  conversationId: string, 
  limit: number = 50, 
  before?: string
) {
  let query = supabase
    .from('messages')
    .select(`
      *,
      attachments:message_attachments(*)
    `)
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (before) {
    query = query.lt('created_at', before);
  }
  
  const { data } = await query;
  return data?.reverse() || [];
}

export async function sendMessage(
  conversationId: string, 
  content: string, 
  replyToId?: string
) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  
  const profile = await getCurrentProfile();
  
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      sender_name: profile?.display_name || profile?.full_name || 'Unknown',
      sender_avatar_url: profile?.avatar_url,
      content,
      reply_to_id: replyToId,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ============================================
// HELPERS MODERAZIONE
// ============================================

export async function kickUser(
  roomId: string, 
  userId: string, 
  reason?: string, 
  durationMinutes?: number
) {
  const { error } = await supabase.rpc('kick_user_from_room', {
    p_room_id: roomId,
    p_user_id: userId,
    p_reason: reason,
    p_duration_minutes: durationMinutes,
  });
  
  if (error) throw error;
}

export async function banUser(
  workspaceId: string, 
  userId: string, 
  reason?: string, 
  expiresAt?: string
) {
  const { error } = await supabase.rpc('ban_user_from_workspace', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_reason: reason,
    p_expires_at: expiresAt,
  });
  
  if (error) throw error;
}

export async function unbanUser(
  workspaceId: string, 
  userId: string, 
  reason?: string
) {
  const { error } = await supabase.rpc('unban_user_from_workspace', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_reason: reason,
  });
  
  if (error) throw error;
}

export async function muteUser(
  roomId: string, 
  userId: string, 
  muteType: 'chat' | 'audio' | 'video' | 'all' = 'chat', 
  durationMinutes?: number
) {
  const { error } = await supabase.rpc('mute_user_in_room', {
    p_room_id: roomId,
    p_user_id: userId,
    p_mute_type: muteType,
    p_duration_minutes: durationMinutes,
  });
  
  if (error) throw error;
}

export async function unmuteUser(
  roomId: string, 
  userId: string, 
  muteType: 'chat' | 'audio' | 'video' | 'all' = 'chat'
) {
  const { error } = await supabase.rpc('unmute_user_in_room', {
    p_room_id: roomId,
    p_user_id: userId,
    p_mute_type: muteType,
  });
  
  if (error) throw error;
}

export async function changeUserRole(
  workspaceId: string, 
  userId: string, 
  newRole: WorkspaceRole
) {
  const { error } = await supabase.rpc('change_user_role', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_new_role: newRole,
  });
  
  if (error) throw error;
}

// ============================================
// HELPERS PERMESSI
// ============================================

export async function checkPermission(
  workspaceId: string, 
  permission: keyof Database['public']['Tables']['workspace_role_permissions']['Row']
) {
  const { data } = await supabase.rpc('has_workspace_permission', {
    p_workspace_id: workspaceId,
    p_permission: permission,
  });
  
  return data || false;
}

export async function canModerateUser(workspaceId: string, targetUserId: string) {
  const { data } = await supabase.rpc('can_moderate_user', {
    p_workspace_id: workspaceId,
    p_target_user_id: targetUserId,
  });
  
  return data || false;
}

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

export function subscribeToRoomParticipants(
  roomId: string, 
  callback: (payload: any) => void
) {
  return supabase
    .channel(`room_participants:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'room_participants',
        filter: `room_id=eq.${roomId}`,
      },
      callback
    )
    .subscribe();
}

export function subscribeToMessages(
  conversationId: string, 
  callback: (payload: any) => void
) {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      callback
    )
    .subscribe();
}

export function subscribeToUserPresence(
  workspaceId: string, 
  callback: (payload: any) => void
) {
  return supabase
    .channel(`user_presence:${workspaceId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_presence',
        filter: `workspace_id=eq.${workspaceId}`,
      },
      callback
    )
    .subscribe();
}

// ============================================
// PRESENCE (Online Status)
// ============================================

export async function updatePresence(
  workspaceId: string, 
  status: Database['public']['Tables']['user_presence']['Row']['status'],
  statusMessage?: string
) {
  const user = await getCurrentUser();
  if (!user) return;
  
  await supabase
    .from('user_presence')
    .upsert({
      user_id: user.id,
      workspace_id: workspaceId,
      status,
      status_message: statusMessage,
    });
}

export async function setCurrentLocation(
  workspaceId: string, 
  spaceId: string | null, 
  roomId: string | null
) {
  const user = await getCurrentUser();
  if (!user) return;
  
  await supabase
    .from('user_presence')
    .upsert({
      user_id: user.id,
      workspace_id: workspaceId,
      space_id: spaceId,
      room_id: roomId,
    });
}
