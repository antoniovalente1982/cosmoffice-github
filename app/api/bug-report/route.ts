import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// ─── PUBLIC: Create bug report (authenticated user) ───
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
    const { workspace_id, title, description, severity, category } = body;

    if (!title || !description) {
        return NextResponse.json({ error: 'Titolo e descrizione sono obbligatori' }, { status: 400 });
    }

    const validSeverities = ['low', 'medium', 'high', 'critical'];
    const bugSeverity = validSeverities.includes(severity) ? severity : 'medium';

    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Collect browser info from request
    const userAgent = req.headers.get('user-agent') || '';
    const browserInfo = {
        userAgent,
        language: req.headers.get('accept-language') || '',
        timestamp: new Date().toISOString(),
    };

    // 1. Map Severity to Priority
    const priorityMap: Record<string, string> = {
        low: 'low',
        medium: 'normal',
        high: 'high',
        critical: 'urgent'
    };
    const mappedPriority = priorityMap[bugSeverity] || 'normal';

    // 2. Append browser info to description
    const fullDescription = `${description}\n\n--- INFORMAZIONI DI SISTEMA ---\nUser Agent: ${browserInfo.userAgent}\nLingua: ${browserInfo.language}`;

    // 3. Get Requester Info
    const { data: profile } = await adminClient
        .from('profiles')
        .select('full_name, display_name, email, phone, company_name')
        .eq('id', session.user.id)
        .single();

    let requesterRole = null;
    let workspaceName = null;
    let workspaceOwnerEmail = null;

    if (workspace_id) {
        const { data: member } = await adminClient
            .from('workspace_members')
            .select('role')
            .eq('workspace_id', workspace_id)
            .eq('user_id', session.user.id)
            .is('removed_at', null)
            .single();
        requesterRole = member?.role || null;

        // Get workspace name
        const { data: ws } = await adminClient
            .from('workspaces')
            .select('name')
            .eq('id', workspace_id)
            .single();
        if (ws) workspaceName = ws.name;

        // Get owner email
        const { data: ownerMember } = await adminClient
            .from('workspace_members')
            .select('user_id')
            .eq('workspace_id', workspace_id)
            .eq('role', 'owner')
            .is('removed_at', null)
            .limit(1)
            .maybeSingle();

        if (ownerMember) {
            const { data: ownerProfile } = await adminClient
                .from('profiles')
                .select('email')
                .eq('id', ownerMember.user_id)
                .maybeSingle();
            if (ownerProfile) workspaceOwnerEmail = ownerProfile.email;
        }
    }

    const { error } = await adminClient
        .from('support_tickets')
        .insert({
            user_id: session.user.id,
            workspace_id: workspace_id || null,
            workspace_name: workspaceName,
            workspace_owner_email: workspaceOwnerEmail,
            requester_name: profile?.display_name || profile?.full_name || null,
            requester_email: profile?.email || session.user.email || null,
            requester_phone: profile?.phone || null,
            requester_role: requesterRole,
            requester_company: profile?.company_name || null,
            category: 'bug_report',
            subject: title,
            description: fullDescription,
            priority: mappedPriority,
        });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
