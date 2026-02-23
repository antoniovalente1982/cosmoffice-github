import { useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useOfficeStore } from '@/stores/useOfficeStore';

export function usePresence() {
    const supabase = createClient();
    const { myPosition, myStatus, myRoomId, updatePeer, removePeer } = useOfficeStore();

    const syncPosition = useCallback(async (userId: string) => {
        const channel = supabase.channel('office_presence', {
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
    }, [supabase, updatePeer, removePeer, myPosition, myStatus, myRoomId]);

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
            if (user) {
                const channel = supabase.channel('office_presence');
                await channel.track({
                    position: myPosition,
                    status: myStatus,
                    roomId: myRoomId,
                    online_at: new Date().toISOString(),
                });
            }
        };
        updatePresence();
    }, [myPosition, myStatus, myRoomId, supabase]);
}
