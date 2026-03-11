// Presence Analytics API — log events and compute metrics

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getServiceClient() {
    return createClient(supabaseUrl, supabaseServiceKey);
}

// ─── POST: store presence events (batch) ────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { events } = body;
        if (!events || !Array.isArray(events) || events.length === 0) {
            return NextResponse.json({ error: 'No events provided' }, { status: 400 });
        }

        const supabase = getServiceClient();

        // Insert batch — max 50 events at a time
        const batch = events.slice(0, 50).map((e: any) => ({
            workspace_id: e.workspace_id,
            user_id: e.user_id,
            room_id: e.room_id || null,
            x: Math.round(e.x || 0),
            y: Math.round(e.y || 0),
        }));

        const { error } = await supabase.from('presence_events').insert(batch);
        if (error) {
            console.error('[Presence] Insert error:', error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, count: batch.length });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ─── GET: compute analytics from presence_events ─────────
export async function GET(req: NextRequest) {
    try {
        const supabase = getServiceClient();
        const { searchParams } = new URL(req.url);
        const workspaceId = searchParams.get('workspace_id');
        const days = parseInt(searchParams.get('days') || '7');

        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        // If workspace_id filter: scope to that workspace. Otherwise: all workspaces (superadmin)
        let query = supabase
            .from('presence_events')
            .select('user_id, room_id, created_at')
            .gte('created_at', cutoff)
            .order('created_at', { ascending: true });

        if (workspaceId) {
            query = query.eq('workspace_id', workspaceId);
        }

        const { data: events, error } = await query.limit(10000);
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!events || events.length === 0) {
            return NextResponse.json({
                totalEvents: 0,
                uniqueUsers: 0,
                roomUtilization: [],
                hourlyActivity: Array(24).fill(0),
                dailyActiveUsers: [],
                collaborationPairs: [],
            });
        }

        // ─── Room Utilization ─────────────────────────
        const roomCounts: Record<string, number> = {};
        for (const ev of events) {
            if (ev.room_id) {
                roomCounts[ev.room_id] = (roomCounts[ev.room_id] || 0) + 1;
            }
        }
        const totalRoomEvents = Object.values(roomCounts).reduce((s, v) => s + v, 0) || 1;
        const roomUtilization = Object.entries(roomCounts)
            .map(([room_id, count]) => ({
                room_id,
                count,
                percentage: Math.round((count / totalRoomEvents) * 100),
            }))
            .sort((a, b) => b.count - a.count);

        // ─── Hourly Activity (UTC) ───────────────────
        const hourlyActivity = Array(24).fill(0);
        for (const ev of events) {
            const hour = new Date(ev.created_at).getUTCHours();
            hourlyActivity[hour]++;
        }

        // ─── Unique Users ────────────────────────────
        const uniqueUsers = new Set(events.map((e: any) => e.user_id)).size;

        // ─── Daily Active Users ──────────────────────
        const dailyMap: Record<string, Set<string>> = {};
        for (const ev of events) {
            const day = ev.created_at.slice(0, 10);
            if (!dailyMap[day]) dailyMap[day] = new Set();
            dailyMap[day].add(ev.user_id);
        }
        const dailyActiveUsers = Object.entries(dailyMap)
            .map(([date, users]) => ({ date, count: users.size }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // ─── Collaboration Pairs (co-presence in same room) ──
        // Group events by room+time window (5-minute buckets)
        const coPresence: Record<string, Set<string>> = {};
        for (const ev of events) {
            if (!ev.room_id) continue;
            const bucket = ev.room_id + '_' + ev.created_at.slice(0, 15); // 10-min bucket
            if (!coPresence[bucket]) coPresence[bucket] = new Set();
            coPresence[bucket].add(ev.user_id);
        }
        const pairCounts: Record<string, number> = {};
        for (const users of Object.values(coPresence)) {
            const arr = Array.from(users);
            for (let i = 0; i < arr.length; i++) {
                for (let j = i + 1; j < arr.length; j++) {
                    const key = [arr[i], arr[j]].sort().join('|');
                    pairCounts[key] = (pairCounts[key] || 0) + 1;
                }
            }
        }
        const collaborationPairs = Object.entries(pairCounts)
            .map(([pair, count]) => {
                const [a, b] = pair.split('|');
                return { user_a: a, user_b: b, coPresenceScore: count };
            })
            .sort((a, b) => b.coPresenceScore - a.coPresenceScore)
            .slice(0, 20);

        return NextResponse.json({
            totalEvents: events.length,
            uniqueUsers,
            roomUtilization,
            hourlyActivity,
            dailyActiveUsers,
            collaborationPairs,
            periodDays: days,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
