// ============================================
// HOOK: usePermissions
// Gestione permessi RBAC nel workspace
// ============================================

import { useCallback, useEffect, useState } from 'react';
import { supabase, checkPermission, canModerateUser } from '@/lib/supabase/client';
import type { Database, WorkspaceRole } from '@/lib/supabase/database.types';

type Permission = keyof Database['public']['Tables']['workspace_role_permissions']['Row'];

interface UsePermissionsOptions {
  workspaceId?: string;
  targetUserId?: string;
}

export function usePermissions({ workspaceId, targetUserId }: UsePermissionsOptions = {}) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [canModerate, setCanModerate] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Check singolo permesso
  const check = useCallback(async (permission: Permission): Promise<boolean> => {
    if (!workspaceId) return false;
    
    try {
      const hasPermission = await checkPermission(workspaceId, permission);
      setPermissions(prev => ({ ...prev, [permission]: hasPermission }));
      return hasPermission;
    } catch (err) {
      console.error('Error checking permission:', err);
      return false;
    }
  }, [workspaceId]);

  // Check multipli permessi
  const checkMany = useCallback(async (permissionList: Permission[]): Promise<Record<string, boolean>> => {
    if (!workspaceId) return {};
    
    const results: Record<string, boolean> = {};
    
    await Promise.all(
      permissionList.map(async (perm) => {
        results[perm] = await checkPermission(workspaceId, perm);
      })
    );
    
    setPermissions(prev => ({ ...prev, ...results }));
    return results;
  }, [workspaceId]);

  // Check se può moderare un utente specifico
  const checkCanModerate = useCallback(async (): Promise<boolean> => {
    if (!workspaceId || !targetUserId) {
      setCanModerate(false);
      return false;
    }
    
    try {
      const result = await canModerateUser(workspaceId, targetUserId);
      setCanModerate(result);
      return result;
    } catch (err) {
      console.error('Error checking moderation:', err);
      setCanModerate(false);
      return false;
    }
  }, [workspaceId, targetUserId]);

  // Precarica permessi comuni
  useEffect(() => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    const loadPermissions = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Permessi di moderazione più comuni
        const commonPermissions: Permission[] = [
          'can_kick_from_rooms',
          'can_mute_in_rooms',
          'can_ban_members',
          'can_manage_member_roles',
          'can_create_rooms',
          'can_delete_rooms',
          'can_manage_space_settings',
          'can_invite_members',
          'can_remove_members',
          'can_delete_any_message',
          'can_moderate_chat',
        ];
        
        await checkMany(commonPermissions);
        
        if (targetUserId) {
          await checkCanModerate();
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPermissions();
  }, [workspaceId, targetUserId, checkMany, checkCanModerate]);

  return {
    permissions,
    canModerate,
    isLoading,
    error,
    check,
    checkMany,
    checkCanModerate,
    
    // Helper booleani comodi
    canKick: permissions['can_kick_from_rooms'] || false,
    canMute: permissions['can_mute_in_rooms'] || false,
    canBan: permissions['can_ban_members'] || false,
    canManageRoles: permissions['can_manage_member_roles'] || false,
    canCreateRooms: permissions['can_create_rooms'] || false,
    canDeleteRooms: permissions['can_delete_rooms'] || false,
    canInvite: permissions['can_invite_members'] || false,
    canRemoveMembers: permissions['can_remove_members'] || false,
    canModerateChat: permissions['can_moderate_chat'] || false,
    canDeleteAnyMessage: permissions['can_delete_any_message'] || false,
  };
}

// ============================================
// HOOK: useWorkspaceRole
// Ottiene il ruolo dell'utente corrente
// ============================================

export function useWorkspaceRole(workspaceId?: string) {
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    const fetchRole = async () => {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRole(null);
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .is('removed_at', null)
        .single();

      setRole(data?.role || null);
      setIsLoading(false);
    };

    fetchRole();

    // Subscribe to changes
    const subscription = supabase
      .channel(`workspace_member:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workspace_members',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.new && 'role' in payload.new) {
            setRole(payload.new.role as WorkspaceRole);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [workspaceId]);

  const roleHierarchy = {
    owner: 4,
    admin: 3,
    member: 2,
    guest: 1,
    viewer: 0,
  };

  const isAtLeast = useCallback((minRole: WorkspaceRole): boolean => {
    if (!role) return false;
    return roleHierarchy[role] >= roleHierarchy[minRole];
  }, [role]);

  return {
    role,
    isLoading,
    isOwner: role === 'owner',
    isAdmin: role === 'admin' || role === 'owner',
    isMember: role === 'member',
    isGuest: role === 'guest',
    isViewer: role === 'viewer',
    isAtLeast,
    roleValue: role ? roleHierarchy[role] : -1,
  };
}

// ============================================
// HOOK: useIsMember
// Verifica se l'utente è membro del workspace
// ============================================

export function useIsMember(workspaceId?: string) {
  const [isMember, setIsMember] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    const checkMembership = async () => {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsMember(false);
        setIsLoading(false);
        return;
      }

      // Check ban
      const { data: banData } = await supabase.rpc('is_user_banned', {
        p_workspace_id: workspaceId,
        p_user_id: user.id,
      });
      setIsBanned(banData || false);

      // Check membership
      const { data } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .is('removed_at', null)
        .is('is_suspended', false)
        .single();

      setIsMember(!!data && !banData);
      setIsLoading(false);
    };

    checkMembership();
  }, [workspaceId]);

  return { isMember, isLoading, isBanned };
}
