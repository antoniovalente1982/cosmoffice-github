import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: requests, error } = await supabase
        .from('upgrade_requests')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Enrich with user and workspace info
    const userIds = Array.from(new Set((requests || []).map((r: any) => r.user_id)));
    const wsIds = Array.from(new Set((requests || []).filter((r: any) => r.workspace_id).map((r: any) => r.workspace_id)));

    let profileMap: Record<string, any> = {};
    if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, email, full_name, display_name, phone, company_name').in('id', userIds);
        (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
    }

    let wsMap: Record<string, any> = {};
    if (wsIds.length > 0) {
        const { data: workspaces } = await supabase.from('workspaces').select('id, name, max_capacity').in('id', wsIds);
        (workspaces || []).forEach((w: any) => { wsMap[w.id] = w; });
    }

    // Count members per workspace
    let memberCounts: Record<string, number> = {};
    if (wsIds.length > 0) {
        const { data: members } = await supabase
            .from('workspace_members')
            .select('workspace_id')
            .in('workspace_id', wsIds);
        (members || []).forEach((m: any) => {
            memberCounts[m.workspace_id] = (memberCounts[m.workspace_id] || 0) + 1;
        });
    }

    // Get workspace roles for each user
    let roleMap: Record<string, string> = {};
    for (const r of (requests || [])) {
        if (r.workspace_id) {
            const { data: member } = await supabase
                .from('workspace_members')
                .select('role')
                .eq('workspace_id', r.workspace_id)
                .eq('user_id', r.user_id)
                .is('removed_at', null)
                .maybeSingle();
            if (member) roleMap[`${r.user_id}_${r.workspace_id}`] = member.role;
        }
    }

    const enriched = (requests || []).map((r: any) => {
        const profile = profileMap[r.user_id];
        const ws = r.workspace_id ? wsMap[r.workspace_id] : null;
        const roleKey = `${r.user_id}_${r.workspace_id}`;
        return {
            ...r,
            user_email: profile?.email || null,
            user_name: profile?.display_name || profile?.full_name || null,
            user_phone: profile?.phone || r.requester_phone || null,
            user_company: profile?.company_name || r.requester_company || null,
            user_role: roleMap[roleKey] || r.requester_role || null,
            workspace_name: ws?.name || null,
            current_seats: ws?.max_capacity || null,
            used_seats: r.workspace_id ? (memberCounts[r.workspace_id] || 0) : null,
        };
    });

    return NextResponse.json({ requests: enriched });
}

export async function POST(req: NextRequest) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await req.json();
    const { action, requestId, status } = body;

    if (action === 'update_status') {
        if (!requestId || !status) {
            return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        }

        const { error } = await supabase
            .from('upgrade_requests')
            .update({
                status,
                resolved_at: new Date().toISOString(),
            })
            .eq('id', requestId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
