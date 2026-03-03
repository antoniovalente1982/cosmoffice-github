-- ============================================
-- FIX: GUEST RE-ENTRY AFTER KICK
-- Eseguire nel SQL Editor di Supabase
-- Idempotente — sicuro da rieseguire
-- ============================================
-- 
-- Problema: Quando un guest viene kickato e poi riceve un nuovo link,
-- la RPC accept_invite_link resetta removed_at correttamente ma
-- non restituisce lo space_id. Il client deve poi fare una query
-- sulla tabella spaces, che può fallire per RLS timing perché
-- la sessione dell'utente anonimo non ha ancora i permessi aggiornati.
--
-- Fix: La RPC ora restituisce anche lo space_id direttamente
-- (gira con SECURITY DEFINER, bypassando le RLS).
-- ============================================

CREATE OR REPLACE FUNCTION public.accept_invite_link(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
  v_existing RECORD;
  v_space_id UUID;
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
    -- Already a member, find first space for redirect
    SELECT id INTO v_space_id FROM spaces WHERE workspace_id = v_invite.workspace_id LIMIT 1;
    RETURN jsonb_build_object('success', true, 'already_member', true, 'workspace_id', v_invite.workspace_id, 'space_id', v_space_id);
  END IF;

  IF FOUND AND v_existing.removed_at IS NOT NULL THEN
    -- Re-entry: user was previously kicked, re-activate membership
    UPDATE workspace_members
    SET role = v_invite.role, removed_at = NULL, removed_by = NULL, remove_reason = NULL, joined_at = NOW()
    WHERE workspace_id = v_invite.workspace_id AND user_id = v_user_id;
  ELSE
    -- New member
    INSERT INTO workspace_members (workspace_id, user_id, role, invited_by, invited_at, joined_at)
    VALUES (v_invite.workspace_id, v_user_id, v_invite.role, v_invite.invited_by, v_invite.invited_at, NOW());
  END IF;

  IF v_invite.invite_type = 'email' THEN
    UPDATE workspace_invitations SET accepted_at = NOW(), accepted_by = v_user_id WHERE id = v_invite.id;
  ELSE
    UPDATE workspace_invitations SET use_count = use_count + 1 WHERE id = v_invite.id;
  END IF;

  -- Fetch first space for direct redirect (bypasses RLS since this is SECURITY DEFINER)
  SELECT id INTO v_space_id FROM spaces WHERE workspace_id = v_invite.workspace_id LIMIT 1;

  RETURN jsonb_build_object('success', true, 'workspace_id', v_invite.workspace_id, 'role', v_invite.role, 'space_id', v_space_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
