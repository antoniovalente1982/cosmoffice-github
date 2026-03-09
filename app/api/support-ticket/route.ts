import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// ─── PUBLIC: Create support ticket (authenticated user) ───
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
    const { workspace_id, category, subject, description, priority } = body;

    if (!subject || !description) {
        return NextResponse.json({ error: 'Oggetto e descrizione sono obbligatori' }, { status: 400 });
    }

    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get requester info
    const { data: profile } = await adminClient
        .from('profiles')
        .select('full_name, display_name, email, phone, company_name')
        .eq('id', session.user.id)
        .single();

    // Get workspace role if workspace_id provided
    let requesterRole = null;
    if (workspace_id) {
        const { data: member } = await adminClient
            .from('workspace_members')
            .select('role')
            .eq('workspace_id', workspace_id)
            .eq('user_id', session.user.id)
            .is('removed_at', null)
            .single();
        requesterRole = member?.role || null;
    }

    const { error } = await adminClient
        .from('support_tickets')
        .insert({
            user_id: session.user.id,
            workspace_id: workspace_id || null,
            requester_name: profile?.display_name || profile?.full_name || null,
            requester_email: profile?.email || session.user.email || null,
            requester_phone: profile?.phone || null,
            requester_role: requesterRole,
            requester_company: profile?.company_name || null,
            category: category || 'general',
            subject,
            description,
            priority: priority || 'normal',
        });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
