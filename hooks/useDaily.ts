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
const DAILY_DOMAIN = process.env.NEXT_PUBLIC_DAILY_DOMAIN || 'antoniovalente.daily.co';
const PROXIMITY_RANGE = 2000; // World-units — must be large enough for users to hear each other across the office
const ROOM_CHECK_INTERVAL = 1500; // Was 500ms — reduced to save CPU
const TRACK_SYNC_POLL_MS = 100;     // Was 500ms — faster track detection
const TRACK_SYNC_MAX_ATTEMPTS = 30; // ~3s max wait at 100ms intervals

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

// ─── Module-level singleton — survives React Strict Mode ─────────
let gCall: DailyCall | null = null;
let gJoined = false;
let gJoining = false;
let gRoomUrl: string | null = null;
let gSpaceId: string | null = null;
const gPeers = new Map<string, DailyPeerInfo>();
// Track local tracks separately — participants().local has stale data at track-started time
const gLocalTracks = new Map<string, MediaStreamTrack>(); // kind → track
// ─── Room URL cache — avoids redundant API calls ─────────────────
const gRoomUrlCache = new Map<string, { url: string; ts: number }>();
const ROOM_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
// ─── Instant preview stream (getUserMedia before Daily join completes)
let gPreviewStream: MediaStream | null = null;
// ─── Daily session_id → Supabase user_id mapping ─────────────────
const gDailyToSupabase = new Map<string, string>();
// ─── Last subscribe state per peer (avoid redundant updateParticipant calls)
const gLastSubscribeState = new Map<string, string>();

export function useDaily(spaceId: string | null) {
    const proximityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const {
        myPosition, myRoomId, isMicEnabled, isVideoEnabled,
        setLocalStream, setSpeaking, updatePeer,
    } = useOfficeStore();

    // Whether the user needs Daily.co active (mic or camera on)
    const needsDaily = isMicEnabled || isVideoEnabled;

    // ─── Room name (short, fits Daily's 41-char limit) ───────
    const getRoomName = useCallback(
        (roomId?: string) => {
            if (!spaceId) return null;
            const s = spaceId.slice(0, 8);
            return roomId ? `co-${s}-r-${roomId.slice(0, 8)}` : `co-${s}-lobby`;
        },
        [spaceId]
    );

    // ─── Create or get room via API (with cache) ─────────────
    const ensureRoom = useCallback(async (roomName: string): Promise<string | null> => {
        // Check cache first — avoids ~300-800ms API round-trip
        const cached = gRoomUrlCache.get(roomName);
        if (cached && (Date.now() - cached.ts) < ROOM_CACHE_TTL_MS) {
            console.log(`[Daily] Room cache hit: ${roomName}`);
            return cached.url;
        }

        try {
            const res = await fetch('/api/daily/room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName }),
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const detail = errData?.details?.info || errData?.error || `HTTP ${res.status}`;
                console.error('[Daily] Room API error:', detail);
                useOfficeStore.getState().setDailyError(`Errore creazione stanza Daily.co: ${detail}`);
                return null;
            }
            const data = await res.json();
            console.log(`[Daily] Room ready: ${data.name} (${data.created ? 'new' : 'existing'})`);
            // Cache the URL
            gRoomUrlCache.set(roomName, { url: data.url, ts: Date.now() });
            return data.url;
        } catch (err: any) {
            const msg = err?.message?.includes('ENOTFOUND') || err?.message?.includes('fetch')
                ? 'Connessione internet assente o instabile'
                : err?.message || 'Errore sconosciuto';
            console.error('[Daily] Room API failed:', msg);
            useOfficeStore.getState().setDailyError(`Impossibile raggiungere Daily.co: ${msg}`);
            return null;
        }
    }, []);

    // ─── Update local stream in store ────────────────────────
    const updateLocalStream = useCallback(
        (p: DailyParticipant) => {
            const tracks: MediaStreamTrack[] = [];
            const audioTrack = p.tracks.audio?.persistentTrack;
            const videoTrack = p.tracks.video?.persistentTrack;

            // Include tracks that are alive — Daily.co's `off` can be an object or boolean
            if (audioTrack && audioTrack.readyState === 'live') {
                tracks.push(audioTrack);
            }
            if (videoTrack && videoTrack.readyState === 'live') {
                tracks.push(videoTrack);
            }

            console.log('[Daily] updateLocalStream:', {
                hasAudio: !!audioTrack, audioState: audioTrack?.readyState, audioOff: p.tracks.audio?.off,
                hasVideo: !!videoTrack, videoState: videoTrack?.readyState, videoOff: p.tracks.video?.off,
                totalTracks: tracks.length,
            });

            setLocalStream(tracks.length > 0 ? new MediaStream(tracks) : null);
        },
        [setLocalStream]
    );

    // ─── Event Handlers ──────────────────────────────────────
    const handleParticipantJoined = useCallback((ev: DailyEventObjectParticipant | undefined) => {
        if (!ev?.participant || ev.participant.local) return;
        const p = ev.participant;
        const id = p.user_id || p.session_id;
        // Extract Supabase user ID from userName (format: "DisplayName|supabaseId")
        let supabaseId: string | null = null;
        if (p.user_name?.includes('|')) {
            const parts = p.user_name.split('|');
            supabaseId = parts[parts.length - 1];
        }
        // Also try userData as backup
        if (!supabaseId) {
            supabaseId = (p as any).userData?.supabaseUserId || null;
        }
        if (supabaseId) {
            gDailyToSupabase.set(id, supabaseId);
            gDailyToSupabase.set(p.session_id, supabaseId);
        }
        const displayName = p.user_name?.split('|')[0] || 'Anonymous';
        gPeers.set(id, { sessionId: p.session_id, participantId: id, audioTrack: null, videoTrack: null, audioEnabled: !p.tracks.audio?.off, videoEnabled: !p.tracks.video?.off, userName: displayName });
        console.log('[Daily] Peer joined:', displayName, supabaseId ? `(supabase: ${supabaseId})` : '(no supabase mapping)');
    }, []);

    const handleParticipantLeft = useCallback((ev: DailyEventObjectParticipantLeft | undefined) => {
        if (!ev?.participant) return;
        const id = ev.participant.user_id || ev.participant.session_id;
        const supabaseId = gDailyToSupabase.get(id) || id;
        // Remove audio elements for both IDs
        document.getElementById(`daily-audio-${supabaseId}`)?.remove();
        document.getElementById(`daily-audio-${id}`)?.remove();
        gPeers.delete(id);
        gDailyToSupabase.delete(id);
        gLastSubscribeState.delete(id);
    }, []);

    const handleParticipantUpdated = useCallback((ev: DailyEventObjectParticipant | undefined) => {
        if (!ev?.participant || ev.participant.local) return;
        const p = ev.participant;
        const id = p.user_id || p.session_id;
        // Retry Supabase ID extraction (userData may arrive late)
        if (!gDailyToSupabase.has(id)) {
            let supabaseId: string | null = null;
            if (p.user_name?.includes('|')) {
                supabaseId = p.user_name.split('|').pop() || null;
            }
            if (!supabaseId) {
                supabaseId = (p as any).userData?.supabaseUserId || null;
            }
            if (supabaseId) {
                gDailyToSupabase.set(id, supabaseId);
                gDailyToSupabase.set(p.session_id, supabaseId);
                console.log('[Daily] Late mapping resolved:', id, '->', supabaseId);
            }
        }
        const ex = gPeers.get(id);
        if (ex) {
            ex.audioEnabled = !p.tracks.audio?.off;
            ex.videoEnabled = !p.tracks.video?.off;
        }
    }, []);
    if (!ev?.participant) return;
    const p = ev.participant;
    if (p.local) { updateLocalStream(p); return; }
    const id = p.user_id || p.session_id;
    const ex = gPeers.get(id);
    if (ex) { ex.audioEnabled = !p.tracks.audio?.off; ex.videoEnabled = !p.tracks.video?.off; }
    const ps = useOfficeStore.getState().peers[id];
    if (ps) updatePeer(id, { ...ps, audioEnabled: !p.tracks.audio?.off, videoEnabled: !p.tracks.video?.off });
}, [updatePeer, updateLocalStream]);

const handleTrackStarted = useCallback((ev: any) => {
    if (!ev?.participant) return;
    const track = ev.track as MediaStreamTrack;
    if (!track) return;

    // Determine if this is a screenVideo track
    const isScreenTrack = ev.type === 'screenVideo' ||
        ev.participant.tracks?.screenVideo?.persistentTrack === track;

    // ─── Local participant: directly build stream from tracks ───
    if (ev.participant.local) {
        if (isScreenTrack) {
            // Local screen share track — add to screen streams store
            console.log('[Daily] Local screen share track started');
            const screenStream = new MediaStream([track]);
            useOfficeStore.getState().addScreenStream(screenStream);
            // Auto-remove when track ends
            track.addEventListener('ended', () => {
                useOfficeStore.getState().removeScreenStream(screenStream.id);
            });
            return;
        }
        console.log(`[Daily] Local track started: ${track.kind}, readyState: ${track.readyState}`);
        gLocalTracks.set(track.kind, track);
        // Build localStream from all known local tracks
        const liveTracks = Array.from(gLocalTracks.values()).filter(t => t.readyState === 'live');
        console.log('[Daily] Rebuilding localStream with', liveTracks.length, 'tracks');
        setLocalStream(liveTracks.length > 0 ? new MediaStream(liveTracks) : null);
        return;
    }

    // ─── Remote participant ───
    const dailyId = ev.participant.user_id || ev.participant.session_id;
    const supabaseId = gDailyToSupabase.get(dailyId) || dailyId;
    const ex = gPeers.get(dailyId);
    if (!ex) return;

    if (isScreenTrack) {
        // Remote screen share — add as a screen stream visible to this user
        console.log('[Daily] Remote screen share track started from:', ex.userName);
        const screenStream = new MediaStream([track]);
        useOfficeStore.getState().addScreenStream(screenStream);
        track.addEventListener('ended', () => {
            useOfficeStore.getState().removeScreenStream(screenStream.id);
        });
        return;
    }

    if (track.kind === 'audio') {
        ex.audioTrack = track;
        // Use Supabase ID for audio element so useSpatialAudio can find it
        const audioElId = `daily-audio-${supabaseId}`;
        let el = document.getElementById(audioElId) as HTMLAudioElement;
        if (!el) { el = document.createElement('audio'); el.id = audioElId; el.autoplay = true; el.style.display = 'none'; document.body.appendChild(el); }
        el.srcObject = new MediaStream([track]);
    }
    if (track.kind === 'video') {
        ex.videoTrack = track;
        // Map to Supabase peer ID for the store
        const ps = useOfficeStore.getState().peers[supabaseId];
        if (ps) {
            updatePeer(supabaseId, { ...ps, videoEnabled: true, stream: new MediaStream([track]) });
        } else {
            // Fallback: try with Daily ID
            const psFallback = useOfficeStore.getState().peers[dailyId];
            if (psFallback) updatePeer(dailyId, { ...psFallback, videoEnabled: true, stream: new MediaStream([track]) });
        }
    }
}, [updatePeer, setLocalStream]);

const handleTrackStopped = useCallback((ev: any) => {
    if (!ev?.participant) return;
    const track = ev.track as MediaStreamTrack;
    const isScreenTrack = ev.type === 'screenVideo' ||
        ev.participant.tracks?.screenVideo?.persistentTrack === track;

    // ─── Local participant: remove from local tracks map ───
    if (ev.participant.local) {
        if (isScreenTrack) {
            console.log('[Daily] Local screen share track stopped');
            // Screen stream removal is handled by the 'ended' event listener
            return;
        }
        console.log(`[Daily] Local track stopped: ${track?.kind}`);
        if (track?.kind) gLocalTracks.delete(track.kind);
        const liveTracks = Array.from(gLocalTracks.values()).filter(t => t.readyState === 'live');
        setLocalStream(liveTracks.length > 0 ? new MediaStream(liveTracks) : null);
        return;
    }

    // ─── Remote participant ───
    if (isScreenTrack) {
        console.log('[Daily] Remote screen share track stopped');
        // Screen stream removal is handled by the 'ended' event listener
        return;
    }
    const dailyId = ev.participant.user_id || ev.participant.session_id;
    const supabaseId = gDailyToSupabase.get(dailyId) || dailyId;
    const ex = gPeers.get(dailyId);
    if (!ex) return;
    if (track?.kind === 'audio') {
        ex.audioTrack = null;
        // Try both Supabase and Daily IDs for audio element
        const el = document.getElementById(`daily-audio-${supabaseId}`) || document.getElementById(`daily-audio-${dailyId}`);
        if (el) (el as HTMLAudioElement).srcObject = null;
    }
    if (track?.kind === 'video') {
        ex.videoTrack = null;
        const ps = useOfficeStore.getState().peers[supabaseId] || useOfficeStore.getState().peers[dailyId];
        const peerId = useOfficeStore.getState().peers[supabaseId] ? supabaseId : dailyId;
        if (ps) updatePeer(peerId, { ...ps, videoEnabled: false, stream: null });
    }
}, [updatePeer, setLocalStream]);

const handleError = useCallback((ev: any) => { console.error('[Daily] Error:', ev?.errorMsg || ev); }, []);

// ─── Save spaceId — no SDK or API calls at mount ─────────
useEffect(() => {
    if (!spaceId || !DAILY_DOMAIN) return;
    gSpaceId = spaceId;
    console.log('[Daily] SpaceId saved (idle — no SDK loaded until mic/camera enabled)');
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [spaceId]);

// ─── Instant preview: grab local media BEFORE Daily.co finishes joining ──
const startInstantPreview = useCallback(async () => {
    try {
        const state = useOfficeStore.getState();
        const constraints: MediaStreamConstraints = {};
        if (state.isMicEnabled) constraints.audio = state.selectedAudioInput ? { deviceId: { exact: state.selectedAudioInput } } : true;
        if (state.isVideoEnabled) constraints.video = state.selectedVideoInput ? { deviceId: { exact: state.selectedVideoInput } } : true;
        if (!constraints.audio && !constraints.video) return;

        console.log('[Daily] 🚀 Instant preview: requesting getUserMedia...');
        gPreviewStream = await navigator.mediaDevices.getUserMedia(constraints);
        // Show preview immediately — Daily.co tracks will replace this when ready
        setLocalStream(gPreviewStream);
        console.log('[Daily] 🚀 Instant preview active (tracks:', gPreviewStream.getTracks().length + ')');
    } catch (err) {
        console.warn('[Daily] Instant preview failed (will fall back to Daily.co):', err);
        gPreviewStream = null;
    }
}, [setLocalStream]);

const stopInstantPreview = useCallback(() => {
    if (gPreviewStream) {
        gPreviewStream.getTracks().forEach(t => t.stop());
        gPreviewStream = null;
    }
}, []);

// ─── Lazy Join/Leave: connect only when mic or camera is ON ──
useEffect(() => {
    if (!spaceId || !DAILY_DOMAIN) return;

    const handleJoinLeave = async () => {
        if (needsDaily && !gJoined && !gJoining) {
            // User turned on mic or camera → CREATE call object (if needed) + JOIN
            gJoining = true;

            // Step 0: Create call object on-demand (deferred from mount)
            if (!gCall) {
                try {
                    const call = DailyIframe.createCallObject();
                    call.on('participant-joined', handleParticipantJoined);
                    call.on('participant-left', handleParticipantLeft);
                    call.on('participant-updated', handleParticipantUpdated);
                    call.on('track-started', handleTrackStarted);
                    call.on('track-stopped', handleTrackStopped);
                    call.on('error', handleError);
                    gCall = call;
                    (window as any).__dailyCall = call;
                    console.log('[Daily] Call object created on-demand');
                } catch (err: any) {
                    console.error('[Daily] Failed to create call object:', err?.message);
                    gJoining = false;
                    return;
                }
            }

            // Step 1: Instant local preview (shows video/plays audio within ~50-200ms)
            await startInstantPreview();

            try {
                // Step 2: Get room URL (first call may take ~300ms, subsequent ones are cached)
                const roomName = getRoomName(myRoomId || undefined);
                if (!roomName) { gJoining = false; return; }
                const url = await ensureRoom(roomName);
                if (!url) { gJoining = false; return; }

                // Step 3: Join Daily.co room
                console.log('[Daily] 🔗 Connecting (mic/camera enabled)...');
                useOfficeStore.getState().clearDailyError();
                const profile = useOfficeStore.getState().myProfile;
                // Get Supabase user ID for peer mapping
                const supabaseUserId = profile?.id || null;
                await gCall!.join({
                    url,
                    userName: `${profile?.display_name || profile?.full_name || 'Anonymous'}|${supabaseUserId || 'unknown'}`,
                    startVideoOff: !isVideoEnabled,
                    startAudioOff: !isMicEnabled,
                    ...(supabaseUserId ? { userData: { supabaseUserId } } : {}),
                } as any);

                gJoined = true;
                gRoomUrl = url;
                useOfficeStore.getState().clearDailyError();
                console.log('[Daily] ✅ Joined room:', url);

                // Explicitly enable audio/video AFTER join
                if (isVideoEnabled) {
                    gCall!.setLocalVideo(true);
                    console.log('[Daily] Forced video ON after join');
                }
                if (isMicEnabled) {
                    gCall!.setLocalAudio(true);
                    console.log('[Daily] Forced audio ON after join');
                }

                // Step 4: Poll for Daily.co tracks to replace preview stream
                let attempts = 0;
                const syncInterval = setInterval(() => {
                    if (!gCall || !gJoined || attempts >= TRACK_SYNC_MAX_ATTEMPTS) {
                        clearInterval(syncInterval);
                        // If Daily tracks arrived, stop preview; otherwise keep it
                        if (gLocalTracks.size > 0) stopInstantPreview();
                        return;
                    }
                    attempts++;
                    const local = gCall.participants()?.local;
                    if (!local) return;

                    const audioTrack = local.tracks?.audio?.persistentTrack;
                    const videoTrack = local.tracks?.video?.persistentTrack;

                    let changed = false;
                    if (audioTrack && audioTrack.readyState === 'live' && !gLocalTracks.has('audio')) {
                        gLocalTracks.set('audio', audioTrack);
                        changed = true;
                        console.log('[Daily] Sync poll: found audio track (attempt', attempts + ')');
                    }
                    if (videoTrack && videoTrack.readyState === 'live' && !gLocalTracks.has('video')) {
                        gLocalTracks.set('video', videoTrack);
                        changed = true;
                        console.log('[Daily] Sync poll: found video track (attempt', attempts + ')');
                    }

                    if (changed) {
                        // Daily.co tracks ready — replace preview stream with real tracks
                        stopInstantPreview();
                        const liveTracks = Array.from(gLocalTracks.values()).filter(t => t.readyState === 'live');
                        console.log('[Daily] Sync poll: replacing preview → Daily tracks (' + liveTracks.length + ')');
                        setLocalStream(liveTracks.length > 0 ? new MediaStream(liveTracks) : null);
                    }

                    // Stop polling once we have all expected tracks
                    const hasAllTracks = (!isVideoEnabled || gLocalTracks.has('video')) &&
                        (!isMicEnabled || gLocalTracks.has('audio'));
                    if (hasAllTracks) {
                        console.log('[Daily] Sync poll: all tracks found, stopping poll');
                        clearInterval(syncInterval);
                    }
                }, TRACK_SYNC_POLL_MS);
            } catch (err: any) {
                const msg = err?.message || 'Errore sconosciuto';
                console.error('[Daily] Join failed:', msg);
                stopInstantPreview();
                const userMsg = msg.includes('payment') ? 'Account Daily.co: metodo di pagamento mancante'
                    : msg.includes('destroy') ? 'Sessione Daily.co corrotta — ricarica la pagina'
                        : msg.includes('Duplicate') ? 'Sessione duplicata — ricarica la pagina'
                            : `Connessione Daily.co fallita: ${msg}`;
                useOfficeStore.getState().setDailyError(userMsg);
            } finally {
                gJoining = false;
            }
        } else if (!needsDaily && gJoined && !gJoining) {
            // User turned off BOTH mic and camera → LEAVE to save minutes
            console.log('[Daily] 🔌 Disconnecting (both mic & camera off)...');
            stopInstantPreview();
            try {
                await gCall!.leave();
            } catch { /* ignore */ }
            gJoined = false;
            gRoomUrl = null;
            gLocalTracks.clear();
            setLocalStream(null);
            console.log('[Daily] ⏸️ Left room — saving participant-minutes');
        }
    };

    handleJoinLeave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [needsDaily, spaceId]);

// ─── Sync mic/video changes while connected ─────────────
useEffect(() => {
    if (!gCall || !gJoined) return;
    gCall.setLocalAudio(isMicEnabled);
    console.log('[Daily] Audio:', isMicEnabled ? 'ON' : 'OFF');
}, [isMicEnabled]);

useEffect(() => {
    if (!gCall || !gJoined) return;
    gCall.setLocalVideo(isVideoEnabled);
    console.log('[Daily] Video:', isVideoEnabled ? 'ON' : 'OFF');
}, [isVideoEnabled]);

// ─── Room switching (only when connected) ────────────────
useEffect(() => {
    if (!gCall || !gJoined || !DAILY_DOMAIN) return;
    const switchRoom = async () => {
        const roomName = getRoomName(myRoomId || undefined);
        if (!roomName) return;
        const url = await ensureRoom(roomName);
        if (!url || (gRoomUrl === url && gJoined)) return;

        gJoining = true;
        try {
            if (gJoined) { await gCall!.leave(); gJoined = false; gRoomUrl = null; }
            const profile = useOfficeStore.getState().myProfile;
            const state = useOfficeStore.getState();
            const supabaseUserId = profile?.id || null;
            await gCall!.join({
                url,
                userName: `${profile?.display_name || profile?.full_name || 'Anonymous'}|${supabaseUserId || 'unknown'}`,
                startVideoOff: !state.isVideoEnabled,
                startAudioOff: !state.isMicEnabled,
                ...(supabaseUserId ? { userData: { supabaseUserId } } : {}),
            } as any);
            gJoined = true;
            gRoomUrl = url;
            console.log('[Daily] ✅ Switched room:', url);
        } catch (err: any) { console.error('[Daily] Room switch failed:', err?.message); }
        finally { gJoining = false; }
    };
    switchRoom();
}, [myRoomId, getRoomName, ensureRoom]);

// ─── Cleanup on page unload ──────────────────────────────
useEffect(() => {
    const handleUnload = () => {
        if (gCall) {
            try { gCall.leave(); gCall.destroy(); } catch { /* ignore */ }
            gCall = null;
            (window as any).__dailyCall = null;
            gJoined = false;
            gRoomUrl = null;
        }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
}, []);

// ─── Spatial audio (runs only when connected) ────────────
useEffect(() => {
    // Don't even start the interval if not connected
    if (!gJoined || !gCall) {
        if (proximityIntervalRef.current) {
            clearInterval(proximityIntervalRef.current);
            proximityIntervalRef.current = null;
        }
        return;
    }

    if (proximityIntervalRef.current) clearInterval(proximityIntervalRef.current);
    proximityIntervalRef.current = setInterval(() => {
        if (!gCall || !gJoined) {
            if (proximityIntervalRef.current) clearInterval(proximityIntervalRef.current);
            proximityIntervalRef.current = null;
            return;
        }
        const state = useOfficeStore.getState();
        const myPos = state.myPosition;
        gPeers.forEach((info, id) => {
            // Resolve Supabase ID for looking up peer in presence store
            const supabaseId = gDailyToSupabase.get(id) || id;
            const peer = state.peers[supabaseId] || state.peers[id];
            if (!peer) return;
            const dx = myPos.x - peer.position.x, dy = myPos.y - peer.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            let vol = Math.max(0, 1 - dist / PROXIMITY_RANGE);
            if (state.myRoomId !== peer.roomId) vol *= 0.3;
            if (!state.isRemoteAudioEnabled) vol = 0;
            // Use Supabase ID for audio element
            const el = document.getElementById(`daily-audio-${supabaseId}`) as HTMLAudioElement;
            if (el) el.volume = Math.min(1, Math.max(0, vol));
            // Only update subscriptions if state changed (avoid redundant API calls)
            const wantAudio = dist <= PROXIMITY_RANGE * 1.5;
            const wantVideo = dist < PROXIMITY_RANGE;
            const subKey = `${wantAudio}:${wantVideo}`;
            const lastSub = gLastSubscribeState.get(id);
            if (lastSub !== subKey) {
                gLastSubscribeState.set(id, subKey);
                try {
                    gCall!.updateParticipant(info.sessionId, {
                        setSubscribedTracks: { audio: wantAudio, video: wantVideo }
                    });
                } catch { /* peer left */ }
            }
        });
    }, ROOM_CHECK_INTERVAL);
    return () => { if (proximityIntervalRef.current) clearInterval(proximityIntervalRef.current); };
}, [myPosition, needsDaily]);

// ─── Public API ──────────────────────────────────────────
const startScreenShare = useCallback(async () => { if (gCall && gJoined) { try { gCall.startScreenShare(); } catch (e) { console.error(e); } } }, []);
const stopScreenShare = useCallback(async () => { if (gCall && gJoined) { try { gCall.stopScreenShare(); } catch (e) { console.error(e); } } }, []);
const setAudioDevice = useCallback(async (id: string) => { if (gCall) await gCall.setInputDevicesAsync({ audioDeviceId: id }); }, []);
const setVideoDevice = useCallback(async (id: string) => { if (gCall) await gCall.setInputDevicesAsync({ videoDeviceId: id }); }, []);

return { isConnected: gJoined, startScreenShare, stopScreenShare, setAudioDevice, setVideoDevice, callObject: gCall };
}
