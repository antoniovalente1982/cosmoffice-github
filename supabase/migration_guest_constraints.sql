-- Migrazione per funzionalità avanzate Guest: Posto Singolo e Stanza di Atterraggio

-- 1. Aggiungi destination_room_id agli inviti
ALTER TABLE workspace_invitations
ADD COLUMN IF NOT EXISTS destination_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;

-- 2. Aggiungi invitation_id ai membri del workspace per mappare chi ha usato quale link
ALTER TABLE workspace_members
ADD COLUMN IF NOT EXISTS invitation_id UUID REFERENCES workspace_invitations(id) ON DELETE SET NULL;

-- 3. Aggiorna get_invite_info per ritornare la destination_room_id
CREATE OR REPLACE FUNCTION public.get_invite_info(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_invite RECORD;
  v_workspace RECORD;
BEGIN
  -- Aggiunto destination_room_id
  SELECT id, workspace_id, role, invite_type, expires_at, revoked_at, max_uses, use_count, label, destination_room_id
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
    'destination_room_id', v_invite.destination_room_id,
    'is_expired', CASE WHEN v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN true ELSE false END,
    'is_revoked', v_invite.revoked_at IS NOT NULL,
    'is_exhausted', CASE WHEN v_invite.invite_type = 'link' AND v_invite.max_uses IS NOT NULL AND v_invite.use_count >= v_invite.max_uses THEN true ELSE false END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Aggiorna accept_invite_link per registrare l'invitation_id in workspace_members
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

  -- Cerca invito (incluso destination_room_id)
  SELECT id, workspace_id, role, invite_type, expires_at, revoked_at, max_uses, use_count, email, invited_by, invited_at, destination_room_id 
  INTO v_invite
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
    -- Aggiorna invitation_id se manca (es. ha cliccato di nuovo per rientrare dal link originale)
    IF v_existing.invitation_id IS NULL THEN
        UPDATE workspace_members SET invitation_id = v_invite.id WHERE id = v_existing.id;
    END IF;
    
    RETURN jsonb_build_object(
      'success', true, 
      'already_member', true, 
      'workspace_id', v_invite.workspace_id,
      'destination_room_id', v_invite.destination_room_id
    );
  END IF;

  -- Se era stato rimosso, re-inserisci
  IF FOUND AND v_existing.removed_at IS NOT NULL THEN
    UPDATE workspace_members
    SET role = v_invite.role,
        removed_at = NULL,
        removed_by = NULL,
        remove_reason = NULL,
        joined_at = NOW(),
        invitation_id = v_invite.id
    WHERE workspace_id = v_invite.workspace_id
    AND user_id = v_user_id;
  ELSE
    -- Nuovo membro (inseriamo anche invitation_id)
    INSERT INTO workspace_members (workspace_id, user_id, role, invited_by, invited_at, joined_at, invitation_id)
    VALUES (v_invite.workspace_id, v_user_id, v_invite.role, v_invite.invited_by, v_invite.invited_at, NOW(), v_invite.id);
  END IF;

  -- Aggiorna l'invito
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
    'role', v_invite.role,
    'destination_room_id', v_invite.destination_room_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
