import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { RoomServiceClient } from 'livekit-server-sdk';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || '';

// Derive HTTP API URL from WebSocket URL
function getHttpUrl(): string {
    return LIVEKIT_URL
        .replace('wss://', 'https://')
        .replace('ws://', 'http://');
}

async function verifySuperAdmin(req: NextRequest) {
    const res = NextResponse.next();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) { return req.cookies.get(name)?.value; },
                set(name: string, value: string, options: CookieOptions) { res.cookies.set({ name, value, ...options }); },
                remove(name: string, options: CookieOptions) { res.cookies.set({ name, value: '', ...options }); },
            },
        }
    );
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', session.user.id)
        .single();

    return profile?.is_super_admin === true;
}

// ─── LiveKit Pricing (Cloud, as of 2025) ─────────────────────
// Audio:  $0.30 / 1000 participant-minutes ($0.0003/min)
// Video:  $2.40 / 1000 participant-minutes ($0.0024/min)
// Egress: $6.00 / 1000 egress-minutes
// Bandwidth included: 50GB free, then $0.10/GB

const PRICING = {
    audioPerMin: 0.0003,   // $0.0003 per participant-minute (audio)
    videoPerMin: 0.0024,   // $0.0024 per participant-minute (video)
    egressPerMin: 0.006,   // $0.006 per egress-minute
    bandwidthPerGB: 0.10,  // $0.10 per GB over 50GB
    freeBandwidthGB: 50,
};

export async function GET(req: NextRequest) {
    const isAdmin = await verifySuperAdmin(req);
    if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
        return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });
    }

    const url = new URL(req.url);
    const section = url.searchParams.get('section') || 'overview';

    try {
        const roomService = new RoomServiceClient(getHttpUrl(), LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

        switch (section) {
            case 'overview': {
                // List all active rooms
                const rooms = await roomService.listRooms();

                // For each room, get participants
                const roomDetails = await Promise.all(
                    rooms.map(async (room) => {
                        try {
                            const participants = await roomService.listParticipants(room.name);
                            return {
                                name: room.name,
                                sid: room.sid,
                                numParticipants: room.numParticipants,
                                numPublishers: room.numPublishers,
                                maxParticipants: room.maxParticipants,
                                createdAt: Number(room.creationTime) * 1000,
                                activeDurationSec: Math.floor((Date.now() / 1000) - Number(room.creationTime)),
                                metadata: room.metadata || '',
                                participants: participants.map(p => ({
                                    identity: p.identity,
                                    name: p.name || p.identity,
                                    joinedAt: Number(p.joinedAt) * 1000,
                                    isPublishing: p.tracks.some((t: any) => !t.muted),
                                    trackCount: p.tracks.length,
                                    hasVideo: p.tracks.some((t: any) => t.type === 1 && !t.muted), // VIDEO = 1
                                    hasAudio: p.tracks.some((t: any) => t.type === 0 && !t.muted), // AUDIO = 0
                                    hasScreen: p.tracks.some((t: any) => t.source === 2), // SCREEN_SHARE = 2
                                })),
                            };
                        } catch {
                            return {
                                name: room.name,
                                sid: room.sid,
                                numParticipants: room.numParticipants,
                                numPublishers: room.numPublishers,
                                maxParticipants: room.maxParticipants,
                                createdAt: Number(room.creationTime) * 1000,
                                activeDurationSec: Math.floor((Date.now() / 1000) - Number(room.creationTime)),
                                metadata: room.metadata || '',
                                participants: [],
                            };
                        }
                    })
                );

                // Calculate live stats
                const totalParticipants = roomDetails.reduce((sum, r) => sum + r.participants.length, 0);
                const totalVideoTracks = roomDetails.reduce(
                    (sum, r) => sum + r.participants.filter(p => p.hasVideo).length, 0
                );
                const totalAudioTracks = roomDetails.reduce(
                    (sum, r) => sum + r.participants.filter(p => p.hasAudio).length, 0
                );
                const totalScreenShares = roomDetails.reduce(
                    (sum, r) => sum + r.participants.filter(p => p.hasScreen).length, 0
                );

                // Estimate CURRENT burn rate (per minute)
                const currentAudioCostPerMin = totalAudioTracks * PRICING.audioPerMin;
                const currentVideoCostPerMin = totalVideoTracks * PRICING.videoPerMin;
                const currentTotalPerMin = currentAudioCostPerMin + currentVideoCostPerMin;
                const currentTotalPerHour = currentTotalPerMin * 60;

                // Estimate session costs so far (based on room creation time)
                let totalSessionCost = 0;
                for (const room of roomDetails) {
                    const durationMin = room.activeDurationSec / 60;
                    const videoUsers = room.participants.filter(p => p.hasVideo).length;
                    const audioOnlyUsers = room.participants.filter(p => p.hasAudio && !p.hasVideo).length;
                    totalSessionCost += (videoUsers * PRICING.videoPerMin * durationMin)
                        + (audioOnlyUsers * PRICING.audioPerMin * durationMin);
                }

                return NextResponse.json({
                    livekit: {
                        url: LIVEKIT_URL,
                        region: LIVEKIT_URL.includes('.livekit.cloud') ? LIVEKIT_URL.split('.')[0].replace('wss://', '') : 'self-hosted',
                    },
                    live: {
                        rooms: rooms.length,
                        participants: totalParticipants,
                        videoTracks: totalVideoTracks,
                        audioTracks: totalAudioTracks,
                        screenShares: totalScreenShares,
                    },
                    costs: {
                        currentPerMinute: currentTotalPerMin,
                        currentPerHour: currentTotalPerHour,
                        sessionAccumulated: totalSessionCost,
                        pricing: PRICING,
                    },
                    rooms: roomDetails,
                });
            }

            default:
                return NextResponse.json({ error: 'Unknown section' }, { status: 400 });
        }
    } catch (err: any) {
        console.error('[Admin LiveKit] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
