import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useOfficeStore } from '../stores/useOfficeStore';

export function usePresence() {
    const supabase = createClient();
    const channelRef = useRef<any>(null);
    const userIdRef = useRef<string | null>(null);
    const lastSentRef = useRef({ x: 0, y: 0, status: '', roomId: '', mic: false, vid: false });
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

    // Update presence when state changes — with dead-zone + 200ms throttle
    useEffect(() => {
        if (!channelRef.current || !userIdRef.current || !activeSpaceId) return;

        const last = lastSentRef.current;
        const dx = Math.abs(myPosition.x - last.x);
        const dy = Math.abs(myPosition.y - last.y);
        const posChanged = dx > 2 || dy > 2; // dead-zone: skip tiny movements
        const stateChanged = last.status !== myStatus || last.roomId !== (myRoomId || '')
            || last.mic !== isMicEnabled || last.vid !== isVideoEnabled;

        // Skip if nothing meaningful changed
        if (!posChanged && !stateChanged) return;

        const timeoutId = setTimeout(() => {
            lastSentRef.current = {
                x: myPosition.x, y: myPosition.y,
                status: myStatus, roomId: myRoomId || '',
                mic: isMicEnabled, vid: isVideoEnabled,
            };
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
        }, 200); // 200ms throttle (was 100ms)

        return () => clearTimeout(timeoutId);
    }, [myPosition, myStatus, myRoomId, activeSpaceId, isMicEnabled, isVideoEnabled, isSpeaking]);
}
