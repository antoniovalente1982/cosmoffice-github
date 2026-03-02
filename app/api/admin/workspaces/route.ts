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

export async function GET(req: NextRequest) {
    const auth = await getAdminClient(req);
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase } = auth;

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';
    const plan = url.searchParams.get('plan') || '';
    const offset = (page - 1) * limit;

    try {
        let query = supabase
            .from('workspaces')
            .select(`
        id, name, slug, plan, max_members, max_spaces,
        created_at, updated_at, deleted_at,
        workspace_members(id, user_id, role, joined_at, last_active_at, is_suspended, removed_at)
      `, { count: 'exact' })
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (search) {
            query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
        }
        if (plan) {
            query = query.eq('plan', plan);
        }

        const { data, count, error } = await query;
        if (error) throw error;

        // Enrich with member counts
        const enriched = (data || []).map((ws: any) => {
            const members = ws.workspace_members || [];
            const activeMembers = members.filter((m: any) => !m.removed_at && !m.is_suspended);
            const owner = members.find((m: any) => m.role === 'owner');
            return {
                id: ws.id,
                name: ws.name,
                slug: ws.slug,
                plan: ws.plan,
                maxMembers: ws.max_members,
                maxSpaces: ws.max_spaces,
                totalMembers: activeMembers.length,
                suspendedMembers: members.filter((m: any) => m.is_suspended).length,
                ownerUserId: owner?.user_id || null,
                createdAt: ws.created_at,
                lastActivity: Math.max(...members.map((m: any) => new Date(m.last_active_at || 0).getTime())) || null,
            };
        });

        return NextResponse.json({
            workspaces: enriched,
            total: count || 0,
            page,
            totalPages: Math.ceil((count || 0) / limit),
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await getAdminClient(req);
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase } = auth;

    try {
        const body = await req.json();
        const { action, workspaceId, data } = body;

        switch (action) {
            case 'change_plan': {
                const { data: ws, error } = await supabase
                    .from('workspaces')
                    .update({ plan: data.plan })
                    .eq('id', workspaceId)
                    .select()
                    .single();
                if (error) throw error;

                // Log billing event
                await supabase.from('billing_events').insert({
                    workspace_id: workspaceId,
                    event_type: 'plan_upgrade',
                    plan_from: data.planFrom,
                    plan_to: data.plan,
                });

                return NextResponse.json({ success: true, workspace: ws });
            }

            case 'suspend_workspace': {
                // Suspend all members
                const { error } = await supabase
                    .from('workspace_members')
                    .update({ is_suspended: true, suspended_at: new Date().toISOString() })
                    .eq('workspace_id', workspaceId);
                if (error) throw error;
                return NextResponse.json({ success: true });
            }

            case 'delete_workspace': {
                // Soft delete
                const { error } = await supabase
                    .from('workspaces')
                    .update({ deleted_at: new Date().toISOString() })
                    .eq('id', workspaceId);
                if (error) throw error;
                return NextResponse.json({ success: true });
            }

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
