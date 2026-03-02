'use client';

// ============================================
// useProximityAndRooms — Pure visual proximity engine
// ZERO Daily API calls — only tracks aura state + prepares volume
// Daily connections are triggered by DailyManager when user enables mic/cam
// ============================================

import { useEffect, useRef, useCallback } from 'react';
import { useAvatarStore } from '../stores/avatarStore';
import { useDailyStore } from '../stores/dailyStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { isPointInRect, isBlockedByWall, distance, type Rect, type Point } from '../utils/wallDetection';
import { getAdaptiveVolume, canFormProximityConnection } from '../utils/avatarStateMachine';

const PROXIMITY_RADIUS = 250;
const CHECK_INTERVAL_MS = 500;   // 2 checks/sec — smooth enough for aura
const FADE_OUT_MS = 1500;

interface ProximityPeer {
    id: string;
    position: Point;
    distance: number;
}

/**
 * Compute stable host ID: the lexicographically smallest ID in the group.
 * Used as the proximity room name so it doesn't change when peers join/leave.
 */
function computeHostId(myId: string, peerIds: string[]): string {
    let host = myId;
    for (const id of peerIds) {
        if (id < host) host = id;
    }
    return host;
}

/**
 * Pure visual proximity engine.
 * Detects nearby peers, manages aura state, prepares volume levels.
 * Does NOT call Daily API — DailyManager handles that on mic/cam toggle.
 */
export function useProximityAndRooms() {
    const lastRoomIdRef = useRef<string | null>(null);
    const lastProximityPeersRef = useRef<Set<string>>(new Set());
    const fadeOutTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const lastVolumesRef = useRef<Map<string, number>>(new Map());
    const roomJoinDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── Room entry handler (rooms ARE explicit — keep Daily join) ────
    const handleRoomEntry = useCallback((roomId: string, rooms: any[]) => {
        const room = rooms.find((r: any) => r.id === roomId);
        if (!room) return;

        const avatarStore = useAvatarStore.getState();
        const isKnockRequired = room.settings?.knockRequired || room.is_secret;

        // Check if room is locked by admin
        const lockedRoomIds = useWorkspaceStore.getState().lockedRoomIds;
        if (lockedRoomIds.has(roomId)) {
            console.log('[Proximity] Room is locked by admin:', roomId);
            return;
        }

        if (!isKnockRequired) {
            avatarStore.setMyRoom(roomId);
            useDailyStore.getState().setActiveContext('room', roomId);
            // Debounce Daily join: prevents leave+join spam when walking between rooms
            if (roomJoinDebounceRef.current) clearTimeout(roomJoinDebounceRef.current);
            roomJoinDebounceRef.current = setTimeout(() => {
                roomJoinDebounceRef.current = null;
                const joinRoomFn = (window as any).__joinDailyContext;
                if (joinRoomFn) joinRoomFn('room', roomId);
            }, 300);
            console.log('[Proximity] Entered room freely:', room.name);
            return;
        }

        const peersInRoom = Object.values(avatarStore.peers).filter((p: any) => p.roomId === roomId);
        if (peersInRoom.length === 0) {
            avatarStore.setMyRoom(roomId);
            useDailyStore.getState().setActiveContext('room', roomId);
            // Debounce Daily join: prevents leave+join spam when walking between rooms
            if (roomJoinDebounceRef.current) clearTimeout(roomJoinDebounceRef.current);
            roomJoinDebounceRef.current = setTimeout(() => {
                roomJoinDebounceRef.current = null;
                const joinRoomFn = (window as any).__joinDailyContext;
                if (joinRoomFn) joinRoomFn('room', roomId);
            }, 300);
            console.log('[Proximity] First user entering knock room:', room.name);
            return;
        }

        avatarStore.setKnockingAtRoom(roomId);
        const sendKnockFn = (window as any).__sendKnock;
        if (sendKnockFn) sendKnockFn(roomId);
        console.log('[Proximity] Knocking at room:', room.name);
    }, []);

    // ─── Room exit handler ───────────────────────────────────
    const handleRoomExit = useCallback(() => {
        const avatarStore = useAvatarStore.getState();
        const dailyStore = useDailyStore.getState();

        // Cancel any pending room join debounce (user is leaving before debounce fired)
        if (roomJoinDebounceRef.current) {
            clearTimeout(roomJoinDebounceRef.current);
            roomJoinDebounceRef.current = null;
        }

        if (dailyStore.activeContext === 'room') {
            const leaveFn = (window as any).__leaveDailyContext;
            if (leaveFn) leaveFn();
        }

        avatarStore.setMyRoom(undefined);
        avatarStore.setKnockingAtRoom(null);
        useDailyStore.getState().setActiveContext('none', null);
        console.log('[Proximity] Left room');
    }, []);

    // ─── Proximity group tracking (VISUAL ONLY — no Daily calls) ─────
    const updateProximityGroup = useCallback((nearbyPeers: ProximityPeer[]) => {
        const avatarStore = useAvatarStore.getState();
        const dailyStore = useDailyStore.getState();
        const myId = avatarStore.myProfile?.id;
        if (!myId) return;

        // Skip if DND or admin blocked proximity
        if (avatarStore.myDnd || dailyStore.proximityBlockedGlobal) {
            // Clear proximity state
            if (avatarStore.myProximityGroupId) {
                avatarStore.setMyProximityGroup(null);
            }
            lastProximityPeersRef.current.clear();
            return;
        }

        const currentPeerIds = new Set(nearbyPeers.map(p => p.id));
        const previousPeerIds = lastProximityPeersRef.current;

        const peersChanged =
            currentPeerIds.size !== previousPeerIds.size ||
            Array.from(currentPeerIds).some(id => !previousPeerIds.has(id));

        if (!peersChanged) return;

        // Cancel fade-out timers for peers that came back
        nearbyPeers.forEach(p => {
            const timer = fadeOutTimersRef.current.get(p.id);
            if (timer) {
                clearTimeout(timer);
                fadeOutTimersRef.current.delete(p.id);
            }
        });

        // Fade out audio for peers that left
        previousPeerIds.forEach(id => {
            if (!currentPeerIds.has(id)) {
                const timer = setTimeout(() => {
                    fadeOutTimersRef.current.delete(id);
                    const audioEl = document.getElementById(`daily-audio-${id}`) as HTMLAudioElement;
                    if (audioEl) audioEl.volume = 0;
                }, FADE_OUT_MS);
                fadeOutTimersRef.current.set(id, timer);
            }
        });

        lastProximityPeersRef.current = currentPeerIds;

        // ─── Update proximity group ID in store (for DailyManager to read) ───
        if (nearbyPeers.length > 0) {
            const hostId = computeHostId(myId, nearbyPeers.map(p => p.id));
            // Only update store if host changed
            if (avatarStore.myProximityGroupId !== hostId) {
                avatarStore.setMyProximityGroup(hostId);
                console.log('[Proximity] Aura active — host:', hostId.slice(0, 8) + '...');
            }
        } else {
            // No peers nearby — clear proximity group
            if (avatarStore.myProximityGroupId) {
                avatarStore.setMyProximityGroup(null);
                console.log('[Proximity] Aura deactivated — no nearby peers');
            }
        }

        // NOTE: NO __joinDailyContext / __leaveDailyContext calls here!
        // DailyManager handles Daily connections based on mic/cam state.
    }, []);

    // ─── Adaptive volume update ──────────────────────────────
    const updateAdaptiveVolume = useCallback((nearbyPeers: ProximityPeer[]) => {
        nearbyPeers.forEach(peer => {
            const volume = getAdaptiveVolume(peer.distance, PROXIMITY_RADIUS);
            const prevVol = lastVolumesRef.current.get(peer.id) ?? -1;
            if (Math.abs(volume - prevVol) < 0.01) return;
            lastVolumesRef.current.set(peer.id, volume);

            const audioEl = document.getElementById(`daily-audio-${peer.id}`) as HTMLAudioElement;
            if (audioEl) {
                audioEl.volume = Math.max(0, Math.min(1, volume));
            }
        });
    }, []);

    // ─── Main check loop (every 500ms) ───────────────────────
    useEffect(() => {
        const interval = setInterval(() => {
            const avatarStore = useAvatarStore.getState();
            const dailyStore = useDailyStore.getState();
            const workspaceStore = useWorkspaceStore.getState();

            const myPos = avatarStore.myPosition;
            const rooms = workspaceStore.rooms;

            const roomRects: Rect[] = rooms.map((r: any) => ({
                x: r.x, y: r.y, width: r.width, height: r.height,
            }));

            // ─── 1. Am I inside a room? ─────────────────────
            let currentRoomId: string | null = null;
            for (const room of rooms) {
                if (isPointInRect(myPos, { x: room.x, y: room.y, width: room.width, height: room.height })) {
                    currentRoomId = room.id;
                    break;
                }
            }

            if (currentRoomId) {
                if (currentRoomId !== lastRoomIdRef.current) {
                    // Clear proximity when entering a room
                    if (avatarStore.myProximityGroupId) {
                        avatarStore.setMyProximityGroup(null);
                    }
                    lastProximityPeersRef.current.clear();

                    handleRoomEntry(currentRoomId, rooms);
                    lastRoomIdRef.current = currentRoomId;
                }
                return;
            }

            // ─── 2. Open space — check if we just left a room ──
            if (lastRoomIdRef.current) {
                handleRoomExit();
                lastRoomIdRef.current = null;
            }

            // ─── 3. Check if currently knocking ─────────────
            if (avatarStore.knockingAtRoom) return;

            // ─── 4. Calculate nearby users ───────────────────
            const myState = {
                isDnd: avatarStore.myDnd,
                isAway: avatarStore.myAway,
                inRoom: false,
            };

            const nearbyPeers: ProximityPeer[] = [];

            Object.values(avatarStore.peers).forEach((peer: any) => {
                if (!peer.position) return;

                const peerState = {
                    isDnd: peer.isDnd || false,
                    isAway: peer.isAway || peer.status === 'away',
                    inRoom: !!peer.roomId,
                };

                if (!canFormProximityConnection(myState, peerState)) return;

                const dist = distance(myPos, peer.position);
                if (dist >= PROXIMITY_RADIUS) return;

                if (isBlockedByWall(myPos, peer.position, roomRects)) return;

                nearbyPeers.push({
                    id: peer.id,
                    position: peer.position,
                    distance: dist,
                });
            });

            // ─── 5. Update proximity group (visual) and volume ──
            updateProximityGroup(nearbyPeers);
            updateAdaptiveVolume(nearbyPeers);

        }, CHECK_INTERVAL_MS);

        return () => {
            clearInterval(interval);
            fadeOutTimersRef.current.forEach(timer => clearTimeout(timer));
            fadeOutTimersRef.current.clear();
        };
    }, [handleRoomEntry, handleRoomExit, updateProximityGroup, updateAdaptiveVolume]);

    return {
        proximityRadius: PROXIMITY_RADIUS,
    };
}
