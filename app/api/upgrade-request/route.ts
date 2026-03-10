import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// ─── PUBLIC: Create upgrade request as a support ticket ───
export async function POST(req: NextRequest) {
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
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const { workspace_id, request_type, message } = body;

    if (!request_type || !['seats', 'workspace'].includes(request_type)) {
        return NextResponse.json({ error: 'Invalid request_type' }, { status: 400 });
    }

    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check for existing open upgrade ticket from this user
    const { data: existing } = await adminClient
        .from('support_tickets')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('category', 'upgrade')
        .in('status', ['open', 'in_progress'])
        .maybeSingle();

    if (existing) {
        return NextResponse.json({ error: 'Hai già una richiesta di upgrade in attesa', alreadyPending: true }, { status: 409 });
    }

    // Get requester info
    const { data: profile } = await adminClient
        .from('profiles')
        .select('full_name, email, phone, company_name')
        .eq('id', session.user.id)
        .single();

    // Get workspace role if applicable
    let requesterRole = null;
    if (workspace_id) {
        const { data: member } = await adminClient
            .from('workspace_members')
            .select('role')
            .eq('workspace_id', workspace_id)
            .eq('user_id', session.user.id)
            .is('removed_at', null)
            .maybeSingle();
        requesterRole = member?.role || null;
    }

    const subject = request_type === 'seats'
        ? 'Richiesta Upgrade — Più Posti'
        : 'Richiesta Upgrade — Nuovo Workspace';

    const description = message || (request_type === 'seats'
        ? 'Vorrei aumentare il numero di posti disponibili nel mio workspace.'
        : 'Vorrei aggiungere un nuovo workspace al mio account.');

    // Create as support ticket with category 'upgrade'
    const { error } = await adminClient
        .from('support_tickets')
        .insert({
            user_id: session.user.id,
            workspace_id: workspace_id || null,
            requester_name: profile?.full_name || session.user.email || null,
            requester_email: profile?.email || session.user.email || null,
            requester_phone: profile?.phone || null,
            requester_role: requesterRole,
            requester_company: profile?.company_name || null,
            category: 'upgrade',
            subject,
            description,
            priority: 'high',
            status: 'open',
        });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
