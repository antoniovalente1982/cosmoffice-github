'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
    Room,
    RoomEvent,
    Track,
    RemoteTrack,
    RemoteTrackPublication,
    RemoteParticipant,
    LocalParticipant,
    LocalTrackPublication,
    ConnectionState,
    DisconnectReason,
    Participant,
    TrackPublication,
} from 'livekit-client';
import { useDailyStore } from '../../stores/dailyStore';
import { useAvatarStore } from '../../stores/avatarStore';

// ─── Configuration ──────────────────────────────────────────
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || '';
const PROXIMITY_RANGE = 2000;
const ROOM_CHECK_INTERVAL = 1500;

// ─── Token cache ────────────────────────────────────────────
const gTokenCache = new Map<string, { token: string; ts: number }>();
const TOKEN_CACHE_TTL_MS = 20 * 60 * 1000; // 20 min (tokens last 24h)
const gPendingTokenRequests = new Map<string, Promise<string | null>>();

// ─── LiveKit participant ID → Supabase user_id mapping ──────
const gLivekitToSupabase = new Map<string, string>();

/**
 * LiveKitManager — Singleton component mounted ONCE in the office layout.
 * Creates and manages the LiveKit room lifecycle.
 * Drop-in replacement for DailyManager — same store interface.
 * Returns null (no JSX, pure logic).
 */
export function LiveKitManager({ spaceId }: { spaceId: string | null }) {
    const roomRef = useRef<Room | null>(null);
    const joinedRef = useRef(false);
    const joiningRef = useRef(false);
    const currentRoomNameRef = useRef<string | null>(null);

    // Track what media the user WANTS, separate from what LiveKit knows
    // This survives room switches so we can re-enable after reconnecting
    const wantedMediaRef = useRef({ audio: false, video: false });

    // Atomic lock for join/leave to prevent race conditions
    const operationLockRef = useRef<Promise<void>>(Promise.resolve());
    const lockOperation = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
        const prev = operationLockRef.current;
        const next = prev.then(fn, fn);
        operationLockRef.current = next.then(() => { }, () => { });
        return next;
    }, []);

    // Read media toggles from daily store
    const isAudioOn = useDailyStore(s => s.isAudioOn);
    const isVideoOn = useDailyStore(s => s.isVideoOn);
    const isRemoteAudioEnabled = useDailyStore(s => s.isRemoteAudioEnabled);

    // Always track what user wants
    useEffect(() => {
        wantedMediaRef.current = { audio: isAudioOn, video: isVideoOn };
    }, [isAudioOn, isVideoOn]);

    // ─── Room name — generates LiveKit room name for a given context ─
    const getContextRoomName = useCallback((contextType: 'room' | 'proximity', contextId: string) => {
        if (!spaceId) return null;
        const prefix = spaceId.slice(0, 8);
        return contextType === 'room'
            ? `co-${prefix}-room-${contextId.slice(0, 8)}`
            : `co-${prefix}-prox-${contextId.slice(0, 8)}`;
    }, [spaceId]);

    // ─── Get token for a room (with cache + dedup) ─────────────
    const getToken = useCallback(async (roomName: string): Promise<string | null> => {
        const cached = gTokenCache.get(roomName);
        if (cached && (Date.now() - cached.ts) < TOKEN_CACHE_TTL_MS) return cached.token;

        const pending = gPendingTokenRequests.get(roomName);
        if (pending) return pending;

        const request = (async (): Promise<string | null> => {
            try {
                const profile = useAvatarStore.getState().myProfile;
                const displayName = profile?.display_name
                    || profile?.full_name
                    || profile?.email?.split('@')[0]
                    || 'User';
                const supabaseUserId = profile?.id || 'unknown';

                const res = await fetch('/api/livekit/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        roomName,
                        participantName: displayName,
                        participantId: supabaseUserId,
                        spaceId,
                    }),
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    useDailyStore.getState().setDailyError(`Errore token LiveKit: ${errData?.error || `HTTP ${res.status}`}`);
                    return null;
                }

                const data = await res.json();
                gTokenCache.set(roomName, { token: data.token, ts: Date.now() });
                return data.token;
            } catch (err: any) {
                const msg = err?.message?.includes('fetch')
                    ? 'Connessione internet assente o instabile'
                    : err?.message || 'Errore sconosciuto';
                useDailyStore.getState().setDailyError(`Impossibile ottenere token LiveKit: ${msg}`);
                return null;
            } finally {
                gPendingTokenRequests.delete(roomName);
            }
        })();

        gPendingTokenRequests.set(roomName, request);
        return request;
    }, []);

    // ─── Setup Room event handlers ──────────────────────────────
    const setupRoomEvents = useCallback((room: Room) => {
        // ─── Remote participant connected ─────────────
        room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
            const id = participant.identity;
            gLivekitToSupabase.set(id, id);

            useDailyStore.getState().setParticipant(id, {
                sessionId: participant.sid,
                odell: id,
                userName: participant.name || 'Anonymous',
                audioEnabled: false,
                videoEnabled: false,
                audioTrack: null,
                videoTrack: null,
                supabaseId: id,
            });
            console.log('[LiveKit] Peer joined:', participant.name || id);
        });

        // ─── Remote participant disconnected ──────────
        room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
            const id = participant.identity;
            const supabaseId = gLivekitToSupabase.get(id) || id;

            document.getElementById(`daily-audio-${supabaseId}`)?.remove();
            useDailyStore.getState().removeParticipant(id);

            if (useAvatarStore.getState().peers[supabaseId]) {
                useAvatarStore.getState().updatePeer(supabaseId, {
                    id: supabaseId,
                    videoEnabled: false,
                    stream: null,
                    isSpeaking: false,
                });
            }

            gLivekitToSupabase.delete(id);
            console.log('[LiveKit] Peer left:', participant.name || id);
        });

        // ─── Track subscribed (remote audio/video) ────
        room.on(RoomEvent.TrackSubscribed, (
            track: RemoteTrack,
            publication: RemoteTrackPublication,
            participant: RemoteParticipant
        ) => {
            const id = participant.identity;
            const supabaseId = gLivekitToSupabase.get(id) || id;

            if (track.source === Track.Source.ScreenShare) {
                const screenStream = new MediaStream([track.mediaStreamTrack]);
                useDailyStore.getState().addScreenStream(screenStream);
                track.mediaStreamTrack.addEventListener('ended', () =>
                    useDailyStore.getState().removeScreenStream(screenStream.id)
                );
                return;
            }

            if (track.kind === Track.Kind.Audio) {
                const audioElId = `daily-audio-${supabaseId}`;
                let el = document.getElementById(audioElId) as HTMLAudioElement;
                if (!el) {
                    el = document.createElement('audio');
                    el.id = audioElId;
                    el.autoplay = true;
                    el.style.display = 'none';
                    document.body.appendChild(el);
                }
                el.muted = !useDailyStore.getState().isRemoteAudioEnabled;
                el.srcObject = new MediaStream([track.mediaStreamTrack]);
                useDailyStore.getState().setParticipant(id, {
                    audioTrack: track.mediaStreamTrack,
                    audioEnabled: true,
                });
            }

            if (track.kind === Track.Kind.Video) {
                const videoStream = new MediaStream([track.mediaStreamTrack]);
                useDailyStore.getState().setParticipant(id, {
                    videoTrack: track.mediaStreamTrack,
                    videoEnabled: true,
                    videoStream,
                });

                if (useAvatarStore.getState().peers[supabaseId]) {
                    useAvatarStore.getState().updatePeer(supabaseId, {
                        id: supabaseId,
                        videoEnabled: true,
                        stream: videoStream,
                    });
                }
                console.log('[LiveKit] Video track subscribed for:', supabaseId.slice(0, 8));
            }
        });

        // ─── Track unsubscribed ───────────────────────
        room.on(RoomEvent.TrackUnsubscribed, (
            track: RemoteTrack,
            _publication: RemoteTrackPublication,
            participant: RemoteParticipant
        ) => {
            const id = participant.identity;
            const supabaseId = gLivekitToSupabase.get(id) || id;

            if (track.source === Track.Source.ScreenShare) return;

            if (track.kind === Track.Kind.Audio) {
                const el = document.getElementById(`daily-audio-${supabaseId}`);
                if (el) (el as HTMLAudioElement).srcObject = null;
                useDailyStore.getState().setParticipant(id, { audioTrack: null, audioEnabled: false });
            }

            if (track.kind === Track.Kind.Video) {
                useDailyStore.getState().setParticipant(id, { videoTrack: null, videoEnabled: false, videoStream: null });
                if (useAvatarStore.getState().peers[supabaseId]) {
                    useAvatarStore.getState().updatePeer(supabaseId, {
                        id: supabaseId,
                        videoEnabled: false,
                        stream: null,
                    });
                }
            }
        });

        // ─── Local track published (our mic/cam) ──────
        room.on(RoomEvent.LocalTrackPublished, (
            publication: LocalTrackPublication,
            _participant: LocalParticipant
        ) => {
            const track = publication.track;
            if (!track) return;

            if (track.source === Track.Source.ScreenShare) {
                const screenStream = new MediaStream([track.mediaStreamTrack]);
                useDailyStore.getState().addScreenStream(screenStream);
                track.mediaStreamTrack.addEventListener('ended', () => {
                    useDailyStore.getState().removeScreenStream(screenStream.id);
                });
                return;
            }

            // Update local stream
            const localTracks: MediaStreamTrack[] = [];
            room.localParticipant.trackPublications.forEach(pub => {
                if (pub.track && pub.track.source !== Track.Source.ScreenShare &&
                    pub.track.mediaStreamTrack.readyState === 'live') {
                    localTracks.push(pub.track.mediaStreamTrack);
                }
            });
            useDailyStore.getState().setLocalStream(
                localTracks.length > 0 ? new MediaStream(localTracks) : null
            );
        });

        // ─── Track muted (remote or local user turned off camera/mic) ──────
        room.on(RoomEvent.TrackMuted, (
            publication: TrackPublication,
            participant: Participant
        ) => {
            const id = participant.identity;
            const isLocal = id === room.localParticipant.identity;
            const supabaseId = gLivekitToSupabase.get(id) || id;

            if (isLocal) {
                // Rebuild local stream when our own tracks change
                const localTracks: MediaStreamTrack[] = [];
                room.localParticipant.trackPublications.forEach(pub => {
                    if (pub.track && pub.track.source !== Track.Source.ScreenShare &&
                        pub.track.mediaStreamTrack.readyState === 'live' && pub.track.mediaStreamTrack.enabled) {
                        localTracks.push(pub.track.mediaStreamTrack);
                    }
                });
                useDailyStore.getState().setLocalStream(
                    localTracks.length > 0 ? new MediaStream(localTracks) : null
                );
                return;
            }

            if (publication.source === Track.Source.Camera) {
                useDailyStore.getState().setParticipant(id, { videoEnabled: false });
                if (useAvatarStore.getState().peers[supabaseId]) {
                    useAvatarStore.getState().updatePeer(supabaseId, {
                        id: supabaseId,
                        videoEnabled: false,
                    });
                }
                console.log('[LiveKit] Remote camera muted:', supabaseId.slice(0, 8));
            }
            if (publication.source === Track.Source.Microphone) {
                useDailyStore.getState().setParticipant(id, { audioEnabled: false });
            }
        });

        // ─── Track unmuted (remote or local user re-enabled camera/mic) ────
        room.on(RoomEvent.TrackUnmuted, (
            publication: TrackPublication,
            participant: Participant
        ) => {
            const id = participant.identity;
            const isLocal = id === room.localParticipant.identity;
            const supabaseId = gLivekitToSupabase.get(id) || id;

            if (isLocal) {
                // Rebuild local stream with the now-live tracks
                const localTracks: MediaStreamTrack[] = [];
                room.localParticipant.trackPublications.forEach(pub => {
                    if (pub.track && pub.track.source !== Track.Source.ScreenShare &&
                        pub.track.mediaStreamTrack.readyState === 'live') {
                        localTracks.push(pub.track.mediaStreamTrack);
                    }
                });
                useDailyStore.getState().setLocalStream(
                    localTracks.length > 0 ? new MediaStream(localTracks) : null
                );
                return;
            }

            if (publication.source === Track.Source.Camera && publication.track) {
                // Rebuild video stream from the now-live track
                const videoStream = new MediaStream([publication.track.mediaStreamTrack]);
                useDailyStore.getState().setParticipant(id, {
                    videoTrack: publication.track.mediaStreamTrack,
                    videoEnabled: true,
                    videoStream,
                });
                if (useAvatarStore.getState().peers[supabaseId]) {
                    useAvatarStore.getState().updatePeer(supabaseId, {
                        id: supabaseId,
                        videoEnabled: true,
                        stream: videoStream,
                    });
                }
                console.log('[LiveKit] Remote camera unmuted:', supabaseId.slice(0, 8));
            }
            if (publication.source === Track.Source.Microphone && publication.track) {
                useDailyStore.getState().setParticipant(id, {
                    audioTrack: publication.track.mediaStreamTrack,
                    audioEnabled: true,
                });
            }
        });

        // ─── Local track unpublished ──────────────────
        room.on(RoomEvent.LocalTrackUnpublished, (
            publication: LocalTrackPublication,
            _participant: LocalParticipant
        ) => {
            // Handle screen share track being unpublished
            if (publication.source === Track.Source.ScreenShare) {
                // Clear all screen streams and reset sharing state
                useDailyStore.getState().clearAllScreenStreams();
                console.log('[LiveKit] Screen share track unpublished — state cleared');
                return;
            }

            // For non-screen-share tracks, rebuild local stream
            const localTracks: MediaStreamTrack[] = [];
            room.localParticipant.trackPublications.forEach(pub => {
                if (pub.track && pub.track.source !== Track.Source.ScreenShare &&
                    pub.track.mediaStreamTrack.readyState === 'live') {
                    localTracks.push(pub.track.mediaStreamTrack);
                }
            });
            useDailyStore.getState().setLocalStream(
                localTracks.length > 0 ? new MediaStream(localTracks) : null
            );
        });

        // ─── Active speaker change ────────────────────
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
            const localIdentity = room.localParticipant?.identity;
            const isLocalSpeaking = speakers.some(s => s.identity === localIdentity);

            useDailyStore.getState().setSpeaking(isLocalSpeaking);

            // Broadcast via PartyKit
            const socket = (window as any).__partykitSocket;
            if (socket?.readyState === WebSocket.OPEN) {
                const profile = useAvatarStore.getState().myProfile;
                socket.send(JSON.stringify({
                    type: 'speaking',
                    userId: profile?.id,
                    isSpeaking: isLocalSpeaking,
                }));
            }
        });

        // ─── Disconnected ─────────────────────────────
        room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
            console.log('[LiveKit] Disconnected, reason:', reason);
            joinedRef.current = false;
            currentRoomNameRef.current = null;
            useDailyStore.getState().clearParticipants();
            useDailyStore.getState().setLocalStream(null);
            useDailyStore.getState().setConnected(false);
            useDailyStore.getState().setActiveContext('none', null);

            // If we were force-disconnected (signal-lost, server restart, etc.)
            // and user still wants media, attempt auto-reconnect
            if (reason !== DisconnectReason.CLIENT_INITIATED) {
                console.warn('[LiveKit] Non-client disconnect — will attempt reconnect');
                const { myRoomId, myProximityGroupId } = useAvatarStore.getState();
                const wanted = wantedMediaRef.current;
                if (wanted.audio || wanted.video) {
                    setTimeout(() => {
                        const currentRoom = useAvatarStore.getState().myRoomId;
                        const currentProx = useAvatarStore.getState().myProximityGroupId;
                        const stillWants = useDailyStore.getState().isAudioOn || useDailyStore.getState().isVideoOn;
                        if (stillWants) {
                            if (currentRoom) {
                                lockOperation(() => joinContextInner('room', currentRoom));
                            } else if (currentProx) {
                                lockOperation(() => joinContextInner('proximity', currentProx));
                            }
                        }
                    }, 2000);
                }
            }
        });

        // ─── Connection quality ───────────────────────
        room.on(RoomEvent.ConnectionQualityChanged, (_quality, participant) => {
            // Could show quality indicator in the future
        });

    }, []);

    // ─── Create a fresh Room object with optimized settings ────
    const createRoom = useCallback(() => {
        const room = new Room({
            adaptiveStream: true,
            dynacast: true,
            videoCaptureDefaults: {
                resolution: { width: 640, height: 480 },
                facingMode: 'user',
            },
            publishDefaults: {
                videoCodec: 'vp8',
                dtx: true,
                red: true,
            },
        });
        setupRoomEvents(room);
        return room;
    }, [setupRoomEvents]);

    // Expose room ref for screen sharing
    useEffect(() => {
        return () => { (window as any).__livekitRoom = null; };
    }, []);

    // ─── Inner join (called inside the lock) ─────────────────────
    const joinContextInner = useCallback(async (contextType: 'room' | 'proximity', contextId: string) => {
        if (!spaceId) return;

        const roomName = getContextRoomName(contextType, contextId);
        if (!roomName) return;

        // Same-room guard
        if (joinedRef.current && currentRoomNameRef.current === roomName) {
            console.log('[LiveKit] Already in room', roomName, '— syncing media');
            // Even if already joined, sync media state (the user likely toggled something)
            if (roomRef.current) {
                const wanted = wantedMediaRef.current;
                try {
                    await roomRef.current.localParticipant.setMicrophoneEnabled(wanted.audio);
                    await roomRef.current.localParticipant.setCameraEnabled(wanted.video);
                } catch (e) {
                    console.warn('[LiveKit] Media sync error:', e);
                }
            }
            return;
        }

        // ─── Destroy old Room before creating new one ─────
        if (roomRef.current) {
            console.log('[LiveKit] Destroying old room before new join');
            try {
                // Stop all local tracks first to release hardware
                roomRef.current.localParticipant.trackPublications.forEach(pub => {
                    if (pub.track) {
                        try { pub.track.stop(); } catch { }
                    }
                });
                await roomRef.current.disconnect(true);
            } catch { }
            roomRef.current = null;
            (window as any).__livekitRoom = null;
            joinedRef.current = false;
            currentRoomNameRef.current = null;
            useDailyStore.getState().clearParticipants();
            useDailyStore.getState().setLocalStream(null);
            // Brief pause for server-side session cleanup
            await new Promise(r => setTimeout(r, 300));
        }

        try {
            // Invalidate token cache for this room to get a fresh token
            // This prevents stale sessions after quick room switches
            gTokenCache.delete(roomName);

            const token = await getToken(roomName);
            if (!token) return;

            // Re-check: has the user navigated away during token fetch?
            const currentAvatarRoom = useAvatarStore.getState().myRoomId;
            if (contextType === 'room' && currentAvatarRoom !== contextId) {
                console.log('[LiveKit] Room changed during token fetch — aborting join');
                return;
            }

            // Create a FRESH Room object — no stale state from previous connection
            const room = createRoom();
            roomRef.current = room;
            (window as any).__livekitRoom = room;

            useDailyStore.getState().clearDailyError();

            await room.connect(LIVEKIT_URL, token);

            joinedRef.current = true;
            currentRoomNameRef.current = roomName;
            useDailyStore.getState().setConnected(true);
            useDailyStore.getState().setActiveContext(contextType, contextId);
            console.log(`[LiveKit] ✅ Joined ${contextType}:`, roomName);

            // Re-enable media that the user wanted
            const wanted = wantedMediaRef.current;
            try {
                if (wanted.audio) {
                    await room.localParticipant.setMicrophoneEnabled(true);
                }
                if (wanted.video) {
                    await room.localParticipant.setCameraEnabled(true);
                }
            } catch (mediaErr) {
                console.warn('[LiveKit] Media enable after join failed:', mediaErr);
                // Don't throw — connection is fine, just media failed
                // User can retry with button
            }

        } catch (err: any) {
            const msg = err?.message || 'Errore sconosciuto';
            useDailyStore.getState().setDailyError(`Connessione LiveKit fallita: ${msg}`);
            console.error('[LiveKit] Join failed:', msg);
            // Clean up on failure
            if (roomRef.current) {
                try { await roomRef.current.disconnect(true); } catch { }
                roomRef.current = null;
                (window as any).__livekitRoom = null;
            }
            joinedRef.current = false;
            currentRoomNameRef.current = null;
        }
    }, [spaceId, getContextRoomName, getToken, createRoom]);

    // ─── Inner leave (called inside the lock) ──────────────────
    const leaveContextInner = useCallback(async () => {
        if (roomRef.current) {
            console.log('[LiveKit] 🔌 Disconnecting + destroying room (billing stopped)');
            try {
                // Stop all local tracks to release hardware
                roomRef.current.localParticipant.trackPublications.forEach(pub => {
                    if (pub.track) {
                        try { pub.track.stop(); } catch { }
                    }
                });
                await roomRef.current.disconnect(true);
            } catch { }
            roomRef.current = null;
            (window as any).__livekitRoom = null;
        }

        joinedRef.current = false;
        currentRoomNameRef.current = null;

        useDailyStore.getState().clearParticipants();
        useDailyStore.getState().setLocalStream(null);
        useDailyStore.getState().setConnected(false);
        useDailyStore.getState().setActiveContext('none', null);

        // Clear peer video in avatarStore
        const peers = useAvatarStore.getState().peers;
        Object.keys(peers).forEach(peerId => {
            const peer = peers[peerId];
            if (peer.stream || peer.videoEnabled) {
                useAvatarStore.getState().updatePeer(peerId, {
                    id: peerId,
                    stream: null,
                    videoEnabled: false,
                });
            }
        });

        // Brief pause for cleanup
        await new Promise(r => setTimeout(r, 200));
    }, []);

    // ─── Public join/leave (serialized via lock) ────────────────
    const joinContext = useCallback((contextType: 'room' | 'proximity', contextId: string) => {
        return lockOperation(() => joinContextInner(contextType, contextId));
    }, [lockOperation, joinContextInner]);

    const leaveContext = useCallback(() => {
        return lockOperation(() => leaveContextInner());
    }, [lockOperation, leaveContextInner]);

    // ─── Register global functions for proximity/rooms engine ──
    useEffect(() => {
        (window as any).__joinDailyContext = joinContext;
        (window as any).__leaveDailyContext = leaveContext;
        return () => {
            delete (window as any).__joinDailyContext;
            delete (window as any).__leaveDailyContext;
        };
    }, [joinContext, leaveContext]);

    // ─── Sync mic/cam state changes to LiveKit ─────────────────
    useEffect(() => {
        const anyMediaOn = isAudioOn || isVideoOn;
        const avatarStore = useAvatarStore.getState();
        const proximityGroupId = avatarStore.myProximityGroupId;
        const myRoomId = avatarStore.myRoomId;

        if (anyMediaOn) {
            if (joinedRef.current && roomRef.current) {
                // Already connected — just sync media state (no need to rejoin)
                const room = roomRef.current;
                (async () => {
                    try {
                        await room.localParticipant.setMicrophoneEnabled(isAudioOn);
                        await room.localParticipant.setCameraEnabled(isVideoOn);
                    } catch (e) {
                        console.warn('[LiveKit] Media toggle failed:', e);
                        // If media toggle fails, the room connection may be broken.
                        // Force reconnect.
                        console.log('[LiveKit] Attempting reconnect after media failure...');
                        if (myRoomId) {
                            joinContext('room', myRoomId);
                        } else if (proximityGroupId) {
                            joinContext('proximity', proximityGroupId);
                        }
                    }
                })();
            } else if (myRoomId) {
                joinContext('room', myRoomId);
            } else if (proximityGroupId) {
                joinContext('proximity', proximityGroupId);
            }
        } else {
            // Both OFF → disconnect (stop billing)
            if (joinedRef.current) {
                leaveContext();
                console.log('[LiveKit] Both mic+cam OFF → disconnected');
            }
        }
    }, [isAudioOn, isVideoOn, joinContext, leaveContext]);

    // ─── Mute/unmute remote audio ──────────────────────────────
    useEffect(() => {
        const audioElements = document.querySelectorAll<HTMLAudioElement>('[id^="daily-audio-"]');
        audioElements.forEach(el => {
            el.muted = !isRemoteAudioEnabled;
        });
    }, [isRemoteAudioEnabled]);

    // ─── Retry connection when media ON but not joined ─────────
    useEffect(() => {
        const anyMediaOn = isAudioOn || isVideoOn;
        if (!anyMediaOn) return;

        const retryInterval = setInterval(() => {
            if (joinedRef.current || joiningRef.current) {
                clearInterval(retryInterval);
                return;
            }
            const { myRoomId, myProximityGroupId } = useAvatarStore.getState();
            if (myRoomId) {
                joinContext('room', myRoomId);
                clearInterval(retryInterval);
            } else if (myProximityGroupId) {
                joinContext('proximity', myProximityGroupId);
                clearInterval(retryInterval);
            }
        }, ROOM_CHECK_INTERVAL);

        return () => clearInterval(retryInterval);
    }, [isAudioOn, isVideoOn, joinContext]);

    // ─── Watch proximity group changes (debounced) ───────────────
    const proxDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const unsubscribe = useAvatarStore.subscribe((state, prevState) => {
            const newGroup = state.myProximityGroupId;
            const oldGroup = prevState.myProximityGroupId;
            if (newGroup === oldGroup) return;

            const dailyStore = useDailyStore.getState();
            const anyMediaOn = dailyStore.isAudioOn || dailyStore.isVideoOn;
            if (state.myRoomId) return;

            if (proxDebounceRef.current) {
                clearTimeout(proxDebounceRef.current);
                proxDebounceRef.current = null;
            }

            if (newGroup) {
                if (anyMediaOn) {
                    proxDebounceRef.current = setTimeout(() => {
                        proxDebounceRef.current = null;
                        const still = useAvatarStore.getState();
                        const stillMedia = useDailyStore.getState();
                        if (still.myProximityGroupId === newGroup && !still.myRoomId &&
                            (stillMedia.isAudioOn || stillMedia.isVideoOn)) {
                            joinContext('proximity', newGroup);
                        }
                    }, 500);
                }
            } else if (oldGroup && dailyStore.activeContext === 'proximity') {
                proxDebounceRef.current = setTimeout(() => {
                    proxDebounceRef.current = null;
                    const still = useAvatarStore.getState();
                    if (!still.myProximityGroupId && !still.myRoomId) {
                        leaveContext();
                        const ds = useDailyStore.getState();
                        if (ds.isAudioOn || ds.isVideoOn) {
                            useDailyStore.setState({ isAudioOn: false, isVideoOn: false });
                            console.log('[LiveKit] Walked away → mic/cam auto-disabled');
                        }
                    }
                }, 500);
            }
        });
        return () => {
            unsubscribe();
            if (proxDebounceRef.current) clearTimeout(proxDebounceRef.current);
        };
    }, [joinContext, leaveContext]);

    // ─── Watch room changes (debounced) ─────────────────────────
    const roomDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const unsubscribe = useAvatarStore.subscribe((state, prevState) => {
            const newRoomId = state.myRoomId;
            const oldRoomId = prevState.myRoomId;
            if (newRoomId === oldRoomId) return;

            const anyMediaOn = useDailyStore.getState().isAudioOn || useDailyStore.getState().isVideoOn;
            if (!anyMediaOn) return;

            if (roomDebounceRef.current) {
                clearTimeout(roomDebounceRef.current);
                roomDebounceRef.current = null;
            }

            // Use a shorter debounce (400ms instead of 800ms) for snappier room switches
            roomDebounceRef.current = setTimeout(() => {
                roomDebounceRef.current = null;
                const stillMediaOn = useDailyStore.getState().isAudioOn || useDailyStore.getState().isVideoOn;
                if (!stillMediaOn) return;

                const currentRoomId = useAvatarStore.getState().myRoomId;

                if (currentRoomId) {
                    joinContext('room', currentRoomId);
                } else {
                    const proxGroup = useAvatarStore.getState().myProximityGroupId;
                    if (proxGroup) {
                        joinContext('proximity', proxGroup);
                    } else if (joinedRef.current) {
                        leaveContext();
                        useDailyStore.setState({ isAudioOn: false, isVideoOn: false });
                        console.log('[LiveKit] Left room → no one nearby, mic/cam auto-disabled');
                    }
                }
            }, 400);
        });
        return () => {
            unsubscribe();
            if (roomDebounceRef.current) clearTimeout(roomDebounceRef.current);
        };
    }, [joinContext, leaveContext]);

    // ─── Cleanup on unmount ─────────────────────────────────────
    useEffect(() => {
        const handleUnload = () => {
            if (roomRef.current) {
                try {
                    roomRef.current.localParticipant.trackPublications.forEach(pub => {
                        if (pub.track) { try { pub.track.stop(); } catch { } }
                    });
                    roomRef.current.disconnect(true);
                } catch { }
                roomRef.current = null;
                (window as any).__livekitRoom = null;
                joinedRef.current = false;
                gLivekitToSupabase.clear();
            }
        };
        window.addEventListener('beforeunload', handleUnload);
        return () => {
            window.removeEventListener('beforeunload', handleUnload);
            handleUnload();
        };
    }, []);

    return null;
}
