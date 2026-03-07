// ============================================
// HOOK: useRoom
// Gestione partecipazione e stato stanza
// ============================================

import { useEffect, useState, useCallback } from 'react';
import { supabase, joinRoom, leaveRoom, updateParticipantPosition, subscribeToRoomParticipants } from '@/lib/supabase/client';
import type { Room, RoomParticipant, Profile, Conversation } from '@/lib/supabase/database.types';

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
            .single<RoomParticipant>();

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

    const updateData: Record<string, boolean | undefined> = {};
    if (state.audio !== undefined) updateData.audio_enabled = state.audio;
    if (state.video !== undefined) updateData.video_enabled = state.video;
    if (state.screenSharing !== undefined) updateData.screen_sharing = state.screenSharing;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('room_participants')
      .update(updateData)
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
      const conversation = await getRoomConversation(roomId) as Conversation | null;
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


