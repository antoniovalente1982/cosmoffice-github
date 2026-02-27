-- ============================================
-- ESEGUIRE NEL SQL EDITOR DI SUPABASE
-- Tutto è idempotente — sicuro da rieseguire
-- ============================================

-- 1. Aggiungi colonne mancanti alla tabella workspace_invitations
ALTER TABLE workspace_invitations 
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS token TEXT UNIQUE DEFAULT uuid_generate_v4()::text,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS invite_type TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS label TEXT;

-- 2. Rendi email opzionale (per link invites)
ALTER TABLE workspace_invitations ALTER COLUMN email DROP NOT NULL;

-- 3. Aggiorna constraint UNIQUE
ALTER TABLE workspace_invitations DROP CONSTRAINT IF EXISTS workspace_invitations_workspace_id_email_key;
DROP INDEX IF EXISTS idx_wi_unique_email;
CREATE UNIQUE INDEX idx_wi_unique_email 
  ON workspace_invitations (workspace_id, email) 
  WHERE email IS NOT NULL AND revoked_at IS NULL AND accepted_at IS NULL;

-- 4. Policy SELECT — tutti possono leggere inviti (il token UUID funge da segreto)
DROP POLICY IF EXISTS "invitations_select_member" ON workspace_invitations;
DROP POLICY IF EXISTS "invitations_select_by_token" ON workspace_invitations;
CREATE POLICY "invitations_select_by_token" ON workspace_invitations
  FOR SELECT USING (true);

-- 5. Policy INSERT — owner/admin/member possono creare inviti
DROP POLICY IF EXISTS "invitations_insert_admin" ON workspace_invitations;
DROP POLICY IF EXISTS "invitations_insert_members" ON workspace_invitations;
CREATE POLICY "invitations_insert_members" ON workspace_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin', 'member')
      AND wm.removed_at IS NULL
    )
  );

-- 6. Policy UPDATE — owner/admin/member possono revocare inviti
DROP POLICY IF EXISTS "invitations_update_admin" ON workspace_invitations;
CREATE POLICY "invitations_update_admin" ON workspace_invitations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin', 'member')
      AND wm.removed_at IS NULL
    )
  );

-- 7. Funzione: ottieni info invito (bypassa RLS, usata dalla pagina /invite)
CREATE OR REPLACE FUNCTION public.get_invite_info(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_invite RECORD;
  v_workspace RECORD;
BEGIN
  SELECT id, workspace_id, role, invite_type, expires_at, revoked_at, max_uses, use_count, label
  INTO v_invite
  FROM workspace_invitations
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT id, name, description INTO v_workspace
  FROM workspaces WHERE id = v_invite.workspace_id;

  RETURN jsonb_build_object(
    'found', true,
    'workspace_id', v_invite.workspace_id,
    'workspace_name', COALESCE(v_workspace.name, 'Workspace'),
    'role', v_invite.role,
    'invite_type', v_invite.invite_type,
    'is_expired', CASE WHEN v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN true ELSE false END,
    'is_revoked', v_invite.revoked_at IS NOT NULL,
    'is_exhausted', CASE WHEN v_invite.invite_type = 'link' AND v_invite.max_uses IS NOT NULL AND v_invite.use_count >= v_invite.max_uses THEN true ELSE false END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Funzione: accetta invito via link (bypassa RLS)
CREATE OR REPLACE FUNCTION public.accept_invite_link(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
  v_existing RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autenticato');
  END IF;

  SELECT * INTO v_invite
  FROM workspace_invitations
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invito non trovato');
  END IF;

  IF v_invite.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invito revocato');
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invito scaduto');
  END IF;

  IF v_invite.invite_type = 'link' AND v_invite.max_uses IS NOT NULL AND v_invite.use_count >= v_invite.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link esaurito');
  END IF;

  IF v_invite.invite_type = 'email' AND v_invite.email IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND email = v_invite.email) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Questo invito è per un altro indirizzo email');
    END IF;
  END IF;

  SELECT * INTO v_existing
  FROM workspace_members
  WHERE workspace_id = v_invite.workspace_id AND user_id = v_user_id;

  IF FOUND AND v_existing.removed_at IS NULL THEN
    RETURN jsonb_build_object('success', true, 'already_member', true, 'workspace_id', v_invite.workspace_id);
  END IF;

  IF FOUND AND v_existing.removed_at IS NOT NULL THEN
    UPDATE workspace_members
    SET role = v_invite.role, removed_at = NULL, removed_by = NULL, remove_reason = NULL, joined_at = NOW()
    WHERE workspace_id = v_invite.workspace_id AND user_id = v_user_id;
  ELSE
    INSERT INTO workspace_members (workspace_id, user_id, role, invited_by, invited_at, joined_at)
    VALUES (v_invite.workspace_id, v_user_id, v_invite.role, v_invite.invited_by, v_invite.invited_at, NOW());
  END IF;

  IF v_invite.invite_type = 'email' THEN
    UPDATE workspace_invitations SET accepted_at = NOW(), accepted_by = v_user_id WHERE id = v_invite.id;
  ELSE
    UPDATE workspace_invitations SET use_count = use_count + 1 WHERE id = v_invite.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'workspace_id', v_invite.workspace_id, 'role', v_invite.role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
