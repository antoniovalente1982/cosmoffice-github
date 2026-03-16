import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { inviteId, workspaceId } = await request.json();
        if (!inviteId || !workspaceId) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // Verify the user has permission to revoke invites in this workspace
        const { data: membership, error: membershipError } = await supabase
            .from('workspace_members')
            .select('role')
            .eq('workspace_id', workspaceId)
            .eq('user_id', user.id)
            .is('removed_at', null)
            .single();

        if (membershipError || !membership || !['owner', 'admin', 'member'].includes(membership.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const adminClient = createAdminClient();

        // 1. Only remove ANONYMOUS GUEST members that used this invitation
        // Registered users (admin, member) who already joined should STAY in the workspace
        const { data: membersUsingInvite } = await adminClient
            .from('workspace_members')
            .select('user_id, role')
            .eq('invitation_id', inviteId);

        if (membersUsingInvite && membersUsingInvite.length > 0) {
            for (const member of membersUsingInvite) {
                const { data: { user: targetUser } } = await adminClient.auth.admin.getUserById(member.user_id);

                // Only remove anonymous/guest users — registered users keep their membership
                if (targetUser?.is_anonymous) {
                    // Hard delete from workspace_members (free the seat)
                    await adminClient
                        .from('workspace_members')
                        .delete()
                        .eq('user_id', member.user_id)
                        .eq('workspace_id', workspaceId);

                    // Delete the anonymous Auth account entirely
                    await adminClient.auth.admin.deleteUser(member.user_id);
                }
                // Registered admin/member users are NOT removed — they stay in the workspace
            }
        }

        // 3. Finally, delete the invitation itself
        const { error: deleteError } = await adminClient
            .from('workspace_invitations')
            .delete()
            .eq('id', inviteId);

        if (deleteError) {
            throw deleteError;
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[Revoke Invite Error]:', err);
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}
