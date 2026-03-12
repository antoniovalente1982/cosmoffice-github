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

const PROXIMITY_RADIUS = 500;
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
    
    // Hysteresis buffer for room entry/exit to prevent flapping
    const pendingRoomIdRef = useRef<string | null>(null);
    const pendingRoomTicksRef = useRef<number>(0);

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
            const pos = avatarStore.myPosition;
            const sendFn = (window as any).__sendAvatarPosition;
            if (sendFn) sendFn(pos.x, pos.y, roomId);
            console.log('[Proximity] Entered room:', room.name, '(state only — Daily on mic/cam)');
            return;
        }

        const peersInRoom = Object.values(avatarStore.peers).filter((p: any) => p.roomId === roomId);
        if (peersInRoom.length === 0) {
            avatarStore.setMyRoom(roomId);
            const pos = avatarStore.myPosition;
            const sendFn = (window as any).__sendAvatarPosition;
            if (sendFn) sendFn(pos.x, pos.y, roomId);
            console.log('[Proximity] First in knock room:', room.name, '(state only)');
            return;
        }

        avatarStore.setKnockingAtRoom(roomId);
        const sendKnockFn = (window as any).__sendKnock;
        if (sendKnockFn) sendKnockFn(roomId);
        console.log('[Proximity] Knocking at room:', room.name);
    }, []);

    const handleRoomExit = useCallback(() => {
        const avatarStore = useAvatarStore.getState();
        avatarStore.setMyRoom(undefined);
        avatarStore.setKnockingAtRoom(null);
        
        const pos = avatarStore.myPosition;
        const sendFn = (window as any).__sendAvatarPosition;
        if (sendFn) sendFn(pos.x, pos.y, null);
        
        console.log('[Proximity] Left room (state only — DailyManager handles disconnect)');
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
        const avatarPeers = useAvatarStore.getState().peers;
        nearbyPeers.forEach(peer => {
            // Only set volume for peers that actually exist in the avatar store
            if (!avatarPeers[peer.id]) return;
            
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

            // ─── Freeze room state in builder mode ───────────
            // When the user is editing/dragging rooms, skip room boundary
            // detection entirely so that moving a room doesn't eject the
            // avatar from its current room assignment.
            if (workspaceStore.isBuilderMode) return;

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
            
            // ─── Hysteresis Buffer to Prevent Flapping ──────
            // Only commit a room change if we've seen the identical target state for 2 consecutive ticks (~1 second)
            if (currentRoomId !== pendingRoomIdRef.current) {
                pendingRoomIdRef.current = currentRoomId;
                pendingRoomTicksRef.current = 1;
            } else {
                pendingRoomTicksRef.current++;
            }

            // Require 2 ticks (1 second) of stability before resolving the geographic transition
            if (pendingRoomTicksRef.current >= 2) {
                // If the room changed and is stable, trigger entry events (clear old aura first)
                if (currentRoomId && currentRoomId !== lastRoomIdRef.current) {
                    if (avatarStore.myProximityGroupId) {
                        avatarStore.setMyProximityGroup(null);
                    }
                    lastProximityPeersRef.current.clear();

                    handleRoomEntry(currentRoomId, rooms);
                    lastRoomIdRef.current = currentRoomId;
                }

                // Open space — check if we just left a room stably
                if (!currentRoomId && lastRoomIdRef.current) {
                    handleRoomExit();
                    lastRoomIdRef.current = null;
                }
            }

            // ─── 3. Check if currently knocking ─────────────
            if (avatarStore.knockingAtRoom) return;

            // ─── 4. Calculate nearby users ───────────────────
            const myState = {
                isDnd: avatarStore.myDnd,
                isAway: avatarStore.myAway,
                inRoom: !!currentRoomId,
                roomId: currentRoomId,
            };

            const nearbyPeers: ProximityPeer[] = [];

            Object.values(avatarStore.peers).forEach((peer: any) => {
                if (!peer.position) return;

                // For users explicitly inside rooms, rely on exact roomId matching
                // Proximity only applies in open space, unless both users are in the SAME room
                const peerInRoom = !!peer.roomId;
                if (currentRoomId && peer.roomId !== currentRoomId) return; // Ignore if I'm in a room, and they are outside/in another room
                if (!currentRoomId && peerInRoom) return; // Ignore if I'm outside, and they're in a room

                const peerState = {
                    isDnd: peer.isDnd || false,
                    isAway: peer.isAway || peer.status === 'away',
                    inRoom: peerInRoom,
                    roomId: peer.roomId,
                };

                // Apply do-not-disturb / away gating
                if (!canFormProximityConnection(myState, peerState)) return;

                // If both are in the SAME room, consider them "infinitely close" so they always link up without geometry bugs
                let dist = distance(myPos, peer.position);
                
                if (currentRoomId && peer.roomId === currentRoomId) {
                    dist = 0; // Inside a room = automatic proximity
                } else {
                    // Open space logic
                    if (dist >= PROXIMITY_RADIUS) return;
                    if (isBlockedByWall(myPos, peer.position, roomRects)) return;
                }

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
