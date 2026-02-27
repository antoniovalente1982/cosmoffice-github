// ============================================
// HOOK: useEdgeFunctions
// Wrapper per chiamare le edge functions
// ============================================

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { WorkspaceRole } from '@/lib/supabase/database.types';

interface EdgeFunctionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: { message: string; code: string };
}

export function useEdgeFunctions() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const callFunction = useCallback(async <T = any>(
    functionName: string,
    body: any
  ): Promise<T | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${functionName}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      const result: EdgeFunctionResponse<T> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Unknown error');
      }

      return result.data || null;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================
  // MANAGE MEMBER
  // ============================================

  const banUser = useCallback(async (
    workspaceId: string,
    userId: string,
    options?: { reason?: string; durationMinutes?: number }
  ): Promise<boolean> => {
    const result = await callFunction('manage-member', {
      action: 'ban',
      workspace_id: workspaceId,
      target_user_id: userId,
      reason: options?.reason,
      duration_minutes: options?.durationMinutes,
    });
    return !!result;
  }, [callFunction]);

  const unbanUser = useCallback(async (
    workspaceId: string,
    userId: string,
    reason?: string
  ): Promise<boolean> => {
    const result = await callFunction('manage-member', {
      action: 'unban',
      workspace_id: workspaceId,
      target_user_id: userId,
      reason,
    });
    return !!result;
  }, [callFunction]);

  const kickUser = useCallback(async (
    workspaceId: string,
    roomId: string,
    userId: string,
    options?: { reason?: string; durationMinutes?: number }
  ): Promise<boolean> => {
    const result = await callFunction('manage-member', {
      action: 'kick',
      workspace_id: workspaceId,
      room_id: roomId,
      target_user_id: userId,
      reason: options?.reason,
      duration_minutes: options?.durationMinutes,
    });
    return !!result;
  }, [callFunction]);

  const muteUser = useCallback(async (
    workspaceId: string,
    roomId: string,
    userId: string,
    options?: { type?: 'chat' | 'audio' | 'video' | 'all'; durationMinutes?: number }
  ): Promise<boolean> => {
    const result = await callFunction('manage-member', {
      action: 'mute',
      workspace_id: workspaceId,
      room_id: roomId,
      target_user_id: userId,
      mute_type: options?.type || 'chat',
      duration_minutes: options?.durationMinutes,
    });
    return !!result;
  }, [callFunction]);

  const unmuteUser = useCallback(async (
    workspaceId: string,
    roomId: string,
    userId: string,
    type: 'chat' | 'audio' | 'video' | 'all' = 'chat'
  ): Promise<boolean> => {
    const result = await callFunction('manage-member', {
      action: 'unmute',
      workspace_id: workspaceId,
      room_id: roomId,
      target_user_id: userId,
      mute_type: type,
    });
    return !!result;
  }, [callFunction]);

  const changeUserRole = useCallback(async (
    workspaceId: string,
    userId: string,
    newRole: WorkspaceRole
  ): Promise<boolean> => {
    const result = await callFunction('manage-member', {
      action: 'change_role',
      workspace_id: workspaceId,
      target_user_id: userId,
      new_role: newRole,
    });
    return !!result;
  }, [callFunction]);

  const removeMember = useCallback(async (
    workspaceId: string,
    userId: string,
    reason?: string
  ): Promise<boolean> => {
    const result = await callFunction('manage-member', {
      action: 'remove',
      workspace_id: workspaceId,
      target_user_id: userId,
      reason,
    });
    return !!result;
  }, [callFunction]);

  // ============================================
  // JOIN WORKSPACE
  // ============================================

  const acceptInvitation = useCallback(async (token: string): Promise<{ joined: boolean; workspace_id?: string } | null> => {
    return await callFunction('join-workspace', {
      type: 'invitation',
      invitation_token: token,
    });
  }, [callFunction]);

  const requestAccess = useCallback(async (
    workspaceId: string,
    message?: string
  ): Promise<{ requested: boolean; request_id?: string } | null> => {
    return await callFunction('join-workspace', {
      type: 'request',
      workspace_id: workspaceId,
      message,
    });
  }, [callFunction]);

  return {
    isLoading,
    error,
    
    // Moderation
    banUser,
    unbanUser,
    kickUser,
    muteUser,
    unmuteUser,
    changeUserRole,
    removeMember,
    
    // Join
    acceptInvitation,
    requestAccess,
  };
}
