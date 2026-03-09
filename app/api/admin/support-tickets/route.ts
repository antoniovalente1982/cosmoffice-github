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
        .select('is_super_admin, is_support_staff')
        .eq('id', session.user.id)
        .single();

    if (!profile?.is_super_admin && !profile?.is_support_staff) {
        return { error: 'Forbidden', status: 403 };
    }

    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    return { supabase: adminClient, userId: session.user.id, isSuperAdmin: profile.is_super_admin };
}

// GET: List all support tickets
export async function GET(req: NextRequest) {
    const auth = await getAdminClient(req);
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase } = auth;

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '30');
    const status = url.searchParams.get('status') || '';
    const category = url.searchParams.get('category') || '';
    const offset = (page - 1) * limit;

    try {
        let query = supabase
            .from('support_tickets')
            .select(`
                id, user_id, workspace_id,
                requester_name, requester_email, requester_phone, requester_role, requester_company,
                category, subject, description, priority, status,
                assigned_to, admin_notes, resolution, resolved_at, resolved_by,
                created_at, updated_at
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) query = query.eq('status', status);
        if (category) query = query.eq('category', category);

        const { data, count, error } = await query;
        if (error) throw error;

        return NextResponse.json({
            tickets: data,
            total: count || 0,
            page,
            totalPages: Math.ceil((count || 0) / limit),
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// PATCH: Update a support ticket (status, notes, assignment, resolution)
export async function PATCH(req: NextRequest) {
    const auth = await getAdminClient(req);
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase, userId } = auth;

    try {
        const body = await req.json();
        const { id, status, admin_notes, resolution, assigned_to } = body;

        if (!id) return NextResponse.json({ error: 'Missing ticket id' }, { status: 400 });

        const update: any = {};
        if (status) update.status = status;
        if (admin_notes !== undefined) update.admin_notes = admin_notes;
        if (resolution !== undefined) update.resolution = resolution;
        if (assigned_to !== undefined) update.assigned_to = assigned_to;
        if (status === 'resolved' || status === 'closed') {
            update.resolved_at = new Date().toISOString();
            update.resolved_by = userId;
        }

        const { data, error } = await supabase
            .from('support_tickets')
            .update(update)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ success: true, ticket: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
