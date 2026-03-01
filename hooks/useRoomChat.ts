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

    // ─── Send message: PartyKit (instant) + Supabase (persist) ─
    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || !roomId || !workspaceId) return;

        const trimmed = content.trim();

        // 1. PartyKit — instant broadcast to room members
        const sendFn = (window as any).__sendChatMessage;
        if (sendFn) sendFn(trimmed, roomId);

        // 2. Supabase — persist (fire-and-forget)
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
    }, [roomId, workspaceId, userId, supabase]);

    return { messages, sendMessage, isLoading };
}
