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

export async function GET(req: NextRequest) {
    const auth = await getAdminClient(req);
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase } = auth;

    try {
        // Parallel queries for KPIs
        const [
            usersRes,
            workspacesRes,
            roomsRes,
            activeUsersRes,
            activeWorkspacesRes,
            bugsRes,
            criticalBugsRes,
            billingRes,
            recentSignupsRes,
            plansRes,
        ] = await Promise.all([
            // Total users
            supabase.from('profiles').select('id', { count: 'exact', head: true }).is('deleted_at', null),
            // Total workspaces
            supabase.from('workspaces').select('id', { count: 'exact', head: true }).is('deleted_at', null),
            // Total rooms
            supabase.from('rooms').select('id', { count: 'exact', head: true }),
            // Active users in last 24h
            supabase.from('profiles').select('id', { count: 'exact', head: true })
                .gte('last_seen_at', new Date(Date.now() - 86400000).toISOString()),
            // Active workspaces in last 24h
            supabase.from('workspace_members').select('workspace_id', { count: 'exact', head: true })
                .gte('last_active_at', new Date(Date.now() - 86400000).toISOString()),
            // Open bugs
            supabase.from('bug_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
            // Critical bugs
            supabase.from('bug_reports').select('id', { count: 'exact', head: true })
                .eq('severity', 'critical').in('status', ['open', 'in_progress']),
            // MRR calculation (sum of latest month's payments)
            supabase.from('billing_events').select('amount_cents')
                .eq('event_type', 'payment')
                .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
            // Signups last 7 days
            supabase.from('profiles').select('id, created_at')
                .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
                .order('created_at', { ascending: false }),
            // Plan distribution
            supabase.from('workspaces').select('plan').is('deleted_at', null),
        ]);

        // Calculate MRR
        const mrrCents = (billingRes.data || []).reduce((sum: number, e: any) => sum + (e.amount_cents || 0), 0);

        // Plan distribution
        const planDistribution: Record<string, number> = {};
        (plansRes.data || []).forEach((w: any) => {
            planDistribution[w.plan] = (planDistribution[w.plan] || 0) + 1;
        });

        return NextResponse.json({
            totalUsers: usersRes.count || 0,
            totalWorkspaces: workspacesRes.count || 0,
            totalRooms: roomsRes.count || 0,
            activeUsers24h: activeUsersRes.count || 0,
            activeWorkspaces24h: activeWorkspacesRes.count || 0,
            openBugs: bugsRes.count || 0,
            criticalBugs: criticalBugsRes.count || 0,
            mrrCents,
            mrrFormatted: `€${(mrrCents / 100).toFixed(2)}`,
            recentSignups: recentSignupsRes.data?.length || 0,
            planDistribution,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
