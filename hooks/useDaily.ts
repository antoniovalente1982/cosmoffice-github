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

// ─── Module-level singleton — survives React Strict Mode ─────────
let gCall: DailyCall | null = null;
let gJoined = false;
let gJoining = false;
let gRoomUrl: string | null = null;
let gSpaceId: string | null = null;
const gPeers = new Map<string, DailyPeerInfo>();
// Track local tracks separately — participants().local has stale data at track-started time
const gLocalTracks = new Map<string, MediaStreamTrack>(); // kind → track

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

    // ─── Create or get room via API ──────────────────────────
    const ensureRoom = useCallback(async (roomName: string): Promise<string | null> => {
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
        gPeers.set(id, { sessionId: p.session_id, participantId: id, audioTrack: null, videoTrack: null, audioEnabled: !p.tracks.audio?.off, videoEnabled: !p.tracks.video?.off, userName: p.user_name || 'Anonymous' });
        console.log('[Daily] Peer joined:', p.user_name);
    }, []);

    const handleParticipantLeft = useCallback((ev: DailyEventObjectParticipantLeft | undefined) => {
        if (!ev?.participant) return;
        const id = ev.participant.user_id || ev.participant.session_id;
        document.getElementById(`daily-audio-${id}`)?.remove();
        gPeers.delete(id);
    }, []);

    const handleParticipantUpdated = useCallback((ev: DailyEventObjectParticipant | undefined) => {
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

        // ─── Local participant: directly build stream from tracks ───
        if (ev.participant.local) {
            console.log(`[Daily] Local track started: ${track.kind}, readyState: ${track.readyState}`);
            gLocalTracks.set(track.kind, track);
            // Build localStream from all known local tracks
            const liveTracks = Array.from(gLocalTracks.values()).filter(t => t.readyState === 'live');
            console.log('[Daily] Rebuilding localStream with', liveTracks.length, 'tracks');
            setLocalStream(liveTracks.length > 0 ? new MediaStream(liveTracks) : null);
            return;
        }

        // ─── Remote participant ───
        const id = ev.participant.user_id || ev.participant.session_id;
        const ex = gPeers.get(id);
        if (!ex) return;
        if (track.kind === 'audio') {
            ex.audioTrack = track;
            let el = document.getElementById(`daily-audio-${id}`) as HTMLAudioElement;
            if (!el) { el = document.createElement('audio'); el.id = `daily-audio-${id}`; el.autoplay = true; el.style.display = 'none'; document.body.appendChild(el); }
            el.srcObject = new MediaStream([track]);
        }
        if (track.kind === 'video') {
            ex.videoTrack = track;
            const ps = useOfficeStore.getState().peers[id];
            if (ps) updatePeer(id, { ...ps, videoEnabled: true, stream: new MediaStream([track]) });
        }
    }, [updatePeer, setLocalStream]);

    const handleTrackStopped = useCallback((ev: any) => {
        if (!ev?.participant) return;
        const track = ev.track as MediaStreamTrack;

        // ─── Local participant: remove from local tracks map ───
        if (ev.participant.local) {
            console.log(`[Daily] Local track stopped: ${track?.kind}`);
            if (track?.kind) gLocalTracks.delete(track.kind);
            const liveTracks = Array.from(gLocalTracks.values()).filter(t => t.readyState === 'live');
            setLocalStream(liveTracks.length > 0 ? new MediaStream(liveTracks) : null);
            return;
        }

        // ─── Remote participant ───
        const id = ev.participant.user_id || ev.participant.session_id;
        const ex = gPeers.get(id);
        if (!ex) return;
        if (track?.kind === 'audio') { ex.audioTrack = null; const el = document.getElementById(`daily-audio-${id}`); if (el) (el as HTMLAudioElement).srcObject = null; }
        if (track?.kind === 'video') { ex.videoTrack = null; const ps = useOfficeStore.getState().peers[id]; if (ps) updatePeer(id, { ...ps, videoEnabled: false, stream: null }); }
    }, [updatePeer, setLocalStream]);

    const handleError = useCallback((ev: any) => { console.error('[Daily] Error:', ev?.errorMsg || ev); }, []);

    // ─── Create call object (no join yet) ────────────────────
    useEffect(() => {
        if (!spaceId || !DAILY_DOMAIN) return;

        // Save spaceId for lazy join
        gSpaceId = spaceId;

        // Singleton: create call object once, but DON'T join any room
        if (gCall) {
            console.log('[Daily] Call object already exists');
            return;
        }

        try {
            const call = DailyIframe.createCallObject();
            call.on('participant-joined', handleParticipantJoined);
            call.on('participant-left', handleParticipantLeft);
            call.on('participant-updated', handleParticipantUpdated);
            call.on('track-started', handleTrackStarted);
            call.on('track-stopped', handleTrackStopped);
            call.on('error', handleError);
            gCall = call;
            console.log('[Daily] Call object created (idle — will join when mic/camera enabled)');
        } catch (err: any) {
            console.error('[Daily] Failed to create call object:', err?.message);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spaceId]);

    // ─── Lazy Join/Leave: connect only when mic or camera is ON ──
    useEffect(() => {
        if (!gCall || !spaceId || !DAILY_DOMAIN) return;

        const handleJoinLeave = async () => {
            if (needsDaily && !gJoined && !gJoining) {
                // User turned on mic or camera → JOIN Daily.co
                gJoining = true;
                try {
                    const roomName = getRoomName(myRoomId || undefined);
                    if (!roomName) { gJoining = false; return; }
                    const url = await ensureRoom(roomName);
                    if (!url) { gJoining = false; return; } // Error already set by ensureRoom

                    console.log('[Daily] 🔗 Connecting (mic/camera enabled)...');
                    useOfficeStore.getState().clearDailyError(); // Clear previous errors
                    const profile = useOfficeStore.getState().myProfile;
                    await gCall!.join({
                        url,
                        userName: profile?.display_name || profile?.full_name || 'Anonymous',
                        startVideoOff: !isVideoEnabled,
                        startAudioOff: !isMicEnabled,
                    });

                    gJoined = true;
                    gRoomUrl = url;
                    useOfficeStore.getState().clearDailyError();
                    console.log('[Daily] ✅ Joined room:', url);

                    // Explicitly enable audio/video AFTER join — Daily.co may not
                    // auto-start tracks despite startVideoOff/startAudioOff flags
                    if (isVideoEnabled) {
                        gCall!.setLocalVideo(true);
                        console.log('[Daily] Forced video ON after join');
                    }
                    if (isMicEnabled) {
                        gCall!.setLocalAudio(true);
                        console.log('[Daily] Forced audio ON after join');
                    }

                    // Poll for tracks: Daily.co populates persistentTrack asynchronously
                    let attempts = 0;
                    const maxAttempts = 10;
                    const syncInterval = setInterval(() => {
                        if (!gCall || !gJoined || attempts >= maxAttempts) {
                            clearInterval(syncInterval);
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
                            const liveTracks = Array.from(gLocalTracks.values()).filter(t => t.readyState === 'live');
                            console.log('[Daily] Sync poll: rebuilding localStream with', liveTracks.length, 'tracks');
                            setLocalStream(liveTracks.length > 0 ? new MediaStream(liveTracks) : null);
                        }

                        // Stop polling once we have all expected tracks
                        const hasAllTracks = (!isVideoEnabled || gLocalTracks.has('video')) &&
                            (!isMicEnabled || gLocalTracks.has('audio'));
                        if (hasAllTracks) {
                            console.log('[Daily] Sync poll: all tracks found, stopping poll');
                            clearInterval(syncInterval);
                        }
                    }, 500);
                } catch (err: any) {
                    const msg = err?.message || 'Errore sconosciuto';
                    console.error('[Daily] Join failed:', msg);
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
                await gCall!.join({
                    url,
                    userName: profile?.display_name || profile?.full_name || 'Anonymous',
                    startVideoOff: !state.isVideoEnabled,
                    startAudioOff: !state.isMicEnabled,
                });
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
                gJoined = false;
                gRoomUrl = null;
            }
        };
        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, []);

    // ─── Spatial audio (runs only when connected) ────────────
    useEffect(() => {
        if (proximityIntervalRef.current) clearInterval(proximityIntervalRef.current);
        proximityIntervalRef.current = setInterval(() => {
            if (!gCall || !gJoined) return;
            const state = useOfficeStore.getState();
            const myPos = state.myPosition;
            gPeers.forEach((info, id) => {
                const peer = state.peers[id];
                if (!peer) return;
                const dx = myPos.x - peer.position.x, dy = myPos.y - peer.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                let vol = Math.max(0, 1 - dist / PROXIMITY_RANGE);
                if (state.myRoomId !== peer.roomId) vol *= 0.3;
                if (!state.isRemoteAudioEnabled) vol = 0;
                const el = document.getElementById(`daily-audio-${id}`) as HTMLAudioElement;
                if (el) el.volume = Math.min(1, Math.max(0, vol));
                try {
                    if (dist > PROXIMITY_RANGE * 1.5) gCall!.updateParticipant(info.sessionId, { setSubscribedTracks: { audio: false, video: false } });
                    else gCall!.updateParticipant(info.sessionId, { setSubscribedTracks: { audio: true, video: dist < PROXIMITY_RANGE } });
                } catch { /* peer left */ }
            });
        }, ROOM_CHECK_INTERVAL);
        return () => { if (proximityIntervalRef.current) clearInterval(proximityIntervalRef.current); };
    }, [myPosition]);

    // ─── Public API ──────────────────────────────────────────
    const startScreenShare = useCallback(async () => { if (gCall && gJoined) { try { gCall.startScreenShare(); } catch (e) { console.error(e); } } }, []);
    const stopScreenShare = useCallback(async () => { if (gCall && gJoined) { try { gCall.stopScreenShare(); } catch (e) { console.error(e); } } }, []);
    const setAudioDevice = useCallback(async (id: string) => { if (gCall) await gCall.setInputDevicesAsync({ audioDeviceId: id }); }, []);
    const setVideoDevice = useCallback(async (id: string) => { if (gCall) await gCall.setInputDevicesAsync({ videoDeviceId: id }); }, []);

    return { isConnected: gJoined, startScreenShare, stopScreenShare, setAudioDevice, setVideoDevice, callObject: gCall };
}
