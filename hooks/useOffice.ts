'use client';

import { useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useWorkspaceStore } from '../stores/workspaceStore';

/**
 * Notify other clients via PartyKit that office data has changed.
 * They will refetch from Supabase when they receive this broadcast.
 */
function notifyDataChanged(scope: string) {
    const socket = (window as any).__partykitSocket;
    if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'data_changed',
            userId: '', // server only needs it for type-check
            scope,
        }));
    }
}

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

        // ─── Listen for PartyKit data_changed broadcasts ──────────
        // When another client modifies rooms/furniture/settings, we refetch
        const handleDataChanged = (e: CustomEvent) => {
            const data = e.detail;
            if (data?.type === 'data_changed') {
                const scope = data.scope;
                if (scope === 'office' || scope === 'rooms' || scope === 'furniture' || scope === 'settings') {
                    // Skip refetch if in builder mode (we're the source of truth)
                    if (useWorkspaceStore.getState().isBuilderMode) return;
                    fetchOfficeData();
                }
            }
        };

        window.addEventListener('partykit-data-changed' as any, handleDataChanged);

        return () => {
            window.removeEventListener('partykit-data-changed' as any, handleDataChanged);
        };
    }, [spaceId, fetchOfficeData]);

    return { refresh: fetchOfficeData, notifyDataChanged };
}

// Re-export for convenience
export { notifyDataChanged };
