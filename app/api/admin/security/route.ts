import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

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

// GET - Login events, active bans, suspicious activity
export async function GET(req: NextRequest) {
    const auth = await getAdminClient(req);
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase } = auth;

    const url = new URL(req.url);
    const section = url.searchParams.get('section') || 'overview';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '30');
    const offset = (page - 1) * limit;

    try {
        switch (section) {
            case 'overview': {
                const [failedLoginsRes, bansRes, suspendedRes, recentLoginsRes] = await Promise.all([
                    // Failed logins in last 24h
                    supabase.from('login_events')
                        .select('id', { count: 'exact', head: true })
                        .eq('event_type', 'failed_login')
                        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
                    // Active bans
                    supabase.from('workspace_bans')
                        .select('id', { count: 'exact', head: true })
                        .is('revoked_at', null)
                        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
                    // Suspended users
                    supabase.from('workspace_members')
                        .select('id', { count: 'exact', head: true })
                        .eq('is_suspended', true),
                    // Last 10 logins
                    supabase.from('login_events')
                        .select('id, user_id, email, event_type, ip_address, country, city, success, created_at')
                        .order('created_at', { ascending: false })
                        .limit(10),
                ]);

                return NextResponse.json({
                    failedLogins24h: failedLoginsRes.count || 0,
                    activeBans: bansRes.count || 0,
                    suspendedUsers: suspendedRes.count || 0,
                    recentLogins: recentLoginsRes.data || [],
                });
            }

            case 'logins': {
                const eventType = url.searchParams.get('event_type') || '';
                let query = supabase
                    .from('login_events')
                    .select('id, user_id, email, event_type, ip_address, user_agent, country, city, success, failure_reason, created_at', { count: 'exact' })
                    .order('created_at', { ascending: false })
                    .range(offset, offset + limit - 1);

                if (eventType) query = query.eq('event_type', eventType);

                const { data, count, error } = await query;
                if (error) throw error;
                return NextResponse.json({ events: data, total: count, page });
            }

            case 'bans': {
                const { data, count, error } = await supabase
                    .from('workspace_bans')
                    .select(`
            id, workspace_id, user_id, ban_type, reason, expires_at, created_at,
            workspaces(name),
            profiles:user_id(email, full_name, display_name)
          `, { count: 'exact' })
                    .is('revoked_at', null)
                    .order('created_at', { ascending: false })
                    .range(offset, offset + limit - 1);

                if (error) throw error;
                return NextResponse.json({ bans: data, total: count, page });
            }

            case 'suspended': {
                const { data, count, error } = await supabase
                    .from('workspace_members')
                    .select(`
            id, workspace_id, user_id, role, is_suspended, suspended_at, suspend_reason,
            workspaces(name),
            profiles:user_id(email, full_name, display_name)
          `, { count: 'exact' })
                    .eq('is_suspended', true)
                    .order('suspended_at', { ascending: false })
                    .range(offset, offset + limit - 1);

                if (error) throw error;
                return NextResponse.json({ suspended: data, total: count, page });
            }

            default:
                return NextResponse.json({ error: 'Unknown section' }, { status: 400 });
        }
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
