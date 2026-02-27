// ============================================
// HOOK: useModeration
// Gestione azioni di moderazione (kick, ban, mute)
// ============================================

import { useCallback, useState } from 'react';
import { 
  kickUser, 
  banUser, 
  unbanUser, 
  muteUser, 
  unmuteUser, 
  changeUserRole 
} from '@/lib/supabase/client';
import type { WorkspaceRole } from '@/lib/supabase/database.types';

interface ModerationState {
  isLoading: boolean;
  error: Error | null;
  success: boolean;
}

interface UseModerationOptions {
  workspaceId: string;
  roomId?: string;
}

export function useModeration({ workspaceId, roomId }: UseModerationOptions) {
  const [state, setState] = useState<ModerationState>({
    isLoading: false,
    error: null,
    success: false,
  });

  const resetState = useCallback(() => {
    setState({ isLoading: false, error: null, success: false });
  }, []);

  // ============================================
  // KICK
  // ============================================
  
  const kick = useCallback(async (
    userId: string, 
    options?: { reason?: string; durationMinutes?: number }
  ): Promise<boolean> => {
    if (!roomId) {
      setState(prev => ({ ...prev, error: new Error('Room ID required for kick') }));
      return false;
    }

    setState({ isLoading: true, error: null, success: false });

    try {
      await kickUser(roomId, userId, options?.reason, options?.durationMinutes);
      setState({ isLoading: false, error: null, success: true });
      return true;
    } catch (err) {
      setState({ isLoading: false, error: err as Error, success: false });
      return false;
    }
  }, [roomId]);

  // ============================================
  // BAN
  // ============================================

  const ban = useCallback(async (
    userId: string, 
    options?: { reason?: string; expiresAt?: Date; permanent?: boolean }
  ): Promise<boolean> => {
    setState({ isLoading: true, error: null, success: false });

    try {
      const expiresAt = options?.permanent 
        ? undefined 
        : options?.expiresAt?.toISOString();
      
      await banUser(workspaceId, userId, options?.reason, expiresAt);
      setState({ isLoading: false, error: null, success: true });
      return true;
    } catch (err) {
      setState({ isLoading: false, error: err as Error, success: false });
      return false;
    }
  }, [workspaceId]);

  const unban = useCallback(async (
    userId: string, 
    reason?: string
  ): Promise<boolean> => {
    setState({ isLoading: true, error: null, success: false });

    try {
      await unbanUser(workspaceId, userId, reason);
      setState({ isLoading: false, error: null, success: true });
      return true;
    } catch (err) {
      setState({ isLoading: false, error: err as Error, success: false });
      return false;
    }
  }, [workspaceId]);

  // ============================================
  // MUTE
  // ============================================

  const mute = useCallback(async (
    userId: string, 
    options?: { 
      type?: 'chat' | 'audio' | 'video' | 'all'; 
      durationMinutes?: number;
    }
  ): Promise<boolean> => {
    if (!roomId) {
      setState(prev => ({ ...prev, error: new Error('Room ID required for mute') }));
      return false;
    }

    setState({ isLoading: true, error: null, success: false });

    try {
      await muteUser(
        roomId, 
        userId, 
        options?.type || 'chat', 
        options?.durationMinutes
      );
      setState({ isLoading: false, error: null, success: true });
      return true;
    } catch (err) {
      setState({ isLoading: false, error: err as Error, success: false });
      return false;
    }
  }, [roomId]);

  const unmute = useCallback(async (
    userId: string, 
    type: 'chat' | 'audio' | 'video' | 'all' = 'chat'
  ): Promise<boolean> => {
    if (!roomId) {
      setState(prev => ({ ...prev, error: new Error('Room ID required for unmute') }));
      return false;
    }

    setState({ isLoading: true, error: null, success: false });

    try {
      await unmuteUser(roomId, userId, type);
      setState({ isLoading: false, error: null, success: true });
      return true;
    } catch (err) {
      setState({ isLoading: false, error: err as Error, success: false });
      return false;
    }
  }, [roomId]);

  // ============================================
  // ROLE MANAGEMENT
  // ============================================

  const changeRole = useCallback(async (
    userId: string, 
    newRole: WorkspaceRole
  ): Promise<boolean> => {
    setState({ isLoading: true, error: null, success: false });

    try {
      await changeUserRole(workspaceId, userId, newRole);
      setState({ isLoading: false, error: null, success: true });
      return true;
    } catch (err) {
      setState({ isLoading: false, error: err as Error, success: false });
      return false;
    }
  }, [workspaceId]);

  return {
    // State
    isLoading: state.isLoading,
    error: state.error,
    success: state.success,
    resetState,

    // Actions
    kick,
    ban,
    unban,
    mute,
    unmute,
    changeRole,

    // Helpers
    kickTemporary: useCallback((userId: string, minutes: number, reason?: string) => 
      kick(userId, { durationMinutes: minutes, reason }), 
    [kick]),
    
    banPermanent: useCallback((userId: string, reason?: string) => 
      ban(userId, { reason, permanent: true }), 
    [ban]),
    
    banTemporary: useCallback((userId: string, until: Date, reason?: string) => 
      ban(userId, { reason, expiresAt: until }), 
    [ban]),
  };
}

// ============================================
// HOOK: useRoomModeration
// Stato di moderazione in una stanza specifica
// ============================================

import { useEffect, useState as useReactState } from 'react';
import { supabase } from '@/lib/supabase/client';

export function useRoomModeration(roomId?: string) {
  const [mutedUsers, setMutedUsers] = useState<string[]>([]);
  const [kickedUsers, setKickedUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setIsLoading(false);
      return;
    }

    const fetchModerationState = async () => {
      setIsLoading(true);
      
      // Get muted users
      const { data: mutes } = await supabase
        .from('room_mutes')
        .select('user_id')
        .eq('room_id', roomId)
        .is('unmuted_at', null)
        .or('expires_at.is.null,expires_at.gt.now()');

      setMutedUsers(mutes?.map(m => m.user_id) || []);

      // Get recent kicks (still banned)
      const { data: kicks } = await supabase
        .from('room_kicks')
        .select('user_id')
        .eq('room_id', roomId)
        .eq('can_reenter', false)
        .or('banned_until.is.null,banned_until.gt.now()');

      setKickedUsers(kicks?.map(k => k.user_id) || []);
      setIsLoading(false);
    };

    fetchModerationState();

    // Subscribe to mutes
    const muteSubscription = supabase
      .channel(`room_mutes:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_mutes',
          filter: `room_id=eq.${roomId}`,
        },
        () => fetchModerationState()
      )
      .subscribe();

    return () => {
      muteSubscription.unsubscribe();
    };
  }, [roomId]);

  const isUserMuted = useCallback((userId: string) => {
    return mutedUsers.includes(userId);
  }, [mutedUsers]);

  const isUserKicked = useCallback((userId: string) => {
    return kickedUsers.includes(userId);
  }, [kickedUsers]);

  return {
    mutedUsers,
    kickedUsers,
    isLoading,
    isUserMuted,
    isUserKicked,
  };
}

// ============================================
// HOOK: useBannedUsers
// Lista utenti bannati nel workspace
// ============================================

export function useBannedUsers(workspaceId?: string) {
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    const fetchBannedUsers = async () => {
      setIsLoading(true);
      
      const { data } = await supabase
        .from('workspace_ban_details')
        .select('*')
        .eq('workspace_id', workspaceId);

      setBannedUsers(data || []);
      setIsLoading(false);
    };

    fetchBannedUsers();

    const subscription = supabase
      .channel(`workspace_bans:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_bans',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => fetchBannedUsers()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [workspaceId]);

  return { bannedUsers, isLoading };
}

// Fix import
function useState<T>(initial: T): [T, (val: T | ((prev: T) => T)) => void] {
  return useReactState(initial);
}

function useCallback<T extends (...args: any[]) => any>(
  callback: T, 
  deps: any[]
): T {
  // This is a shim for the type checker, actual implementation is from React
  return callback as T;
}
