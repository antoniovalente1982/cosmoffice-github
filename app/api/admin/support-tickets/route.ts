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
        // 1. Get global status counts AND unread reply counts per status
        const { data: allTickets } = await supabase
            .from('support_tickets')
            .select('id, status');

        const statusCounts = {
            open: 0, in_progress: 0, resolved: 0, closed: 0, total: 0,
        };
        const allTicketIds = (allTickets || []).map((t: any) => t.id);
        const ticketStatusMap: Record<string, string> = {};
        (allTickets || []).forEach((t: any) => {
            statusCounts.total++;
            if (t.status === 'open') statusCounts.open++;
            else if (t.status === 'in_progress') statusCounts.in_progress++;
            else if (t.status === 'resolved') statusCounts.resolved++;
            else if (t.status === 'closed') statusCounts.closed++;
            ticketStatusMap[t.id] = t.status;
        });

        // Compute global unread reply counts per status
        const unreadByStatus = { open: 0, in_progress: 0, resolved: 0, closed: 0, total: 0 };
        if (allTicketIds.length > 0) {
            const { data: allMsgs } = await supabase
                .from('ticket_messages')
                .select('ticket_id, is_admin, created_at')
                .in('ticket_id', allTicketIds)
                .order('created_at', { ascending: false });

            allTicketIds.forEach((tid: string) => {
                const ticketMsgs = (allMsgs || []).filter((m: any) => m.ticket_id === tid);
                const lastAdminMsg = ticketMsgs.find((m: any) => m.is_admin);
                const lastAdminTime = lastAdminMsg?.created_at || '1970-01-01';
                const unread = ticketMsgs.filter((m: any) => !m.is_admin && m.created_at > lastAdminTime).length;
                if (unread > 0) {
                    const st = ticketStatusMap[tid];
                    if (st === 'open') unreadByStatus.open += unread;
                    else if (st === 'in_progress') unreadByStatus.in_progress += unread;
                    else if (st === 'resolved') unreadByStatus.resolved += unread;
                    else if (st === 'closed') unreadByStatus.closed += unread;
                    unreadByStatus.total += unread;
                }
            });
        }

        // 2. Get filtered tickets for the list
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

        // 3. Compute unread user message counts for each ticket
        const ticketIds = (data || []).map((t: any) => t.id);
        let unreadCounts: Record<string, number> = {};

        if (ticketIds.length > 0) {
            const { data: msgs } = await supabase
                .from('ticket_messages')
                .select('ticket_id, is_admin, created_at')
                .in('ticket_id', ticketIds)
                .order('created_at', { ascending: false });

            ticketIds.forEach((tid: string) => {
                const ticketMsgs = (msgs || []).filter((m: any) => m.ticket_id === tid);
                const lastAdminMsg = ticketMsgs.find((m: any) => m.is_admin);
                const lastAdminTime = lastAdminMsg?.created_at || '1970-01-01';
                unreadCounts[tid] = ticketMsgs.filter((m: any) => !m.is_admin && m.created_at > lastAdminTime).length;
            });
        }

        return NextResponse.json({
            tickets: (data || []).map((t: any) => ({
                ...t,
                unreadUserCount: unreadCounts[t.id] || 0,
            })),
            statusCounts,
            unreadByStatus,
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

// DELETE: Hard-delete ticket(s) and their messages
export async function DELETE(req: NextRequest) {
    const auth = await getAdminClient(req);
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase } = auth;

    try {
        const body = await req.json();
        const { id, deleteAll } = body;

        if (deleteAll) {
            // Delete ALL ticket messages first, then ALL tickets
            await supabase.from('ticket_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('support_tickets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            return NextResponse.json({ success: true, deleted: 'all' });
        }

        if (!id) return NextResponse.json({ error: 'Missing ticket id' }, { status: 400 });

        // Delete messages for this ticket first, then the ticket itself
        await supabase.from('ticket_messages').delete().eq('ticket_id', id);
        const { error } = await supabase.from('support_tickets').delete().eq('id', id);
        if (error) throw error;

        return NextResponse.json({ success: true, deleted: id });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
