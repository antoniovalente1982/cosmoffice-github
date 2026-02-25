import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useOfficeStore } from '../stores/useOfficeStore';

export function usePresence() {
    const supabase = createClient();
    const channelRef = useRef<any>(null);
    const userIdRef = useRef<string | null>(null);
    const {
        myPosition, myStatus, myRoomId, activeSpaceId, updatePeer, removePeer,
        isMicEnabled, isVideoEnabled, isSpeaking
    } = useOfficeStore();

    // Initialize presence channel once
    useEffect(() => {
        if (!activeSpaceId) return;

        let cleanupFn: (() => void) | undefined;

        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            userIdRef.current = user.id;

            const channel = supabase.channel(`office_presence_${activeSpaceId}`, {
                config: {
                    presence: {
                        key: user.id,
                    },
                },
            });

            channel
                .on('presence', { event: 'sync' }, () => {
                    const state = channel.presenceState();
                    Object.keys(state).forEach((key) => {
                        if (key !== user.id) {
                            const presenceData = state[key][0] as any;
                            updatePeer(key, {
                                id: key,
                                ...presenceData,
                            });
                        }
                    });
                })
                .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                    if (key !== user.id) {
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
                            audioEnabled: isMicEnabled,
                            videoEnabled: isVideoEnabled,
                            isSpeaking: isSpeaking,
                            online_at: new Date().toISOString(),
                        });
                    }
                });

            channelRef.current = channel;

            cleanupFn = () => {
                supabase.removeChannel(channel);
            };
        };

        init();

        return () => {
            if (cleanupFn) cleanupFn();
        };
    }, [supabase, activeSpaceId, updatePeer, removePeer]);

    // Update presence when state changes (using the existing channel)
    useEffect(() => {
        if (!channelRef.current || !userIdRef.current || !activeSpaceId) return;
        
        // Debounce the update to prevent too many calls
        const timeoutId = setTimeout(() => {
            channelRef.current.track({
                position: myPosition,
                status: myStatus,
                roomId: myRoomId,
                spaceId: activeSpaceId,
                audioEnabled: isMicEnabled,
                videoEnabled: isVideoEnabled,
                isSpeaking: isSpeaking,
                online_at: new Date().toISOString(),
            });
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [myPosition, myStatus, myRoomId, activeSpaceId, isMicEnabled, isVideoEnabled, isSpeaking]);
}
