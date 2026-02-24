'use client';

import { useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useOfficeStore } from '../stores/useOfficeStore';

export function useOffice(spaceId?: string) {
    const supabase = createClient();
    const { setRooms, setRoomConnections } = useOfficeStore();

    const fetchOfficeData = useCallback(async () => {
        if (!spaceId) return;

        // Fetch rooms
        const { data: rooms, error: roomsError } = await supabase
            .from('rooms')
            .select('*')
            .eq('space_id', spaceId);

        if (!roomsError && rooms) {
            setRooms(rooms);
        }

        // Fetch connections
        const { data: connections, error: connError } = await supabase
            .from('room_connections')
            .select('*')
            .eq('space_id', spaceId);

        if (!connError && connections) {
            setRoomConnections(connections);
        }
    }, [spaceId, supabase, setRooms, setRoomConnections]);

    useEffect(() => {
        fetchOfficeData();

        if (!spaceId) return;

        // Subscribe to changes
        const roomsChannel = supabase
            .channel(`rooms_${spaceId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'rooms',
                filter: `space_id=eq.${spaceId}`
            }, () => fetchOfficeData())
            .subscribe();

        const connChannel = supabase
            .channel(`connections_${spaceId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'room_connections',
                filter: `space_id=eq.${spaceId}`
            }, () => fetchOfficeData())
            .subscribe();

        return () => {
            supabase.removeChannel(roomsChannel);
            supabase.removeChannel(connChannel);
        };
    }, [spaceId, supabase, fetchOfficeData]);

    return { refresh: fetchOfficeData };
}
