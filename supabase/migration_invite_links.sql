-- ============================================
-- MIGRATION: Invite Links
-- Estende workspace_invitations per supportare
-- inviti via link oltre che via email
-- ============================================

-- STEP 1: Assicura che le colonne base esistano
ALTER TABLE workspace_invitations 
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS token TEXT UNIQUE DEFAULT uuid_generate_v4()::text,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- STEP 2: Aggiungi colonne per link invites
ALTER TABLE workspace_invitations ALTER COLUMN email DROP NOT NULL;

ALTER TABLE workspace_invitations 
  ADD COLUMN IF NOT EXISTS invite_type TEXT DEFAULT 'email' CHECK (invite_type IN ('email', 'link')),
  ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS label TEXT; -- nome descrittivo del link (es: "Link per clienti")

-- STEP 3: Aggiorna constraint UNIQUE
-- Il vecchio constraint (workspace_id, email) non funziona per link invites (email NULL)
-- Rimuoviamo e aggiungiamo il nuovo
ALTER TABLE workspace_invitations DROP CONSTRAINT IF EXISTS workspace_invitations_workspace_id_email_key;

-- Per email invites: unico per workspace+email (solo inviti attivi)
CREATE UNIQUE INDEX IF NOT EXISTS idx_wi_unique_email 
  ON workspace_invitations (workspace_id, email) 
  WHERE email IS NOT NULL AND revoked_at IS NULL AND accepted_at IS NULL;

-- STEP 4: Policy — consenti ai member (non guest) di creare inviti link
-- Prima droppiamo la vecchia policy che permetteva solo admin
DROP POLICY IF EXISTS "invitations_insert_admin" ON workspace_invitations;

CREATE POLICY "invitations_insert_members" ON workspace_invitations
  FOR INSERT WITH CHECK (
    -- Admin e Owner possono sempre invitare
    public.is_workspace_admin(workspace_id) 
    OR
    -- I member possono creare solo link invites con ruolo guest o member
    (
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin', 'member')
        AND wm.removed_at IS NULL
      )
      AND invite_type = 'link'
      AND role IN ('member', 'guest')
    )
  );

-- STEP 5: Funzione per accettare un invito link
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
    RETURN jsonb_build_object('success', false, 'error', 'Link esaurito (uso massimo raggiunto)');
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
