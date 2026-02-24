import { useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useOfficeStore } from '../stores/useOfficeStore';

export function usePresence() {
    const supabase = createClient();
    const { myPosition, myStatus, myRoomId, activeSpaceId, updatePeer, removePeer } = useOfficeStore();

    const syncPosition = useCallback(async (userId: string) => {
        if (!activeSpaceId) return;

        const channel = supabase.channel(`office_presence_${activeSpaceId}`, {
            config: {
                presence: {
                    key: userId,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                Object.keys(state).forEach((key) => {
                    if (key !== userId) {
                        const presenceData = state[key][0] as any;
                        updatePeer(key, {
                            id: key,
                            ...presenceData,
                        });
                    }
                });
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                if (key !== userId) {
                    updatePeer(key, newPresences[0] as any);
                }
            })
            .on('presence', { event: 'leave' }, ({ key }) => {
                removePeer(key);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        position: myPosition,
                        status: myStatus,
                        roomId: myRoomId,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, updatePeer, removePeer, myPosition, myStatus, myRoomId, activeSpaceId]);

    useEffect(() => {
        let cleanup: (() => void) | undefined;

        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                cleanup = await syncPosition(user.id);
            }
        };

        init();

        return () => {
            if (cleanup) cleanup();
        };
    }, [supabase, syncPosition]);

    // Update position in presence when it changes locally
    useEffect(() => {
        const updatePresence = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && activeSpaceId) {
                const channel = supabase.channel(`office_presence_${activeSpaceId}`);
                await channel.track({
                    position: myPosition,
                    status: myStatus,
                    roomId: myRoomId,
                    spaceId: activeSpaceId,
                    online_at: new Date().toISOString(),
                });
            }
        };
        updatePresence();
    }, [myPosition, myStatus, myRoomId, activeSpaceId, supabase]);
}
