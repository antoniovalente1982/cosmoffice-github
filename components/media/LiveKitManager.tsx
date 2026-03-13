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
import { useMediaStore } from '../../stores/mediaStore';
import { useAvatarStore } from '../../stores/avatarStore';

// ─── Configuration ──────────────────────────────────────────
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || '';
const PROXIMITY_RANGE = 2000;
const ROOM_CHECK_INTERVAL = 1500;

// ─── Token cache ────────────────────────────────────────────
const gTokenCache = new Map<string, { token: string; ts: number }>();
const TOKEN_CACHE_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours (tokens last 24h) — longer cache = fewer API calls
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
    const isAudioOn = useMediaStore(s => s.isAudioOn);
    const isVideoOn = useMediaStore(s => s.isVideoOn);
    const isRemoteAudioEnabled = useMediaStore(s => s.isRemoteAudioEnabled);

    // Always track what user wants
    useEffect(() => {
        wantedMediaRef.current = { audio: isAudioOn, video: isVideoOn };
    }, [isAudioOn, isVideoOn]);

    // ─── Room name — generates LiveKit room name for a given context ─
    // BUG-4 FIX: Use full contextId (not truncated) to prevent room name collisions
    // Two different rooms sharing the first 8 chars of their UUIDs would end up in the same
    // LiveKit room — causing users to see/hear each other across rooms
    const getContextRoomName = useCallback((contextType: 'room' | 'proximity', contextId: string) => {
        if (!spaceId) return null;
        const prefix = spaceId.slice(0, 8);
        // Use full contextId to guarantee uniqueness
        const safeId = contextId.replace(/[^a-zA-Z0-9-]/g, '');
        return contextType === 'room'
            ? `co-${prefix}-room-${safeId}`
            : `co-${prefix}-prox-${safeId}`;
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
                    useMediaStore.getState().setMediaError(`Errore token LiveKit: ${errData?.error || `HTTP ${res.status}`}`);
                    return null;
                }

                const data = await res.json();
                gTokenCache.set(roomName, { token: data.token, ts: Date.now() });
                return data.token;
            } catch (err: any) {
                const msg = err?.message?.includes('fetch')
                    ? 'Connessione internet assente o instabile'
                    : err?.message || 'Errore sconosciuto';
                useMediaStore.getState().setMediaError(`Impossibile ottenere token LiveKit: ${msg}`);
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

            useMediaStore.getState().setParticipant(id, {
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
            useMediaStore.getState().removeParticipant(id);

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
                useMediaStore.getState().addScreenStream(screenStream);
                track.mediaStreamTrack.addEventListener('ended', () =>
                    useMediaStore.getState().removeScreenStream(screenStream.id)
                );
                return;
            }

            if (track.kind === Track.Kind.Audio) {
                const audioElId = `daily-audio-${supabaseId}`;
                // BUG-3 FIX: Remove any existing element first to prevent duplicates
                const existingEl = document.getElementById(audioElId) as HTMLAudioElement;
                if (existingEl) {
                    existingEl.srcObject = null;
                    existingEl.remove();
                }
                const el = document.createElement('audio');
                el.id = audioElId;
                el.autoplay = true;
                el.style.display = 'none';
                // BUG-2 FIX: Always start at volume 1.0 for room context
                // For proximity, the adaptive volume engine will adjust on next tick
                const ctx = useMediaStore.getState().activeContext;
                el.volume = (ctx === 'room') ? 1.0 : 0.5;
                document.body.appendChild(el);
                el.muted = !useMediaStore.getState().isRemoteAudioEnabled;
                el.srcObject = new MediaStream([track.mediaStreamTrack]);
                el.play().catch(e => console.warn('[LiveKit] Audio autoplay blocked:', e));
                
                useMediaStore.getState().setParticipant(id, {
                    audioTrack: track.mediaStreamTrack,
                    audioEnabled: true,
                });
                console.log('[LiveKit] Audio track subscribed for:', supabaseId.slice(0, 8), 'ctx:', ctx, 'vol:', el.volume);
            }

            if (track.kind === Track.Kind.Video) {
                // BUG-4 FIX: Only show video for peers in the same room/proximity context
                const myRoomId = useAvatarStore.getState().myRoomId;
                const peerData = useAvatarStore.getState().peers[supabaseId];
                const peerRoomId = peerData?.roomId;
                const activeCtx = useMediaStore.getState().activeContext;
                
                // If in room context, only accept video from peers in the same room
                if (activeCtx === 'room' && myRoomId && peerRoomId && peerRoomId !== myRoomId) {
                    console.log('[LiveKit] Ignoring video from peer in different room:', supabaseId.slice(0, 8));
                    return;
                }

                const videoStream = new MediaStream([track.mediaStreamTrack]);
                useMediaStore.getState().setParticipant(id, {
                    videoTrack: track.mediaStreamTrack,
                    videoEnabled: true,
                    videoStream,
                });

                if (peerData) {
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

            if (track.source === Track.Source.ScreenShare) {
                // BUG-7 FIX: Only remove the specific screen stream from this participant,
                // NOT all streams. clearAllScreenStreams() was killing other users' shares.
                const trackId = track.mediaStreamTrack?.id;
                if (trackId) {
                    const streams = useMediaStore.getState().screenStreams;
                    const matchingStream = streams.find(s => 
                        s.getVideoTracks().some(t => t.id === trackId)
                    );
                    if (matchingStream) {
                        useMediaStore.getState().removeScreenStream(matchingStream.id);
                    }
                } else {
                    // Fallback: if no track ID, clear all (legacy behavior)
                    useMediaStore.getState().clearAllScreenStreams();
                }
                console.log('[LiveKit] Screen share track unsubscribed for:', supabaseId.slice(0, 8));
                return;
            }

            if (track.kind === Track.Kind.Audio) {
                const el = document.getElementById(`daily-audio-${supabaseId}`);
                if (el) (el as HTMLAudioElement).srcObject = null;
                useMediaStore.getState().setParticipant(id, { audioTrack: null, audioEnabled: false });
            }

            if (track.kind === Track.Kind.Video) {
                useMediaStore.getState().setParticipant(id, { videoTrack: null, videoEnabled: false, videoStream: null });
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
                useMediaStore.getState().addScreenStream(screenStream);
                track.mediaStreamTrack.addEventListener('ended', () => {
                    useMediaStore.getState().removeScreenStream(screenStream.id);
                    // Crucial fix: when the browser's native "Stop sharing" is clicked, 
                    // we must tell LiveKit to disable the screen share explicitly
                    // so it resets its internal 'isScreenShareEnabled' flag. 
                    // Otherwise, the second time, setScreenShareEnabled(true) does nothing!
                    if (room.localParticipant) {
                        room.localParticipant.setScreenShareEnabled(false).catch(() => {});
                    }
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
            useMediaStore.getState().setLocalStream(
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
                useMediaStore.getState().setLocalStream(
                    localTracks.length > 0 ? new MediaStream(localTracks) : null
                );
                return;
            }

            if (publication.source === Track.Source.Camera) {
                useMediaStore.getState().setParticipant(id, { videoEnabled: false });
                if (useAvatarStore.getState().peers[supabaseId]) {
                    useAvatarStore.getState().updatePeer(supabaseId, {
                        id: supabaseId,
                        videoEnabled: false,
                    });
                }
                console.log('[LiveKit] Remote camera muted:', supabaseId.slice(0, 8));
            }
            if (publication.source === Track.Source.Microphone) {
                useMediaStore.getState().setParticipant(id, { audioEnabled: false });
                // BUG-1 FIX: Completely stop audio output by nulling srcObject.
                // Just setting volume=0/muted=true is insufficient — the audio pipeline
                // can still leak sound through browser quirks.
                const audioEl = document.getElementById(`daily-audio-${supabaseId}`) as HTMLAudioElement;
                if (audioEl) {
                    audioEl.volume = 0;
                    audioEl.muted = true;
                    // Store srcObject for restore on unmute
                    (audioEl as any).__savedSrcObject = audioEl.srcObject;
                    audioEl.srcObject = null;
                }
                console.log('[LiveKit] Remote mic muted — audio pipeline stopped:', supabaseId.slice(0, 8));
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
                useMediaStore.getState().setLocalStream(
                    localTracks.length > 0 ? new MediaStream(localTracks) : null
                );
                return;
            }

            if (publication.source === Track.Source.Camera && publication.track) {
                // Rebuild video stream from the now-live track
                const videoStream = new MediaStream([publication.track.mediaStreamTrack]);
                useMediaStore.getState().setParticipant(id, {
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
                useMediaStore.getState().setParticipant(id, {
                    audioTrack: publication.track.mediaStreamTrack,
                    audioEnabled: true,
                });
                // BUG-1 FIX: Fully restore audio pipeline — re-attach srcObject and set volume
                const audioEl = document.getElementById(`daily-audio-${supabaseId}`) as HTMLAudioElement;
                if (audioEl) {
                    // Restore srcObject from saved or create fresh MediaStream
                    const savedSrc = (audioEl as any).__savedSrcObject;
                    if (savedSrc) {
                        audioEl.srcObject = savedSrc;
                        delete (audioEl as any).__savedSrcObject;
                    } else {
                        audioEl.srcObject = new MediaStream([publication.track.mediaStreamTrack]);
                    }
                    audioEl.muted = !useMediaStore.getState().isRemoteAudioEnabled;
                    // Set volume based on context — room = full, proximity = engine controls
                    const ctx = useMediaStore.getState().activeContext;
                    audioEl.volume = (ctx === 'room') ? 1.0 : 0.5;
                    audioEl.play().catch(e => console.warn('[LiveKit] Audio play on unmute blocked:', e));
                }
                console.log('[LiveKit] Remote mic unmuted — audio pipeline restored:', supabaseId.slice(0, 8));
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
                useMediaStore.getState().clearAllScreenStreams();
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
            useMediaStore.getState().setLocalStream(
                localTracks.length > 0 ? new MediaStream(localTracks) : null
            );
        });

        // ─── Active speaker change ────────────────────
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
            const localIdentity = room.localParticipant?.identity;
            const isLocalSpeaking = speakers.some(s => s.identity === localIdentity);

            useMediaStore.getState().setSpeaking(isLocalSpeaking);

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
            joiningRef.current = false;
            currentRoomNameRef.current = null;
            useMediaStore.getState().clearParticipants();
            useMediaStore.getState().setLocalStream(null);
            useMediaStore.getState().setConnected(false);
            useMediaStore.getState().setActiveContext('none', null);

            // If we were force-disconnected (signal-lost, server restart, etc.)
            // and user still wants media, attempt auto-reconnect
            if (reason !== DisconnectReason.CLIENT_INITIATED) {
                console.warn('[LiveKit] Non-client disconnect — will attempt reconnect in 1.5s');
                setTimeout(() => {
                    const currentRoom = useAvatarStore.getState().myRoomId;
                    const currentProx = useAvatarStore.getState().myProximityGroupId;
                    const stillWants = useMediaStore.getState().isAudioOn || useMediaStore.getState().isVideoOn;
                    if (stillWants) {
                        if (currentRoom) {
                            lockOperation(() => joinContextInner('room', currentRoom));
                        } else if (currentProx) {
                            lockOperation(() => joinContextInner('proximity', currentProx));
                        }
                    }
                }, 1500);
            }
        });

        // ─── Reconnecting (automatic, LiveKit SDK internal) ───
        room.on(RoomEvent.Reconnecting, () => {
            console.log('[LiveKit] 🔄 Reconnecting automatically...');
        });

        // ─── Reconnected (automatic, LiveKit SDK internal) ───
        room.on(RoomEvent.Reconnected, () => {
            console.log('[LiveKit] ✅ Reconnected automatically');
            const wanted = wantedMediaRef.current;
            (async () => {
                try {
                    await room.localParticipant.setMicrophoneEnabled(wanted.audio);
                    await room.localParticipant.setCameraEnabled(wanted.video);
                } catch (e) {
                    console.warn('[LiveKit] Media re-sync after reconnect failed:', e);
                }
            })();
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

        // Same-room guard — but only if the connection is actually alive
        if (joinedRef.current && currentRoomNameRef.current === roomName
            && roomRef.current?.state === ConnectionState.Connected) {
            console.log('[LiveKit] Already in room', roomName, '— syncing media');
            const wanted = wantedMediaRef.current;
            try {
                await roomRef.current.localParticipant.setMicrophoneEnabled(wanted.audio);
                await roomRef.current.localParticipant.setCameraEnabled(wanted.video);
            } catch (e) {
                console.warn('[LiveKit] Media sync error:', e);
            }
            return;
        }

        joiningRef.current = true;

        // ─── BUG-3 FIX: Aggressive DOM cleanup BEFORE destroying old room ─────
        // Remove ALL orphaned audio elements to prevent DOM accumulation
        document.querySelectorAll<HTMLAudioElement>('[id^="daily-audio-"]').forEach(el => {
            el.srcObject = null;
            el.remove();
        });

        // ─── Destroy old Room before creating new one ─────
        if (roomRef.current) {
            console.log('[LiveKit] Destroying old room before new join');
            try {
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
            useMediaStore.getState().clearParticipants();
            useMediaStore.getState().setLocalStream(null);
            // BUG-8 FIX: Minimal pause — 50ms is enough for cleanup
            await new Promise(r => setTimeout(r, 50));
        }

        try {
            // Reuse cached token when possible (tokens last 24h)
            // Only fetch fresh if not cached

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

            useMediaStore.getState().clearMediaError();

            // Set context BEFORE connect so TrackSubscribed knows if room or proximity
            useMediaStore.getState().setActiveContext(contextType, contextId);

            await room.connect(LIVEKIT_URL, token);

            joinedRef.current = true;
            currentRoomNameRef.current = roomName;
            useMediaStore.getState().setConnected(true);
            console.log(`[LiveKit] ✅ Joined ${contextType}:`, roomName);

            // BUG-2 FIX: Multi-step audio activation for room context.
            // TrackSubscribed fires asynchronously and may race with context setting.
            // Three sweeps ensure audio is NEVER stuck at zero.
            if (contextType === 'room') {
                const activateRoomAudio = () => {
                    document.querySelectorAll<HTMLAudioElement>('[id^="daily-audio-"]').forEach(el => {
                        if (el.volume < 0.3) el.volume = 1.0;
                        if (el.muted && useMediaStore.getState().isRemoteAudioEnabled) {
                            el.muted = false;
                        }
                        if (el.srcObject && el.paused) {
                            el.play().catch(() => {});
                        }
                    });
                };
                setTimeout(activateRoomAudio, 300);
                setTimeout(activateRoomAudio, 1000);
                setTimeout(activateRoomAudio, 2500);
            }

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

            // Sync existing remote participants (they may already be publishing tracks)
            // This is critical for re-entry: if others were in the room before us,
            // their tracks are already published and we need to manually process them
            for (const participant of Array.from(room.remoteParticipants.values())) {
                const pid = participant.identity;
                gLivekitToSupabase.set(pid, pid);
                useMediaStore.getState().setParticipant(pid, {
                    sessionId: participant.sid,
                    odell: pid,
                    userName: participant.name || 'Anonymous',
                    audioEnabled: false,
                    videoEnabled: false,
                    audioTrack: null,
                    videoTrack: null,
                    supabaseId: pid,
                });
                // Process already-subscribed tracks
                for (const pub of Array.from(participant.trackPublications.values())) {
                    if (pub.track && pub.isSubscribed) {
                        if (pub.track.kind === Track.Kind.Video && pub.source === Track.Source.Camera) {
                            const videoStream = new MediaStream([pub.track.mediaStreamTrack]);
                            useMediaStore.getState().setParticipant(pid, {
                                videoTrack: pub.track.mediaStreamTrack,
                                videoEnabled: true,
                                videoStream,
                            });
                            if (useAvatarStore.getState().peers[pid]) {
                                useAvatarStore.getState().updatePeer(pid, {
                                    id: pid,
                                    videoEnabled: true,
                                    stream: videoStream,
                                });
                            }
                        }
                        if (pub.track.kind === Track.Kind.Audio && pub.source === Track.Source.Microphone) {
                            const audioElId = `daily-audio-${pid}`;
                            // BUG-3 FIX: Remove existing element first
                            const existingEl = document.getElementById(audioElId) as HTMLAudioElement;
                            if (existingEl) {
                                existingEl.srcObject = null;
                                existingEl.remove();
                            }
                            const el = document.createElement('audio');
                            el.id = audioElId;
                            el.autoplay = true;
                            el.style.display = 'none';
                            // BUG-2 FIX: For room context, start at full volume immediately
                            el.volume = (contextType === 'room') ? 1.0 : 0.5;
                            document.body.appendChild(el);
                            el.muted = !useMediaStore.getState().isRemoteAudioEnabled;
                            el.srcObject = new MediaStream([pub.track.mediaStreamTrack]);
                            el.play().catch(e => console.warn('[LiveKit] Audio play blocked:', e));
                            useMediaStore.getState().setParticipant(pid, {
                                audioTrack: pub.track.mediaStreamTrack,
                                audioEnabled: true,
                            });
                        }
                    }
                }
                console.log('[LiveKit] Synced existing participant:', pid.slice(0, 8));
            }

        } catch (err: any) {
            const msg = err?.message || 'Errore sconosciuto';
            useMediaStore.getState().setMediaError(`Connessione LiveKit fallita: ${msg}`);
            console.error('[LiveKit] Join failed:', msg);
            // Clean up on failure
            if (roomRef.current) {
                try { await roomRef.current.disconnect(true); } catch { }
                roomRef.current = null;
                (window as any).__livekitRoom = null;
            }
            joinedRef.current = false;
            currentRoomNameRef.current = null;
        } finally {
            joiningRef.current = false;
        }
    }, [spaceId, getContextRoomName, getToken, createRoom]);

    // ─── Inner leave (called inside the lock) ──────────────────
    const leaveContextInner = useCallback(async () => {
        // Clean up ALL audio elements to prevent DOM accumulation on room switches
        document.querySelectorAll<HTMLAudioElement>('[id^="daily-audio-"]').forEach(el => {
            el.srcObject = null;
            el.remove();
        });

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

        useMediaStore.getState().clearParticipants();
        useMediaStore.getState().setLocalStream(null);
        useMediaStore.getState().setConnected(false);
        useMediaStore.getState().setActiveContext('none', null);

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

        // BUG-8 FIX: Minimal pause for cleanup
        await new Promise(r => setTimeout(r, 30));
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
            if (isRemoteAudioEnabled && el.srcObject) {
                el.play().catch(e => console.warn('[LiveKit] Audio play blocked on unmute:', e));
            }
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

            const mediaStore = useMediaStore.getState();
            const anyMediaOn = mediaStore.isAudioOn || mediaStore.isVideoOn;
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
                        const stillMedia = useMediaStore.getState();
                        if (still.myProximityGroupId === newGroup && !still.myRoomId &&
                            (stillMedia.isAudioOn || stillMedia.isVideoOn)) {
                            joinContext('proximity', newGroup);
                        }
                    }, 500);
                }
            } else if (oldGroup && mediaStore.activeContext === 'proximity') {
                proxDebounceRef.current = setTimeout(() => {
                    proxDebounceRef.current = null;
                    const still = useAvatarStore.getState();
                    if (!still.myProximityGroupId && !still.myRoomId) {
                        leaveContext();
                        const ds = useMediaStore.getState();
                        if (ds.isAudioOn || ds.isVideoOn) {
                            useMediaStore.setState({ isAudioOn: false, isVideoOn: false });
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

            const anyMediaOn = useMediaStore.getState().isAudioOn || useMediaStore.getState().isVideoOn;
            if (!anyMediaOn) return;

            if (roomDebounceRef.current) {
                clearTimeout(roomDebounceRef.current);
                roomDebounceRef.current = null;
            }

            // Use a shorter debounce (400ms instead of 800ms) for snappier room switches
            roomDebounceRef.current = setTimeout(() => {
                roomDebounceRef.current = null;
                const stillMediaOn = useMediaStore.getState().isAudioOn || useMediaStore.getState().isVideoOn;
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
                        useMediaStore.setState({ isAudioOn: false, isVideoOn: false });
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

    // ─── BUG-1/BUG-4 FIX: Periodic reconciliation ────────────────
    // Every 3s: check that muted tracks have zero audio output
    // Every 5s: hide video from peers in different rooms
    useEffect(() => {
        // Audio mute reconciliation (3s)
        const audioReconcile = setInterval(() => {
            if (!roomRef.current || !joinedRef.current) return;
            
            for (const participant of Array.from(roomRef.current.remoteParticipants.values())) {
                const pid = participant.identity;
                const supabaseId = gLivekitToSupabase.get(pid) || pid;
                
                // Check mic tracks
                for (const pub of Array.from(participant.trackPublications.values())) {
                    if (pub.source === Track.Source.Microphone) {
                        const audioEl = document.getElementById(`daily-audio-${supabaseId}`) as HTMLAudioElement;
                        if (!audioEl) continue;
                        
                        if (pub.isMuted || !pub.isSubscribed) {
                            // Track is muted at LiveKit level → ensure audio is stopped
                            if (audioEl.srcObject || audioEl.volume > 0) {
                                audioEl.volume = 0;
                                audioEl.muted = true;
                                (audioEl as any).__savedSrcObject = audioEl.srcObject;
                                audioEl.srcObject = null;
                            }
                            // Sync store state
                            const storeParticipant = useMediaStore.getState().participants[pid];
                            if (storeParticipant?.audioEnabled) {
                                useMediaStore.getState().setParticipant(pid, { audioEnabled: false });
                            }
                        } else if (!pub.isMuted && pub.isSubscribed && pub.track) {
                            // Track is active → ensure audio element is playing
                            if (!audioEl.srcObject) {
                                audioEl.srcObject = new MediaStream([pub.track.mediaStreamTrack]);
                                audioEl.muted = !useMediaStore.getState().isRemoteAudioEnabled;
                                const ctx = useMediaStore.getState().activeContext;
                                audioEl.volume = (ctx === 'room') ? 1.0 : 0.5;
                                audioEl.play().catch(() => {});
                            }
                        }
                    }
                }
            }
        }, 3000);

        // Video room isolation check (5s)
        const videoReconcile = setInterval(() => {
            if (!joinedRef.current) return;
            
            const myRoomId = useAvatarStore.getState().myRoomId;
            const activeCtx = useMediaStore.getState().activeContext;
            if (activeCtx !== 'room' || !myRoomId) return;
            
            // Check all peers: if they're in a different room, clear their video
            const peers = useAvatarStore.getState().peers;
            Object.entries(peers).forEach(([peerId, peer]: [string, any]) => {
                if (peer.roomId && peer.roomId !== myRoomId && peer.videoEnabled) {
                    useAvatarStore.getState().updatePeer(peerId, {
                        id: peerId,
                        videoEnabled: false,
                        stream: null,
                    });
                }
            });
        }, 5000);

        return () => {
            clearInterval(audioReconcile);
            clearInterval(videoReconcile);
        };
    }, []);

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
