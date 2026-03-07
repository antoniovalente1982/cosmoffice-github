import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// ─── PUBLIC: Create upgrade request (authenticated user) ───
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

    // Check for existing pending request of same type
    const { data: existing } = await adminClient
        .from('upgrade_requests')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('request_type', request_type)
        .eq('status', 'pending')
        .maybeSingle();

    if (existing) {
        return NextResponse.json({ error: 'Hai già una richiesta in attesa', alreadyPending: true }, { status: 409 });
    }

    const { error } = await adminClient
        .from('upgrade_requests')
        .insert({
            user_id: session.user.id,
            workspace_id: workspace_id || null,
            request_type,
            message: message || null,
        });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
