import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const DAILY_API_KEY = process.env.DAILY_API_KEY || 'e7bcb47aeb2919ee16605fac7a0f8ff37e9bf8f1a95d4f357464b300d24b48bf';
const DAILY_API_URL = 'https://api.daily.co/v1';

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

async function dailyFetch(endpoint: string, params?: Record<string, string>) {
    const url = new URL(`${DAILY_API_URL}${endpoint}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Daily API ${res.status}: ${JSON.stringify(err)}`);
    }
    return res.json();
}

export async function GET(req: NextRequest) {
    const isAdmin = await verifySuperAdmin(req);
    if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const section = url.searchParams.get('section') || 'overview';

    try {
        switch (section) {
            case 'overview': {
                // Fetch live presence, rooms, and recent meetings in parallel
                const now = Math.floor(Date.now() / 1000);
                const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

                const [presenceData, roomsData, meetingsData] = await Promise.all([
                    // Live sessions right now
                    dailyFetch('/presence'),
                    // All rooms
                    dailyFetch('/rooms', { limit: '100' }),
                    // Meetings this month
                    dailyFetch('/meetings', {
                        timeframe_start: String(monthStart),
                        timeframe_end: String(now),
                        limit: '100',
                        no_participants: 'true',
                    }),
                ]);

                // Calculate totals
                const liveSessions = Object.keys(presenceData).length;
                const liveParticipants = Object.values(presenceData).reduce(
                    (sum: number, room: any) => sum + (Array.isArray(room) ? room.length : 0), 0
                );

                const totalRooms = roomsData.total_count || (roomsData.data?.length || 0);

                const meetings = meetingsData.data || [];
                const totalSessions = meetings.length;
                const totalParticipantSeconds = meetings.reduce(
                    (sum: number, m: any) => sum + (m.duration || 0) * (m.max_participants || 1), 0
                );
                const totalParticipantMinutes = Math.round(totalParticipantSeconds / 60);

                // Estimate cost (Daily charges ~$0.004/participant-minute for scale plan)
                const estimatedCostCents = Math.round(totalParticipantMinutes * 0.4);

                return NextResponse.json({
                    live: { sessions: liveSessions, participants: liveParticipants },
                    monthly: {
                        totalSessions,
                        totalParticipantMinutes,
                        estimatedCostCents,
                        estimatedCostFormatted: `$${(estimatedCostCents / 100).toFixed(2)}`,
                    },
                    rooms: {
                        total: totalRooms,
                        maxAllowed: 100000, // Daily.co limit
                    },
                    presenceDetails: presenceData,
                });
            }

            case 'meetings': {
                const page = url.searchParams.get('page') || '1';
                const now = Math.floor(Date.now() / 1000);
                const startDays = parseInt(url.searchParams.get('days') || '30');
                const timeStart = now - (startDays * 86400);

                const data = await dailyFetch('/meetings', {
                    timeframe_start: String(timeStart),
                    timeframe_end: String(now),
                    limit: '50',
                });

                const meetings = (data.data || []).map((m: any) => ({
                    id: m.id,
                    room: m.room,
                    startTime: m.start_time,
                    duration: m.duration,
                    maxParticipants: m.max_participants,
                    participantMinutes: Math.round((m.duration || 0) * (m.max_participants || 1) / 60),
                    participants: m.participants || [],
                }));

                return NextResponse.json({
                    meetings,
                    total: data.total_count || meetings.length,
                });
            }

            case 'rooms': {
                const data = await dailyFetch('/rooms', { limit: '100' });
                const rooms = (data.data || []).map((r: any) => ({
                    id: r.id,
                    name: r.name,
                    url: r.url,
                    privacy: r.privacy,
                    createdAt: r.created_at,
                    config: r.config || {},
                }));
                return NextResponse.json({ rooms, total: data.total_count || rooms.length });
            }

            default:
                return NextResponse.json({ error: 'Unknown section' }, { status: 400 });
        }
    } catch (err: any) {
        console.error('[Admin Daily] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
