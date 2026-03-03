import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Helper to create an authenticated Supabase client and verify super admin
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

    // Use service role for admin queries (bypass RLS)
    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    return { supabase: adminClient, userId: session.user.id };
}

// Safe count helper — returns 0 if query fails (e.g. missing column)
async function safeCount(
    queryFn: () => PromiseLike<{ count: number | null; error: any }>
): Promise<number> {
    try {
        const { count, error } = await queryFn();
        if (error) return 0;
        return count || 0;
    } catch {
        return 0;
    }
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

        // ── Total users ──
        // Try profiles first, fallback to distinct workspace_members
        let totalUsers = await safeCount(() =>
            supabase.from('profiles').select('id', { count: 'exact', head: true })
        );
        // If profiles returns 0, try counting distinct users from workspace_members
        if (totalUsers === 0) {
            const { data: memberData } = await supabase
                .from('workspace_members')
                .select('user_id')
                .is('removed_at', null);
            if (memberData) {
                totalUsers = new Set(memberData.map((m: any) => m.user_id)).size;
            }
        }

        // ── Total workspaces (non-deleted) ──
        const totalWorkspaces = await safeCount(() =>
            supabase.from('workspaces').select('id', { count: 'exact', head: true }).is('deleted_at', null)
        );

        // ── Suspended workspaces ──
        let suspendedWorkspaces = 0;
        try {
            const { count } = await supabase
                .from('workspaces')
                .select('id', { count: 'exact', head: true })
                .is('deleted_at', null)
                .not('suspended_at', 'is', null);
            suspendedWorkspaces = count || 0;
        } catch { /* column may not exist */ }

        // ── Total spaces (uffici) ──
        const totalSpaces = await safeCount(() =>
            supabase.from('spaces').select('id', { count: 'exact', head: true }).is('deleted_at', null)
        );

        // ── Total rooms (stanze) ──
        const totalRooms = await safeCount(() =>
            supabase.from('rooms').select('id', { count: 'exact', head: true })
        );

        // ── Active users in last 24h ──
        // Try profiles.last_seen_at first, then workspace_members.last_active_at
        let activeUsers24h = await safeCount(() =>
            supabase.from('profiles').select('id', { count: 'exact', head: true })
                .gte('last_seen_at', new Date(now - day).toISOString())
        );
        if (activeUsers24h === 0) {
            // Fallback: count distinct users with recent activity in workspace_members
            try {
                const { data: activeData } = await supabase
                    .from('workspace_members')
                    .select('user_id')
                    .gte('last_active_at', new Date(now - day).toISOString())
                    .is('removed_at', null);
                if (activeData) {
                    activeUsers24h = new Set(activeData.map((m: any) => m.user_id)).size;
                }
            } catch { /* ignore */ }
        }

        // ── Active workspaces 24h ──
        let activeWorkspaces24h = 0;
        try {
            const { data: awData } = await supabase
                .from('workspace_members')
                .select('workspace_id')
                .gte('last_active_at', new Date(now - day).toISOString());
            if (awData) {
                activeWorkspaces24h = new Set(awData.map((m: any) => m.workspace_id)).size;
            }
        } catch { /* ignore */ }

        // ── Bugs ──
        const openBugs = await safeCount(() =>
            supabase.from('bug_reports').select('id', { count: 'exact', head: true }).eq('status', 'open')
        );
        const criticalBugs = await safeCount(() =>
            supabase.from('bug_reports').select('id', { count: 'exact', head: true })
                .eq('severity', 'critical').in('status', ['open', 'in_progress'])
        );

        // ── MRR ──
        let mrrCents = 0;
        try {
            const { data: billingData } = await supabase
                .from('billing_events')
                .select('amount_cents')
                .eq('event_type', 'payment')
                .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
            mrrCents = (billingData || []).reduce((sum: number, e: any) => sum + (e.amount_cents || 0), 0);
        } catch { /* billing_events table may not exist */ }

        // ── Recent signups (7 days) ──
        let recentSignups = 0;
        try {
            const { data: signupData } = await supabase
                .from('profiles')
                .select('id')
                .gte('created_at', new Date(now - 7 * day).toISOString());
            recentSignups = signupData?.length || 0;
        } catch { /* ignore */ }

        // ── Active bans ──
        const activeBans = await safeCount(() =>
            supabase.from('workspace_bans').select('id', { count: 'exact', head: true })
                .is('revoked_at', null)
        );

        // ── Plan distribution ──
        const planDistribution: Record<string, number> = {};
        try {
            const { data: plansData } = await supabase
                .from('workspaces')
                .select('plan')
                .is('deleted_at', null);
            (plansData || []).forEach((w: any) => {
                planDistribution[w.plan] = (planDistribution[w.plan] || 0) + 1;
            });
        } catch { /* ignore */ }

        return NextResponse.json({
            totalUsers,
            totalWorkspaces,
            suspendedWorkspaces,
            totalSpaces,
            totalRooms,
            activeUsers24h,
            activeWorkspaces24h,
            openBugs,
            criticalBugs,
            mrrCents,
            mrrFormatted: `€${(mrrCents / 100).toFixed(2)}`,
            recentSignups,
            activeBans,
            planDistribution,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
