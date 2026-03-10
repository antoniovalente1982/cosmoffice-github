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

    const { error } = await adminClient
        .from('bug_reports')
        .insert({
            reporter_id: session.user.id,
            workspace_id: workspace_id || null,
            title,
            description,
            severity: bugSeverity,
            status: 'open',
            category: category || 'general',
            browser_info: browserInfo,
        });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
