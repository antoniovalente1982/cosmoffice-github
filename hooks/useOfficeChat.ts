'use client';
import { useCommsStore } from '../stores/commsStore';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useChatStore, ChatMessage } from '../stores/chatStore';
import { createClient } from '../utils/supabase/client';

// ============================================
// useOfficeChat — Office-wide global chat hook
// Messages with room_id=NULL in the messages table
// ============================================

interface UseOfficeChatOptions {
    workspaceId: string | null;
    userId: string;
    userName: string;
    userAvatarUrl: string | null;
}

export function useOfficeChat({ workspaceId, userId, userName, userAvatarUrl }: UseOfficeChatOptions) {
    const officeMessages = useChatStore(s => s.officeMessages);
    const addOfficeMessage = useChatStore(s => s.addOfficeMessage);
    const setOfficeMessages = useChatStore(s => s.setOfficeMessages);
    const clearOfficeMessages = useChatStore(s => s.clearOfficeMessages);
    const removeOfficeMessage = useChatStore(s => s.removeOfficeMessage);
    const [isLoading, setIsLoading] = useState(false);
    const supabase = createClient();
    const loadedRef = useRef(false);
    const prevWorkspaceRef = useRef<string | null>(null);

    // Reset chat when switching workspace — prevents messages leaking between workspaces
    useEffect(() => {
        if (workspaceId && workspaceId !== prevWorkspaceRef.current) {
            if (prevWorkspaceRef.current !== null) {
                // Actually switching — clear old messages
                clearOfficeMessages();
                loadedRef.current = false;
            }
            prevWorkspaceRef.current = workspaceId;
        }
    }, [workspaceId, clearOfficeMessages]);

    // ─── Load history from Supabase (once) ────────────────
    useEffect(() => {
        if (!workspaceId || loadedRef.current) return;
        loadedRef.current = true;

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
                    .is('room_id', null)
                    .order('created_at', { ascending: true })
                    .limit(50);

                if (cancelled) return;

                if (error) {
                    console.error('[OfficeChat] Failed to load history:', error);
                } else if (data) {
                    const mapped: ChatMessage[] = data.map((row: any) => {
                        const profile = row.profiles;
                        return {
                            id: row.id,
                            userId: row.user_id,
                            userName: profile?.display_name || profile?.full_name || 'User',
                            avatarUrl: profile?.avatar_url || null,
                            content: row.content,
                            roomId: null,
                            timestamp: row.created_at,
                        };
                    });
                    setOfficeMessages(mapped);
                }
            } catch (err) {
                console.error('[OfficeChat] History load error:', err);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        loadHistory();
        return () => { cancelled = true; };
    }, [workspaceId, supabase, setOfficeMessages]);

    // DELETE events are handled by PartyKit (message_deleted broadcast)
    // No Supabase Realtime channel needed.

    // ─── Send message: Optimistic + PartyKit + Supabase ──────
    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || !workspaceId) return;

        const trimmed = content.trim();

        // 1. Optimistic — add to local store immediately
        const optimisticMsg: ChatMessage = {
            id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            userId,
            userName,
            avatarUrl: userAvatarUrl,
            content: trimmed,
            roomId: null,
            timestamp: new Date().toISOString(),
        };
        addOfficeMessage(optimisticMsg);

        // 2. PartyKit — broadcast to other users
        const sendFn = useCommsStore.getState().sendOfficeChatMessage;
        if (sendFn) sendFn(trimmed);

        // 3. Supabase — persist with room_id=NULL
        try {
            await supabase.from('messages').insert({
                workspace_id: workspaceId,
                room_id: null,
                user_id: userId,
                content: trimmed,
                type: 'text',
            });
        } catch (err) {
            console.error('[OfficeChat] Failed to persist message:', err);
        }
    }, [workspaceId, userId, userName, userAvatarUrl, supabase, addOfficeMessage]);

    // ─── Delete single message ──────────────────────────────
    const deleteMessage = useCallback(async (messageId: string) => {
        if (!workspaceId) return;

        removeOfficeMessage(messageId);

        const deleteFn = useCommsStore.getState().sendDeleteMessage;
        if (deleteFn) deleteFn(messageId, null);

        try {
            await supabase.from('messages').delete().eq('id', messageId);
        } catch (err) {
            console.error('[OfficeChat] Failed to delete message:', err);
        }
    }, [workspaceId, supabase, removeOfficeMessage]);

    // ─── Clear all office messages ──────────────────────────
    const clearAllMessages = useCallback(async () => {
        if (!workspaceId) return;

        clearOfficeMessages();

        const clearFn = useCommsStore.getState().sendClearChat;
        if (clearFn) clearFn(null);

        try {
            await supabase
                .from('messages')
                .delete()
                .eq('workspace_id', workspaceId)
                .is('room_id', null);
        } catch (err) {
            console.error('[OfficeChat] Failed to clear messages:', err);
        }
    }, [workspaceId, supabase, clearOfficeMessages]);

    return { messages: officeMessages, sendMessage, deleteMessage, clearAllMessages, isLoading };
}
