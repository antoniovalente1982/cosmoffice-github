-- ============================================
-- FIX URGENTE: RIPRISTINO VISIBILITÀ WORKSPACE
-- Eseguire SUBITO nel SQL Editor di Supabase
-- ============================================

-- STEP 1: Fix workspace_members — usa is_workspace_member() 
-- che è SECURITY DEFINER e bypassa le RLS (evita loop ricorsivo)
DROP POLICY IF EXISTS "Members viewable by workspace members" ON workspace_members;
CREATE POLICY "Members viewable by workspace members" ON workspace_members
  FOR SELECT TO authenticated
  USING (
    removed_at IS NULL AND
    public.is_workspace_member(workspace_id)
  );

-- STEP 2: Fix workspaces — rimuovi deleted_at se non esiste
DROP POLICY IF EXISTS "Workspaces viewable by members" ON workspaces;
CREATE POLICY "Workspaces viewable by members" ON workspaces
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_member(id)
  );

-- STEP 3: Verifica
SELECT w.id, w.name, count(wm.user_id) as members
FROM workspaces w
LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.removed_at IS NULL
GROUP BY w.id, w.name;
