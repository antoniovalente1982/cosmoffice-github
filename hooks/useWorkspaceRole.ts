'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';

type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest' | 'viewer';

interface WorkspaceRoleData {
    role: WorkspaceRole | null;
    loading: boolean;
    isOwner: boolean;
    isAdmin: boolean;
    isMember: boolean;
    isGuest: boolean;
    canManageMembers: boolean;
    canEditRooms: boolean;
    canModerateChat: boolean;
    canManageWorkspace: boolean;
    canInvite: boolean;
    canKick: boolean;
    canBan: boolean;
    refetch: () => Promise<void>;
}

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
    owner: 4,
    admin: 3,
    member: 2,
    guest: 1,
    viewer: 0,
};

export function useWorkspaceRole(workspaceId: string | null): WorkspaceRoleData {
    const [role, setRole] = useState<WorkspaceRole | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchRole = async () => {
        if (!workspaceId) {
            setRole(null);
            setLoading(false);
            return;
        }

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setRole(null);
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('workspace_members')
            .select('role')
            .eq('workspace_id', workspaceId)
            .eq('user_id', user.id)
            .is('removed_at', null)
            .single();

        if (error || !data) {
            // Fallback: check if user is workspace creator
            const { data: ws } = await supabase
                .from('workspaces')
                .select('created_by')
                .eq('id', workspaceId)
                .single();

            if (ws?.created_by === user.id) {
                setRole('owner');
            } else {
                setRole(null);
            }
        } else {
            setRole(data.role as WorkspaceRole);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchRole();
    }, [workspaceId]);

    const level = role ? ROLE_HIERARCHY[role] : -1;

    return {
        role,
        loading,
        isOwner: role === 'owner',
        isAdmin: level >= ROLE_HIERARCHY.admin,
        isMember: level >= ROLE_HIERARCHY.member,
        isGuest: level >= ROLE_HIERARCHY.guest,
        canManageMembers: level >= ROLE_HIERARCHY.admin,
        canEditRooms: level >= ROLE_HIERARCHY.admin,
        canModerateChat: level >= ROLE_HIERARCHY.admin,
        canManageWorkspace: level >= ROLE_HIERARCHY.admin,
        canInvite: level >= ROLE_HIERARCHY.admin,
        canKick: level >= ROLE_HIERARCHY.admin,
        canBan: level >= ROLE_HIERARCHY.admin,
        refetch: fetchRole,
    };
}

// Helper to get workspace_id from a space_id
export async function getWorkspaceIdFromSpace(spaceId: string): Promise<string | null> {
    const supabase = createClient();
    const { data } = await supabase
        .from('spaces')
        .select('workspace_id')
        .eq('id', spaceId)
        .single();
    return data?.workspace_id || null;
}
