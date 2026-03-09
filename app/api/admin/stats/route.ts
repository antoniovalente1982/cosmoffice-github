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

        // Total registered profiles
        const totalProfiles = await safeCount(() =>
            supabase.from('profiles').select('id', { count: 'exact', head: true })
        );

        // All workspace members — fetch with pagination to handle large datasets
        let allMembers: any[] = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
            const { data, error } = await supabase
                .from('workspace_members')
                .select('user_id, last_active_at, role')
                .is('removed_at', null)
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                console.error('[stats] workspace_members fetch error:', error.message, error.details, error.hint);
                break;
            }
            if (!data || data.length === 0) break;
            allMembers = allMembers.concat(data);
            if (data.length < pageSize) break;
            page++;
        }

        console.log(`[stats] Fetched ${allMembers.length} active workspace members`);

        // Unique users across all workspaces
        const uniqueUserIds = new Set(allMembers.map((m: any) => m.user_id));
        const uniqueUsers = uniqueUserIds.size;

        // Use the larger value
        const totalUsers = Math.max(totalProfiles, uniqueUsers);

        // Role counts — always current snapshot
        const roleCounts = { owner: 0, admin: 0, member: 0, guest: 0 };
        const roleSets: Record<string, Set<string>> = {
            owner: new Set(), admin: new Set(), member: new Set(), guest: new Set()
        };

        for (const m of allMembers) {
            const role = (m.role || '').toLowerCase();
            if (roleSets[role]) {
                roleSets[role].add(m.user_id);
            }
        }

        roleCounts.owner = roleSets.owner.size;
        roleCounts.admin = roleSets.admin.size;
        roleCounts.member = roleSets.member.size;
        roleCounts.guest = roleSets.guest.size;

        console.log(`[stats] Role breakdown — owner:${roleCounts.owner} admin:${roleCounts.admin} member:${roleCounts.member} guest:${roleCounts.guest}`);

        // Super admins count
        const superAdmins = await safeCount(() =>
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_super_admin', true)
        );

        // ── Range-aware metrics ──

        // Recent signups
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

        // Active users
        let activeUsers: number;
        if (hasRange) {
            activeUsers = await safeCount(() =>
                supabase.from('profiles').select('id', { count: 'exact', head: true })
                    .gte('last_seen_at', rangeFrom).lte('last_seen_at', rangeTo)
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
                    .gte('last_seen_at', new Date(now - day).toISOString())
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

        const { data: wsData, error: wsError } = await supabase.from('workspaces').select('id, plan, deleted_at, suspended_at, created_at');
        if (wsError) console.error('[stats] workspaces fetch error:', wsError.message);
        const allWorkspaces = wsData || [];

        const wsActive = allWorkspaces.filter((w: any) => !w.deleted_at && !w.suspended_at);
        const wsSuspended = allWorkspaces.filter((w: any) => !w.deleted_at && w.suspended_at);
        const wsDeleted = allWorkspaces.filter((w: any) => w.deleted_at);
        const wsTotal = allWorkspaces.filter((w: any) => !w.deleted_at);

        // New workspaces
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

        // Plan distribution
        const planDistribution: Record<string, number> = {};
        wsTotal.forEach((w: any) => {
            planDistribution[w.plan] = (planDistribution[w.plan] || 0) + 1;
        });

        // Active workspaces
        let activeWs = 0;
        try {
            const cutoff = hasRange ? rangeFrom : new Date(now - day).toISOString();
            let query = supabase.from('workspace_members').select('workspace_id').gte('last_active_at', cutoff);
            if (hasRange) query = query.lte('last_active_at', rangeTo);

            const { data: awData } = await query;
            if (awData) {
                activeWs = new Set(awData.map((m: any) => m.workspace_id)).size;
            }
        } catch { /* ignore */ }

        // ───────────────────────────────────────────────
        // BLOCCO 3: REVENUE
        // ───────────────────────────────────────────────

        let revenueCents = 0;
        try {
            let query = supabase
                .from('billing_events')
                .select('amount_cents')
                .eq('event_type', 'payment');

            if (hasRange) {
                query = query.gte('created_at', rangeFrom).lte('created_at', rangeTo);
            } else {
                query = query.gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
            }

            const { data: billingData } = await query;
            revenueCents = (billingData || []).reduce((sum: number, e: any) => sum + (e.amount_cents || 0), 0);
        } catch { /* billing_events may not exist */ }

        const paidWorkspaces = wsTotal.filter((w: any) => w.plan === 'premium').length;

        // ───────────────────────────────────────────────
        // BLOCCO 4: MONITORAGGIO
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
        // When a date range is active, the hero cards should show
        // period-scoped numbers to make filtering visible.
        // "recentSignups" already counts users registered in period.
        // "recentWs" already counts workspaces created in period.

        // Count workspaces that existed up to rangeTo (created before rangeTo and not deleted before rangeFrom)
        let wsInPeriod = wsTotal.length; // default: all non-deleted
        if (hasRange) {
            wsInPeriod = allWorkspaces.filter((w: any) =>
                new Date(w.created_at).toISOString() <= rangeTo &&
                (!w.deleted_at || new Date(w.deleted_at).toISOString() >= rangeFrom)
            ).length;
        }

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
                registeredInPeriod: recentSignups, // same as recentSignups but clearer name
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
            },
            revenue: {
                totalCents: revenueCents,
                totalFormatted: `€${(revenueCents / 100).toFixed(2)}`,
                paidWorkspaces,
            },
            monitoring: {
                openBugs,
                criticalBugs,
                activeBans,
            },
            dateRange: hasRange ? { from: fromParam, to: toParam } : null,
            _debug: {
                totalProfiles,
                totalMembers: allMembers.length,
                uniqueUsers,
                roles: roleCounts,
                hasRange,
                rangeFrom: hasRange ? rangeFrom : null,
                rangeTo: hasRange ? rangeTo : null,
            },
        });
    } catch (err: any) {
        console.error('[stats] Unexpected error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
