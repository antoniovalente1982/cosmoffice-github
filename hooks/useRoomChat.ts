'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useChatStore, ChatMessage } from '../stores/chatStore';
import { createClient } from '../utils/supabase/client';

// ============================================
// useRoomChat — Room-scoped chat hook
// Loads history from Supabase, live via PartyKit
// Reuses the socket from useAvatarSync (no new connection)
// ============================================

interface UseRoomChatOptions {
    workspaceId: string | null;
    roomId: string | null;
    userId: string;
    userName: string;
    userAvatarUrl: string | null;
}

export function useRoomChat({ workspaceId, roomId, userId, userName, userAvatarUrl }: UseRoomChatOptions) {
    const messages = useChatStore(s => s.messages);
    const addMessage = useChatStore(s => s.addMessage);
    const setMessages = useChatStore(s => s.setMessages);
    const clearMessages = useChatStore(s => s.clearMessages);
    const removeMessage = useChatStore(s => s.removeMessage);
    const [isLoading, setIsLoading] = useState(false);
    const supabase = createClient();
    const prevRoomIdRef = useRef<string | null>(null);

    // ─── Load history from Supabase when room changes ────────
    useEffect(() => {
        if (prevRoomIdRef.current === roomId) return;
        prevRoomIdRef.current = roomId;

        // Clear previous messages
        clearMessages();

        if (!roomId || !workspaceId) return;

        let cancelled = false;
        setIsLoading(true);

        const loadHistory = async () => {
            try {
                const { data, error } = await supabase
                    .from('messages')
                    .select(`
                        id,
                        content,
                        type,
                        created_at,
                        user_id,
                        room_id,
                        workspace_id,
                        profiles:user_id (
                            display_name,
                            full_name,
                            avatar_url
                        )
                    `)
                    .eq('workspace_id', workspaceId)
                    .eq('room_id', roomId)
                    .order('created_at', { ascending: true })
                    .limit(50);

                if (cancelled) return;

                if (error) {
                    console.error('[RoomChat] Failed to load history:', error);
                } else if (data) {
                    const mapped: ChatMessage[] = data.map((row: any) => {
                        const profile = row.profiles;
                        return {
                            id: row.id,
                            userId: row.user_id,
                            userName: profile?.display_name || profile?.full_name || 'User',
                            avatarUrl: profile?.avatar_url || null,
                            content: row.content,
                            roomId: row.room_id,
                            timestamp: row.created_at,
                        };
                    });
                    setMessages(mapped);
                }
            } catch (err) {
                console.error('[RoomChat] History load error:', err);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        loadHistory();
        return () => { cancelled = true; };
    }, [roomId, workspaceId, supabase, clearMessages, setMessages]);

    // ─── Supabase Realtime: catch messages even if PartyKit misses ──
    useEffect(() => {
        if (!roomId || !workspaceId) return;

        const channel = supabase.channel(`room-chat-${roomId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `room_id=eq.${roomId}`,
            }, async (payload: any) => {
                const row = payload.new;
                if (!row || row.user_id === userId) return; // Skip own messages (already optimistic)

                // Check if we already have this message (from PartyKit)
                const existing = useChatStore.getState().messages;
                if (existing.some((m: any) => m.id === row.id)) return;

                // Fetch sender profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('display_name, full_name, avatar_url')
                    .eq('id', row.user_id)
                    .single();

                const msg: ChatMessage = {
                    id: row.id,
                    userId: row.user_id,
                    userName: profile?.display_name || profile?.full_name || 'User',
                    avatarUrl: profile?.avatar_url || null,
                    content: row.content,
                    roomId: row.room_id,
                    timestamp: row.created_at,
                };
                addMessage(msg);
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'messages',
                filter: `room_id=eq.${roomId}`,
            }, (payload: any) => {
                if (payload.old?.id) {
                    removeMessage(payload.old.id);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId, workspaceId, userId, supabase, addMessage, removeMessage]);

    // ─── Send message: Optimistic + PartyKit + Supabase ──────
    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || !roomId || !workspaceId) return;

        const trimmed = content.trim();

        // 1. Optimistic — add to local store immediately
        const optimisticMsg: ChatMessage = {
            id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            userId,
            userName,
            avatarUrl: userAvatarUrl,
            content: trimmed,
            roomId,
            timestamp: new Date().toISOString(),
        };
        addMessage(optimisticMsg);

        // 2. PartyKit — broadcast to other room members
        const sendFn = (window as any).__sendChatMessage;
        if (sendFn) sendFn(trimmed, roomId);

        // 3. Supabase — persist (fire-and-forget)
        try {
            await supabase.from('messages').insert({
                workspace_id: workspaceId,
                room_id: roomId,
                user_id: userId,
                content: trimmed,
                type: 'text',
            });
        } catch (err) {
            console.error('[RoomChat] Failed to persist message:', err);
        }
    }, [roomId, workspaceId, userId, userName, userAvatarUrl, supabase, addMessage]);

    // ─── Delete single message: Supabase + PartyKit ─────────
    const deleteMessage = useCallback(async (messageId: string) => {
        if (!workspaceId) return;

        // 1. Remove from local state immediately
        removeMessage(messageId);

        // 2. PartyKit — broadcast deletion
        const deleteFn = (window as any).__sendDeleteMessage;
        if (deleteFn) deleteFn(messageId, roomId);

        // 3. Supabase — delete from DB
        try {
            await supabase.from('messages').delete().eq('id', messageId);
        } catch (err) {
            console.error('[RoomChat] Failed to delete message:', err);
        }
    }, [workspaceId, roomId, supabase, removeMessage]);

    // ─── Clear all messages: Supabase + PartyKit ────────────
    const clearAllMessages = useCallback(async () => {
        if (!workspaceId || !roomId) return;

        // 1. Clear local state
        clearMessages();

        // 2. PartyKit — broadcast clear
        const clearFn = (window as any).__sendClearChat;
        if (clearFn) clearFn(roomId);

        // 3. Supabase — delete all room messages
        try {
            await supabase
                .from('messages')
                .delete()
                .eq('workspace_id', workspaceId)
                .eq('room_id', roomId);
        } catch (err) {
            console.error('[RoomChat] Failed to clear messages:', err);
        }
    }, [workspaceId, roomId, supabase, clearMessages]);

    return { messages, sendMessage, deleteMessage, clearAllMessages, isLoading };
}
