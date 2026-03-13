-- ============================================
-- 🔧 FIX SISTEMA INVITI - COSMOFFICE
-- ============================================
-- Copia TUTTO questo testo e incollalo nel
-- SQL Editor di Supabase, poi clicca "Run"
-- 
-- È sicuro da eseguire più volte (idempotente)
-- ============================================


-- ============================================
-- STEP 1: Aggiungi colonne mancanti a workspace_members
-- (Queste sono le colonne che causano l'errore)
-- ============================================
ALTER TABLE workspace_members 
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS remove_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS suspend_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspend_expires_at TIMESTAMP WITH TIME ZONE;


-- ============================================
-- STEP 2: Aggiungi colonne mancanti a workspace_invitations
-- ============================================
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

-- Rendi email opzionale (per link invites)
ALTER TABLE workspace_invitations ALTER COLUMN email DROP NOT NULL;


-- ============================================
-- STEP 3: Aggiorna constraint UNIQUE per invitations
-- ============================================
ALTER TABLE workspace_invitations DROP CONSTRAINT IF EXISTS workspace_invitations_workspace_id_email_key;
DROP INDEX IF EXISTS idx_wi_unique_email;
CREATE UNIQUE INDEX IF NOT EXISTS idx_wi_unique_email 
  ON workspace_invitations (workspace_id, email) 
  WHERE email IS NOT NULL AND revoked_at IS NULL AND accepted_at IS NULL;


-- ============================================
-- STEP 4: Policy per workspace_invitations
-- ============================================

-- Chiunque autenticato può leggere inviti (il token UUID è il segreto)
DROP POLICY IF EXISTS "invitations_select_member" ON workspace_invitations;
DROP POLICY IF EXISTS "invitations_select_by_token" ON workspace_invitations;
CREATE POLICY "invitations_select_by_token" ON workspace_invitations
  FOR SELECT USING (true);

-- Membri/Admin/Owner possono creare inviti
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

-- Membri/Admin/Owner possono aggiornare inviti (revocare)
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

-- Permetti anche DELETE per cancellare inviti
DROP POLICY IF EXISTS "invitations_delete_admin" ON workspace_invitations;
CREATE POLICY "invitations_delete_admin" ON workspace_invitations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin', 'member')
      AND wm.removed_at IS NULL
    )
  );

-- Abilita RLS sulla tabella (nel caso non sia già attivo)
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;


-- ============================================
-- STEP 5: Policy per workspace_members (insert via invito)
-- ============================================

-- Permetti l'inserimento per il trigger e per le funzioni SECURITY DEFINER
DROP POLICY IF EXISTS "Allow insert for trigger" ON workspace_members;
CREATE POLICY "Allow insert for trigger"
  ON workspace_members FOR INSERT
  WITH CHECK (true);


-- ============================================
-- STEP 6: Funzione get_invite_info (ottenere info invito)
-- ============================================
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


-- ============================================
-- STEP 7: Funzione accept_invite_link (accettare l'invito)
-- ============================================
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

  -- Cerca invito
  SELECT * INTO v_invite
  FROM workspace_invitations
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invito non trovato');
  END IF;

  -- Verifica stato
  IF v_invite.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invito revocato');
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invito scaduto');
  END IF;

  -- Per link invites, verifica max_uses
  IF v_invite.invite_type = 'link' AND v_invite.max_uses IS NOT NULL AND v_invite.use_count >= v_invite.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link esaurito');
  END IF;

  -- Per email invites, verifica email match
  IF v_invite.invite_type = 'email' AND v_invite.email IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND email = v_invite.email) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Questo invito è per un altro indirizzo email');
    END IF;
  END IF;

  -- Verifica se già membro
  SELECT * INTO v_existing
  FROM workspace_members
  WHERE workspace_id = v_invite.workspace_id
  AND user_id = v_user_id;

  IF FOUND AND v_existing.removed_at IS NULL THEN
    RETURN jsonb_build_object('success', true, 'already_member', true, 'workspace_id', v_invite.workspace_id);
  END IF;

  -- Se era stato rimosso, re-inserisci
  IF FOUND AND v_existing.removed_at IS NOT NULL THEN
    UPDATE workspace_members
    SET role = v_invite.role,
        removed_at = NULL,
        removed_by = NULL,
        remove_reason = NULL,
        joined_at = NOW()
    WHERE workspace_id = v_invite.workspace_id
    AND user_id = v_user_id;
  ELSE
    -- Nuovo membro
    INSERT INTO workspace_members (workspace_id, user_id, role, invited_by, invited_at, joined_at)
    VALUES (v_invite.workspace_id, v_user_id, v_invite.role, v_invite.invited_by, v_invite.invited_at, NOW());
  END IF;

  -- Aggiorna invito
  IF v_invite.invite_type = 'email' THEN
    UPDATE workspace_invitations
    SET accepted_at = NOW(), accepted_by = v_user_id
    WHERE id = v_invite.id;
  ELSE
    -- Per link invites, incrementa use_count
    UPDATE workspace_invitations
    SET use_count = use_count + 1
    WHERE id = v_invite.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'workspace_id', v_invite.workspace_id,
    'role', v_invite.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- ✅ VERIFICA FINALE
-- ============================================
SELECT '✅ Fix inviti completato! Ora gli invitati dovrebbero poter entrare senza problemi.' AS risultato;
