'use client';

import { useEffect, useRef, useCallback } from 'react';
import DailyIframe, {
    DailyCall,
    DailyEventObjectParticipant,
    DailyEventObjectParticipantLeft,
    DailyParticipant,
    DailyTrackState,
} from '@daily-co/daily-js';
import { useOfficeStore } from '../stores/useOfficeStore';

// ─── Configuration ───────────────────────────────────────────────
const DAILY_DOMAIN = process.env.NEXT_PUBLIC_DAILY_DOMAIN || '';
const PROXIMITY_RANGE = 300; // px — range for auto-joining audio/video
const ROOM_CHECK_INTERVAL = 500; // ms — interval for proximity checks

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
 * Architecture:
 * - Creates a single Daily.co call object per session
 * - Uses the spaceId to create/join a Daily.co room
 * - Manages local mic/camera through Daily.co instead of raw getUserMedia
 * - Maps Daily.co remote participants to Zustand peer store
 * - Applies spatial audio (distance-based volume) to remote audio tracks
 * - When user enters a Cosmoffice room, joins the corresponding Daily room
 */
export function useDaily(spaceId: string | null) {
    const callRef = useRef<DailyCall | null>(null);
    const isJoinedRef = useRef(false);
    const proximityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const peerTracksRef = useRef<Map<string, DailyPeerInfo>>(new Map());

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

    // ─── Get or Create Daily.co Room URL ─────────────────────
    const getDailyRoomUrl = useCallback(
        (roomId?: string) => {
            if (!DAILY_DOMAIN) return null;
            // Use spaceId as the base room name, roomId as sub-room
            const roomName = roomId
                ? `cosmo-${spaceId}-room-${roomId}`
                : `cosmo-${spaceId}-lobby`;
            return `https://${DAILY_DOMAIN}/${roomName}`;
        },
        [spaceId]
    );

    // ─── Initialize Daily.co Call Object ─────────────────────
    useEffect(() => {
        if (!spaceId || !DAILY_DOMAIN) return;

        const initDaily = async () => {
            try {
                const callObject = DailyIframe.createCallObject({
                    audioSource: true,
                    videoSource: true,
                });

                // ─── Event Handlers ──────────────────────────
                callObject.on('participant-joined', handleParticipantJoined);
                callObject.on('participant-left', handleParticipantLeft);
                callObject.on('participant-updated', handleParticipantUpdated);
                callObject.on('track-started', handleTrackStarted);
                callObject.on('track-stopped', handleTrackStopped);
                callObject.on('error', handleError);

                callRef.current = callObject;

                // Auto-join the lobby room for this space
                const lobbyUrl = getDailyRoomUrl();
                if (lobbyUrl) {
                    await joinRoom(lobbyUrl);
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

    // ─── Join a Daily.co Room ────────────────────────────────
    const joinRoom = useCallback(
        async (url: string) => {
            const call = callRef.current;
            if (!call) return;

            try {
                // Leave current room if in one
                if (isJoinedRef.current) {
                    await call.leave();
                    isJoinedRef.current = false;
                }

                const profile = useOfficeStore.getState().myProfile;
                await call.join({
                    url,
                    userName: profile?.display_name || profile?.full_name || 'Anonymous',
                    startVideoOff: !useOfficeStore.getState().isVideoEnabled,
                    startAudioOff: !useOfficeStore.getState().isMicEnabled,
                });

                isJoinedRef.current = true;

                // Get local tracks and update store
                const localParticipant = call.participants().local;
                updateLocalStream(localParticipant);

                console.log('[Daily.co] Joined room:', url);
            } catch (err) {
                console.error('[Daily.co] Failed to join room:', err);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    // ─── Sync local mic/video state to Daily.co ──────────────
    useEffect(() => {
        const call = callRef.current;
        if (!call || !isJoinedRef.current) return;

        call.setLocalAudio(isMicEnabled);
    }, [isMicEnabled]);

    useEffect(() => {
        const call = callRef.current;
        if (!call || !isJoinedRef.current) return;

        call.setLocalVideo(isVideoEnabled);
    }, [isVideoEnabled]);

    // ─── Room-based call switching ───────────────────────────
    // When user enters/exits a Cosmoffice room, switch Daily.co room
    useEffect(() => {
        if (!callRef.current || !DAILY_DOMAIN) return;

        const url = getDailyRoomUrl(myRoomId || undefined);
        if (url && isJoinedRef.current) {
            joinRoom(url);
        }
    }, [myRoomId, getDailyRoomUrl, joinRoom]);

    // ─── Proximity-Based Audio/Video ─────────────────────────
    // Adjust remote audio volume based on distance (spatial audio)
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

                // Calculate distance
                const dx = myPos.x - peer.position.x;
                const dy = myPos.y - peer.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Base volume from distance
                let volume = Math.max(0, 1 - distance / PROXIMITY_RANGE);

                // Room dampening: different rooms = 70% reduction
                if (state.myRoomId !== peer.roomId) {
                    volume *= 0.3;
                }

                // Focus mode: mute all
                if (!isRemoteAudioEnabled) {
                    volume = 0;
                }

                // Apply volume to the audio element
                const audioEl = document.getElementById(
                    `daily-audio-${peerId}`
                ) as HTMLAudioElement;
                if (audioEl) {
                    audioEl.volume = Math.min(1, Math.max(0, volume));
                }

                // Bandwidth optimization: unsubscribe from far-away peers
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
            if (proximityIntervalRef.current) {
                clearInterval(proximityIntervalRef.current);
            }
        };
    }, [myPosition]);

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

            // Clean up audio element
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
                // Update local state
                updateLocalStream(p);
                return;
            }

            const peerId = p.user_id || p.session_id;
            const existing = peerTracksRef.current.get(peerId);
            if (existing) {
                existing.audioEnabled = !p.tracks.audio?.off;
                existing.videoEnabled = !p.tracks.video?.off;
            }

            // Update peer in Zustand store
            const peerState = useOfficeStore.getState().peers[peerId];
            if (peerState) {
                updatePeer(peerId, {
                    ...peerState,
                    audioEnabled: !p.tracks.audio?.off,
                    videoEnabled: !p.tracks.video?.off,
                });
            }
        },
        [updatePeer]
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

                // Create/update hidden audio element for spatial audio
                let audioEl = document.getElementById(
                    `daily-audio-${peerId}`
                ) as HTMLAudioElement;
                if (!audioEl) {
                    audioEl = document.createElement('audio');
                    audioEl.id = `daily-audio-${peerId}`;
                    audioEl.autoplay = true;
                    audioEl.style.display = 'none';
                    document.body.appendChild(audioEl);
                }
                const stream = new MediaStream([track]);
                audioEl.srcObject = stream;
            }

            if (track.kind === 'video') {
                existing.videoTrack = track;

                // Create a MediaStream from the video track and update peer
                const peerState = useOfficeStore.getState().peers[peerId];
                if (peerState) {
                    const videoStream = new MediaStream([track]);
                    updatePeer(peerId, {
                        ...peerState,
                        videoEnabled: true,
                        stream: videoStream,
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
                if (audioEl) {
                    (audioEl as HTMLAudioElement).srcObject = null;
                }
            }

            if (track?.kind === 'video') {
                existing.videoTrack = null;
                const peerState = useOfficeStore.getState().peers[peerId];
                if (peerState) {
                    updatePeer(peerId, {
                        ...peerState,
                        videoEnabled: false,
                        stream: null,
                    });
                }
            }
        },
        [updatePeer]
    );

    const handleError = useCallback((event: any) => {
        console.error('[Daily.co] Error:', event?.errorMsg || event);
    }, []);

    // ─── Local Stream Management ─────────────────────────────
    const updateLocalStream = useCallback(
        (participant: DailyParticipant) => {
            const tracks: MediaStreamTrack[] = [];

            const audioTrackState = participant.tracks.audio;
            if (audioTrackState?.persistentTrack) {
                tracks.push(audioTrackState.persistentTrack);
            }

            const videoTrackState = participant.tracks.video;
            if (videoTrackState?.persistentTrack) {
                tracks.push(videoTrackState.persistentTrack);
            }

            if (tracks.length > 0) {
                const stream = new MediaStream(tracks);
                setLocalStream(stream);
            }
        },
        [setLocalStream]
    );

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

        await call.setInputDevicesAsync({
            audioDeviceId: deviceId,
        });
    }, []);

    const setVideoDevice = useCallback(async (deviceId: string) => {
        const call = callRef.current;
        if (!call) return;

        await call.setInputDevicesAsync({
            videoDeviceId: deviceId,
        });
    }, []);

    // ─── Cleanup ─────────────────────────────────────────────
    const cleanup = useCallback(() => {
        if (proximityIntervalRef.current) {
            clearInterval(proximityIntervalRef.current);
            proximityIntervalRef.current = null;
        }

        // Clean up all audio elements
        peerTracksRef.current.forEach((_, peerId) => {
            const audioEl = document.getElementById(`daily-audio-${peerId}`);
            if (audioEl) audioEl.remove();
        });
        peerTracksRef.current.clear();

        if (callRef.current) {
            // Force leave and destroy async but without waiting to not block unmount UI
            callRef.current.leave().catch(console.error).finally(() => {
                if (callRef.current) {
                    try {
                        callRef.current.destroy();
                    } catch (e) {
                        console.error('Error destroying daily call object:', e);
                    }
                    callRef.current = null;
                }
            });
        }

        isJoinedRef.current = false;
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
