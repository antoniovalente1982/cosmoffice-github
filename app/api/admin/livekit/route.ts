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

// ─── LiveKit Cloud Pricing (as of 2025) ──────────────────────
// LiveKit charges per WebRTC CONNECTION MINUTE (not separate audio/video).
// Each participant connected = 1 connection minute per minute.
//
// Plans:
//   Build (free):  5,000 WebRTC min/month   — hard limit
//   Ship  ($50):   150,000 WebRTC min/month  — overage $0.0005/min ($0.50/1K)
//   Scale ($500):  1,500,000 WebRTC min/month— overage $0.0004/min ($0.40/1K)
//
// Bandwidth: $0.12/GB (downstream), upstream free
// Egress (recording): $0.024/min (composited), $0.006/min (track-level)
// Ingress: $0.012/min

interface PlanInfo {
    name: string;
    baseCostMonth: number;
    includedMinutes: number;
    overagePerMin: number;
}

const PLANS: Record<string, PlanInfo> = {
    build: { name: 'Build (Free)', baseCostMonth: 0, includedMinutes: 5_000, overagePerMin: 0 },          // hard limit, no overage
    ship: { name: 'Ship', baseCostMonth: 50, includedMinutes: 150_000, overagePerMin: 0.0005 },   // $0.50 per 1K extra min
    scale: { name: 'Scale', baseCostMonth: 500, includedMinutes: 1_500_000, overagePerMin: 0.0004 }, // $0.40 per 1K extra min
};

// Default — change this to match your actual plan
const CURRENT_PLAN = process.env.LIVEKIT_PLAN || 'build';

const PRICING = {
    plan: PLANS[CURRENT_PLAN] || PLANS.build,
    connectionPerMin: PLANS[CURRENT_PLAN]?.overagePerMin || 0.0005,  // per WebRTC connection-minute (overage)
    egressCompositePerMin: 0.024,   // composited recording
    egressTrackPerMin: 0.006,       // track-level export
    ingressPerMin: 0.012,
    bandwidthPerGB: 0.12,           // downstream
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

                // LiveKit charges per CONNECTION MINUTE (each connected participant = 1 connection-min/min)
                const currentCostPerMin = totalParticipants * PRICING.connectionPerMin;
                const currentCostPerHour = currentCostPerMin * 60;

                // Estimate session costs so far (based on each participant's connection duration)
                let totalSessionMinutes = 0;
                let totalSessionCost = 0;
                for (const room of roomDetails) {
                    for (const p of room.participants) {
                        const participantDurMin = (Date.now() - p.joinedAt) / 60000;
                        totalSessionMinutes += participantDurMin;
                        totalSessionCost += participantDurMin * PRICING.connectionPerMin;
                    }
                }

                return NextResponse.json({
                    livekit: {
                        url: LIVEKIT_URL,
                        region: LIVEKIT_URL.includes('.livekit.cloud') ? LIVEKIT_URL.split('.')[0].replace('wss://', '') : 'self-hosted',
                    },
                    plan: {
                        name: PRICING.plan.name,
                        baseCostMonth: PRICING.plan.baseCostMonth,
                        includedMinutes: PRICING.plan.includedMinutes,
                        overagePerMin: PRICING.plan.overagePerMin,
                    },
                    live: {
                        rooms: rooms.length,
                        participants: totalParticipants,
                        videoTracks: totalVideoTracks,
                        audioTracks: totalAudioTracks,
                        screenShares: totalScreenShares,
                    },
                    costs: {
                        currentPerMinute: currentCostPerMin,
                        currentPerHour: currentCostPerHour,
                        sessionMinutes: totalSessionMinutes,
                        sessionAccumulated: totalSessionCost,
                        connectionPerMin: PRICING.connectionPerMin,
                        bandwidthPerGB: PRICING.bandwidthPerGB,
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
