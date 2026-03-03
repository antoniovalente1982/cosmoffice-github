'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';

type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest';

interface WorkspaceRoleData {
    role: WorkspaceRole | null;
    loading: boolean;
    isOwner: boolean;
    isAdmin: boolean;      // owner or admin
    isMember: boolean;     // owner, admin, or member
    isGuest: boolean;      // any valid role
    canManageMembers: boolean;  // admin+
    canEditRooms: boolean;      // admin+
    canModerateChat: boolean;   // admin+
    canManageWorkspace: boolean; // owner only (settings, billing)
    canCreateSpaces: boolean;    // owner only
    canDeleteSpaces: boolean;    // owner only
    canInvite: boolean;          // member+ (NOT guest)
    invitableRoles: WorkspaceRole[];
    canKick: boolean;            // admin+
    canBan: boolean;             // admin+
    refetch: () => Promise<void>;
}

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
    owner: 3,
    admin: 2,
    member: 1,
    guest: 0,
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

    // Which roles can this user assign to invitees?
    // owner  → admin, member, guest
    // admin  → member, guest
    // member → guest
    // guest  → (none)
    const invitableRoles: WorkspaceRole[] = role ? getInvitableRoles(role) : [];

    return {
        role,
        loading,
        isOwner: role === 'owner',
        isAdmin: level >= ROLE_HIERARCHY.admin,     // owner or admin
        isMember: level >= ROLE_HIERARCHY.member,    // owner, admin, member
        isGuest: level >= ROLE_HIERARCHY.guest,      // any valid role
        canManageMembers: level >= ROLE_HIERARCHY.admin,
        canEditRooms: level >= ROLE_HIERARCHY.admin,
        canModerateChat: level >= ROLE_HIERARCHY.admin,
        canManageWorkspace: role === 'owner',        // OWNER ONLY
        canCreateSpaces: role === 'owner',           // OWNER ONLY
        canDeleteSpaces: role === 'owner',           // OWNER ONLY
        canInvite: level >= ROLE_HIERARCHY.member,   // member+ (guest cannot invite)
        invitableRoles,
        canKick: level >= ROLE_HIERARCHY.admin,
        canBan: level >= ROLE_HIERARCHY.admin,
        refetch: fetchRole,
    };
}

/**
 * Returns the roles a given user role can assign to invitees.
 * Rule: you can invite anyone with a role strictly below yours.
 *   owner  → admin, member, guest
 *   admin  → member, guest
 *   member → guest
 *   guest  → (none)
 */
export function getInvitableRoles(myRole: WorkspaceRole): WorkspaceRole[] {
    const myLevel = ROLE_HIERARCHY[myRole];
    const all: WorkspaceRole[] = ['admin', 'member', 'guest'];
    return all.filter(r => ROLE_HIERARCHY[r] < myLevel);
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
