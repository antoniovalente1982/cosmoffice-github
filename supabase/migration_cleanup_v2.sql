-- ============================================
-- MIGRATION: CLEANUP v2 — Drop Legacy + Add RLS
-- Cosmoffice Database Cleanup
-- ============================================

-- ============================================
-- STEP 1: DROP TABELLE LEGACY v1
-- ============================================

DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP FUNCTION IF EXISTS public.is_org_member(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_org_admin(UUID) CASCADE;

-- ============================================
-- STEP 2: CREA FUNZIONI HELPER (necessarie per RLS)
-- ============================================

-- is_workspace_member: verifica se l'utente è membro attivo del workspace
CREATE OR REPLACE FUNCTION public.is_workspace_member(check_workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = check_workspace_id
    AND wm.user_id = auth.uid()
    AND wm.removed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- is_workspace_admin: verifica se l'utente è admin o owner
CREATE OR REPLACE FUNCTION public.is_workspace_admin(check_workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = check_workspace_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('admin', 'owner')
    AND wm.removed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- is_workspace_owner: verifica se l'utente è owner
CREATE OR REPLACE FUNCTION public.is_workspace_owner(check_workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = check_workspace_id
    AND wm.user_id = auth.uid()
    AND wm.role = 'owner'
    AND wm.removed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- is_space_admin: verifica admin via workspace
CREATE OR REPLACE FUNCTION public.is_space_admin(check_space_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.spaces s
    JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
    WHERE s.id = check_space_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('admin', 'owner')
    AND wm.removed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- create_default_role_permissions (se non esiste)
CREATE OR REPLACE FUNCTION public.create_default_role_permissions(ws_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Salta se la tabella non esiste o i permessi già esistono
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspace_role_permissions') THEN
    IF NOT EXISTS (SELECT 1 FROM public.workspace_role_permissions WHERE workspace_id = ws_id) THEN
      INSERT INTO public.workspace_role_permissions (workspace_id, role,
        can_manage_workspace_settings, can_delete_workspace, can_manage_billing,
        can_invite_members, can_remove_members, can_change_roles,
        can_create_spaces, can_delete_spaces, can_manage_spaces,
        can_create_rooms, can_delete_rooms, can_manage_rooms,
        can_kick_users, can_ban_users, can_mute_users,
        can_manage_furniture, can_delete_any_message, can_moderate_chat,
        can_pin_messages, can_manage_ai_agents, can_manage_integrations)
      VALUES
        (ws_id, 'owner', true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true),
        (ws_id, 'admin', true, false, false, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true),
        (ws_id, 'member', false, false, false, false, false, false, false, false, false, true, false, false, false, false, false, true, false, false, false, false, false),
        (ws_id, 'guest', false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false),
        (ws_id, 'viewer', false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 3: RLS su rooms
-- ============================================

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rooms_select_workspace_members" ON rooms;
CREATE POLICY "rooms_select_workspace_members" ON rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM spaces s
      JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
      WHERE s.id = rooms.space_id
      AND wm.user_id = auth.uid()
      AND wm.removed_at IS NULL
    )
  );

DROP POLICY IF EXISTS "rooms_insert_admin" ON rooms;
CREATE POLICY "rooms_insert_admin" ON rooms
  FOR INSERT WITH CHECK (public.is_space_admin(space_id));

DROP POLICY IF EXISTS "rooms_update_admin" ON rooms;
CREATE POLICY "rooms_update_admin" ON rooms
  FOR UPDATE USING (public.is_space_admin(space_id));

DROP POLICY IF EXISTS "rooms_delete_admin" ON rooms;
CREATE POLICY "rooms_delete_admin" ON rooms
  FOR DELETE USING (public.is_space_admin(space_id));

-- ============================================
-- STEP 4: RLS su spaces
-- ============================================

ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spaces_select_workspace_members" ON spaces;
CREATE POLICY "spaces_select_workspace_members" ON spaces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = spaces.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.removed_at IS NULL
    )
  );

DROP POLICY IF EXISTS "spaces_insert_admin" ON spaces;
CREATE POLICY "spaces_insert_admin" ON spaces
  FOR INSERT WITH CHECK (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "spaces_update_admin" ON spaces;
CREATE POLICY "spaces_update_admin" ON spaces
  FOR UPDATE USING (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "spaces_delete_admin" ON spaces;
CREATE POLICY "spaces_delete_admin" ON spaces
  FOR DELETE USING (public.is_workspace_admin(workspace_id));

-- ============================================
-- STEP 5: RLS su workspaces
-- ============================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspaces_select_members" ON workspaces;
CREATE POLICY "workspaces_select_members" ON workspaces
  FOR SELECT USING (
    created_by = auth.uid() OR public.is_workspace_member(id)
  );

DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON workspaces;
CREATE POLICY "workspaces_insert_authenticated" ON workspaces
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "workspaces_update_admin" ON workspaces;
CREATE POLICY "workspaces_update_admin" ON workspaces
  FOR UPDATE USING (public.is_workspace_admin(id));

DROP POLICY IF EXISTS "workspaces_delete_owner" ON workspaces;
CREATE POLICY "workspaces_delete_owner" ON workspaces
  FOR DELETE USING (public.is_workspace_owner(id));

-- ============================================
-- STEP 6: RLS su workspace_members
-- ============================================

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wm_select_workspace_members" ON workspace_members;
CREATE POLICY "wm_select_workspace_members" ON workspace_members
  FOR SELECT USING (
    user_id = auth.uid() OR public.is_workspace_member(workspace_id)
  );

DROP POLICY IF EXISTS "wm_insert_admin" ON workspace_members;
CREATE POLICY "wm_insert_admin" ON workspace_members
  FOR INSERT WITH CHECK (
    public.is_workspace_admin(workspace_id) OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "wm_update_admin" ON workspace_members;
CREATE POLICY "wm_update_admin" ON workspace_members
  FOR UPDATE USING (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "wm_delete_admin" ON workspace_members;
CREATE POLICY "wm_delete_admin" ON workspace_members
  FOR DELETE USING (
    public.is_workspace_admin(workspace_id) OR user_id = auth.uid()
  );

-- ============================================
-- STEP 7: RLS su workspace_invitations
-- ============================================

ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invitations_select" ON workspace_invitations;
CREATE POLICY "invitations_select" ON workspace_invitations
  FOR SELECT USING (
    public.is_workspace_admin(workspace_id) OR
    email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "invitations_insert_admin" ON workspace_invitations;
CREATE POLICY "invitations_insert_admin" ON workspace_invitations
  FOR INSERT WITH CHECK (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "invitations_update" ON workspace_invitations;
CREATE POLICY "invitations_update" ON workspace_invitations
  FOR UPDATE USING (
    public.is_workspace_admin(workspace_id) OR
    email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "invitations_delete_admin" ON workspace_invitations;
CREATE POLICY "invitations_delete_admin" ON workspace_invitations
  FOR DELETE USING (public.is_workspace_admin(workspace_id));

-- ============================================
-- STEP 8: RLS su user_presence
-- ============================================

ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presence_select_all" ON user_presence;
CREATE POLICY "presence_select_all" ON user_presence
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "presence_insert_own" ON user_presence;
CREATE POLICY "presence_insert_own" ON user_presence
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "presence_update_own" ON user_presence;
CREATE POLICY "presence_update_own" ON user_presence
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "presence_delete_own" ON user_presence;
CREATE POLICY "presence_delete_own" ON user_presence
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- STEP 9: Trigger handle_new_workspace
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (NEW.id, NEW.created_by, 'owner', NOW())
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  PERFORM public.create_default_role_permissions(NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_workspace_created ON workspaces;
CREATE TRIGGER on_workspace_created
  AFTER INSERT ON workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();

-- ============================================
-- STEP 10: Trigger handle_new_user
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
