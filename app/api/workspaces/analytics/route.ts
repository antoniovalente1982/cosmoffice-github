import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
        return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
    }

    const supabase = await createClient();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Total members count
    const { count: totalMembers } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .is('removed_at', null);

    // 2. Members by role
    const { data: roleData } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .is('removed_at', null);

    const roleCounts = (roleData || []).reduce((acc: Record<string, number>, m) => {
        acc[m.role] = (acc[m.role] || 0) + 1;
        return acc;
    }, {});

    // 3. Recent member joins (last 30 days)
    const { count: recentJoins } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('created_at', thirtyDaysAgo.toISOString());

    // 4. Rooms count
    const { data: spaces } = await supabase
        .from('spaces')
        .select('id')
        .eq('workspace_id', workspaceId);

    let totalRooms = 0;
    if (spaces && spaces.length > 0) {
        const spaceIds = spaces.map(s => s.id);
        const { count } = await supabase
            .from('rooms')
            .select('*', { count: 'exact', head: true })
            .in('space_id', spaceIds);
        totalRooms = count || 0;
    }

    // 5. Guest invite count (active)
    const { count: activeInvites } = await supabase
        .from('workspace_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'active');

    return NextResponse.json({
        totalMembers: totalMembers || 0,
        roleCounts,
        recentJoins: recentJoins || 0,
        totalRooms,
        activeInvites: activeInvites || 0,
        period: '30d',
        generatedAt: now.toISOString(),
    });
}
