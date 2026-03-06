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
    const leavingRef = useRef(false);
    const currentRoomNameRef = useRef<string | null>(null);

    // Read media toggles from daily store (same store, renamed internally)
    const isAudioOn = useDailyStore(s => s.isAudioOn);
    const isVideoOn = useDailyStore(s => s.isVideoOn);
    const isRemoteAudioEnabled = useDailyStore(s => s.isRemoteAudioEnabled);

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
            // Identity format: supabaseUserId (set in token)
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

            // Clean up video state in avatarStore
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
                // Screen share track
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

        // ─── Local track unpublished ──────────────────
        room.on(RoomEvent.LocalTrackUnpublished, () => {
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
                // Simulcast: sends 3 quality layers (high/mid/low) — server picks best for each viewer
                videoCodec: 'vp8',
                dtx: true,
                red: true,
            },
        });
        setupRoomEvents(room);
        return room;
    }, [setupRoomEvents]);

    // Expose room ref for screen sharing (updated on each join)
    useEffect(() => {
        return () => { (window as any).__livekitRoom = null; };
    }, []);

    // ─── Join a LiveKit room (room or proximity group) ─────────
    const joinContext = useCallback(async (contextType: 'room' | 'proximity', contextId: string) => {
        if (!spaceId) return;
        if (leavingRef.current) return;

        const roomName = getContextRoomName(contextType, contextId);
        if (!roomName) return;

        // Same-room guard
        if (joinedRef.current && currentRoomNameRef.current === roomName) {
            console.log('[LiveKit] Already in room', roomName, '— skipping');
            return;
        }

        // ─── ALWAYS destroy old Room before creating new one ─────
        // This guarantees the old server-side session is fully closed
        if (roomRef.current) {
            console.log('[LiveKit] Destroying old room before new join');
            try { await roomRef.current.disconnect(true); } catch { }
            roomRef.current = null;
            (window as any).__livekitRoom = null;
            joinedRef.current = false;
            currentRoomNameRef.current = null;
            // Wait for server-side session cleanup
            await new Promise(r => setTimeout(r, 500));
        }

        if (joiningRef.current) return;
        joiningRef.current = true;

        try {
            const token = await getToken(roomName);
            if (!token) { joiningRef.current = false; return; }
            if (leavingRef.current) { joiningRef.current = false; return; }

            // Create a FRESH Room object — no stale state from previous connection
            const room = createRoom();
            roomRef.current = room;
            (window as any).__livekitRoom = room;

            useDailyStore.getState().clearDailyError();
            const dailyState = useDailyStore.getState();

            await room.connect(LIVEKIT_URL, token);

            joinedRef.current = true;
            currentRoomNameRef.current = roomName;
            useDailyStore.getState().setConnected(true);
            useDailyStore.getState().setActiveContext(contextType, contextId);
            console.log(`[LiveKit] ✅ Joined ${contextType}:`, roomName);

            if (dailyState.isAudioOn) {
                await room.localParticipant.setMicrophoneEnabled(true);
            }
            if (dailyState.isVideoOn) {
                await room.localParticipant.setCameraEnabled(true);
            }

        } catch (err: any) {
            const msg = err?.message || 'Errore sconosciuto';
            useDailyStore.getState().setDailyError(`Connessione LiveKit fallita: ${msg}`);
            console.error('[LiveKit] Join failed:', msg);
        } finally {
            joiningRef.current = false;
        }
    }, [spaceId, getContextRoomName, getToken, createRoom]);

    // ─── Leave current room ────────────────────────────────────
    const leaveContext = useCallback(async () => {
        leavingRef.current = true;
        joiningRef.current = false;

        if (roomRef.current) {
            console.log('[LiveKit] 🔌 Disconnecting + destroying room (billing stopped)');
            try { await roomRef.current.disconnect(true); } catch { }
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

        await new Promise(r => setTimeout(r, 500));
        leavingRef.current = false;
    }, []);

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
            // Safety: reset stuck joiningRef after 15s
            if (joiningRef.current) {
                setTimeout(() => {
                    if (joiningRef.current && !joinedRef.current) {
                        console.warn('[LiveKit] joiningRef stuck — force resetting');
                        joiningRef.current = false;
                    }
                }, 15000);
            }

            if (joinedRef.current && roomRef.current) {
                // Already connected — sync media state
                roomRef.current.localParticipant.setMicrophoneEnabled(isAudioOn);
                roomRef.current.localParticipant.setCameraEnabled(isVideoOn);
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
                    // Debounce proximity joins to prevent flicker at border
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
                // Left proximity — disconnect and turn off mic/cam
                proxDebounceRef.current = setTimeout(() => {
                    proxDebounceRef.current = null;
                    const still = useAvatarStore.getState();
                    if (!still.myProximityGroupId && !still.myRoomId) {
                        leaveContext();
                        // Auto-disable mic/cam when no one is around
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
                        // Auto-disable mic/cam when no one is around
                        useDailyStore.setState({ isAudioOn: false, isVideoOn: false });
                        console.log('[LiveKit] Left room → no one nearby, mic/cam auto-disabled');
                    }
                }
            }, 800);  // 800ms debounce — prevents fast room switching race conditions
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
                try { roomRef.current.disconnect(true); } catch { }
                roomRef.current = null;
                (window as any).__livekitRoom = null;
                joinedRef.current = false;
                joiningRef.current = false;
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
