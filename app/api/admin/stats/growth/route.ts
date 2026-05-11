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

    return {
        supabase: createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        ),
    };
}

export async function GET(req: NextRequest) {
    const auth = await getAdminClient(req);
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase } = auth;

    try {
        // Get all profiles with created_at
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, created_at')
            .order('created_at', { ascending: true });

        // Get all workspaces with created_at & monthly_amount_cents
        const { data: workspaces } = await supabase
            .from('workspaces')
            .select('id, created_at, deleted_at, monthly_amount_cents, plan')
            .is('deleted_at', null);

        // Get all payments
        const { data: payments } = await supabase
            .from('payments')
            .select('amount_cents, payment_date, type')
            .eq('type', 'payment')
            .order('payment_date', { ascending: true });

        const allProfiles = profiles || [];
        const allWorkspaces = workspaces || [];
        const allPayments = payments || [];

        // Determine the range: from the earliest record to now
        const now = new Date();
        let earliest = now;
        if (allProfiles.length > 0) {
            const d = new Date(allProfiles[0].created_at);
            if (d < earliest) earliest = d;
        }
        if (allWorkspaces.length > 0) {
            const d = new Date(allWorkspaces[0].created_at);
            if (d < earliest) earliest = d;
        }

        // Generate months from earliest to now
        const months: { key: string; label: string; year: number; month: number }[] = [];
        const startYear = earliest.getFullYear();
        const startMonth = earliest.getMonth();
        const endYear = now.getFullYear();
        const endMonth = now.getMonth();

        for (let y = startYear; y <= endYear; y++) {
            const mStart = y === startYear ? startMonth : 0;
            const mEnd = y === endYear ? endMonth : 11;
            for (let m = mStart; m <= mEnd; m++) {
                const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
                months.push({
                    key: `${y}-${String(m + 1).padStart(2, '0')}`,
                    label: `${monthNames[m]} ${y}`,
                    year: y,
                    month: m,
                });
            }
        }

        // Calculate cumulative clients per month
        let cumulativeClients = 0;
        const data = months.map(({ key, label, year, month }) => {
            const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
            const monthStart = new Date(year, month, 1);

            // New clients this month
            const newClients = allProfiles.filter(p => {
                const d = new Date(p.created_at);
                return d >= monthStart && d <= monthEnd;
            }).length;
            cumulativeClients += newClients;

            // Active workspaces at this point
            const activeWorkspaces = allWorkspaces.filter(w => {
                const created = new Date(w.created_at);
                return created <= monthEnd;
            }).length;

            // MRR at this point (sum monthly_amount_cents for workspaces created by this month)
            const mrr = allWorkspaces
                .filter(w => {
                    const created = new Date(w.created_at);
                    return created <= monthEnd && (w.monthly_amount_cents || 0) > 0;
                })
                .reduce((sum, w) => sum + (w.monthly_amount_cents || 0), 0);

            // Revenue collected this month
            const monthRevenue = allPayments
                .filter(p => {
                    const d = new Date(p.payment_date);
                    return d >= monthStart && d <= monthEnd;
                })
                .reduce((sum, p) => sum + (p.amount_cents || 0), 0);

            return {
                month: key,
                label,
                clients: cumulativeClients,
                newClients,
                workspaces: activeWorkspaces,
                mrr,
                revenue: monthRevenue,
            };
        });

        return NextResponse.json({ data });
    } catch (err: any) {
        console.error('[stats/growth] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
