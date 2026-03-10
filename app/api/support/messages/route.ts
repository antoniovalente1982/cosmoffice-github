import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

async function getUserClient(req: NextRequest) {
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
        .select('full_name, email')
        .eq('id', session.user.id)
        .single();

    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    return {
        supabase: adminClient,
        userId: session.user.id,
        userName: profile?.full_name || session.user.email || 'Utente',
        userEmail: session.user.email || profile?.email || '',
    };
}

// GET: Get user's own tickets with message counts
export async function GET(req: NextRequest) {
    const auth = await getUserClient(req);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { supabase, userId } = auth;

    try {
        const url = new URL(req.url);
        const ticketId = url.searchParams.get('ticketId');

        // If ticketId provided, get messages for that ticket
        if (ticketId) {
            // Verify user owns this ticket
            const { data: ticket } = await supabase
                .from('support_tickets')
                .select('id, user_id')
                .eq('id', ticketId)
                .single();

            if (!ticket || ticket.user_id !== userId) {
                return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
            }

            const { data: messages } = await supabase
                .from('ticket_messages')
                .select('*')
                .eq('ticket_id', ticketId)
                .order('created_at', { ascending: true });

            return NextResponse.json({ messages: messages || [] });
        }

        // Otherwise get all user's tickets (optionally filtered by workspace)
        const workspaceId = url.searchParams.get('workspaceId');
        let ticketQuery = supabase
            .from('support_tickets')
            .select('id, subject, category, priority, status, created_at, updated_at, workspace_id')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (workspaceId) {
            ticketQuery = ticketQuery.eq('workspace_id', workspaceId);
        }

        const { data: tickets } = await ticketQuery;

        // Get unread message counts (admin messages after last user message)
        const ticketIds = (tickets || []).map((t: any) => t.id);
        let unreadCounts: Record<string, number> = {};

        if (ticketIds.length > 0) {
            const { data: msgs } = await supabase
                .from('ticket_messages')
                .select('ticket_id, is_admin, created_at')
                .in('ticket_id', ticketIds)
                .order('created_at', { ascending: false });

            // For each ticket, count admin messages after the last user message
            ticketIds.forEach((tid: string) => {
                const ticketMsgs = (msgs || []).filter((m: any) => m.ticket_id === tid);
                const lastUserMsg = ticketMsgs.find((m: any) => !m.is_admin);
                const lastUserTime = lastUserMsg?.created_at || '1970-01-01';
                unreadCounts[tid] = ticketMsgs.filter((m: any) => m.is_admin && m.created_at > lastUserTime).length;
            });
        }

        return NextResponse.json({
            tickets: (tickets || []).map((t: any) => ({
                ...t,
                unreadCount: unreadCounts[t.id] || 0,
            })),
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST: User sends a message on their own ticket
export async function POST(req: NextRequest) {
    const auth = await getUserClient(req);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { supabase, userId, userName, userEmail } = auth;

    try {
        const { ticketId, message } = await req.json();
        if (!ticketId || !message?.trim()) {
            return NextResponse.json({ error: 'ticketId and message required' }, { status: 400 });
        }

        // Verify user owns this ticket
        const { data: ticket } = await supabase
            .from('support_tickets')
            .select('id, user_id, status')
            .eq('id', ticketId)
            .single();

        if (!ticket || ticket.user_id !== userId) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        // Don't allow messages on closed tickets
        if (ticket.status === 'closed') {
            return NextResponse.json({ error: 'This ticket is closed' }, { status: 400 });
        }

        // Insert message
        const { data: msg, error } = await supabase
            .from('ticket_messages')
            .insert({
                ticket_id: ticketId,
                sender_id: userId,
                sender_name: userName,
                sender_email: userEmail,
                is_admin: false,
                message: message.trim(),
            })
            .select()
            .single();

        if (error) throw error;

        // If ticket was resolved, re-open it
        if (ticket.status === 'resolved') {
            await supabase
                .from('support_tickets')
                .update({ status: 'open', updated_at: new Date().toISOString() })
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

// DELETE: User deletes their own ticket (hard delete)
export async function DELETE(req: NextRequest) {
    const auth = await getUserClient(req);
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { supabase, userId } = auth;

    try {
        const url = new URL(req.url);
        const ticketId = url.searchParams.get('ticketId');
        if (!ticketId) return NextResponse.json({ error: 'ticketId required' }, { status: 400 });

        // Verify user owns this ticket
        const { data: ticket } = await supabase
            .from('support_tickets')
            .select('id, user_id')
            .eq('id', ticketId)
            .single();

        if (!ticket || ticket.user_id !== userId) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        // Delete ticket (messages cascade via FK)
        const { error } = await supabase
            .from('support_tickets')
            .delete()
            .eq('id', ticketId);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
