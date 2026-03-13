'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useWhiteboardStore, WhiteboardStroke } from '../stores/whiteboardStore';
import { createClient } from '../utils/supabase/client';
import { useAvatarStore } from '../stores/avatarStore';

// ============================================
// useWhiteboard — Collaborative whiteboard hook
// Loads strokes from Supabase, syncs via PartyKit
// Handles: strokes, shapes, activity notifications
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
    const setActiveDrawer = useWhiteboardStore(s => s.setActiveDrawer);
    const removeActiveDrawer = useWhiteboardStore(s => s.removeActiveDrawer);
    const updateStroke = useWhiteboardStore(s => s.updateStroke);
    const updateOfficeStroke = useWhiteboardStore(s => s.updateOfficeStroke);

    const [isLoading, setIsLoading] = useState(false);
    const supabase = createClient();
    const prevRoomIdRef = useRef<string | null>(null);
    const officeLoadedRef = useRef(false);
    const activityTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

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
                        fillColor: row.stroke_data?.fillColor || null,
                        width: row.stroke_data?.width || 4,
                        points: row.stroke_data?.points || [],
                        tool: row.stroke_data?.tool || 'pen',
                        text: row.stroke_data?.text || undefined,
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

    // ─── Auto-reset: clear old strokes when room was empty ────
    // When entering a room, wait for peers to sync, then check if
    // we're the only occupant. If so, the room was empty → reset.
    useEffect(() => {
        if (!roomId || !workspaceId) return;

        const timer = setTimeout(async () => {
            const peers = useAvatarStore.getState().peers;
            const roomPeers = Object.values(peers).filter(
                (p: any) => p.roomId === roomId && p.id !== userId
            );

            // If no other peers in this room, it was empty → cleanup old strokes
            if (roomPeers.length === 0) {
                const currentStrokes = useWhiteboardStore.getState().roomStrokes;
                if (currentStrokes.length > 0) {
                    console.log('[Whiteboard] Room was empty, clearing old strokes');
                    clearRoomStrokes();
                    try {
                        await supabase
                            .from('whiteboard_strokes')
                            .delete()
                            .eq('workspace_id', workspaceId)
                            .eq('room_id', roomId);
                    } catch (err) {
                        console.error('[Whiteboard] Failed to cleanup old strokes:', err);
                    }
                }
            }
        }, 3000); // 3s delay to let peer list populate

        return () => clearTimeout(timer);
    }, [roomId, workspaceId, userId, supabase, clearRoomStrokes]);

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
                        fillColor: row.stroke_data?.fillColor || null,
                        width: row.stroke_data?.width || 4,
                        points: row.stroke_data?.points || [],
                        tool: row.stroke_data?.tool || 'pen',
                        text: row.stroke_data?.text || undefined,
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

    // ─── Register PartyKit listener ───────────────────────────
    useEffect(() => {
        const handleWbMessage = (e: CustomEvent) => {
            const data = e.detail;
            if (!data) return;

            if (data.type === 'wb_stroke') {
                if (data.stroke?.userId === userId) return;
                // Laser strokes should be temporary (fade out), not persisted in store
                if (data.stroke?.tool === 'laser') {
                    window.dispatchEvent(new CustomEvent('whiteboard-laser', { detail: data.stroke }));
                    return;
                }
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
            } else if (data.type === 'wb_activity') {
                if (data.userId === userId) return;
                // Track active drawer
                setActiveDrawer({
                    userId: data.userId,
                    userName: data.userName,
                    color: data.color,
                    timestamp: Date.now(),
                });
                // Auto-remove after 5s inactivity
                const existingTimeout = activityTimeoutsRef.current.get(data.userId);
                if (existingTimeout) clearTimeout(existingTimeout);
                const timeout = setTimeout(() => {
                    removeActiveDrawer(data.userId);
                    activityTimeoutsRef.current.delete(data.userId);
                }, 5000);
                activityTimeoutsRef.current.set(data.userId, timeout);
            } else if (data.type === 'wb_stroke_update') {
                // Remote shape update (resize)
                if (data.scope === 'room') {
                    updateStroke(data.strokeId, data.updates);
                } else {
                    updateOfficeStroke(data.strokeId, data.updates);
                }
            }
        };

        window.addEventListener('whiteboard-message' as any, handleWbMessage);
        return () => {
            window.removeEventListener('whiteboard-message' as any, handleWbMessage);
            // Clear all activity timeouts
            activityTimeoutsRef.current.forEach(t => clearTimeout(t));
            activityTimeoutsRef.current.clear();
        };
    }, [userId, addStroke, addOfficeStroke, updateRemoteCursor, clearRoomStrokes, clearOfficeStrokes, setActiveDrawer, removeActiveDrawer, updateStroke, updateOfficeStroke]);

    // Whiteboard sync is fully handled by PartyKit (wb_stroke/wb_clear/wb_stroke_update).
    // No Supabase Realtime backup channel needed — data is persisted to Supabase on write.

    // ─── Send stroke: Optimistic + PartyKit + Supabase ────────
    const sendStroke = useCallback(async (stroke: WhiteboardStroke) => {
        if (!workspaceId) return;

        const isRoom = activeChannel === 'room';
        const targetRoomId = isRoom ? roomId : null;

        // 1. Optimistic
        if (isRoom) addStroke(stroke); else addOfficeStroke(stroke);

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
                    fillColor: stroke.fillColor || null,
                    text: stroke.text || null,
                },
            });
        } catch (err) {
            console.error('[Whiteboard] Failed to persist stroke:', err);
        }
    }, [workspaceId, roomId, userId, userName, activeChannel, supabase, addStroke, addOfficeStroke]);

    // ─── Send activity notification (drawing/opened) ──────────
    const sendActivity = useCallback((action: string, color: string) => {
        const socket = (window as any).__partykitSocket;
        if (socket?.readyState === WebSocket.OPEN) {
            const isRoom = useWhiteboardStore.getState().activeChannel === 'room';
            socket.send(JSON.stringify({
                type: 'wb_activity',
                scope: isRoom ? 'room' : 'office',
                roomId: isRoom ? roomId : null,
                userId,
                userName,
                color,
                action,
            }));
        }
    }, [roomId, userId, userName]);

    // ─── Send stroke update (shape resize) ────────────────────
    const sendStrokeUpdate = useCallback(async (strokeId: string, updates: Partial<WhiteboardStroke>) => {
        if (!workspaceId) return;

        const isRoom = activeChannel === 'room';
        const targetRoomId = isRoom ? roomId : null;

        // 1. Local update
        if (isRoom) updateStroke(strokeId, updates); else updateOfficeStroke(strokeId, updates);

        // 2. PartyKit broadcast
        const socket = (window as any).__partykitSocket;
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'wb_stroke_update',
                scope: isRoom ? 'room' : 'office',
                roomId: targetRoomId,
                strokeId,
                updates,
            }));
        }

        // 3. Supabase update
        try {
            const existingStroke = isRoom
                ? useWhiteboardStore.getState().roomStrokes.find(s => s.id === strokeId)
                : useWhiteboardStore.getState().officeStrokes.find(s => s.id === strokeId);

            if (existingStroke) {
                await supabase.from('whiteboard_strokes').update({
                    stroke_data: {
                        points: updates.points || existingStroke.points,
                        width: updates.width || existingStroke.width,
                        tool: existingStroke.tool,
                        fillColor: updates.fillColor !== undefined ? updates.fillColor : existingStroke.fillColor,
                        text: updates.text !== undefined ? updates.text : existingStroke.text,
                    },
                }).eq('id', strokeId);
            }
        } catch (err) {
            console.error('[Whiteboard] Failed to update stroke:', err);
        }
    }, [workspaceId, roomId, activeChannel, supabase, updateStroke, updateOfficeStroke]);

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

        if (isRoom) clearRoomStrokes(); else clearOfficeStrokes();

        const socket = (window as any).__partykitSocket;
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'wb_clear',
                scope: isRoom ? 'room' : 'office',
                roomId: targetRoomId,
            }));
        }

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
        sendActivity,
        sendStrokeUpdate,
        clearAllStrokes,
        isLoading,
    };
}
