'use client';

import { useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useWorkspaceStore } from '../stores/workspaceStore';

export function useOffice(spaceId?: string) {
    const supabase = createClient();
    const setRooms = useWorkspaceStore(s => s.setRooms);
    const setRoomConnections = useWorkspaceStore(s => s.setRoomConnections);
    const setFurnitureItems = useWorkspaceStore(s => s.setFurnitureItems);
    const setOfficeDimensions = useWorkspaceStore(s => s.setOfficeDimensions);
    const setBgOpacity = useWorkspaceStore(s => s.setBgOpacity);
    const setLandingPad = useWorkspaceStore(s => s.setLandingPad);
    const setLandingPadScale = useWorkspaceStore(s => s.setLandingPadScale);
    const setLayoutMode = useWorkspaceStore(s => s.setLayoutMode);
    const setTheme = useWorkspaceStore(s => s.setTheme);

    // ─── Initial full fetch (once) ───────────────────────────
    const fetchOfficeData = useCallback(async () => {
        if (!spaceId) return;

        // Fetch office layout settings from space
        const { data: space, error: spaceError } = await supabase
            .from('spaces')
            .select('layout_data')
            .eq('id', spaceId)
            .single();

        if (!spaceError && space?.layout_data) {
            const layout = space.layout_data as any;
            if (layout.officeWidth && layout.officeHeight) {
                setOfficeDimensions(layout.officeWidth, layout.officeHeight);
            }
            if (layout.bgOpacity !== undefined) {
                setBgOpacity(layout.bgOpacity);
            }
            if (typeof layout.landingPadX === 'number' && typeof layout.landingPadY === 'number') {
                setLandingPad({ x: layout.landingPadX, y: layout.landingPadY });
            }
            if (typeof layout.landingPadScale === 'number') {
                setLandingPadScale(layout.landingPadScale);
            }
            if (layout.layoutMode === 'free' || layout.layoutMode === 'hierarchical' || layout.layoutMode === 'teamsmap') {
                setLayoutMode(layout.layoutMode);
            } else if (layout.layoutMode === 'classic') {
                setLayoutMode('free'); // Backward compat
            } else if (layout.layoutMode === 'mindmap') {
                setLayoutMode('teamsmap'); // Backward compat
            }
        }

        // Fetch workspace theme
        const { data: spaceForWs } = await supabase
            .from('spaces')
            .select('workspace_id')
            .eq('id', spaceId)
            .single();
        if (spaceForWs?.workspace_id) {
            const { data: ws } = await supabase
                .from('workspaces')
                .select('settings')
                .eq('id', spaceForWs.workspace_id)
                .single();
            if (ws?.settings?.theme) {
                setTheme(ws.settings.theme);
            } else {
                setTheme('space');
            }
        }

        // Fetch rooms for THIS space only
        const { data: rooms, error: roomsError } = await supabase
            .from('rooms')
            .select('*')
            .eq('space_id', spaceId);

        if (roomsError) {
            console.error('Error fetching rooms:', roomsError);
        } else {
            setRooms(rooms || []);

            // Fetch furniture for all rooms in this space
            const roomIds = (rooms || []).map((r: any) => r.id);
            if (roomIds.length > 0) {
                const { data: furniture, error: furnError } = await supabase
                    .from('furniture')
                    .select('*')
                    .in('room_id', roomIds);

                if (!furnError && furniture) {
                    setFurnitureItems(furniture);
                }
            }
        }

        // Fetch connections for THIS space only
        const { data: connections, error: connError } = await supabase
            .from('room_connections')
            .select('*')
            .eq('space_id', spaceId);

        if (!connError && connections) {
            setRoomConnections(connections);
        }
    }, [spaceId, supabase, setRooms, setRoomConnections, setFurnitureItems, setOfficeDimensions, setBgOpacity, setLandingPad, setLandingPadScale, setLayoutMode, setTheme]);

    useEffect(() => {
        fetchOfficeData();

        if (!spaceId) return;

        // ─── Delta updates for rooms ─────────────────────────────
        const roomsChannel = supabase
            .channel(`rooms_${spaceId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'rooms',
                filter: `space_id=eq.${spaceId}`
            }, (payload) => {
                const newRoom = payload.new as any;
                const store = useWorkspaceStore.getState();
                // In builder mode, we manage rooms directly — ignore echoes
                if (store.isBuilderMode) return;
                // Only add if not already present (avoid duplicates from optimistic updates)
                if (!store.rooms.find((r: any) => r.id === newRoom.id)) {
                    store.addRoom(newRoom);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'rooms',
                filter: `space_id=eq.${spaceId}`
            }, (payload) => {
                const updated = payload.new as any;
                const store = useWorkspaceStore.getState();
                // In builder mode, we are the source of truth — ignore echoes from our own updates
                // This prevents Realtime from overwriting unsaved local edits (name, color, etc.)
                if (store.isBuilderMode) return;
                store.setRooms(store.rooms.map((r: any) =>
                    r.id === updated.id ? { ...r, ...updated } : r
                ));
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'rooms',
                filter: `space_id=eq.${spaceId}`
            }, (payload) => {
                const deletedId = (payload.old as any).id;
                if (deletedId) {
                    useWorkspaceStore.getState().removeRoom(deletedId);
                }
            })
            .subscribe();

        // ─── Delta updates for connections ────────────────────────
        const connChannel = supabase
            .channel(`connections_${spaceId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'room_connections',
                filter: `space_id=eq.${spaceId}`
            }, (payload) => {
                const store = useWorkspaceStore.getState();
                const newConn = payload.new as any;
                if (!store.roomConnections.find((c: any) => c.id === newConn.id)) {
                    store.setRoomConnections([...store.roomConnections, newConn]);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'room_connections',
                filter: `space_id=eq.${spaceId}`
            }, (payload) => {
                const updated = payload.new as any;
                const store = useWorkspaceStore.getState();
                store.setRoomConnections(store.roomConnections.map((c: any) =>
                    c.id === updated.id ? { ...c, ...updated } : c
                ));
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'room_connections',
                filter: `space_id=eq.${spaceId}`
            }, (payload) => {
                const deletedId = (payload.old as any).id;
                const store = useWorkspaceStore.getState();
                store.setRoomConnections(store.roomConnections.filter((c: any) => c.id !== deletedId));
            })
            .subscribe();

        // ─── Delta updates for furniture ──────────────────────────
        const furnitureChannel = supabase
            .channel(`furniture_${spaceId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'furniture',
            }, (payload) => {
                const newItem = payload.new as any;
                const store = useWorkspaceStore.getState();
                // Only add if belonging to a room in this space
                if (store.rooms.find((r: any) => r.id === newItem.room_id)) {
                    store.addFurniture(newItem);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'furniture',
            }, (payload) => {
                const updated = payload.new as any;
                useWorkspaceStore.getState().updateFurniture(updated.id, updated);
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'furniture',
            }, (payload) => {
                const deletedId = (payload.old as any).id;
                if (deletedId) {
                    useWorkspaceStore.getState().removeFurniture(deletedId);
                }
            })
            .subscribe();

        // ─── Delta updates for workspace settings (theme sync) ─────
        // We need the workspace_id to subscribe to workspace changes
        let workspaceChannel: ReturnType<typeof supabase.channel> | null = null;
        (async () => {
            const { data: spaceForWs } = await supabase
                .from('spaces')
                .select('workspace_id')
                .eq('id', spaceId)
                .single();
            if (spaceForWs?.workspace_id) {
                workspaceChannel = supabase
                    .channel(`workspace_settings_${spaceForWs.workspace_id}`)
                    .on('postgres_changes', {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'workspaces',
                        filter: `id=eq.${spaceForWs.workspace_id}`
                    }, (payload) => {
                        const updated = payload.new as any;
                        if (updated?.settings?.theme) {
                            useWorkspaceStore.getState().setTheme(updated.settings.theme);
                        }
                    })
                    .subscribe();
            }
        })();

        return () => {
            supabase.removeChannel(roomsChannel);
            supabase.removeChannel(connChannel);
            supabase.removeChannel(furnitureChannel);
            if (workspaceChannel) supabase.removeChannel(workspaceChannel);
        };
    }, [spaceId, supabase, fetchOfficeData]);

    return { refresh: fetchOfficeData };
}
