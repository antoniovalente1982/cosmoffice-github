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

// ═══════════════════════════════════════════════════════════════
// LiveKit Cloud Pricing — verified from livekit.io/pricing
// Last verified: 2026-03-06
//
// LiveKit charges per WebRTC CONNECTION MINUTE.
// 1 participant connected = 1 connection-minute per minute.
// A 10-second connection is billed as 1 minute (rounded up).
//
// Quotas reset on the 1st of each calendar month.
// Unused quota does NOT roll over.
// Build plan: hard limit (service stops when exceeded).
// Ship/Scale plans: overage is billed incrementally.
// ═══════════════════════════════════════════════════════════════

interface PlanInfo {
    name: string;
    baseCostMonth: number;
    includedMinutes: number;
    overagePerMin: number;      // 0 = hard limit (Build)
    maxConcurrent: number;      // max simultaneous connections
}

const PLANS: Record<string, PlanInfo> = {
    build: {
        name: 'Build (Free)',
        baseCostMonth: 0,
        includedMinutes: 5_000,
        overagePerMin: 0,          // hard limit — service stops
        maxConcurrent: 100,
    },
    ship: {
        name: 'Ship',
        baseCostMonth: 50,
        includedMinutes: 150_000,
        overagePerMin: 0.0005,     // $0.50 per 1K extra min
        maxConcurrent: 1_000,
    },
    scale: {
        name: 'Scale',
        baseCostMonth: 500,
        includedMinutes: 1_500_000,
        overagePerMin: 0.0004,     // $0.40 per 1K extra min
        maxConcurrent: 5_000,
    },
};

// Set your plan here or via env variable LIVEKIT_PLAN=build|ship|scale
const CURRENT_PLAN_KEY = process.env.LIVEKIT_PLAN || 'build';
const CURRENT_PLAN = PLANS[CURRENT_PLAN_KEY] || PLANS.build;

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
                // ─── REAL-TIME: list active rooms ─────────────────
                const rooms = await roomService.listRooms();

                // ─── REAL-TIME: list participants per room ────────
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
                                    hasVideo: p.tracks.some((t: any) => t.type === 1 && !t.muted),
                                    hasAudio: p.tracks.some((t: any) => t.type === 0 && !t.muted),
                                    hasScreen: p.tracks.some((t: any) => t.source === 2),
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

                // ─── REAL-TIME: calculate live stats ──────────────
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

                // ─── ESTIMATED: burn rate based on connected participants ──
                // Each connected participant = 1 connection-minute/minute
                const burnRatePerMin = totalParticipants * (CURRENT_PLAN.overagePerMin || 0.0005);
                const burnRatePerHour = burnRatePerMin * 60;

                // ─── ESTIMATED: session cost (current sessions only) ──
                // This is NOT the monthly total — we can't get that without Analytics API (Scale+ only)
                let currentSessionMinutes = 0;
                for (const room of roomDetails) {
                    for (const p of room.participants) {
                        currentSessionMinutes += Math.max(1, (Date.now() - p.joinedAt) / 60000);
                    }
                }

                return NextResponse.json({
                    // ─── Server info ──
                    livekit: {
                        url: LIVEKIT_URL,
                        region: LIVEKIT_URL.includes('.livekit.cloud')
                            ? LIVEKIT_URL.split('.')[0].replace('wss://', '')
                            : 'self-hosted',
                    },

                    // ─── Plan info (from env/config, NOT from LiveKit API) ──
                    plan: {
                        key: CURRENT_PLAN_KEY,
                        name: CURRENT_PLAN.name,
                        baseCostMonth: CURRENT_PLAN.baseCostMonth,
                        includedMinutes: CURRENT_PLAN.includedMinutes,
                        overagePerMin: CURRENT_PLAN.overagePerMin,
                        maxConcurrent: CURRENT_PLAN.maxConcurrent,
                    },

                    // ─── All plans for comparison ──
                    allPlans: Object.entries(PLANS).map(([key, p]) => ({
                        key,
                        name: p.name,
                        baseCostMonth: p.baseCostMonth,
                        includedMinutes: p.includedMinutes,
                        overagePerMin: p.overagePerMin,
                        maxConcurrent: p.maxConcurrent,
                        isCurrent: key === CURRENT_PLAN_KEY,
                    })),

                    // ─── REAL-TIME data from LiveKit Server SDK ──
                    live: {
                        rooms: rooms.length,
                        participants: totalParticipants,
                        videoTracks: totalVideoTracks,
                        audioTracks: totalAudioTracks,
                        screenShares: totalScreenShares,
                    },

                    // ─── ESTIMATED costs (clearly labeled) ──
                    costs: {
                        burnRatePerMin,
                        burnRatePerHour,
                        currentSessionMinutes: Math.round(currentSessionMinutes),
                    },

                    // ─── Data source transparency ──
                    dataSources: {
                        realtime: [
                            'live.rooms', 'live.participants', 'live.videoTracks',
                            'live.audioTracks', 'live.screenShares', 'rooms[]',
                        ],
                        estimated: [
                            'costs.burnRatePerMin (calcolato: partecipanti × tariffa)',
                            'costs.burnRatePerHour (calcolato: burnRate × 60)',
                            'costs.currentSessionMinutes (calcolato: somma durate partecipanti)',
                        ],
                        configured: [
                            'plan.* (da variabile env LIVEKIT_PLAN, default: build)',
                            'allPlans (tariffe hardcoded, verificate su livekit.io/pricing il 2026-03-06)',
                        ],
                        notAvailable: [
                            'Minuti totali consumati nel mese — richiede piano Scale ($500/mo) + Analytics API',
                            'Piano effettivo dal tuo account — verificare su cloud.livekit.io',
                            'Fattura/billing — solo da cloud.livekit.io',
                        ],
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
