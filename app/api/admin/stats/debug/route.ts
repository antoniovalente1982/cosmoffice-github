import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // Auth check
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

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', session.user.id)
        .single();
    if (!profile?.is_super_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Use service role
    const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Debug: count profiles
    const { count: profileCount, error: pErr } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true });

    // Debug: get all workspace_members
    const { data: allWm, error: wmErr } = await admin
        .from('workspace_members')
        .select('user_id, role, removed_at')
        .is('removed_at', null);

    const wmRows = allWm || [];
    const uniqueIds = new Set(wmRows.map((m: any) => m.user_id));

    const roleSets: Record<string, Set<string>> = {
        owner: new Set(), admin: new Set(), member: new Set(), guest: new Set()
    };
    for (const m of wmRows) {
        const role = (m.role || '').toLowerCase();
        if (roleSets[role]) roleSets[role].add(m.user_id);
    }

    // Super admins
    const { count: saCount } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_super_admin', true);

    return NextResponse.json({
        debug: true,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        profileCount,
        profileError: pErr?.message || null,
        wmRowCount: wmRows.length,
        wmError: wmErr?.message || null,
        wmUniqueUsers: uniqueIds.size,
        wmRawData: wmRows.map((m: any) => ({ user_id: m.user_id?.substring(0, 8), role: m.role })),
        roleCounts: {
            owner: roleSets.owner.size,
            admin: roleSets.admin.size,
            member: roleSets.member.size,
            guest: roleSets.guest.size,
        },
        superAdmins: saCount,
        totalCalculated: profileCount,
    });
}
