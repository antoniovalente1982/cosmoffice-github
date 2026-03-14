import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { formatEurCents } from '../../../../lib/currency';

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

async function safeCount(fn: () => PromiseLike<{ count: number | null; error: any }>): Promise<number> {
    try {
        const { count, error } = await fn();
        if (error) { console.error('[stats] safeCount error:', error.message); return 0; }
        return count || 0;
    } catch (e: any) { console.error('[stats] safeCount exception:', e.message); return 0; }
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

        // ── Parse optional date range params ──
        const url = new URL(req.url);
        const fromParam = url.searchParams.get('from');
        const toParam = url.searchParams.get('to');
        const hasRange = !!(fromParam && toParam);
        const rangeFrom = hasRange ? new Date(fromParam + 'T00:00:00Z').toISOString() : '';
        const rangeTo = hasRange ? new Date(toParam + 'T23:59:59.999Z').toISOString() : '';

        // ───────────────────────────────────────────────
        // BLOCCO 1: UTENTI
        // ───────────────────────────────────────────────
        const totalProfiles = await safeCount(() =>
            supabase.from('profiles').select('id', { count: 'exact', head: true })
        );

        let allMembers: any[] = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
            const { data, error } = await supabase
                .from('workspace_members')
                .select('user_id, last_active_at, role')
                .is('removed_at', null)
                .range(page * pageSize, (page + 1) * pageSize - 1);
            if (error) { console.error('[stats] workspace_members fetch error:', error.message); break; }
            if (!data || data.length === 0) break;
            allMembers = allMembers.concat(data);
            if (data.length < pageSize) break;
            page++;
        }

        const uniqueUserIds = new Set(allMembers.map((m: any) => m.user_id));
        const uniqueUsers = uniqueUserIds.size;
        const totalUsers = totalProfiles;

        // 1) Fetch all super admins to ensure they are tracked
        const { data: saData } = await supabase.from('profiles').select('id').eq('is_super_admin', true);
        const superAdminIds = new Set((saData || []).map(p => p.id));
        const superAdmins = superAdminIds.size;

        // 2) Determine highest workspace role per-user (owner > admin > member > guest)
        //    Super admins ALSO count in their workspace role (e.g., owner)
        const uniqueUserRoles = new Map<string, string>(); // user_id -> highest workspace role
        const rolePriority: Record<string, number> = { 'owner': 1, 'admin': 2, 'member': 3, 'guest': 4 };

        for (const m of allMembers) {
            const userId = m.user_id;
            const currentRole = (m.role || '').toLowerCase();
            const existingRole = uniqueUserRoles.get(userId);

            // Always track the highest workspace role, even for super admins
            if (!existingRole || (rolePriority[currentRole] !== undefined && rolePriority[currentRole] < rolePriority[existingRole])) {
                uniqueUserRoles.set(userId, currentRole);
            }
        }

        const roleCounts = { owner: 0, admin: 0, member: 0, guest: 0 };
        for (const role of Array.from(uniqueUserRoles.values())) {
            if (role === 'owner') roleCounts.owner++;
            if (role === 'admin') roleCounts.admin++;
            if (role === 'member') roleCounts.member++;
            if (role === 'guest') roleCounts.guest++;
        }

        // Range-aware user metrics
        let recentSignups: number;
        if (hasRange) {
            recentSignups = await safeCount(() =>
                supabase.from('profiles').select('id', { count: 'exact', head: true })
                    .gte('created_at', rangeFrom).lte('created_at', rangeTo)
            );
        } else {
            recentSignups = await safeCount(() =>
                supabase.from('profiles').select('id', { count: 'exact', head: true })
                    .gte('created_at', new Date(now - 7 * day).toISOString())
            );
        }

        let activeUsers: number;
        if (hasRange) {
            activeUsers = await safeCount(() =>
                supabase.from('profiles').select('id', { count: 'exact', head: true })
                    .gte('last_seen', rangeFrom).lte('last_seen', rangeTo)
            );
            if (activeUsers === 0 && allMembers.length > 0) {
                const activeSet = new Set(
                    allMembers.filter((m: any) => m.last_active_at && m.last_active_at >= rangeFrom && m.last_active_at <= rangeTo)
                        .map((m: any) => m.user_id)
                );
                activeUsers = activeSet.size;
            }
        } else {
            activeUsers = await safeCount(() =>
                supabase.from('profiles').select('id', { count: 'exact', head: true })
                    .gte('last_seen', new Date(now - day).toISOString())
            );
            if (activeUsers === 0 && allMembers.length > 0) {
                const cutoff = new Date(now - day).toISOString();
                const activeSet = new Set(
                    allMembers.filter((m: any) => m.last_active_at && m.last_active_at >= cutoff)
                        .map((m: any) => m.user_id)
                );
                activeUsers = activeSet.size;
            }
        }

        // ───────────────────────────────────────────────
        // BLOCCO 2: WORKSPACE
        // ───────────────────────────────────────────────
        const { data: wsData } = await supabase.from('workspaces').select('id, plan, deleted_at, suspended_at, created_at, monthly_amount_cents, billing_cycle, payment_status, max_capacity, price_per_seat');
        const allWorkspaces = wsData || [];

        const wsActive = allWorkspaces.filter((w: any) => !w.deleted_at && !w.suspended_at);
        const wsSuspended = allWorkspaces.filter((w: any) => !w.deleted_at && w.suspended_at);
        const wsDeleted = allWorkspaces.filter((w: any) => w.deleted_at);
        const wsTotal = allWorkspaces.filter((w: any) => !w.deleted_at);

        let recentWs: number;
        if (hasRange) {
            recentWs = allWorkspaces.filter((w: any) =>
                !w.deleted_at &&
                new Date(w.created_at).toISOString() >= rangeFrom &&
                new Date(w.created_at).toISOString() <= rangeTo
            ).length;
        } else {
            recentWs = allWorkspaces.filter((w: any) =>
                !w.deleted_at && new Date(w.created_at).getTime() > now - 7 * day
            ).length;
        }

        const planDistribution: Record<string, number> = {};
        wsTotal.forEach((w: any) => { planDistribution[w.plan] = (planDistribution[w.plan] || 0) + 1; });

        let activeWs = 0;
        try {
            const cutoff = hasRange ? rangeFrom : new Date(now - day).toISOString();
            let query = supabase.from('workspace_members').select('workspace_id').gte('last_active_at', cutoff);
            if (hasRange) query = query.lte('last_active_at', rangeTo);
            const { data: awData } = await query;
            if (awData) activeWs = new Set(awData.map((m: any) => m.workspace_id)).size;
        } catch { /* ignore */ }

        // Total spaces (offices) across all workspaces
        const totalSpaces = await safeCount(() =>
            supabase.from('spaces').select('id', { count: 'exact', head: true })
        );

        // Total seats allocated
        const totalSeatsAllocated = wsTotal.reduce((sum: number, w: any) => sum + (w.max_capacity || 0), 0);
        const totalSeatsUsed = allMembers.length;

        // ───────────────────────────────────────────────
        // BLOCCO 3: REVENUE (from payments table)
        // ───────────────────────────────────────────────
        let revenueCents = 0;
        let revenueThisMonth = 0;
        let revenueLastMonth = 0;
        let totalPayments = 0;
        let recentPayments: any[] = [];

        try {
            // Current month
            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
            const { data: pmThisMonth } = await supabase.from('payments')
                .select('amount_cents').eq('type', 'payment')
                .gte('payment_date', monthStart.split('T')[0]);
            revenueThisMonth = (pmThisMonth || []).reduce((s: number, p: any) => s + (p.amount_cents || 0), 0);

            // Last month
            const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
            const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
            const { data: pmLastMonth } = await supabase.from('payments')
                .select('amount_cents').eq('type', 'payment')
                .gte('payment_date', lastMonthStart.toISOString().split('T')[0])
                .lte('payment_date', lastMonthEnd.toISOString().split('T')[0]);
            revenueLastMonth = (pmLastMonth || []).reduce((s: number, p: any) => s + (p.amount_cents || 0), 0);

            // Range or all-time
            if (hasRange) {
                const { data: pmRange } = await supabase.from('payments')
                    .select('amount_cents').eq('type', 'payment')
                    .gte('payment_date', fromParam!).lte('payment_date', toParam!);
                revenueCents = (pmRange || []).reduce((s: number, p: any) => s + (p.amount_cents || 0), 0);
            } else {
                const { data: pmAll } = await supabase.from('payments')
                    .select('amount_cents').eq('type', 'payment');
                revenueCents = (pmAll || []).reduce((s: number, p: any) => s + (p.amount_cents || 0), 0);
            }

            // Total payment count
            totalPayments = await safeCount(() =>
                supabase.from('payments').select('id', { count: 'exact', head: true }).eq('type', 'payment')
            );

            // Last 5 payments
            const { data: recent } = await supabase.from('payments')
                .select('id, workspace_name, owner_name, amount_cents, payment_date, receipt_number, type')
                .order('payment_date', { ascending: false })
                .limit(5);
            recentPayments = recent || [];
        } catch { /* payments table may not exist yet */ }

        // MRR calculation (sum of monthly_amount_cents for all active paid workspaces)
        const mrr = wsActive
            .filter((w: any) => w.monthly_amount_cents > 0)
            .reduce((sum: number, w: any) => sum + (w.monthly_amount_cents || 0), 0);

        // ARR = MRR × 12
        const arr = mrr * 12;

        const paidWorkspaces = wsTotal.filter((w: any) => w.plan === 'premium').length;

        // ───────────────────────────────────────────────
        // BLOCCO 4: SUPPORT TICKETS
        // ───────────────────────────────────────────────
        let ticketStats = { open: 0, in_progress: 0, resolved: 0, closed: 0, total: 0 };
        let recentTickets: any[] = [];
        try {
            const openT = await safeCount(() =>
                supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open')
            );
            const progressT = await safeCount(() =>
                supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'in_progress')
            );
            const resolvedT = await safeCount(() =>
                supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'resolved')
            );
            const closedT = await safeCount(() =>
                supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'closed')
            );
            ticketStats = { open: openT, in_progress: progressT, resolved: resolvedT, closed: closedT, total: openT + progressT + resolvedT + closedT };

            const { data: tRecent } = await supabase.from('support_tickets')
                .select('id, subject, status, priority, created_at, workspace_name')
                .in('status', ['open', 'in_progress'])
                .order('created_at', { ascending: false })
                .limit(5);
            recentTickets = tRecent || [];
        } catch { /* support_tickets may not exist */ }

        // ───────────────────────────────────────────────
        // BLOCCO 5: MONITORAGGIO
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

        // Workspace existed in period
        let wsInPeriod = wsTotal.length;
        if (hasRange) {
            wsInPeriod = allWorkspaces.filter((w: any) =>
                new Date(w.created_at).toISOString() <= rangeTo &&
                (!w.deleted_at || new Date(w.deleted_at).toISOString() >= rangeFrom)
            ).length;
        }

        // ─── RESPONSE ─────────────────────────────────
        return NextResponse.json({
            users: {
                total: totalUsers,
                unique: uniqueUsers,
                superAdmins,
                owners: roleCounts.owner,
                admins: roleCounts.admin,
                members: roleCounts.member,
                guests: roleCounts.guest,
                recentSignups,
                activeInPeriod: activeUsers,
                registeredInPeriod: recentSignups,
            },
            workspaces: {
                total: wsTotal.length,
                active: wsActive.length,
                suspended: wsSuspended.length,
                deleted: wsDeleted.length,
                recentNew: recentWs,
                activeInPeriod: activeWs,
                existedInPeriod: wsInPeriod,
                planDistribution,
                paidWorkspaces,
                totalSpaces,
                totalSeatsAllocated,
                totalSeatsUsed,
            },
            revenue: {
                totalCents: revenueCents,
                totalFormatted: formatEurCents(revenueCents),
                paidWorkspaces,
                mrr,
                mrrFormatted: formatEurCents(mrr),
                arr,
                arrFormatted: formatEurCents(arr),
                thisMonth: revenueThisMonth,
                thisMonthFormatted: formatEurCents(revenueThisMonth),
                lastMonth: revenueLastMonth,
                lastMonthFormatted: formatEurCents(revenueLastMonth),
                totalPayments,
                recentPayments,
            },
            tickets: ticketStats,
            recentTickets,
            monitoring: {
                openBugs,
                criticalBugs,
                activeBans,
            },
            dateRange: hasRange ? { from: fromParam, to: toParam } : null,
        });
    } catch (err: any) {
        console.error('[stats] Unexpected error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
