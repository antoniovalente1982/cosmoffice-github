// ============================================
// HOOK: usePresenceManager
// Gestione presence avanzata con heartbeat automatico
// Evita utenti "fantasma" nelle stanze
// ============================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

interface PresenceConfig {
  workspaceId: string;
  spaceId?: string;
  roomId?: string;
  heartbeatInterval?: number; // ms, default 30000 (30s)
}

export function usePresenceManager({
  workspaceId,
  spaceId,
  roomId,
  heartbeatInterval = 30000,
}: PresenceConfig) {
  const [isOnline, setIsOnline] = useState(true);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityRef = useRef<boolean>(true);

  // Send heartbeat to edge function
  const sendHeartbeat = useCallback(async (status?: 'online' | 'away' | 'busy') => {
    if (!workspaceId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cleanup-presence`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspace_id: workspaceId,
            space_id: spaceId,
            room_id: roomId,
            status: status || (visibilityRef.current ? 'online' : 'away'),
          }),
        }
      );

      if (response.ok) {
        setLastHeartbeat(new Date());
      }
    } catch (err) {
      console.error('Heartbeat failed:', err);
    }
  }, [workspaceId, spaceId, roomId]);

  // Initial presence and heartbeat setup
  useEffect(() => {
    if (!workspaceId) return;

    // Send initial heartbeat
    sendHeartbeat('online');

    // Setup interval
    heartbeatRef.current = setInterval(() => {
      sendHeartbeat();
    }, heartbeatInterval);

    // Handle visibility change
    const handleVisibilityChange = () => {
      visibilityRef.current = document.visibilityState === 'visible';
      
      if (visibilityRef.current) {
        sendHeartbeat('online');
      } else {
        sendHeartbeat('away');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle beforeunload
    const handleBeforeUnload = () => {
      // Try to send offline status
      navigator.sendBeacon?.(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cleanup-presence`,
        JSON.stringify({
          workspace_id: workspaceId,
          status: 'offline',
        })
      );
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Set offline on unmount
      sendHeartbeat('offline');
    };
  }, [workspaceId, heartbeatInterval, sendHeartbeat]);

  // Manual status update
  const setStatus = useCallback((status: 'online' | 'away' | 'busy' | 'in_call', message?: string) => {
    sendHeartbeat(status);
  }, [sendHeartbeat]);

  // Update location
  const setLocation = useCallback((newSpaceId?: string, newRoomId?: string) => {
    if (!workspaceId) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;

      fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cleanup-presence`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspace_id: workspaceId,
            space_id: newSpaceId,
            room_id: newRoomId,
          }),
        }
      );
    });
  }, [workspaceId]);

  return {
    isOnline,
    lastHeartbeat,
    setStatus,
    setLocation,
    sendHeartbeat,
  };
}

// ============================================
// HOOK: useOnlineUsers
// Lista utenti online nel workspace
// ============================================

import type { Profile } from '@/lib/supabase/database.types';

interface OnlineUser {
  user_id: string;
  status: string;
  status_message: string | null;
  space_id: string | null;
  room_id: string | null;
  last_seen_at: string;
  profile: Profile;
}

export function useOnlineUsers(workspaceId?: string) {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    const fetchOnline = async () => {
      setIsLoading(true);

      const { data } = await supabase
        .from('user_presence')
        .select(`
          *,
          profile:profiles(id, email, full_name, display_name, avatar_url, status)
        `)
        .eq('workspace_id', workspaceId)
        .neq('status', 'offline');

      setUsers(data as OnlineUser[] || []);
      setIsLoading(false);
    };

    fetchOnline();

    // Subscribe to presence changes
    const subscription = supabase
      .channel(`online_users:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => fetchOnline()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [workspaceId]);

  const onlineCount = users.length;
  const inCallCount = users.filter(u => u.status === 'in_call').length;

  return {
    users,
    isLoading,
    onlineCount,
    inCallCount,
  };
}
