'use client';

import { useEffect, useRef, useCallback } from 'react';
import DailyIframe, {
    DailyCall,
    DailyEventObjectParticipant,
    DailyEventObjectParticipantLeft,
} from '@daily-co/daily-js';
import { useDailyStore } from '../stores/dailyStore';
import { useAvatarStore } from '../stores/avatarStore';

// ─── Configuration ──────────────────────────────────────────
const DAILY_DOMAIN = process.env.NEXT_PUBLIC_DAILY_DOMAIN || 'antoniovalente.daily.co';
const PROXIMITY_RANGE = 2000;
const ROOM_CHECK_INTERVAL = 1500;
const TRACK_SYNC_POLL_MS = 100;
const TRACK_SYNC_MAX_ATTEMPTS = 30;

// ─── Room URL cache ─────────────────────────────────────────
const gRoomUrlCache = new Map<string, { url: string; ts: number }>();
const ROOM_CACHE_TTL_MS = 30 * 60 * 1000; // Layer 5: 30 min cache (was 10 min)

// ─── In-flight dedup for ensureRoom API calls (Layer 5) ─────
const gPendingRoomRequests = new Map<string, Promise<string | null>>();

// ─── Daily session_id → Supabase user_id mapping ────────────
const gDailyToSupabase = new Map<string, string>();
const gLastSubscribeState = new Map<string, string>();
const gLocalTracks = new Map<string, MediaStreamTrack>();

/**
 * DailyManager — Singleton component mounted ONCE in the office layout.
 * Creates and manages the Daily.co call object lifecycle.
 * Returns null (no JSX, pure logic).
 */
export function DailyManager({ spaceId }: { spaceId: string | null }) {
    const callRef = useRef<DailyCall | null>(null);
    const joinedRef = useRef(false);
    const joiningRef = useRef(false);
    const roomUrlRef = useRef<string | null>(null);
    const currentRoomNameRef = useRef<string | null>(null); // Layer 3: track current room name

    // Read media toggles from daily store
    const isAudioOn = useDailyStore(s => s.isAudioOn);
    const isVideoOn = useDailyStore(s => s.isVideoOn);

    // ─── Room name — generates Daily.co room name for a given context ─
    const getContextRoomName = useCallback((contextType: 'room' | 'proximity', contextId: string) => {
        if (!spaceId) return null;
        const prefix = spaceId.slice(0, 8);
        return contextType === 'room'
            ? `co-${prefix}-room-${contextId.slice(0, 8)}`
            : `co-${prefix}-prox-${contextId.slice(0, 8)}`;
    }, [spaceId]);

    // ─── Create or get room via API (with cache + in-flight dedup) ─
    const ensureRoom = useCallback(async (roomName: string): Promise<string | null> => {
        // Check cache first
        const cached = gRoomUrlCache.get(roomName);
        if (cached && (Date.now() - cached.ts) < ROOM_CACHE_TTL_MS) return cached.url;

        // Layer 5: Dedup — if there's already an in-flight request for this room, reuse it
        const pending = gPendingRoomRequests.get(roomName);
        if (pending) return pending;

        const request = (async (): Promise<string | null> => {
            try {
                const res = await fetch('/api/daily/room', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomName }),
                });
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    const detail = errData?.details?.info || errData?.error || `HTTP ${res.status}`;
                    useDailyStore.getState().setDailyError(`Errore creazione stanza Daily.co: ${detail}`);
                    return null;
                }
                const data = await res.json();
                gRoomUrlCache.set(roomName, { url: data.url, ts: Date.now() });
                return data.url;
            } catch (err: any) {
                const msg = err?.message?.includes('ENOTFOUND') || err?.message?.includes('fetch')
                    ? 'Connessione internet assente o instabile'
                    : err?.message || 'Errore sconosciuto';
                useDailyStore.getState().setDailyError(`Impossibile raggiungere Daily.co: ${msg}`);
                return null;
            } finally {
                gPendingRoomRequests.delete(roomName);
            }
        })();

        gPendingRoomRequests.set(roomName, request);
        return request;
    }, []);

    // ─── Event handlers (stable refs, no deps) ──────────────
    const handleParticipantJoined = useCallback((ev: DailyEventObjectParticipant | undefined) => {
        if (!ev?.participant || ev.participant.local) return;
        const p = ev.participant;
        const id = p.user_id || p.session_id;

        let supabaseId: string | null = null;
        if (p.user_name?.includes('|')) supabaseId = p.user_name.split('|').pop() || null;
        if (!supabaseId) supabaseId = (p as any).userData?.supabaseUserId || null;
        if (supabaseId) {
            gDailyToSupabase.set(id, supabaseId);
            gDailyToSupabase.set(p.session_id, supabaseId);
        }

        const displayName = p.user_name?.split('|')[0] || 'Anonymous';
        useDailyStore.getState().setParticipant(id, {
            sessionId: p.session_id, odell: id, userName: displayName,
            audioEnabled: !p.tracks.audio?.off, videoEnabled: !p.tracks.video?.off,
            audioTrack: null, videoTrack: null, supabaseId,
        });
        console.log('[Daily] Peer joined:', displayName);
    }, []);

    const handleParticipantLeft = useCallback((ev: DailyEventObjectParticipantLeft | undefined) => {
        if (!ev?.participant) return;
        const id = ev.participant.user_id || ev.participant.session_id;
        const supabaseId = gDailyToSupabase.get(id) || id;
        document.getElementById(`daily-audio-${supabaseId}`)?.remove();
        document.getElementById(`daily-audio-${id}`)?.remove();
        useDailyStore.getState().removeParticipant(id);

        // Clean up video state in avatarStore so tile disappears
        if (useAvatarStore.getState().peers[supabaseId]) {
            useAvatarStore.getState().updatePeer(supabaseId, {
                id: supabaseId,
                videoEnabled: false,
                stream: null,
                isSpeaking: false,
            });
        }

        gDailyToSupabase.delete(id);
        gLastSubscribeState.delete(id);
    }, []);

    const handleParticipantUpdated = useCallback((ev: DailyEventObjectParticipant | undefined) => {
        if (!ev?.participant || ev.participant.local) return;
        const p = ev.participant;
        const id = p.user_id || p.session_id;

        if (!gDailyToSupabase.has(id)) {
            let supabaseId: string | null = null;
            if (p.user_name?.includes('|')) supabaseId = p.user_name.split('|').pop() || null;
            if (!supabaseId) supabaseId = (p as any).userData?.supabaseUserId || null;
            if (supabaseId) {
                gDailyToSupabase.set(id, supabaseId);
                gDailyToSupabase.set(p.session_id, supabaseId);
            }
        }

        useDailyStore.getState().setParticipant(id, {
            audioEnabled: !p.tracks.audio?.off,
            videoEnabled: !p.tracks.video?.off,
        });
    }, []);

    const handleTrackStarted = useCallback((ev: any) => {
        if (!ev?.participant) return;
        const track = ev.track as MediaStreamTrack;
        if (!track) return;

        const isScreenTrack = ev.type === 'screenVideo' ||
            ev.participant.tracks?.screenVideo?.persistentTrack === track;

        if (ev.participant.local) {
            if (isScreenTrack) {
                const screenStream = new MediaStream([track]);
                useDailyStore.getState().addScreenStream(screenStream);
                track.addEventListener('ended', () => useDailyStore.getState().removeScreenStream(screenStream.id));
                return;
            }
            gLocalTracks.set(track.kind, track);
            const liveTracks = Array.from(gLocalTracks.values()).filter(t => t.readyState === 'live');
            useDailyStore.getState().setLocalStream(liveTracks.length > 0 ? new MediaStream(liveTracks) : null);
            return;
        }

        const dailyId = ev.participant.user_id || ev.participant.session_id;
        const supabaseId = gDailyToSupabase.get(dailyId) || dailyId;

        if (isScreenTrack) {
            const screenStream = new MediaStream([track]);
            useDailyStore.getState().addScreenStream(screenStream);
            track.addEventListener('ended', () => useDailyStore.getState().removeScreenStream(screenStream.id));
            return;
        }

        if (track.kind === 'audio') {
            const audioElId = `daily-audio-${supabaseId}`;
            let el = document.getElementById(audioElId) as HTMLAudioElement;
            if (!el) { el = document.createElement('audio'); el.id = audioElId; el.autoplay = true; el.style.display = 'none'; document.body.appendChild(el); }
            el.srcObject = new MediaStream([track]);
            // Also store audio track in dailyStore
            useDailyStore.getState().setParticipant(dailyId, { audioTrack: track, audioEnabled: true });
        }
        if (track.kind === 'video') {
            const videoStream = new MediaStream([track]);
            // Store video track AND stable MediaStream in dailyStore
            useDailyStore.getState().setParticipant(dailyId, { videoTrack: track, videoEnabled: true, videoStream });
            // Only update avatarStore if we have a REAL supabaseId mapping (not the dailyId fallback)
            const realSupabaseId = gDailyToSupabase.get(dailyId);
            if (realSupabaseId) {
                const avatarState = useAvatarStore.getState();
                if (avatarState.peers[realSupabaseId]) {
                    useAvatarStore.getState().updatePeer(realSupabaseId, {
                        id: realSupabaseId,
                        videoEnabled: true,
                        stream: videoStream,
                    });
                }
            }
            console.log('[Daily] Video track stored for peer:', realSupabaseId || dailyId);
        }
    }, []);

    const handleTrackStopped = useCallback((ev: any) => {
        if (!ev?.participant) return;
        const track = ev.track as MediaStreamTrack;
        const isScreenTrack = ev.type === 'screenVideo' ||
            ev.participant.tracks?.screenVideo?.persistentTrack === track;

        if (ev.participant.local) {
            if (isScreenTrack) return;
            if (track?.kind) gLocalTracks.delete(track.kind);
            const liveTracks = Array.from(gLocalTracks.values()).filter(t => t.readyState === 'live');
            useDailyStore.getState().setLocalStream(liveTracks.length > 0 ? new MediaStream(liveTracks) : null);
            return;
        }

        if (isScreenTrack) return;
        const dailyId = ev.participant.user_id || ev.participant.session_id;
        const supabaseId = gDailyToSupabase.get(dailyId) || dailyId;

        if (track?.kind === 'audio') {
            const el = document.getElementById(`daily-audio-${supabaseId}`) || document.getElementById(`daily-audio-${dailyId}`);
            if (el) (el as HTMLAudioElement).srcObject = null;
            useDailyStore.getState().setParticipant(dailyId, { audioTrack: null, audioEnabled: false });
        }
        if (track?.kind === 'video') {
            useDailyStore.getState().setParticipant(dailyId, { videoTrack: null, videoEnabled: false, videoStream: null });
            // Only update existing avatarStore peer
            const realSupabaseId = gDailyToSupabase.get(dailyId);
            if (realSupabaseId && useAvatarStore.getState().peers[realSupabaseId]) {
                useAvatarStore.getState().updatePeer(realSupabaseId, {
                    id: realSupabaseId,
                    videoEnabled: false,
                    stream: null,
                });
            }
        }
    }, []);

    const handleError = useCallback((ev: any) => {
        console.error('[Daily] Error:', ev?.errorMsg || ev);
        useDailyStore.getState().setDailyError(ev?.errorMsg || 'Errore Daily.co sconosciuto');
    }, []);

    // ─── Active Speaker Change — broadcast via PartyKit ─────
    const lastSpeakingRef = useRef(false);
    const handleActiveSpeakerChange = useCallback((ev: any) => {
        // ev.activeSpeaker.peerId — the session_id of the active speaker
        const localPeerId = callRef.current?.participants()?.local?.session_id;
        const isLocal = ev?.activeSpeaker?.peerId === localPeerId;
        const nowSpeaking = isLocal;

        // Only broadcast on change to avoid flooding
        if (nowSpeaking !== lastSpeakingRef.current) {
            lastSpeakingRef.current = nowSpeaking;
            useDailyStore.getState().setSpeaking(nowSpeaking);

            // Broadcast via PartyKit to all peers
            const socket = (window as any).__partykitSocket;
            if (socket?.readyState === WebSocket.OPEN) {
                const profile = useAvatarStore.getState().myProfile;
                socket.send(JSON.stringify({
                    type: 'speaking',
                    userId: profile?.id,
                    isSpeaking: nowSpeaking,
                }));
            }
        }
    }, []);


    // ─── Pre-create call object on mount (FREE — no billing) ─
    useEffect(() => {
        if (!spaceId || callRef.current) return;
        try {
            const call = DailyIframe.createCallObject();
            call.on('participant-joined', handleParticipantJoined);
            call.on('participant-left', handleParticipantLeft);
            call.on('participant-updated', handleParticipantUpdated);
            call.on('track-started', handleTrackStarted);
            call.on('track-stopped', handleTrackStopped);
            call.on('active-speaker-change', handleActiveSpeakerChange);
            call.on('error', handleError);
            callRef.current = call;
            (window as any).__dailyCall = call;
            console.log('[Daily] Call object pre-created (no billing)');
        } catch (err: any) {
            console.error('[Daily] Failed to create call object:', err?.message);
        }
    }, [spaceId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Pre-cache a lobby room URL on mount (FREE — just an API call) ─
    useEffect(() => {
        if (!spaceId) return;
        const roomName = `co-${spaceId.slice(0, 8)}-lobby`;
        ensureRoom(roomName).then(url => {
            if (url) console.log('[Daily] Lobby room URL pre-cached (no billing)');
        });
    }, [spaceId, ensureRoom]);

    // ─── Join a Daily.co context (room or proximity group) ─────
    const joinDailyContext = useCallback(async (contextType: 'room' | 'proximity', contextId: string) => {
        if (!spaceId || !callRef.current) return;

        const roomName = getContextRoomName(contextType, contextId);
        if (!roomName) return;

        // Layer 3: Same-room guard — skip if already in this exact room
        if (joinedRef.current && currentRoomNameRef.current === roomName) {
            console.log('[Daily] Already in room', roomName, '— skipping join');
            return;
        }

        if (joinedRef.current) {
            // Already in a different call — leave first
            try { await callRef.current.leave(); } catch { }
            joinedRef.current = false;
            currentRoomNameRef.current = null;
            gLocalTracks.clear();
        }
        if (joiningRef.current) return;
        joiningRef.current = true;

        try {
            const url = await ensureRoom(roomName);
            if (!url) { joiningRef.current = false; return; }

            useDailyStore.getState().clearDailyError();
            const profile = useAvatarStore.getState().myProfile;
            const supabaseUserId = profile?.id || null;
            const dailyState = useDailyStore.getState();

            await callRef.current!.join({
                url,
                userName: `${profile?.display_name || profile?.full_name || 'Anonymous'}|${supabaseUserId || 'unknown'}`,
                startVideoOff: !dailyState.isVideoOn,
                startAudioOff: !dailyState.isAudioOn,
                ...(supabaseUserId ? { userData: { supabaseUserId } } : {}),
            } as any);

            joinedRef.current = true;
            roomUrlRef.current = url;
            currentRoomNameRef.current = roomName; // Layer 3: track active room name
            useDailyStore.getState().setConnected(true);
            useDailyStore.getState().setActiveContext(contextType, contextId);
            console.log(`[Daily] ✅ Joined ${contextType} context:`, roomName);

            if (dailyState.isVideoOn) callRef.current!.setLocalVideo(true);
            if (dailyState.isAudioOn) callRef.current!.setLocalAudio(true);

            // Poll for tracks
            let attempts = 0;
            const syncInterval = setInterval(() => {
                if (!callRef.current || !joinedRef.current || attempts >= TRACK_SYNC_MAX_ATTEMPTS) {
                    clearInterval(syncInterval);
                    return;
                }
                attempts++;
                const local = callRef.current.participants()?.local;
                if (!local) return;
                let changed = false;
                const audioTrack = local.tracks?.audio?.persistentTrack;
                const videoTrack = local.tracks?.video?.persistentTrack;
                if (audioTrack && audioTrack.readyState === 'live' && !gLocalTracks.has('audio')) {
                    gLocalTracks.set('audio', audioTrack);
                    changed = true;
                }
                if (videoTrack && videoTrack.readyState === 'live' && !gLocalTracks.has('video')) {
                    gLocalTracks.set('video', videoTrack);
                    changed = true;
                }
                if (changed) {
                    const liveTracks = Array.from(gLocalTracks.values()).filter(t => t.readyState === 'live');
                    useDailyStore.getState().setLocalStream(liveTracks.length > 0 ? new MediaStream(liveTracks) : null);
                }
                const ds = useDailyStore.getState();
                const hasAll = (!ds.isVideoOn || gLocalTracks.has('video')) && (!ds.isAudioOn || gLocalTracks.has('audio'));
                if (hasAll) clearInterval(syncInterval);
            }, TRACK_SYNC_POLL_MS);

        } catch (err: any) {
            const msg = err?.message || 'Errore sconosciuto';
            const userMsg = msg.includes('payment') ? 'Account Daily.co: metodo di pagamento mancante'
                : msg.includes('destroy') ? 'Sessione Daily.co corrotta — ricarica la pagina'
                    : msg.includes('Duplicate') ? 'Sessione duplicata — ricarica la pagina'
                        : `Connessione Daily.co fallita: ${msg}`;
            useDailyStore.getState().setDailyError(userMsg);
        } finally {
            joiningRef.current = false;
        }
    }, [spaceId, getContextRoomName, ensureRoom]);

    // ─── Leave current Daily.co context ────────────────────────
    const leaveDailyContext = useCallback(async () => {
        if (!callRef.current || !joinedRef.current) return;
        console.log('[Daily] 🔌 Leaving context (billing stopped)');
        try { await callRef.current.leave(); } catch { }
        joinedRef.current = false;
        roomUrlRef.current = null;
        currentRoomNameRef.current = null;
        gLocalTracks.clear();

        // Clear ALL remote participants from dailyStore to prevent stale tiles
        useDailyStore.getState().clearParticipants();
        useDailyStore.getState().setLocalStream(null);
        useDailyStore.getState().setConnected(false);
        useDailyStore.getState().setActiveContext('none', null);

        // Clear video streams from peers in avatarStore so tiles disappear
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
    }, []);

    // ─── Register global functions for proximity/rooms engine ──
    useEffect(() => {
        (window as any).__joinDailyContext = joinDailyContext;
        (window as any).__leaveDailyContext = leaveDailyContext;
        return () => {
            delete (window as any).__joinDailyContext;
            delete (window as any).__leaveDailyContext;
        };
    }, [joinDailyContext, leaveDailyContext]);

    // ─── MEDIA-TRIGGERED JOIN/LEAVE (core optimization) ─────
    // Daily connects ONLY when user enables mic/cam.
    // Rooms and proximity set state in avatarStore (visual only).
    // This effect reads that state to decide whether to join Daily.
    useEffect(() => {
        const anyMediaOn = isAudioOn || isVideoOn;
        const avatarStore = useAvatarStore.getState();
        const proximityGroupId = avatarStore.myProximityGroupId;
        const myRoomId = avatarStore.myRoomId;

        if (anyMediaOn) {
            // User wants media ON
            if (joinedRef.current) {
                // Already connected — just sync media state
                if (callRef.current) {
                    callRef.current.setLocalAudio(isAudioOn);
                    callRef.current.setLocalVideo(isVideoOn);
                }
            } else if (myRoomId) {
                // In a room → join room context
                joinDailyContext('room', myRoomId);
            } else if (proximityGroupId) {
                // Near someone → join proximity context
                joinDailyContext('proximity', proximityGroupId);
            }
            // If alone (no room, no proximity) → set up periodic retry below
        } else {
            // Both mic and cam OFF → ALWAYS leave Daily (stop billing!)
            if (joinedRef.current) {
                leaveDailyContext();
                console.log('[Daily] Both mic+cam OFF → left Daily (billing stopped)');
            }

            // Stop hardware tracks
            if (!isAudioOn) {
                const audioTrack = gLocalTracks.get('audio');
                if (audioTrack) {
                    audioTrack.stop();
                    gLocalTracks.delete('audio');
                }
            }
            if (!isVideoOn) {
                const videoTrack = gLocalTracks.get('video');
                if (videoTrack) {
                    videoTrack.stop();
                    gLocalTracks.delete('video');
                }
            }
            const liveTracks = Array.from(gLocalTracks.values()).filter(t => t.readyState === 'live');
            useDailyStore.getState().setLocalStream(liveTracks.length > 0 ? new MediaStream(liveTracks) : null);
        }
    }, [isAudioOn, isVideoOn, joinDailyContext, leaveDailyContext]);

    // ─── Retry connection when media is ON but Daily not joined ──
    // Catches the case where proximity group forms AFTER mic/cam toggle.
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
                joinDailyContext('room', myRoomId);
                clearInterval(retryInterval);
            } else if (myProximityGroupId) {
                joinDailyContext('proximity', myProximityGroupId);
                clearInterval(retryInterval);
            }
        }, ROOM_CHECK_INTERVAL);

        return () => clearInterval(retryInterval);
    }, [isAudioOn, isVideoOn, joinDailyContext]);

    // ─── Watch proximity group changes while media is ON ─────
    // If user has mic/cam on and walks away from everyone, disconnect.
    // If user has mic/cam on and walks near someone new, connect.
    useEffect(() => {
        const unsubscribe = useAvatarStore.subscribe((state, prevState) => {
            const anyMediaOn = useDailyStore.getState().isAudioOn || useDailyStore.getState().isVideoOn;
            if (!anyMediaOn) return; // No media = no Daily needed

            const newGroup = state.myProximityGroupId;
            const oldGroup = prevState.myProximityGroupId;
            const dailyStore = useDailyStore.getState();

            // Skip if in a room (rooms manage their own Daily connection below)
            if (state.myRoomId) return;

            if (newGroup && newGroup !== oldGroup) {
                // New proximity group while media is on → join Daily
                joinDailyContext('proximity', newGroup);
            } else if (!newGroup && oldGroup && dailyStore.activeContext === 'proximity') {
                // Left proximity while media is on → leave Daily
                leaveDailyContext();
                console.log('[Daily] Walked away with media on → left proximity');
            }
        });
        return unsubscribe;
    }, [joinDailyContext, leaveDailyContext]);

    // ─── Watch room changes while media is ON (debounced) ─────
    // Handles: enter room with mic on → join, leave room with mic on → leave/switch
    // Debounce prevents leave+join spam when walking between rooms quickly.
    const roomDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const unsubscribe = useAvatarStore.subscribe((state, prevState) => {
            const newRoomId = state.myRoomId;
            const oldRoomId = prevState.myRoomId;
            if (newRoomId === oldRoomId) return;

            const anyMediaOn = useDailyStore.getState().isAudioOn || useDailyStore.getState().isVideoOn;
            if (!anyMediaOn) return; // No media = no Daily needed, skip entirely

            // Clear pending debounce
            if (roomDebounceRef.current) {
                clearTimeout(roomDebounceRef.current);
                roomDebounceRef.current = null;
            }

            // Debounce 300ms: A→corridor→B in <300ms = skip corridor
            roomDebounceRef.current = setTimeout(() => {
                roomDebounceRef.current = null;
                // Re-check media (might have turned off during debounce)
                const stillMediaOn = useDailyStore.getState().isAudioOn || useDailyStore.getState().isVideoOn;
                if (!stillMediaOn) return;

                const currentRoomId = useAvatarStore.getState().myRoomId;

                if (currentRoomId) {
                    // Entered a room with media ON → join room Daily context
                    joinDailyContext('room', currentRoomId);
                    console.log('[Daily] Room entered with media → joining:', currentRoomId.slice(0, 8));
                } else {
                    // Left room with media ON → check proximity or leave
                    const proxGroup = useAvatarStore.getState().myProximityGroupId;
                    if (proxGroup) {
                        joinDailyContext('proximity', proxGroup);
                        console.log('[Daily] Left room with media → switched to proximity');
                    } else if (joinedRef.current) {
                        leaveDailyContext();
                        console.log('[Daily] Left room with media → no one nearby, left Daily');
                    }
                }
            }, 300);
        });
        return () => {
            unsubscribe();
            if (roomDebounceRef.current) clearTimeout(roomDebounceRef.current);
        };
    }, [joinDailyContext, leaveDailyContext]);


    // ─── Cleanup on unmount and page unload ─────────────────
    useEffect(() => {
        const handleUnload = () => {
            if (callRef.current) {
                try { callRef.current.leave(); callRef.current.destroy(); } catch { }
                callRef.current = null;
                (window as any).__dailyCall = null;
                joinedRef.current = false;
                joiningRef.current = false;
                roomUrlRef.current = null;
                gLocalTracks.clear();
                gDailyToSupabase.clear();
                gLastSubscribeState.clear();
            }
        };
        window.addEventListener('beforeunload', handleUnload);
        return () => {
            window.removeEventListener('beforeunload', handleUnload);
            handleUnload();
        };
    }, []);

    // Track subscriptions are now managed by useProximityAndRooms engine
    // (proximity-based audio/video subscription is handled there)

    // ─── No JSX — pure logic component ──────────────────────
    return null;
}
