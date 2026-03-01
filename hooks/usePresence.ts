import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useAvatarStore } from '../stores/avatarStore';
import { useDailyStore } from '../stores/dailyStore';
import { useWorkspaceStore } from '../stores/workspaceStore';

/**
 * usePresence — Supabase Presence for status & media state sync.
 * Position sync is handled by PartyKit (useAvatarSync), NOT here.
 * This only broadcasts: status, roomId, audioEnabled, videoEnabled, isSpeaking, remoteAudioEnabled, profile.
 */
export function usePresence() {
    const supabase = createClient();
    const channelRef = useRef<any>(null);
    const userIdRef = useRef<string | null>(null);
    const lastSentRef = useRef({ status: '', roomId: '', mic: false, vid: false, remoteAudio: true });

    const buildPayload = useCallback(() => {
        const avatar = useAvatarStore.getState();
        const daily = useDailyStore.getState();
        return {
            status: avatar.myStatus,
            roomId: avatar.myRoomId,
            audioEnabled: daily.isAudioOn,
            videoEnabled: daily.isVideoOn,
            remoteAudioEnabled: daily.isRemoteAudioEnabled,
            isSpeaking: daily.isSpeaking,
            full_name: avatar.myProfile?.display_name || avatar.myProfile?.full_name || 'User',
            avatar_url: avatar.myProfile?.avatar_url || null,
            online_at: new Date().toISOString(),
        };
    }, []);

    // Initialize presence channel once
    useEffect(() => {
        const activeSpaceId = useWorkspaceStore.getState().activeSpaceId;
        if (!activeSpaceId) return;

        let cleanupFn: (() => void) | undefined;

        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            userIdRef.current = user.id;

            const channel = supabase.channel(`office_presence_${activeSpaceId}`, {
                config: { presence: { key: user.id } },
            });

            channel
                .on('presence', { event: 'sync' }, () => {
                    const state = channel.presenceState();
                    Object.keys(state).forEach((key) => {
                        if (key !== user.id) {
                            const presenceData = state[key][0] as any;
                            // Update peer metadata (status, media) — NOT position
                            useAvatarStore.getState().updatePeer(key, {
                                id: key,
                                status: presenceData.status,
                                roomId: presenceData.roomId,
                                audioEnabled: presenceData.audioEnabled,
                                videoEnabled: presenceData.videoEnabled,
                                remoteAudioEnabled: presenceData.remoteAudioEnabled,
                                isSpeaking: presenceData.isSpeaking,
                                full_name: presenceData.full_name,
                                avatar_url: presenceData.avatar_url,
                            });
                        }
                    });
                })
                .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                    if (key !== user.id) {
                        const p = newPresences[0] as any;
                        useAvatarStore.getState().updatePeer(key, {
                            id: key,
                            status: p.status,
                            roomId: p.roomId,
                            audioEnabled: p.audioEnabled,
                            videoEnabled: p.videoEnabled,
                            remoteAudioEnabled: p.remoteAudioEnabled,
                            isSpeaking: p.isSpeaking,
                            full_name: p.full_name,
                            avatar_url: p.avatar_url,
                        });
                    }
                })
                .on('presence', { event: 'leave' }, ({ key }) => {
                    useAvatarStore.getState().removePeer(key);
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await channel.track(buildPayload());
                    }
                });

            channelRef.current = channel;
            cleanupFn = () => supabase.removeChannel(channel);
        };

        init();
        return () => { if (cleanupFn) cleanupFn(); };
    }, [supabase, buildPayload]);

    // Update presence on status/media state changes (not position — that's PartyKit)
    useEffect(() => {
        if (!channelRef.current || !userIdRef.current) return;

        // Subscribe to state changes from both stores
        const unsubAvatar = useAvatarStore.subscribe((state) => {
            const last = lastSentRef.current;
            if (last.status !== state.myStatus || last.roomId !== (state.myRoomId || '')) {
                lastSentRef.current = { ...last, status: state.myStatus, roomId: state.myRoomId || '' };
                channelRef.current?.track(buildPayload());
            }
        });

        const unsubDaily = useDailyStore.subscribe((state) => {
            const last = lastSentRef.current;
            if (last.mic !== state.isAudioOn || last.vid !== state.isVideoOn || last.remoteAudio !== state.isRemoteAudioEnabled) {
                lastSentRef.current = { ...last, mic: state.isAudioOn, vid: state.isVideoOn, remoteAudio: state.isRemoteAudioEnabled };
                channelRef.current?.track(buildPayload());
            }
        });

        return () => {
            unsubAvatar();
            unsubDaily();
        };
    }, [buildPayload]);
}
