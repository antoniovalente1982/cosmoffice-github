'use client';

import { useEffect, useRef, useCallback } from 'react';
import DailyIframe, {
    DailyCall,
    DailyEventObjectParticipant,
    DailyEventObjectParticipantLeft,
    DailyParticipant,
} from '@daily-co/daily-js';
import { useOfficeStore } from '../stores/useOfficeStore';

// ─── Configuration ───────────────────────────────────────────────
const DAILY_DOMAIN = process.env.NEXT_PUBLIC_DAILY_DOMAIN || '';
const PROXIMITY_RANGE = 300;
const ROOM_CHECK_INTERVAL = 500;

// ─── Types ───────────────────────────────────────────────────────
interface DailyPeerInfo {
    sessionId: string;
    participantId: string;
    audioTrack: MediaStreamTrack | null;
    videoTrack: MediaStreamTrack | null;
    audioEnabled: boolean;
    videoEnabled: boolean;
    userName: string;
}

/**
 * useDaily — Core Daily.co WebRTC hook
 *
 * Single source of truth for all media hardware (camera, mic).
 * Creates rooms via server-side API, joins them, and manages
 * local + remote media through Daily.co's call object.
 */
export function useDaily(spaceId: string | null) {
    const callRef = useRef<DailyCall | null>(null);
    const isJoinedRef = useRef(false);
    const isJoiningRef = useRef(false);
    const proximityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const peerTracksRef = useRef<Map<string, DailyPeerInfo>>(new Map());
    const currentRoomUrlRef = useRef<string | null>(null);

    const {
        myPosition,
        myRoomId,
        myProfile,
        isMicEnabled,
        isVideoEnabled,
        peers,
        setLocalStream,
        setSpeaking,
        updatePeer,
    } = useOfficeStore();

    // ─── Create room name from spaceId + optional roomId ─────
    const getRoomName = useCallback(
        (roomId?: string) => {
            if (!spaceId) return null;
            return roomId
                ? `cosmo-${spaceId}-room-${roomId}`
                : `cosmo-${spaceId}-lobby`;
        },
        [spaceId]
    );

    // ─── Create or get a Daily.co room via our API ───────────
    const ensureRoom = useCallback(async (roomName: string): Promise<string | null> => {
        try {
            const res = await fetch('/api/daily/room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.error('[Daily.co] Room creation failed:', err);
                return null;
            }

            const data = await res.json();
            console.log(`[Daily.co] Room ready: ${data.name} (${data.created ? 'created' : 'existing'})`);
            return data.url;
        } catch (err) {
            console.error('[Daily.co] Failed to ensure room:', err);
            return null;
        }
    }, []);

    // ─── Update local stream in store from Daily participant ──
    const updateLocalStream = useCallback(
        (participant: DailyParticipant) => {
            const tracks: MediaStreamTrack[] = [];

            const audioState = participant.tracks.audio;
            if (audioState?.persistentTrack && !audioState.off) {
                tracks.push(audioState.persistentTrack);
            }

            const videoState = participant.tracks.video;
            if (videoState?.persistentTrack && !videoState.off) {
                tracks.push(videoState.persistentTrack);
            }

            if (tracks.length > 0) {
                setLocalStream(new MediaStream(tracks));
            } else {
                setLocalStream(null);
            }
        },
        [setLocalStream]
    );

    // ─── Event Handlers ──────────────────────────────────────

    const handleParticipantJoined = useCallback(
        (event: DailyEventObjectParticipant | undefined) => {
            if (!event?.participant || event.participant.local) return;
            const p = event.participant;
            const peerId = p.user_id || p.session_id;

            peerTracksRef.current.set(peerId, {
                sessionId: p.session_id,
                participantId: peerId,
                audioTrack: null,
                videoTrack: null,
                audioEnabled: !p.tracks.audio?.off,
                videoEnabled: !p.tracks.video?.off,
                userName: p.user_name || 'Anonymous',
            });
            console.log('[Daily.co] Participant joined:', p.user_name);
        },
        []
    );

    const handleParticipantLeft = useCallback(
        (event: DailyEventObjectParticipantLeft | undefined) => {
            if (!event?.participant) return;
            const p = event.participant;
            const peerId = p.user_id || p.session_id;

            const audioEl = document.getElementById(`daily-audio-${peerId}`);
            if (audioEl) audioEl.remove();

            peerTracksRef.current.delete(peerId);
            console.log('[Daily.co] Participant left:', p.user_name);
        },
        []
    );

    const handleParticipantUpdated = useCallback(
        (event: DailyEventObjectParticipant | undefined) => {
            if (!event?.participant) return;
            const p = event.participant;

            if (p.local) {
                updateLocalStream(p);
                return;
            }

            const peerId = p.user_id || p.session_id;
            const existing = peerTracksRef.current.get(peerId);
            if (existing) {
                existing.audioEnabled = !p.tracks.audio?.off;
                existing.videoEnabled = !p.tracks.video?.off;
            }

            const peerState = useOfficeStore.getState().peers[peerId];
            if (peerState) {
                updatePeer(peerId, {
                    ...peerState,
                    audioEnabled: !p.tracks.audio?.off,
                    videoEnabled: !p.tracks.video?.off,
                });
            }
        },
        [updatePeer, updateLocalStream]
    );

    const handleTrackStarted = useCallback(
        (event: any) => {
            if (!event?.participant || event.participant.local) return;
            const p = event.participant;
            const peerId = p.user_id || p.session_id;
            const track = event.track as MediaStreamTrack;
            if (!track) return;

            const existing = peerTracksRef.current.get(peerId);
            if (!existing) return;

            if (track.kind === 'audio') {
                existing.audioTrack = track;
                let audioEl = document.getElementById(`daily-audio-${peerId}`) as HTMLAudioElement;
                if (!audioEl) {
                    audioEl = document.createElement('audio');
                    audioEl.id = `daily-audio-${peerId}`;
                    audioEl.autoplay = true;
                    audioEl.style.display = 'none';
                    document.body.appendChild(audioEl);
                }
                audioEl.srcObject = new MediaStream([track]);
            }

            if (track.kind === 'video') {
                existing.videoTrack = track;
                const peerState = useOfficeStore.getState().peers[peerId];
                if (peerState) {
                    updatePeer(peerId, {
                        ...peerState,
                        videoEnabled: true,
                        stream: new MediaStream([track]),
                    });
                }
            }
        },
        [updatePeer]
    );

    const handleTrackStopped = useCallback(
        (event: any) => {
            if (!event?.participant || event.participant.local) return;
            const p = event.participant;
            const peerId = p.user_id || p.session_id;
            const track = event.track as MediaStreamTrack;

            const existing = peerTracksRef.current.get(peerId);
            if (!existing) return;

            if (track?.kind === 'audio') {
                existing.audioTrack = null;
                const audioEl = document.getElementById(`daily-audio-${peerId}`);
                if (audioEl) (audioEl as HTMLAudioElement).srcObject = null;
            }

            if (track?.kind === 'video') {
                existing.videoTrack = null;
                const peerState = useOfficeStore.getState().peers[peerId];
                if (peerState) {
                    updatePeer(peerId, { ...peerState, videoEnabled: false, stream: null });
                }
            }
        },
        [updatePeer]
    );

    const handleError = useCallback((event: any) => {
        console.error('[Daily.co] Error:', event?.errorMsg || event);
    }, []);

    // ─── Join a Daily.co Room ────────────────────────────────
    const joinRoom = useCallback(
        async (url: string) => {
            const call = callRef.current;
            if (!call || isJoiningRef.current) return;
            if (currentRoomUrlRef.current === url && isJoinedRef.current) return; // Already in this room

            isJoiningRef.current = true;

            try {
                // Leave current room if in one
                if (isJoinedRef.current) {
                    await call.leave();
                    isJoinedRef.current = false;
                    currentRoomUrlRef.current = null;
                }

                const profile = useOfficeStore.getState().myProfile;
                await call.join({
                    url,
                    userName: profile?.display_name || profile?.full_name || 'Anonymous',
                    startVideoOff: true,
                    startAudioOff: true,
                });

                isJoinedRef.current = true;
                currentRoomUrlRef.current = url;

                // Sync current mic/video state to Daily
                const state = useOfficeStore.getState();
                if (state.isMicEnabled) call.setLocalAudio(true);
                if (state.isVideoEnabled) call.setLocalVideo(true);

                // Update local stream from Daily's participant
                const localParticipant = call.participants().local;
                updateLocalStream(localParticipant);

                console.log('[Daily.co] ✅ Joined room:', url);
            } catch (err) {
                console.error('[Daily.co] ❌ Failed to join room:', err);
                isJoinedRef.current = false;
                currentRoomUrlRef.current = null;
            } finally {
                isJoiningRef.current = false;
            }
        },
        [updateLocalStream]
    );

    // ─── Initialize Daily.co ─────────────────────────────────
    useEffect(() => {
        if (!spaceId || !DAILY_DOMAIN) {
            console.warn('[Daily.co] Missing spaceId or DAILY_DOMAIN, skipping init');
            return;
        }

        const initDaily = async () => {
            try {
                // Create call object (no media acquired yet)
                const callObject = DailyIframe.createCallObject();

                callObject.on('participant-joined', handleParticipantJoined);
                callObject.on('participant-left', handleParticipantLeft);
                callObject.on('participant-updated', handleParticipantUpdated);
                callObject.on('track-started', handleTrackStarted);
                callObject.on('track-stopped', handleTrackStopped);
                callObject.on('error', handleError);

                callRef.current = callObject;
                console.log('[Daily.co] Call object created');

                // Create and join the lobby room
                const roomName = getRoomName();
                if (roomName) {
                    const url = await ensureRoom(roomName);
                    if (url) {
                        await joinRoom(url);
                    } else {
                        console.error('[Daily.co] Could not create lobby room');
                    }
                }
            } catch (err) {
                console.error('[Daily.co] Failed to initialize:', err);
            }
        };

        initDaily();

        return () => {
            cleanup();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spaceId]);

    // ─── Sync mic/video state to Daily.co ────────────────────
    useEffect(() => {
        const call = callRef.current;
        if (!call || !isJoinedRef.current) return;
        call.setLocalAudio(isMicEnabled);
        console.log('[Daily.co] Audio:', isMicEnabled ? 'ON' : 'OFF');
    }, [isMicEnabled]);

    useEffect(() => {
        const call = callRef.current;
        if (!call || !isJoinedRef.current) return;
        call.setLocalVideo(isVideoEnabled);
        console.log('[Daily.co] Video:', isVideoEnabled ? 'ON' : 'OFF');
    }, [isVideoEnabled]);

    // ─── Room-based call switching ───────────────────────────
    useEffect(() => {
        if (!callRef.current || !DAILY_DOMAIN) return;

        const switchRoom = async () => {
            const roomName = getRoomName(myRoomId || undefined);
            if (!roomName) return;

            const url = await ensureRoom(roomName);
            if (url) {
                await joinRoom(url);
            }
        };

        switchRoom();
    }, [myRoomId, getRoomName, ensureRoom, joinRoom]);

    // ─── Proximity-Based Spatial Audio ───────────────────────
    useEffect(() => {
        if (proximityIntervalRef.current) {
            clearInterval(proximityIntervalRef.current);
        }

        proximityIntervalRef.current = setInterval(() => {
            const call = callRef.current;
            if (!call || !isJoinedRef.current) return;

            const state = useOfficeStore.getState();
            const myPos = state.myPosition;
            const isRemoteAudioEnabled = state.isRemoteAudioEnabled;

            peerTracksRef.current.forEach((peerInfo, peerId) => {
                const peer = state.peers[peerId];
                if (!peer) return;

                const dx = myPos.x - peer.position.x;
                const dy = myPos.y - peer.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                let volume = Math.max(0, 1 - distance / PROXIMITY_RANGE);
                if (state.myRoomId !== peer.roomId) volume *= 0.3;
                if (!isRemoteAudioEnabled) volume = 0;

                const audioEl = document.getElementById(`daily-audio-${peerId}`) as HTMLAudioElement;
                if (audioEl) audioEl.volume = Math.min(1, Math.max(0, volume));

                try {
                    if (distance > PROXIMITY_RANGE * 1.5) {
                        call.updateParticipant(peerInfo.sessionId, {
                            setSubscribedTracks: { audio: false, video: false },
                        });
                    } else {
                        call.updateParticipant(peerInfo.sessionId, {
                            setSubscribedTracks: { audio: true, video: distance < PROXIMITY_RANGE },
                        });
                    }
                } catch {
                    // Participant may have left
                }
            });
        }, ROOM_CHECK_INTERVAL);

        return () => {
            if (proximityIntervalRef.current) clearInterval(proximityIntervalRef.current);
        };
    }, [myPosition]);

    // ─── Screen Sharing ──────────────────────────────────────
    const startScreenShare = useCallback(async () => {
        const call = callRef.current;
        if (!call || !isJoinedRef.current) return;
        try {
            await call.startScreenShare();
        } catch (err) {
            console.error('[Daily.co] Screen share failed:', err);
        }
    }, []);

    const stopScreenShare = useCallback(async () => {
        const call = callRef.current;
        if (!call || !isJoinedRef.current) return;
        try {
            await call.stopScreenShare();
        } catch (err) {
            console.error('[Daily.co] Stop screen share failed:', err);
        }
    }, []);

    // ─── Device Management ───────────────────────────────────
    const setAudioDevice = useCallback(async (deviceId: string) => {
        const call = callRef.current;
        if (!call) return;
        await call.setInputDevicesAsync({ audioDeviceId: deviceId });
    }, []);

    const setVideoDevice = useCallback(async (deviceId: string) => {
        const call = callRef.current;
        if (!call) return;
        await call.setInputDevicesAsync({ videoDeviceId: deviceId });
    }, []);

    // ─── Cleanup ─────────────────────────────────────────────
    const cleanup = useCallback(() => {
        if (proximityIntervalRef.current) {
            clearInterval(proximityIntervalRef.current);
            proximityIntervalRef.current = null;
        }

        peerTracksRef.current.forEach((_, peerId) => {
            const audioEl = document.getElementById(`daily-audio-${peerId}`);
            if (audioEl) audioEl.remove();
        });
        peerTracksRef.current.clear();

        if (callRef.current) {
            callRef.current.leave().catch(console.error).finally(() => {
                if (callRef.current) {
                    try { callRef.current.destroy(); } catch (e) { /* ignore */ }
                    callRef.current = null;
                }
            });
        }

        isJoinedRef.current = false;
        isJoiningRef.current = false;
        currentRoomUrlRef.current = null;
    }, []);

    return {
        isConnected: isJoinedRef.current,
        startScreenShare,
        stopScreenShare,
        setAudioDevice,
        setVideoDevice,
        callObject: callRef.current,
    };
}
