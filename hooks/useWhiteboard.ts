'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useWhiteboardStore, WhiteboardStroke } from '../stores/whiteboardStore';
import { createClient } from '../utils/supabase/client';
import { useAvatarStore } from '../stores/avatarStore';

// ============================================
// useWhiteboard — Collaborative whiteboard hook
// Loads strokes from Supabase, syncs via PartyKit
// Same architecture as useRoomChat/useOfficeChat
// ============================================

interface UseWhiteboardOptions {
    workspaceId: string | null;
    roomId: string | null;
    userId: string;
    userName: string;
}

export function useWhiteboard({ workspaceId, roomId, userId, userName }: UseWhiteboardOptions) {
    const activeChannel = useWhiteboardStore(s => s.activeChannel);
    const roomStrokes = useWhiteboardStore(s => s.roomStrokes);
    const officeStrokes = useWhiteboardStore(s => s.officeStrokes);
    const addStroke = useWhiteboardStore(s => s.addStroke);
    const addOfficeStroke = useWhiteboardStore(s => s.addOfficeStroke);
    const setRoomStrokes = useWhiteboardStore(s => s.setRoomStrokes);
    const setOfficeStrokes = useWhiteboardStore(s => s.setOfficeStrokes);
    const clearRoomStrokes = useWhiteboardStore(s => s.clearRoomStrokes);
    const clearOfficeStrokes = useWhiteboardStore(s => s.clearOfficeStrokes);
    const updateRemoteCursor = useWhiteboardStore(s => s.updateRemoteCursor);

    const [isLoading, setIsLoading] = useState(false);
    const supabase = createClient();
    const prevRoomIdRef = useRef<string | null>(null);
    const officeLoadedRef = useRef(false);

    // ─── Load room strokes from Supabase when room changes ────
    useEffect(() => {
        if (prevRoomIdRef.current === roomId) return;
        prevRoomIdRef.current = roomId;
        clearRoomStrokes();

        if (!roomId || !workspaceId) return;
        let cancelled = false;
        setIsLoading(true);

        const loadStrokes = async () => {
            try {
                const { data, error } = await supabase
                    .from('whiteboard_strokes')
                    .select('*')
                    .eq('workspace_id', workspaceId)
                    .eq('room_id', roomId)
                    .order('created_at', { ascending: true })
                    .limit(500);

                if (cancelled) return;
                if (error) {
                    console.error('[Whiteboard] Failed to load room strokes:', error);
                } else if (data) {
                    const mapped: WhiteboardStroke[] = data.map((row: any) => ({
                        id: row.id,
                        userId: row.user_id,
                        userName: row.user_name || 'User',
                        color: row.user_color || '#22d3ee',
                        width: row.stroke_data?.width || 4,
                        points: row.stroke_data?.points || [],
                        tool: row.stroke_data?.tool || 'pen',
                        timestamp: row.created_at,
                    }));
                    setRoomStrokes(mapped);
                }
            } catch (err) {
                console.error('[Whiteboard] Room strokes load error:', err);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        loadStrokes();
        return () => { cancelled = true; };
    }, [roomId, workspaceId, supabase, clearRoomStrokes, setRoomStrokes]);

    // ─── Load office strokes once ─────────────────────────────
    useEffect(() => {
        if (!workspaceId || officeLoadedRef.current) return;
        officeLoadedRef.current = true;

        let cancelled = false;
        const loadOfficeStrokes = async () => {
            try {
                const { data, error } = await supabase
                    .from('whiteboard_strokes')
                    .select('*')
                    .eq('workspace_id', workspaceId)
                    .is('room_id', null)
                    .order('created_at', { ascending: true })
                    .limit(500);

                if (cancelled) return;
                if (error) {
                    console.error('[Whiteboard] Failed to load office strokes:', error);
                } else if (data) {
                    const mapped: WhiteboardStroke[] = data.map((row: any) => ({
                        id: row.id,
                        userId: row.user_id,
                        userName: row.user_name || 'User',
                        color: row.user_color || '#22d3ee',
                        width: row.stroke_data?.width || 4,
                        points: row.stroke_data?.points || [],
                        tool: row.stroke_data?.tool || 'pen',
                        timestamp: row.created_at,
                    }));
                    setOfficeStrokes(mapped);
                }
            } catch (err) {
                console.error('[Whiteboard] Office strokes load error:', err);
            }
        };

        loadOfficeStrokes();
        return () => { cancelled = true; };
    }, [workspaceId, supabase, setOfficeStrokes]);

    // ─── Register PartyKit listener for incoming whiteboard messages ──
    useEffect(() => {
        const handleWbMessage = (e: CustomEvent) => {
            const data = e.detail;
            if (!data) return;

            if (data.type === 'wb_stroke') {
                // Incoming stroke from another user
                if (data.stroke?.userId === userId) return; // skip own
                if (data.scope === 'room') {
                    addStroke(data.stroke);
                } else {
                    addOfficeStroke(data.stroke);
                }
            } else if (data.type === 'wb_cursor') {
                if (data.cursor?.userId === userId) return;
                updateRemoteCursor(data.cursor);
            } else if (data.type === 'wb_clear') {
                if (data.scope === 'room') {
                    clearRoomStrokes();
                } else {
                    clearOfficeStrokes();
                }
            }
        };

        window.addEventListener('whiteboard-message' as any, handleWbMessage);
        return () => window.removeEventListener('whiteboard-message' as any, handleWbMessage);
    }, [userId, addStroke, addOfficeStroke, updateRemoteCursor, clearRoomStrokes, clearOfficeStrokes]);

    // ─── Send stroke: Optimistic + PartyKit + Supabase ────────
    const sendStroke = useCallback(async (stroke: WhiteboardStroke) => {
        if (!workspaceId) return;

        const isRoom = activeChannel === 'room';
        const targetRoomId = isRoom ? roomId : null;

        // 1. Optimistic
        if (isRoom) {
            addStroke(stroke);
        } else {
            addOfficeStroke(stroke);
        }

        // 2. PartyKit broadcast
        const socket = (window as any).__partykitSocket;
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'wb_stroke',
                scope: isRoom ? 'room' : 'office',
                roomId: targetRoomId,
                stroke,
            }));
        }

        // 3. Supabase persist (fire-and-forget)
        try {
            await supabase.from('whiteboard_strokes').insert({
                id: stroke.id,
                workspace_id: workspaceId,
                room_id: targetRoomId,
                user_id: userId,
                user_name: userName,
                user_color: stroke.color,
                stroke_data: {
                    points: stroke.points,
                    width: stroke.width,
                    tool: stroke.tool,
                },
            });
        } catch (err) {
            console.error('[Whiteboard] Failed to persist stroke:', err);
        }
    }, [workspaceId, roomId, userId, userName, activeChannel, supabase, addStroke, addOfficeStroke]);

    // ─── Send cursor position via PartyKit ────────────────────
    const sendCursor = useCallback((x: number, y: number, color: string) => {
        const socket = (window as any).__partykitSocket;
        if (socket?.readyState === WebSocket.OPEN) {
            const isRoom = useWhiteboardStore.getState().activeChannel === 'room';
            socket.send(JSON.stringify({
                type: 'wb_cursor',
                scope: isRoom ? 'room' : 'office',
                roomId: isRoom ? roomId : null,
                cursor: {
                    userId,
                    userName,
                    color,
                    x,
                    y,
                    lastUpdate: Date.now(),
                },
            }));
        }
    }, [roomId, userId, userName]);

    // ─── Clear all strokes ────────────────────────────────────
    const clearAllStrokes = useCallback(async () => {
        if (!workspaceId) return;

        const isRoom = activeChannel === 'room';
        const targetRoomId = isRoom ? roomId : null;

        // 1. Clear local
        if (isRoom) clearRoomStrokes(); else clearOfficeStrokes();

        // 2. PartyKit broadcast
        const socket = (window as any).__partykitSocket;
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'wb_clear',
                scope: isRoom ? 'room' : 'office',
                roomId: targetRoomId,
            }));
        }

        // 3. Supabase delete
        try {
            let query = supabase
                .from('whiteboard_strokes')
                .delete()
                .eq('workspace_id', workspaceId);

            if (isRoom && targetRoomId) {
                query = query.eq('room_id', targetRoomId);
            } else {
                query = query.is('room_id', null);
            }

            await query;
        } catch (err) {
            console.error('[Whiteboard] Failed to clear strokes:', err);
        }
    }, [workspaceId, roomId, activeChannel, supabase, clearRoomStrokes, clearOfficeStrokes]);

    const currentStrokes = activeChannel === 'room' ? roomStrokes : officeStrokes;

    return {
        strokes: currentStrokes,
        sendStroke,
        sendCursor,
        clearAllStrokes,
        isLoading,
    };
}
