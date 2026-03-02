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
        if (joinedRef.current) {
            // Already in a call — leave first
            try { await callRef.current.leave(); } catch { }
            joinedRef.current = false;
            gLocalTracks.clear();
        }
        if (joiningRef.current) return;
        joiningRef.current = true;

        try {
            const roomName = getContextRoomName(contextType, contextId);
            if (!roomName) { joiningRef.current = false; return; }

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
        gLocalTracks.clear();
        useDailyStore.getState().setLocalStream(null);
        useDailyStore.getState().setConnected(false);
        useDailyStore.getState().setActiveContext('none', null);
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

    // ─── Sync mic/video while connected ─────────────────────
    useEffect(() => {
        if (!callRef.current || !joinedRef.current) return;
        callRef.current.setLocalAudio(isAudioOn);

        if (!isAudioOn) {
            // Same Safari fix as video: stop the hardware mic track
            const audioTrack = gLocalTracks.get('audio');
            if (audioTrack) {
                audioTrack.stop();
                gLocalTracks.delete('audio');
                const liveTracks = Array.from(gLocalTracks.values()).filter(t => t.readyState === 'live');
                useDailyStore.getState().setLocalStream(liveTracks.length > 0 ? new MediaStream(liveTracks) : null);
            }
        }
    }, [isAudioOn]);

    useEffect(() => {
        if (!callRef.current || !joinedRef.current) return;
        callRef.current.setLocalVideo(isVideoOn);

        if (!isVideoOn) {
            // Safari fix: setLocalVideo(false) only mutes the track at the SFU level
            // but does NOT stop the hardware camera. We must explicitly stop() the track
            // and rebuild the localStream without it.
            const videoTrack = gLocalTracks.get('video');
            if (videoTrack) {
                videoTrack.stop(); // This turns off the green camera indicator
                gLocalTracks.delete('video');
                const liveTracks = Array.from(gLocalTracks.values()).filter(t => t.readyState === 'live');
                useDailyStore.getState().setLocalStream(liveTracks.length > 0 ? new MediaStream(liveTracks) : null);
            }
        }
    }, [isVideoOn]);

    // Room switching is now handled by useProximityAndRooms engine

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
