'use client';

// ============================================
// useProximityAndRooms — Core engine for room isolation + proximity audio/video
// Runs every 100ms, replaces useSpatialAudio
// Handles: room boundary detection, proximity grouping, wall detection, adaptive volume
// ============================================

import { useEffect, useRef, useCallback } from 'react';
import { useAvatarStore } from '../stores/avatarStore';
import { useDailyStore } from '../stores/dailyStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { isPointInRect, isBlockedByWall, distance, type Rect, type Point } from '../utils/wallDetection';
import { getAdaptiveVolume, canFormProximityConnection } from '../utils/avatarStateMachine';

const PROXIMITY_RADIUS = 250;
const CHECK_INTERVAL_MS = 100;
const FADE_OUT_MS = 1500;

interface ProximityPeer {
    id: string;
    position: Point;
    distance: number;
    dailySessionId?: string;
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

    // ─── Proximity group management ──────────────────────────
    const updateProximityGroup = useCallback((nearbyPeers: ProximityPeer[]) => {
        const avatarStore = useAvatarStore.getState();
        const dailyStore = useDailyStore.getState();

        // Skip if DND or admin blocked proximity
        if (avatarStore.myDnd || dailyStore.proximityBlockedGlobal) {
            if (dailyStore.activeContext === 'proximity') {
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

        // Join or leave proximity call
        if (nearbyPeers.length > 0 && dailyStore.activeContext !== 'proximity') {
            // Generate a proximity group ID based on sorted user IDs
            const myId = avatarStore.myProfile?.id;
            if (myId) {
                const groupMembers = [myId, ...nearbyPeers.map(p => p.id)].sort();
                const groupId = groupMembers.join('-').slice(0, 32);
                dailyStore.setActiveContext('proximity', groupId);
                avatarStore.setMyProximityGroup(groupId);

                const joinFn = (window as any).__joinDailyContext;
                if (joinFn) joinFn('proximity', groupId);
            }
        } else if (nearbyPeers.length === 0 && dailyStore.activeContext === 'proximity') {
            // All peers left — leave proximity call after fade-out
            setTimeout(() => {
                const current = lastProximityPeersRef.current;
                if (current.size === 0) {
                    const leaveFn = (window as any).__leaveDailyContext;
                    if (leaveFn) leaveFn();
                    useDailyStore.getState().setActiveContext('none', null);
                    useAvatarStore.getState().setMyProximityGroup(null);
                }
            }, FADE_OUT_MS);
        }
    }, []);

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

    // ─── Main check loop (every 100ms) ───────────────────────
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
        };
    }, [handleRoomEntry, handleRoomExit, updateProximityGroup, updateAdaptiveVolume]);

    return {
        proximityRadius: PROXIMITY_RADIUS,
    };
}
