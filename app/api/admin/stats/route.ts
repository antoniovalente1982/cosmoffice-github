import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export const dynamic = 'force-dynamic';
async function getAdminClient(req: NextRequest) {
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
    if (!session) return { error: 'Not authenticated', status: 401 };

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', session.user.id)
        .single();

    if (!profile?.is_super_admin) return { error: 'Forbidden', status: 403 };

    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    return { supabase: adminClient, userId: session.user.id };
}

// Safe query helper — silently returns default on error
async function safe<T>(fn: () => PromiseLike<{ data: T | null; error: any }>, fallback: T): Promise<T> {
    try {
        const { data, error } = await fn();
        if (error || data === null) return fallback;
        return data;
    } catch { return fallback; }
}

async function safeCount(fn: () => PromiseLike<{ count: number | null; error: any }>): Promise<number> {
    try {
        const { count, error } = await fn();
        if (error) return 0;
        return count || 0;
    } catch { return 0; }
}

export async function GET(req: NextRequest) {
    const auth = await getAdminClient(req);
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase } = auth;

    try {
        const now = Date.now();
        const day = 86400000;

        // ───────────────────────────────────────────────
        // BLOCCO 1: UTENTI
        // Source: profiles + workspace_members
        // ───────────────────────────────────────────────

        // Total registered profiles
        let totalProfiles = await safeCount(() =>
            supabase.from('profiles').select('id', { count: 'exact', head: true })
        );

        // All workspace members (including cross-workspace duplicates)
        const allMembers = await safe(
            () => supabase.from('workspace_members').select('user_id, last_active_at, role').is('removed_at', null),
            [] as any[]
        );

        // Unique users across all workspaces
        const uniqueUserIds = new Set(allMembers.map((m: any) => m.user_id));
        const uniqueUsers = uniqueUserIds.size;

        // Use the larger value between profiles count and unique members
        const totalUsers = Math.max(totalProfiles, uniqueUsers);

        // Recent signups (last 7 days)
        const recentSignups = await safeCount(() =>
            supabase.from('profiles').select('id', { count: 'exact', head: true })
                .gte('created_at', new Date(now - 7 * day).toISOString())
        );

        // Active users in last 24h — try profiles first, fallback to workspace_members
        let activeUsers24h = await safeCount(() =>
            supabase.from('profiles').select('id', { count: 'exact', head: true })
                .gte('last_seen_at', new Date(now - day).toISOString())
        );
        if (activeUsers24h === 0 && allMembers.length > 0) {
            const cutoff = new Date(now - day).toISOString();
            const activeSet = new Set(
                allMembers.filter((m: any) => m.last_active_at && m.last_active_at >= cutoff)
                    .map((m: any) => m.user_id)
            );
            activeUsers24h = activeSet.size;
        }

        // Owners count (distinct users with role=owner)
        const owners = new Set(
            allMembers.filter((m: any) => m.role === 'owner').map((m: any) => m.user_id)
        ).size;

        // ───────────────────────────────────────────────
        // BLOCCO 2: WORKSPACE
        // Source: workspaces table
        // ───────────────────────────────────────────────

        const allWorkspaces = await safe(
            () => supabase.from('workspaces').select('id, plan, deleted_at, suspended_at, created_at'),
            [] as any[]
        );

        const wsActive = allWorkspaces.filter((w: any) => !w.deleted_at && !w.suspended_at);
        const wsSuspended = allWorkspaces.filter((w: any) => !w.deleted_at && w.suspended_at);
        const wsDeleted = allWorkspaces.filter((w: any) => w.deleted_at);
        const wsTotal = allWorkspaces.filter((w: any) => !w.deleted_at); // non-deleted total

        // New workspaces last 7 days
        const recentWs = allWorkspaces.filter((w: any) =>
            !w.deleted_at && new Date(w.created_at).getTime() > now - 7 * day
        ).length;

        // Plan distribution (only non-deleted)
        const planDistribution: Record<string, number> = {};
        wsTotal.forEach((w: any) => {
            planDistribution[w.plan] = (planDistribution[w.plan] || 0) + 1;
        });

        // Active workspaces 24h (workspaces with at least one member active in 24h)
        let activeWs24h = 0;
        try {
            const { data: awData } = await supabase
                .from('workspace_members')
                .select('workspace_id')
                .gte('last_active_at', new Date(now - day).toISOString());
            if (awData) {
                activeWs24h = new Set(awData.map((m: any) => m.workspace_id)).size;
            }
        } catch { /* ignore */ }

        // Active spaces = non-deleted spaces in active (non-deleted) workspaces
        const activeWsIds = allWorkspaces.filter((w: any) => !w.deleted_at).map((w: any) => w.id);

        const allSpaces = await safe(
            () => supabase.from('spaces').select('id, deleted_at, workspace_id'),
            [] as any[]
        );
        const activeSpaceIds = allSpaces
            .filter((s: any) => !s.deleted_at && activeWsIds.includes(s.workspace_id))
            .map((s: any) => s.id);

        const totalSpaces = activeSpaceIds.length;

        // Count only rooms in active spaces
        let totalRooms = 0;
        if (activeSpaceIds.length > 0) {
            const { data: activeRooms } = await supabase
                .from('rooms')
                .select('id')
                .in('space_id', activeSpaceIds);
            totalRooms = activeRooms?.length || 0;
        }

        // ───────────────────────────────────────────────
        // BLOCCO 4: REVENUE
        // Source: billing_events
        // ───────────────────────────────────────────────

        let mrrCents = 0;
        try {
            const { data: billingData } = await supabase
                .from('billing_events')
                .select('amount_cents')
                .eq('event_type', 'payment')
                .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
            mrrCents = (billingData || []).reduce((sum: number, e: any) => sum + (e.amount_cents || 0), 0);
        } catch { /* billing_events may not exist */ }

        const paidWorkspaces = wsTotal.filter((w: any) => w.plan !== 'free').length;

        // ───────────────────────────────────────────────
        // BLOCCO 5: MONITORAGGIO
        // Source: bug_reports + workspace_bans
        // ───────────────────────────────────────────────

        const openBugs = await safeCount(() =>
            supabase.from('bug_reports').select('id', { count: 'exact', head: true }).eq('status', 'open')
        );
        const criticalBugs = await safeCount(() =>
            supabase.from('bug_reports').select('id', { count: 'exact', head: true })
                .eq('severity', 'critical').in('status', ['open', 'in_progress'])
        );
        const activeBans = await safeCount(() =>
            supabase.from('workspace_bans').select('id', { count: 'exact', head: true })
                .is('revoked_at', null)
        );

        // ─── RESPONSE ─────────────────────────────────
        return NextResponse.json({
            users: {
                total: totalUsers,
                unique: uniqueUsers,
                owners,
                recentSignups,
                active24h: activeUsers24h,
            },
            workspaces: {
                total: wsTotal.length,
                active: wsActive.length,
                suspended: wsSuspended.length,
                deleted: wsDeleted.length,
                recentNew: recentWs,
                active24h: activeWs24h,
                planDistribution,
                paidWorkspaces,
            },
            spaces: {
                total: totalSpaces,
                rooms: totalRooms,
                avgRoomsPerSpace: totalSpaces > 0 ? Math.round((totalRooms / totalSpaces) * 10) / 10 : 0,
            },
            revenue: {
                mrrCents,
                mrrFormatted: `€${(mrrCents / 100).toFixed(2)}`,
                arrFormatted: `€${((mrrCents * 12) / 100).toFixed(2)}`,
                paidWorkspaces,
            },
            monitoring: {
                openBugs,
                criticalBugs,
                activeBans,
            },
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
