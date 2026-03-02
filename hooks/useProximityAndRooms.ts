'use client';

// ============================================
// useProximityAndRooms — Core engine for room isolation + proximity audio/video
// Optimized: stable host-based room IDs, debounced join/leave, 500ms check interval
// Handles: room boundary detection, proximity grouping, wall detection, adaptive volume
// ============================================

import { useEffect, useRef, useCallback } from 'react';
import { useAvatarStore } from '../stores/avatarStore';
import { useDailyStore } from '../stores/dailyStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { isPointInRect, isBlockedByWall, distance, type Rect, type Point } from '../utils/wallDetection';
import { getAdaptiveVolume, canFormProximityConnection } from '../utils/avatarStateMachine';

const PROXIMITY_RADIUS = 250;
const CHECK_INTERVAL_MS = 500;       // Layer 4: was 100ms, now 500ms (5x less CPU)
const FADE_OUT_MS = 1500;
const JOIN_DEBOUNCE_MS = 2000;       // Layer 2: must be near someone 2s before joining Daily
const LEAVE_DEBOUNCE_MS = 3000;      // Layer 2: must have 0 peers for 3s before leaving Daily

interface ProximityPeer {
    id: string;
    position: Point;
    distance: number;
    dailySessionId?: string;
}

/**
 * Layer 1: Compute a stable "host" ID for the proximity group.
 * The peer with the lexicographically smallest ID is the host.
 * Everyone joins the same room: co-{spaceId}-prox-{hostId}.
 * This prevents room changes when peers enter/leave the group.
 */
function computeHostId(myId: string, peerIds: string[]): string {
    let host = myId;
    for (const id of peerIds) {
        if (id < host) host = id;
    }
    return host;
}

/**
 * Core proximity and room engine.
 * Replaces useSpatialAudio with full room isolation + proximity grouping.
 */
export function useProximityAndRooms() {
    const lastRoomIdRef = useRef<string | null>(null);
    const lastProximityPeersRef = useRef<Set<string>>(new Set());
    const fadeOutTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const lastVolumesRef = useRef<Map<string, number>>(new Map());

    // Layer 2: Debounce refs
    const joinDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const leaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingHostIdRef = useRef<string | null>(null);  // The host ID we're debouncing towards

    // ─── Room entry handler ──────────────────────────────────
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
            // Free entry — join directly
            avatarStore.setMyRoom(roomId);
            useDailyStore.getState().setActiveContext('room', roomId);

            // Trigger Daily.co room join via global function
            const joinRoomFn = (window as any).__joinDailyContext;
            if (joinRoomFn) joinRoomFn('room', roomId);

            console.log('[Proximity] Entered room freely:', room.name);
            return;
        }

        // Knock required — check if room is empty (first user enters freely)
        const peersInRoom = Object.values(avatarStore.peers).filter((p: any) => p.roomId === roomId);
        if (peersInRoom.length === 0) {
            // First user — enter freely
            avatarStore.setMyRoom(roomId);
            useDailyStore.getState().setActiveContext('room', roomId);
            const joinRoomFn = (window as any).__joinDailyContext;
            if (joinRoomFn) joinRoomFn('room', roomId);
            console.log('[Proximity] First user entering knock room:', room.name);
            return;
        }

        // Need to knock — set knocking state
        avatarStore.setKnockingAtRoom(roomId);

        // Send knock via PartyKit
        const sendKnockFn = (window as any).__sendKnock;
        if (sendKnockFn) sendKnockFn(roomId);

        console.log('[Proximity] Knocking at room:', room.name);
    }, []);

    // ─── Room exit handler ───────────────────────────────────
    const handleRoomExit = useCallback(() => {
        const avatarStore = useAvatarStore.getState();
        const dailyStore = useDailyStore.getState();

        if (dailyStore.activeContext === 'room') {
            const leaveFn = (window as any).__leaveDailyContext;
            if (leaveFn) leaveFn();
        }

        avatarStore.setMyRoom(undefined);
        avatarStore.setKnockingAtRoom(null);
        useDailyStore.getState().setActiveContext('none', null);
        console.log('[Proximity] Left room');
    }, []);

    // ─── Cancel all debounce timers ──────────────────────────
    const cancelDebounces = useCallback(() => {
        if (joinDebounceRef.current) {
            clearTimeout(joinDebounceRef.current);
            joinDebounceRef.current = null;
        }
        if (leaveDebounceRef.current) {
            clearTimeout(leaveDebounceRef.current);
            leaveDebounceRef.current = null;
        }
        pendingHostIdRef.current = null;
    }, []);

    // ─── Proximity group management (with debounce + stable host ID) ──
    const updateProximityGroup = useCallback((nearbyPeers: ProximityPeer[]) => {
        const avatarStore = useAvatarStore.getState();
        const dailyStore = useDailyStore.getState();
        const myId = avatarStore.myProfile?.id;
        if (!myId) return;

        // Skip if DND or admin blocked proximity
        if (avatarStore.myDnd || dailyStore.proximityBlockedGlobal) {
            if (dailyStore.activeContext === 'proximity') {
                cancelDebounces();
                const leaveFn = (window as any).__leaveDailyContext;
                if (leaveFn) leaveFn();
                dailyStore.setActiveContext('none', null);
            }
            lastProximityPeersRef.current.clear();
            return;
        }

        const currentPeerIds = new Set(nearbyPeers.map(p => p.id));
        const previousPeerIds = lastProximityPeersRef.current;

        // Check if the set of nearby peers changed
        const peersChanged =
            currentPeerIds.size !== previousPeerIds.size ||
            Array.from(currentPeerIds).some(id => !previousPeerIds.has(id));

        if (!peersChanged) return;

        // Cancel any pending fade-out timers for peers that came back
        nearbyPeers.forEach(p => {
            const timer = fadeOutTimersRef.current.get(p.id);
            if (timer) {
                clearTimeout(timer);
                fadeOutTimersRef.current.delete(p.id);
            }
        });

        // Handle peers that left proximity
        previousPeerIds.forEach(id => {
            if (!currentPeerIds.has(id)) {
                // Start fade-out timer
                const timer = setTimeout(() => {
                    fadeOutTimersRef.current.delete(id);
                    // Peer is truly gone — update volume to 0
                    const audioEl = document.getElementById(`daily-audio-${id}`) as HTMLAudioElement;
                    if (audioEl) audioEl.volume = 0;
                }, FADE_OUT_MS);
                fadeOutTimersRef.current.set(id, timer);
            }
        });

        lastProximityPeersRef.current = currentPeerIds;

        // ─── Layer 1: Stable host-based proximity room ──────
        if (nearbyPeers.length > 0) {
            const hostId = computeHostId(myId, nearbyPeers.map(p => p.id));

            // Layer 3: Skip if already in the same proximity room
            if (dailyStore.activeContext === 'proximity' && dailyStore.activeContextId === hostId) {
                // Already in the correct room — no action needed
                // Cancel any pending leave debounce since we still have peers
                if (leaveDebounceRef.current) {
                    clearTimeout(leaveDebounceRef.current);
                    leaveDebounceRef.current = null;
                }
                return;
            }

            // Cancel any pending leave debounce
            if (leaveDebounceRef.current) {
                clearTimeout(leaveDebounceRef.current);
                leaveDebounceRef.current = null;
            }

            // Layer 2: Debounce join — wait JOIN_DEBOUNCE_MS before actually joining
            if (pendingHostIdRef.current === hostId && joinDebounceRef.current) {
                // Already debouncing toward this host — let it ride
                return;
            }

            // Cancel previous join debounce if host changed
            if (joinDebounceRef.current) {
                clearTimeout(joinDebounceRef.current);
                joinDebounceRef.current = null;
            }

            pendingHostIdRef.current = hostId;
            joinDebounceRef.current = setTimeout(() => {
                joinDebounceRef.current = null;
                pendingHostIdRef.current = null;

                // Re-check that we still have nearby peers after debounce
                const currentPeers = lastProximityPeersRef.current;
                if (currentPeers.size === 0) return;

                // Re-check we're not already in this room
                const ds = useDailyStore.getState();
                if (ds.activeContext === 'proximity' && ds.activeContextId === hostId) return;

                ds.setActiveContext('proximity', hostId);
                useAvatarStore.getState().setMyProximityGroup(hostId);

                const joinFn = (window as any).__joinDailyContext;
                if (joinFn) joinFn('proximity', hostId);

                console.log('[Proximity] Joined proximity room (host:', hostId.slice(0, 8) + '...)');
            }, JOIN_DEBOUNCE_MS);

        } else if (nearbyPeers.length === 0 && dailyStore.activeContext === 'proximity') {
            // Cancel any pending join debounce
            if (joinDebounceRef.current) {
                clearTimeout(joinDebounceRef.current);
                joinDebounceRef.current = null;
                pendingHostIdRef.current = null;
            }

            // Layer 2: Debounce leave — wait LEAVE_DEBOUNCE_MS
            if (!leaveDebounceRef.current) {
                leaveDebounceRef.current = setTimeout(() => {
                    leaveDebounceRef.current = null;
                    const current = lastProximityPeersRef.current;
                    if (current.size === 0) {
                        const leaveFn = (window as any).__leaveDailyContext;
                        if (leaveFn) leaveFn();
                        useDailyStore.getState().setActiveContext('none', null);
                        useAvatarStore.getState().setMyProximityGroup(null);
                        console.log('[Proximity] Left proximity room (debounced)');
                    }
                }, LEAVE_DEBOUNCE_MS);
            }
        } else if (nearbyPeers.length === 0 && dailyStore.activeContext !== 'proximity') {
            // No peers nearby and not in proximity — cancel any pending join
            if (joinDebounceRef.current) {
                clearTimeout(joinDebounceRef.current);
                joinDebounceRef.current = null;
                pendingHostIdRef.current = null;
            }
        }
    }, [cancelDebounces]);

    // ─── Adaptive volume update ──────────────────────────────
    const updateAdaptiveVolume = useCallback((nearbyPeers: ProximityPeer[]) => {
        nearbyPeers.forEach(peer => {
            const volume = getAdaptiveVolume(peer.distance, PROXIMITY_RADIUS);

            // Only update if volume changed significantly (> 1%)
            const prevVol = lastVolumesRef.current.get(peer.id) ?? -1;
            if (Math.abs(volume - prevVol) < 0.01) return;
            lastVolumesRef.current.set(peer.id, volume);

            // Update HTML audio element volume
            const audioEl = document.getElementById(`daily-audio-${peer.id}`) as HTMLAudioElement;
            if (audioEl) {
                audioEl.volume = Math.max(0, Math.min(1, volume));
            }
        });
    }, []);

    // ─── Main check loop (every 500ms — Layer 4) ─────────────
    useEffect(() => {
        const interval = setInterval(() => {
            const avatarStore = useAvatarStore.getState();
            const dailyStore = useDailyStore.getState();
            const workspaceStore = useWorkspaceStore.getState();

            const myPos = avatarStore.myPosition;
            const rooms = workspaceStore.rooms;

            // Convert rooms to Rect format for wall detection
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
                    // Cancel proximity debounces when entering a room
                    cancelDebounces();

                    // Leave proximity if active
                    if (dailyStore.activeContext === 'proximity') {
                        const leaveFn = (window as any).__leaveDailyContext;
                        if (leaveFn) leaveFn();
                        lastProximityPeersRef.current.clear();
                    }

                    // Enter room
                    handleRoomEntry(currentRoomId, rooms);
                    lastRoomIdRef.current = currentRoomId;
                }
                // No proximity processing while in a room
                return;
            }

            // ─── 2. Open space — check if we just left a room ──
            if (lastRoomIdRef.current) {
                handleRoomExit();
                lastRoomIdRef.current = null;
            }

            // ─── 3. Check if currently knocking ─────────────
            if (avatarStore.knockingAtRoom) {
                // Don't process proximity while knocking
                return;
            }

            // ─── 4. Calculate nearby users (aura overlap) ───
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

                // Check if proximity connection is allowed
                if (!canFormProximityConnection(myState, peerState)) return;

                const dist = distance(myPos, peer.position);
                if (dist >= PROXIMITY_RADIUS) return;

                // Check wall blocking
                if (isBlockedByWall(myPos, peer.position, roomRects)) return;

                nearbyPeers.push({
                    id: peer.id,
                    position: peer.position,
                    distance: dist,
                });
            });

            // ─── 5. Update proximity group and volume ───────
            updateProximityGroup(nearbyPeers);
            updateAdaptiveVolume(nearbyPeers);

        }, CHECK_INTERVAL_MS);

        return () => {
            clearInterval(interval);
            // Clean up fade-out timers
            fadeOutTimersRef.current.forEach(timer => clearTimeout(timer));
            fadeOutTimersRef.current.clear();
            // Clean up debounce timers
            if (joinDebounceRef.current) clearTimeout(joinDebounceRef.current);
            if (leaveDebounceRef.current) clearTimeout(leaveDebounceRef.current);
        };
    }, [handleRoomEntry, handleRoomExit, updateProximityGroup, updateAdaptiveVolume, cancelDebounces]);

    return {
        proximityRadius: PROXIMITY_RADIUS,
    };
}
