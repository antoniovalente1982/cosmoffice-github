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
        .select('is_super_admin, is_support_staff, full_name, email')
        .eq('id', session.user.id)
        .single();

    if (!profile?.is_super_admin && !profile?.is_support_staff) {
        return { error: 'Forbidden', status: 403 };
    }

    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    return {
        supabase: adminClient,
        userId: session.user.id,
        userEmail: session.user.email || profile.email || '',
        userName: profile.full_name || session.user.email || 'Admin',
        isSuperAdmin: profile.is_super_admin,
    };
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

// POST: Send a message on a ticket (admin chat reply)
export async function POST(req: NextRequest) {
    const auth = await getAdminClient(req);
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase, userId, userName, userEmail } = auth;

    try {
        const body = await req.json();

        // If action is 'get_messages', return messages for a specific ticket
        if (body.action === 'get_messages') {
            const { ticketId } = body;
            if (!ticketId) return NextResponse.json({ error: 'ticketId required' }, { status: 400 });

            const { data: messages, error } = await supabase
                .from('ticket_messages')
                .select('*')
                .eq('ticket_id', ticketId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return NextResponse.json({ messages: messages || [] });
        }

        // Default action: send message
        const { ticketId, message } = body;
        if (!ticketId || !message?.trim()) {
            return NextResponse.json({ error: 'ticketId and message required' }, { status: 400 });
        }

        // Insert the message
        const { data: msg, error: msgError } = await supabase
            .from('ticket_messages')
            .insert({
                ticket_id: ticketId,
                sender_id: userId,
                sender_name: userName,
                sender_email: userEmail,
                is_admin: true,
                message: message.trim(),
            })
            .select()
            .single();

        if (msgError) throw msgError;

        // If ticket is 'open', automatically set to 'in_progress'
        const { data: ticket } = await supabase
            .from('support_tickets')
            .select('status')
            .eq('id', ticketId)
            .single();

        if (ticket?.status === 'open') {
            await supabase
                .from('support_tickets')
                .update({ status: 'in_progress', updated_at: new Date().toISOString() })
                .eq('id', ticketId);
        } else {
            await supabase
                .from('support_tickets')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', ticketId);
        }

        return NextResponse.json({ success: true, message: msg });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
