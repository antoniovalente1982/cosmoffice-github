// ============================================
// HOOK: useWorkspace
// Gestione completa del workspace
// ============================================

import { useEffect, useState, useCallback } from 'react';
import { supabase, getWorkspaceMembers, getWorkspaceSpaces, getUserWorkspaces } from '@/lib/supabase/client';
import type { Workspace, WorkspaceMember, Space } from '@/lib/supabase/database.types';

export function useWorkspace(workspaceId?: string) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    const fetchWorkspace = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch workspace
        const { data: wsData, error: wsError } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', workspaceId)
          .single();

        if (wsError) throw wsError;
        setWorkspace(wsData);

        // Fetch members
        const membersData = await getWorkspaceMembers(workspaceId);
        setMembers(membersData);

        // Fetch spaces
        const spacesData = await getWorkspaceSpaces(workspaceId);
        setSpaces(spacesData);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkspace();

    // Subscribe to workspace changes
    const workspaceSub = supabase
      .channel(`workspace:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workspaces',
          filter: `id=eq.${workspaceId}`,
        },
        (payload) => {
          setWorkspace(payload.new as Workspace);
        }
      )
      .subscribe();

    // Subscribe to members changes
    const membersSub = supabase
      .channel(`workspace_members:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_members',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          getWorkspaceMembers(workspaceId).then(setMembers);
        }
      )
      .subscribe();

    return () => {
      workspaceSub.unsubscribe();
      membersSub.unsubscribe();
    };
  }, [workspaceId]);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    try {
      const [membersData, spacesData] = await Promise.all([
        getWorkspaceMembers(workspaceId),
        getWorkspaceSpaces(workspaceId),
      ]);
      setMembers(membersData);
      setSpaces(spacesData);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  return {
    workspace,
    members,
    spaces,
    isLoading,
    error,
    refresh,
  };
}

// ============================================
// HOOK: useUserWorkspaces
// Lista workspaces dell'utente
// ============================================

export function useUserWorkspaces() {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWorkspaces = async () => {
      setIsLoading(true);
      const data = await getUserWorkspaces();
      setWorkspaces(data);
      setIsLoading(false);
    };

    fetchWorkspaces();
  }, []);

  return { workspaces, isLoading };
}

// ============================================
// HOOK: useCreateWorkspace
// Crea nuovo workspace
// ============================================

import { useRouter } from 'next/navigation';

export function useCreateWorkspace() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();

  const create = useCallback(async (data: {
    name: string;
    slug: string;
    description?: string;
  }): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: workspace, error: createError } = await (supabase
        .from('workspaces') as any)
        .insert({
          name: data.name,
          slug: data.slug,
          description: data.description,
        })
        .select()
        .single();

      if (createError) throw createError;

      router.push(`/w/${data.slug}`);
      return workspace.id;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  return { create, isLoading, error };
}

// ============================================
// HOOK: useInviteMember
// Invita membro al workspace
// ============================================

export function useInviteMember(workspaceId?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const invite = useCallback(async (
    email: string,
    role: 'admin' | 'member' | 'guest' = 'member'
  ): Promise<boolean> => {
    if (!workspaceId) return false;

    setIsLoading(true);
    setError(null);

    try {
      const { error } = await (supabase
        .from('workspace_invitations') as any)
        .insert({
          workspace_id: workspaceId,
          email,
          role,
        });

      if (error) throw error;
      return true;
    } catch (err) {
      setError(err as Error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  return { invite, isLoading, error };
}

// ============================================
// HOOK: useRemoveMember
// Rimuovi membro dal workspace
// ============================================

export function useRemoveMember(workspaceId?: string) {
  const [isLoading, setIsLoading] = useState(false);

  const remove = useCallback(async (
    userId: string,
    reason?: string
  ): Promise<boolean> => {
    if (!workspaceId) return false;

    setIsLoading(true);

    try {
      // Hard delete — remove completely from DB
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId);

      if (error) throw error;

      // Also revoke any pending invitations
      const { data: profile } = await (supabase.from('profiles') as any).select('email').eq('id', userId).single();
      if (profile?.email) {
        await (supabase.from('workspace_invitations') as any)
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('email', profile.email);
      }

      return true;
    } catch (err) {
      console.error('Error removing member:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  return { remove, isLoading };
}

// ============================================
// HOOK: useJoinRequest
// Richiedi di unirti a workspace
// ============================================

export function useJoinRequest() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const request = useCallback(async (
    workspaceId: string,
    message?: string
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await (supabase
        .from('workspace_join_requests') as any)
        .insert({
          workspace_id: workspaceId,
          message,
        });

      if (error) throw error;
      return true;
    } catch (err) {
      setError(err as Error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { request, isLoading, error };
}
