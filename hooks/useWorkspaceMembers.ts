'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';

type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest';

export interface WorkspaceMemberWithProfile {
    id: string;
    workspace_id: string;
    user_id: string;
    role: WorkspaceRole;
    joined_at: string;
    removed_at: string | null;
    is_suspended: boolean;
    profile: {
        id: string;
        email: string;
        full_name: string | null;
        avatar_url: string | null;
        status: string;
    } | null;
}

interface PendingInvitation {
    id: string;
    workspace_id: string;
    email: string;
    role: WorkspaceRole;
    invited_by: string | null;
    invited_at: string;
    expires_at: string;
    accepted_at: string | null;
}

interface UseWorkspaceMembersReturn {
    members: WorkspaceMemberWithProfile[];
    invitations: PendingInvitation[];
    loading: boolean;
    error: string | null;
    inviteMember: (email: string, role: WorkspaceRole) => Promise<{ success: boolean; error?: string }>;
    removeMember: (userId: string) => Promise<{ success: boolean; error?: string }>;
    changeRole: (userId: string, newRole: WorkspaceRole) => Promise<{ success: boolean; error?: string }>;
    cancelInvitation: (invitationId: string) => Promise<{ success: boolean; error?: string }>;
    refetch: () => Promise<void>;
}

export function useWorkspaceMembers(workspaceId: string | null): UseWorkspaceMembersReturn {
    const [members, setMembers] = useState<WorkspaceMemberWithProfile[]>([]);
    const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const supabase = createClient();

    const fetchMembers = useCallback(async () => {
        if (!workspaceId) {
            setMembers([]);
            setInvitations([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Fetch members with profiles
            const { data: membersData, error: membersError } = await supabase
                .from('workspace_members')
                .select(`
          id,
          workspace_id,
          user_id,
          role,
          joined_at,
          removed_at,
          is_suspended,
          profiles:user_id (
            id,
            email,
            full_name,
            avatar_url,
            status
          )
        `)
                .eq('workspace_id', workspaceId)
                .is('removed_at', null)
                .order('joined_at', { ascending: true });

            if (membersError) throw membersError;

            const formattedMembers: WorkspaceMemberWithProfile[] = (membersData || []).map((m: any) => ({
                id: m.id,
                workspace_id: m.workspace_id,
                user_id: m.user_id,
                role: m.role as WorkspaceRole,
                joined_at: m.joined_at,
                removed_at: m.removed_at,
                is_suspended: m.is_suspended,
                profile: m.profiles || null,
            }));

            // Sort: owners first, then admins, then members, etc.
            const roleOrder: Record<string, number> = { owner: 0, admin: 1, member: 2, guest: 3 };
            formattedMembers.sort((a, b) => (roleOrder[a.role] || 5) - (roleOrder[b.role] || 5));

            setMembers(formattedMembers);

            // Fetch pending invitations
            const { data: invData } = await supabase
                .from('workspace_invitations')
                .select('*')
                .eq('workspace_id', workspaceId)
                .is('accepted_at', null)
                .gt('expires_at', new Date().toISOString());

            setInvitations((invData || []) as PendingInvitation[]);
        } catch (err: any) {
            console.error('Error fetching workspace members:', err);
            setError(err.message || 'Failed to load members');
        } finally {
            setLoading(false);
        }
    }, [workspaceId, supabase]);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    const inviteMember = useCallback(async (email: string, role: WorkspaceRole): Promise<{ success: boolean; error?: string }> => {
        if (!workspaceId) return { success: false, error: 'No workspace selected' };

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { success: false, error: 'Not authenticated' };

            // Check if user is already a member
            const existingMember = members.find(m => m.profile?.email === email);
            if (existingMember) return { success: false, error: 'This user is already a member' };

            // Check if invitation already exists
            const existingInvite = invitations.find(i => i.email === email);
            if (existingInvite) return { success: false, error: 'An invitation has already been sent to this email' };

            // Create invitation
            const { error: invError } = await supabase
                .from('workspace_invitations')
                .insert({
                    workspace_id: workspaceId,
                    email: email.trim().toLowerCase(),
                    role,
                    invited_by: user.id,
                });

            if (invError) {
                if (invError.code === '23505') {
                    return { success: false, error: 'An invitation already exists for this email' };
                }
                throw invError;
            }

            await fetchMembers();
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message || 'Failed to send invitation' };
        }
    }, [workspaceId, members, invitations, supabase, fetchMembers]);

    const removeMember = useCallback(async (userId: string): Promise<{ success: boolean; error?: string }> => {
        if (!workspaceId) return { success: false, error: 'No workspace selected' };

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { success: false, error: 'Not authenticated' };

            // Can't remove yourself (use leave)
            if (userId === user.id) return { success: false, error: "Can't remove yourself. Use Leave instead." };

            // Soft delete
            const { error: rmError } = await supabase
                .from('workspace_members')
                .update({
                    removed_at: new Date().toISOString(),
                    removed_by: user.id,
                    remove_reason: 'Removed by admin',
                })
                .eq('workspace_id', workspaceId)
                .eq('user_id', userId);

            if (rmError) throw rmError;

            await fetchMembers();
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message || 'Failed to remove member' };
        }
    }, [workspaceId, supabase, fetchMembers]);

    const changeRole = useCallback(async (userId: string, newRole: WorkspaceRole): Promise<{ success: boolean; error?: string }> => {
        if (!workspaceId) return { success: false, error: 'No workspace selected' };

        try {
            const { error: roleError } = await supabase
                .from('workspace_members')
                .update({ role: newRole })
                .eq('workspace_id', workspaceId)
                .eq('user_id', userId);

            if (roleError) throw roleError;

            await fetchMembers();
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message || 'Failed to change role' };
        }
    }, [workspaceId, supabase, fetchMembers]);

    const cancelInvitation = useCallback(async (invitationId: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { error: delError } = await supabase
                .from('workspace_invitations')
                .delete()
                .eq('id', invitationId);

            if (delError) throw delError;

            await fetchMembers();
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message || 'Failed to cancel invitation' };
        }
    }, [supabase, fetchMembers]);

    return {
        members,
        invitations,
        loading,
        error,
        inviteMember,
        removeMember,
        changeRole,
        cancelInvitation,
        refetch: fetchMembers,
    };
}
