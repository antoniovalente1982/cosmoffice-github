import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { useAvatarStore } from '../stores/avatarStore';
import { useDailyStore } from '../stores/dailyStore';
import { useWorkspaceStore } from '../stores/workspaceStore';

/**
 * usePresence — Lightweight Supabase Presence for online/offline detection ONLY.
 * 
 * Media state (mic/cam/speaking) is now broadcast via PartyKit (useAvatarSync),
 * NOT here. This avoids conflicting updates between two presence systems.
 * 
 * This only handles:
 * - Detecting when a user comes online / goes offline (leave event → removePeer)
 * - Basic profile sync on first join (full_name, avatar_url)
 */
export function usePresence() {
    const supabase = createClient();
    const channelRef = useRef<any>(null);
    const userIdRef = useRef<string | null>(null);

    const buildPayload = useCallback(() => {
        const avatar = useAvatarStore.getState();
        return {
            status: avatar.myStatus,
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
                .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                    if (key !== user.id) {
                        const p = newPresences[0] as any;
                        // Only set profile info on join — no media state here
                        useAvatarStore.getState().updatePeer(key, {
                            id: key,
                            status: p.status || 'online',
                            full_name: p.full_name,
                            avatar_url: p.avatar_url,
                        });
                    }
                })
                .on('presence', { event: 'leave' }, ({ key }) => {
                    // User went offline — remove peer
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

    // Update presence only on status changes (online/away/busy)
    useEffect(() => {
        if (!channelRef.current || !userIdRef.current) return;

        const unsubAvatar = useAvatarStore.subscribe((state, prevState) => {
            if (state.myStatus !== prevState.myStatus) {
                channelRef.current?.track(buildPayload());
            }
        });

        return () => { unsubAvatar(); };
    }, [buildPayload]);
}
