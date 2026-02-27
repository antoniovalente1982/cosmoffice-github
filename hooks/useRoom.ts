// ============================================
// HOOK: useRoom
// Gestione partecipazione e stato stanza
// ============================================

import { useEffect, useState, useCallback } from 'react';
import { supabase, joinRoom, leaveRoom, updateParticipantPosition, subscribeToRoomParticipants } from '@/lib/supabase/client';
import type { Room, RoomParticipant, Profile } from '@/lib/supabase/database.types';

interface ParticipantWithProfile extends RoomParticipant {
  profile: Profile;
}

export function useRoom(roomId?: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<ParticipantWithProfile[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [myPosition, setMyPosition] = useState({ x: 100, y: 100 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch room data
  useEffect(() => {
    if (!roomId) {
      setIsLoading(false);
      return;
    }

    const fetchRoom = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: roomError } = await supabase
          .from('rooms')
          .select(`
            *,
            space:spaces(*)
          `)
          .eq('id', roomId)
          .single();

        if (roomError) throw roomError;
        setRoom(data as Room);

        // Check if current user is joined
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: participant } = await supabase
            .from('room_participants')
            .select('*')
            .eq('room_id', roomId)
            .eq('user_id', user.id)
            .single();
          
          if (participant) {
            setIsJoined(true);
            setMyPosition({ x: participant.x, y: participant.y });
          }
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoom();
  }, [roomId]);

  // Subscribe to participants
  useEffect(() => {
    if (!roomId) return;

    // Initial fetch
    const fetchParticipants = async () => {
      const { data } = await supabase
        .from('room_participants')
        .select(`
          *,
          profile:profiles(id, email, full_name, display_name, avatar_url, status)
        `)
        .eq('room_id', roomId);

      setParticipants(data as ParticipantWithProfile[] || []);
    };

    fetchParticipants();

    // Realtime subscription
    const subscription = subscribeToRoomParticipants(roomId, () => {
      fetchParticipants();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [roomId]);

  // Join room
  const join = useCallback(async (x?: number, y?: number) => {
    if (!roomId) return false;

    try {
      const posX = x ?? myPosition.x;
      const posY = y ?? myPosition.y;
      
      await joinRoom(roomId, posX, posY);
      setIsJoined(true);
      setMyPosition({ x: posX, y: posY });
      return true;
    } catch (err) {
      setError(err as Error);
      return false;
    }
  }, [roomId, myPosition]);

  // Leave room
  const leave = useCallback(async () => {
    if (!roomId) return;

    await leaveRoom(roomId);
    setIsJoined(false);
  }, [roomId]);

  // Move position
  const move = useCallback(async (x: number, y: number) => {
    if (!roomId || !isJoined) return;

    try {
      await updateParticipantPosition(roomId, x, y);
      setMyPosition({ x, y });
    } catch (err) {
      console.error('Error moving:', err);
    }
  }, [roomId, isJoined]);

  // Update media state
  const setMediaState = useCallback(async (state: {
    audio?: boolean;
    video?: boolean;
    screenSharing?: boolean;
  }) => {
    if (!roomId || !isJoined) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('room_participants')
      .update({
        audio_enabled: state.audio,
        video_enabled: state.video,
        screen_sharing: state.screenSharing,
      })
      .eq('room_id', roomId)
      .eq('user_id', user.id);
  }, [roomId, isJoined]);

  return {
    room,
    participants,
    isJoined,
    myPosition,
    isLoading,
    error,
    join,
    leave,
    move,
    setMediaState,
    participantCount: participants.length,
  };
}

// ============================================
// HOOK: useRoomChat
// Chat della stanza
// ============================================

import { getRoomConversation, getConversationMessages, sendMessage, subscribeToMessages } from '@/lib/supabase/client';
import type { Message } from '@/lib/supabase/database.types';

export function useRoomChat(roomId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setIsLoading(false);
      return;
    }

    const initChat = async () => {
      setIsLoading(true);

      // Get or create conversation
      const conversation = await getRoomConversation(roomId);
      if (conversation) {
        setConversationId(conversation.id);
        
        // Load messages
        const msgs = await getConversationMessages(conversation.id, 50);
        setMessages(msgs);
        setHasMore(msgs.length === 50);
      }

      setIsLoading(false);
    };

    initChat();
  }, [roomId]);

  // Subscribe to new messages
  useEffect(() => {
    if (!conversationId) return;

    const subscription = subscribeToMessages(conversationId, (payload) => {
      if (payload.eventType === 'INSERT') {
        setMessages(prev => [...prev, payload.new as Message]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [conversationId]);

  const send = useCallback(async (content: string, replyToId?: string) => {
    if (!conversationId) return false;

    try {
      await sendMessage(conversationId, content, replyToId);
      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      return false;
    }
  }, [conversationId]);

  const loadMore = useCallback(async () => {
    if (!conversationId || !hasMore) return;

    const oldestMessage = messages[0];
    const moreMessages = await getConversationMessages(
      conversationId, 
      50, 
      oldestMessage?.created_at
    );

    if (moreMessages.length < 50) {
      setHasMore(false);
    }

    setMessages(prev => [...moreMessages, ...prev]);
  }, [conversationId, hasMore, messages]);

  return {
    messages,
    isLoading,
    hasMore,
    send,
    loadMore,
  };
}

// ============================================
// HOOK: usePresence
// Stato online degli utenti
// ============================================

export function usePresence(workspaceId?: string) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [presenceData, setPresenceData] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    if (!workspaceId) return;

    const fetchPresence = async () => {
      const { data } = await supabase
        .from('user_presence')
        .select('*')
        .eq('workspace_id', workspaceId);

      const presenceMap = new Map();
      data?.forEach(p => {
        presenceMap.set(p.user_id, p);
      });
      
      setPresenceData(presenceMap);
      setOnlineUsers(data?.map(p => p.user_id) || []);
    };

    fetchPresence();

    const subscription = supabase
      .channel(`presence:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const userId = payload.old.user_id;
            setOnlineUsers(prev => prev.filter(id => id !== userId));
            setPresenceData(prev => {
              const next = new Map(prev);
              next.delete(userId);
              return next;
            });
          } else {
            const userId = payload.new.user_id;
            setOnlineUsers(prev => [...new Set([...prev, userId])]);
            setPresenceData(prev => {
              const next = new Map(prev);
              next.set(userId, payload.new);
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [workspaceId]);

  const updateMyPresence = useCallback(async (status: string, message?: string) => {
    if (!workspaceId) return;

    await supabase
      .from('user_presence')
      .upsert({
        workspace_id: workspaceId,
        status,
        status_message: message,
      });
  }, [workspaceId]);

  const setLocation = useCallback(async (spaceId: string | null, roomId: string | null) => {
    if (!workspaceId) return;

    await supabase
      .from('user_presence')
      .upsert({
        workspace_id: workspaceId,
        space_id: spaceId,
        room_id: roomId,
      });
  }, [workspaceId]);

  return {
    onlineUsers,
    presenceData,
    isOnline: (userId: string) => onlineUsers.includes(userId),
    getUserPresence: (userId: string) => presenceData.get(userId),
    updateMyPresence,
    setLocation,
    onlineCount: onlineUsers.length,
  };
}
