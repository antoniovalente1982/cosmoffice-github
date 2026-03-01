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
const ROOM_CACHE_TTL_MS = 10 * 60 * 1000;

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
    const proximityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Read media toggles from daily store
    const isAudioOn = useDailyStore(s => s.isAudioOn);
    const isVideoOn = useDailyStore(s => s.isVideoOn);

    // ─── Room name (fits Daily's 41-char limit) ─────────────
    const getRoomName = useCallback((roomId?: string) => {
        if (!spaceId) return null;
        const s = spaceId.slice(0, 8);
        return roomId ? `co-${s}-r-${roomId.slice(0, 8)}` : `co-${s}-lobby`;
    }, [spaceId]);

    // ─── Create or get room via API (with cache) ────────────
    const ensureRoom = useCallback(async (roomName: string): Promise<string | null> => {
        const cached = gRoomUrlCache.get(roomName);
        if (cached && (Date.now() - cached.ts) < ROOM_CACHE_TTL_MS) return cached.url;

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
        }
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
        }
        if (track.kind === 'video') {
            // Update peer with video stream in avatar store
            const avatarStore = useAvatarStore.getState();
            const ps = avatarStore.peers[supabaseId] || avatarStore.peers[dailyId];
            const peerId = avatarStore.peers[supabaseId] ? supabaseId : dailyId;
            if (ps) useAvatarStore.getState().updatePeer(peerId, { ...ps, videoEnabled: true, stream: new MediaStream([track]) });
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
        }
        if (track?.kind === 'video') {
            const avatarStore = useAvatarStore.getState();
            const ps = avatarStore.peers[supabaseId] || avatarStore.peers[dailyId];
            const peerId = avatarStore.peers[supabaseId] ? supabaseId : dailyId;
            if (ps) useAvatarStore.getState().updatePeer(peerId, { ...ps, videoEnabled: false, stream: null });
        }
    }, []);

    const handleError = useCallback((ev: any) => {
        console.error('[Daily] Error:', ev?.errorMsg || ev);
        useDailyStore.getState().setDailyError(ev?.errorMsg || 'Errore Daily.co sconosciuto');
    }, []);

    const needsDaily = isAudioOn || isVideoOn;

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
            call.on('error', handleError);
            callRef.current = call;
            (window as any).__dailyCall = call;
            console.log('[Daily] Call object pre-created (no billing)');
        } catch (err: any) {
            console.error('[Daily] Failed to create call object:', err?.message);
        }
    }, [spaceId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Pre-cache room URL on mount (FREE — just an API call) ─
    useEffect(() => {
        if (!spaceId) return;
        const avatarState = useAvatarStore.getState();
        const roomName = getRoomName(avatarState.myRoomId || undefined);
        if (roomName) {
            ensureRoom(roomName).then(url => {
                if (url) console.log('[Daily] Room URL pre-cached (no billing)');
            });
        }
    }, [spaceId, getRoomName, ensureRoom]);

    // ─── Join/Leave based on mic/camera (PAID — billing starts here) ─
    useEffect(() => {
        if (!spaceId || !DAILY_DOMAIN || !callRef.current) return;

        const handleJoinLeave = async () => {
            if (needsDaily && !joinedRef.current && !joiningRef.current) {
                joiningRef.current = true;

                try {
                    const avatarState = useAvatarStore.getState();
                    const roomName = getRoomName(avatarState.myRoomId || undefined);
                    if (!roomName) { joiningRef.current = false; return; }
                    const url = await ensureRoom(roomName);
                    if (!url) { joiningRef.current = false; return; }

                    useDailyStore.getState().clearDailyError();
                    const profile = avatarState.myProfile;
                    const supabaseUserId = profile?.id || null;

                    await callRef.current!.join({
                        url,
                        userName: `${profile?.display_name || profile?.full_name || 'Anonymous'}|${supabaseUserId || 'unknown'}`,
                        startVideoOff: !isVideoOn,
                        startAudioOff: !isAudioOn,
                        ...(supabaseUserId ? { userData: { supabaseUserId } } : {}),
                    } as any);

                    joinedRef.current = true;
                    roomUrlRef.current = url;
                    useDailyStore.getState().setConnected(true);
                    useDailyStore.getState().clearDailyError();
                    console.log('[Daily] ✅ Joined room (billing started):', url);

                    if (isVideoOn) callRef.current!.setLocalVideo(true);
                    if (isAudioOn) callRef.current!.setLocalAudio(true);

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
                        const dailyState = useDailyStore.getState();
                        const hasAll = (!dailyState.isVideoOn || gLocalTracks.has('video')) && (!dailyState.isAudioOn || gLocalTracks.has('audio'));
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

            } else if (!needsDaily && joinedRef.current && !joiningRef.current) {
                console.log('[Daily] 🔌 Disconnecting (billing stopped)');
                try { await callRef.current!.leave(); } catch { }
                joinedRef.current = false;
                roomUrlRef.current = null;
                gLocalTracks.clear();
                useDailyStore.getState().setLocalStream(null);
                useDailyStore.getState().setConnected(false);
            }
        };

        handleJoinLeave();
    }, [needsDaily, spaceId]);  // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Sync mic/video while connected ─────────────────────
    useEffect(() => {
        if (!callRef.current || !joinedRef.current) return;
        callRef.current.setLocalAudio(isAudioOn);
    }, [isAudioOn]);

    useEffect(() => {
        if (!callRef.current || !joinedRef.current) return;
        callRef.current.setLocalVideo(isVideoOn);
    }, [isVideoOn]);

    // ─── Room switching ─────────────────────────────────────
    const myRoomId = useAvatarStore(s => s.myRoomId);
    useEffect(() => {
        if (!callRef.current || !joinedRef.current || !DAILY_DOMAIN) return;
        const switchRoom = async () => {
            const roomName = getRoomName(myRoomId || undefined);
            if (!roomName) return;
            const url = await ensureRoom(roomName);
            if (!url || (roomUrlRef.current === url && joinedRef.current)) return;

            joiningRef.current = true;
            try {
                if (joinedRef.current) { await callRef.current!.leave(); joinedRef.current = false; roomUrlRef.current = null; }
                const avatarState = useAvatarStore.getState();
                const profile = avatarState.myProfile;
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
                useDailyStore.getState().setConnected(true);
            } catch (err: any) {
                console.error('[Daily] Room switch failed:', err?.message);
            } finally {
                joiningRef.current = false;
            }
        };
        switchRoom();
    }, [myRoomId, getRoomName, ensureRoom]);

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

    // ─── Track subscription management ──────────────────────
    useEffect(() => {
        if (!joinedRef.current || !callRef.current) {
            if (proximityIntervalRef.current) { clearInterval(proximityIntervalRef.current); proximityIntervalRef.current = null; }
            return;
        }
        if (proximityIntervalRef.current) clearInterval(proximityIntervalRef.current);
        proximityIntervalRef.current = setInterval(() => {
            if (!callRef.current || !joinedRef.current) {
                if (proximityIntervalRef.current) { clearInterval(proximityIntervalRef.current); proximityIntervalRef.current = null; }
                return;
            }
            const avatarState = useAvatarStore.getState();
            const myPos = avatarState.myPosition;
            const participants = useDailyStore.getState().participants;

            Object.entries(participants).forEach(([id, info]) => {
                const supabaseId = gDailyToSupabase.get(id) || id;
                const peer = avatarState.peers[supabaseId] || avatarState.peers[id];
                if (!peer) return;
                const dx = myPos.x - peer.position.x, dy = myPos.y - peer.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const wantAudio = dist <= PROXIMITY_RANGE * 1.5;
                const wantVideo = dist < PROXIMITY_RANGE;
                const subKey = `${wantAudio}:${wantVideo}`;
                const lastSub = gLastSubscribeState.get(id);
                if (lastSub !== subKey) {
                    gLastSubscribeState.set(id, subKey);
                    try {
                        callRef.current!.updateParticipant(info.sessionId, {
                            setSubscribedTracks: { audio: wantAudio, video: wantVideo },
                        });
                    } catch { /* peer left */ }
                }
            });
        }, ROOM_CHECK_INTERVAL);
        return () => { if (proximityIntervalRef.current) clearInterval(proximityIntervalRef.current); };
    }, [isAudioOn, isVideoOn]);

    // ─── No JSX — pure logic component ──────────────────────
    return null;
}
