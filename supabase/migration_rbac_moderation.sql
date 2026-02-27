-- ============================================
-- MIGRAZIONE: RBAC + MODERATION SYSTEM
-- Gerarchia: Owner > Admin > Member > Guest
-- Tutti possono essere moderati dai superiori
-- ============================================

-- ============================================
-- TABELLA: Permessi per Ruolo (Documentazione/Validazione)
-- ============================================
CREATE TABLE workspace_role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  role workspace_role NOT NULL,
  
  -- Workspace level
  can_manage_workspace_settings BOOLEAN DEFAULT false,
  can_delete_workspace BOOLEAN DEFAULT false,
  can_manage_billing BOOLEAN DEFAULT false,
  can_invite_members BOOLEAN DEFAULT false,
  can_remove_members BOOLEAN DEFAULT false,
  can_manage_member_roles BOOLEAN DEFAULT false,
  can_ban_members BOOLEAN DEFAULT false,
  can_view_audit_logs BOOLEAN DEFAULT false,
  
  -- Space level
  can_create_spaces BOOLEAN DEFAULT false,
  can_delete_spaces BOOLEAN DEFAULT false,
  can_archive_spaces BOOLEAN DEFAULT false,
  can_manage_space_settings BOOLEAN DEFAULT false,
  
  -- Room level
  can_create_rooms BOOLEAN DEFAULT false,
  can_delete_rooms BOOLEAN DEFAULT false,
  can_edit_rooms BOOLEAN DEFAULT false,
  can_lock_rooms BOOLEAN DEFAULT false,
  can_enter_locked_rooms BOOLEAN DEFAULT false,
  can_kick_from_rooms BOOLEAN DEFAULT false,
  can_mute_in_rooms BOOLEAN DEFAULT false,
  can_manage_furniture BOOLEAN DEFAULT false,
  
  -- Chat level
  can_delete_any_message BOOLEAN DEFAULT false,
  can_moderate_chat BOOLEAN DEFAULT false,
  can_pin_messages BOOLEAN DEFAULT false,
  
  -- AI & Integrations
  can_manage_ai_agents BOOLEAN DEFAULT false,
  can_manage_integrations BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(workspace_id, role)
);

-- Default permissions per ruolo (template)
CREATE OR REPLACE FUNCTION public.create_default_role_permissions(p_workspace_id UUID)
RETURNS VOID AS $$
BEGIN
  -- OWNER - Tutto
  INSERT INTO workspace_role_permissions (
    workspace_id, role,
    can_manage_workspace_settings, can_delete_workspace, can_manage_billing,
    can_invite_members, can_remove_members, can_manage_member_roles, can_ban_members,
    can_view_audit_logs, can_create_spaces, can_delete_spaces, can_archive_spaces,
    can_manage_space_settings, can_create_rooms, can_delete_rooms, can_edit_rooms,
    can_lock_rooms, can_enter_locked_rooms, can_kick_from_rooms, can_mute_in_rooms,
    can_manage_furniture, can_delete_any_message, can_moderate_chat, can_pin_messages,
    can_manage_ai_agents, can_manage_integrations
  ) VALUES (
    p_workspace_id, 'owner',
    true, true, true, true, true, true, true, true, true, true, true, true, true, true,
    true, true, true, true, true, true, true, true, true, true
  ) ON CONFLICT (workspace_id, role) DO NOTHING;
  
  -- ADMIN - Quasi tutto, ma non cancella workspace né gestisce billing
  INSERT INTO workspace_role_permissions (
    workspace_id, role,
    can_manage_workspace_settings, can_delete_workspace, can_manage_billing,
    can_invite_members, can_remove_members, can_manage_member_roles, can_ban_members,
    can_view_audit_logs, can_create_spaces, can_delete_spaces, can_archive_spaces,
    can_manage_space_settings, can_create_rooms, can_delete_rooms, can_edit_rooms,
    can_lock_rooms, can_enter_locked_rooms, can_kick_from_rooms, can_mute_in_rooms,
    can_manage_furniture, can_delete_any_message, can_moderate_chat, can_pin_messages,
    can_manage_ai_agents, can_manage_integrations
  ) VALUES (
    p_workspace_id, 'admin',
    true, false, false, true, true, true, true, true, true, true, true, true, true, true,
    true, true, true, true, true, true, true, true, true, true
  ) ON CONFLICT (workspace_id, role) DO NOTHING;
  
  -- MEMBER - Può usare ma non gestire
  INSERT INTO workspace_role_permissions (
    workspace_id, role,
    can_manage_workspace_settings, can_delete_workspace, can_manage_billing,
    can_invite_members, can_remove_members, can_manage_member_roles, can_ban_members,
    can_view_audit_logs, can_create_spaces, can_delete_spaces, can_archive_spaces,
    can_manage_space_settings, can_create_rooms, can_delete_rooms, can_edit_rooms,
    can_lock_rooms, can_enter_locked_rooms, can_kick_from_rooms, can_mute_in_rooms,
    can_manage_furniture, can_delete_any_message, can_moderate_chat, can_pin_messages,
    can_manage_ai_agents, can_manage_integrations
  ) VALUES (
    p_workspace_id, 'member',
    false, false, false, false, false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false, false, false, false, false
  ) ON CONFLICT (workspace_id, role) DO NOTHING;
  
  -- GUEST - Solo entrare, zero permessi di gestione
  INSERT INTO workspace_role_permissions (
    workspace_id, role,
    can_manage_workspace_settings, can_delete_workspace, can_manage_billing,
    can_invite_members, can_remove_members, can_manage_member_roles, can_ban_members,
    can_view_audit_logs, can_create_spaces, can_delete_spaces, can_archive_spaces,
    can_manage_space_settings, can_create_rooms, can_delete_rooms, can_edit_rooms,
    can_lock_rooms, can_enter_locked_rooms, can_kick_from_rooms, can_mute_in_rooms,
    can_manage_furniture, can_delete_any_message, can_moderate_chat, can_pin_messages,
    can_manage_ai_agents, can_manage_integrations
  ) VALUES (
    p_workspace_id, 'guest',
    false, false, false, false, false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false, false, false, false, false
  ) ON CONFLICT (workspace_id, role) DO NOTHING;
  
  -- VIEWER - Solo guardare, non interagire
  INSERT INTO workspace_role_permissions (
    workspace_id, role,
    can_manage_workspace_settings, can_delete_workspace, can_manage_billing,
    can_invite_members, can_remove_members, can_manage_member_roles, can_ban_members,
    can_view_audit_logs, can_create_spaces, can_delete_spaces, can_archive_spaces,
    can_manage_space_settings, can_create_rooms, can_delete_rooms, can_edit_rooms,
    can_lock_rooms, can_enter_locked_rooms, can_kick_from_rooms, can_mute_in_rooms,
    can_manage_furniture, can_delete_any_message, can_moderate_chat, can_pin_messages,
    can_manage_ai_agents, can_manage_integrations
  ) VALUES (
    p_workspace_id, 'viewer',
    false, false, false, false, false, false, false, false, false, false, false, false,
    false, false, false, false, false, false, false, false, false, false, false, false
  ) ON CONFLICT (workspace_id, role) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger per creare default permissions quando si crea un workspace
CREATE OR REPLACE FUNCTION public.handle_workspace_permissions()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.create_default_role_permissions(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_workspace_create_permissions
  AFTER INSERT ON workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_workspace_permissions();

-- ============================================
-- TABELLA: Ban/Blocco utenti
-- ============================================
CREATE TABLE workspace_bans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Chi è stato bannato
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Chi ha bannato
  banned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  banned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Durata
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL = permanente
  
  -- Motivazione
  reason TEXT,
  ban_type TEXT DEFAULT 'workspace' CHECK (ban_type IN ('workspace', 'space', 'room')),
  
  -- Se ban limitato a space/room specifico
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  
  -- Storico (se revocato)
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by UUID REFERENCES profiles(id),
  revoke_reason TEXT,
  
  UNIQUE(workspace_id, user_id, space_id, room_id) WHERE revoked_at IS NULL
);

-- Indici
CREATE INDEX idx_workspace_bans_workspace ON workspace_bans(workspace_id);
CREATE INDEX idx_workspace_bans_user ON workspace_bans(user_id);
CREATE INDEX idx_workspace_bans_active ON workspace_bans(workspace_id, user_id) 
  WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW());

-- ============================================
-- TABELLA: Kick History (chi è stato cacciato da dove)
-- ============================================
CREATE TABLE room_kicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Chi ha kickato
  kicked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  kicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Motivo
  reason TEXT,
  
  -- Se "soft kick" (può rientrare) o "ban temporaneo"
  can_reenter BOOLEAN DEFAULT true,
  banned_until TIMESTAMP WITH TIME ZONE,
  
  -- Notifica inviata
  notification_sent BOOLEAN DEFAULT false
);

CREATE INDEX idx_room_kicks_room ON room_kicks(room_id);
CREATE INDEX idx_room_kicks_user ON room_kicks(user_id);

-- ============================================
-- TABELLA: Mute History (chi è stato mutato)
-- ============================================
CREATE TABLE room_mutes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Chi ha mutato
  muted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  muted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Tipo muto
  mute_type TEXT DEFAULT 'chat' CHECK (mute_type IN ('chat', 'audio', 'video', 'all')),
  
  -- Durata
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL = finché non viene smutato manualmente
  
  -- Storico
  unmuted_by UUID REFERENCES profiles(id),
  unmuted_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(room_id, user_id, mute_type) WHERE unmuted_at IS NULL
);

CREATE INDEX idx_room_mutes_active ON room_mutes(room_id, user_id) 
  WHERE unmuted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW());

-- ============================================
-- AGGIORNA workspace_members con stato moderazione
-- ============================================
ALTER TABLE workspace_members 
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS suspend_reason TEXT,
ADD COLUMN IF NOT EXISTS suspend_expires_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- AGGIORNA room_participants con stato moderazione
-- ============================================
ALTER TABLE room_participants
ADD COLUMN IF NOT EXISTS is_kicked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS kicked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS kicked_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS kick_reason TEXT,
ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS muted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS muted_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS mute_expires_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- FUNCTIONS HELPER PER PERMESSI
-- ============================================

-- Helper: Ha il permesso specifico?
CREATE OR REPLACE FUNCTION public.has_workspace_permission(
  p_workspace_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_role workspace_role;
  v_has_permission BOOLEAN;
BEGIN
  -- Get user role
  SELECT role INTO v_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id
  AND user_id = auth.uid()
  AND removed_at IS NULL
  AND is_suspended = false;
  
  IF v_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check permission
  EXECUTE format(
    'SELECT %I FROM workspace_role_permissions WHERE workspace_id = $1 AND role = $2',
    p_permission
  ) INTO v_has_permission USING p_workspace_id, v_role;
  
  RETURN COALESCE(v_has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Può moderare questo utente?
CREATE OR REPLACE FUNCTION public.can_moderate_user(
  p_workspace_id UUID,
  p_target_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  my_role workspace_role;
  target_role workspace_role;
  role_hierarchy INTEGER;
  target_hierarchy INTEGER;
BEGIN
  -- Get roles
  SELECT role INTO my_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id
  AND user_id = auth.uid()
  AND removed_at IS NULL
  AND is_suspended = false;
  
  SELECT role INTO target_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id
  AND user_id = p_target_user_id
  AND removed_at IS NULL;
  
  IF my_role IS NULL OR target_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Hierarchy: owner(4) > admin(3) > member(2) > guest(1) > viewer(0)
  role_hierarchy := CASE my_role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'member' THEN 2
    WHEN 'guest' THEN 1
    ELSE 0
  END;
  
  target_hierarchy := CASE target_role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'member' THEN 2
    WHEN 'guest' THEN 1
    ELSE 0
  END;
  
  -- Puoi moderare solo chi è sotto di te
  -- Owner può moderare tutti (tranne se stesso in teoria, ma lasciamo libero)
  RETURN role_hierarchy > target_hierarchy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: È bannato?
CREATE OR REPLACE FUNCTION public.is_user_banned(
  p_workspace_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM workspace_bans
    WHERE workspace_id = p_workspace_id
    AND user_id = p_user_id
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: È mutato in questa stanza?
CREATE OR REPLACE FUNCTION public.is_user_muted(
  p_room_id UUID,
  p_mute_type TEXT DEFAULT 'chat'
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM room_mutes
    WHERE room_id = p_room_id
    AND user_id = auth.uid()
    AND mute_type IN (p_mute_type, 'all')
    AND unmuted_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Può entrare nella stanza?
CREATE OR REPLACE FUNCTION public.can_enter_room_v2(p_room_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_workspace_id UUID;
  v_space_id UUID;
  v_room_requires_role workspace_role;
  v_user_role workspace_role;
  v_is_banned BOOLEAN;
  v_is_kicked BOOLEAN;
BEGIN
  -- Get room info
  SELECT r.space_id, r.who_can_enter, s.workspace_id
  INTO v_space_id, v_room_requires_role, v_workspace_id
  FROM rooms r
  JOIN spaces s ON s.id = r.space_id
  WHERE r.id = p_room_id;
  
  -- Check if user is banned from workspace
  IF public.is_user_banned(v_workspace_id) THEN
    RETURN false;
  END IF;
  
  -- Check if user is member
  SELECT role INTO v_user_role
  FROM workspace_members
  WHERE workspace_id = v_workspace_id
  AND user_id = auth.uid()
  AND removed_at IS NULL
  AND is_suspended = false;
  
  IF v_user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check role hierarchy
  IF v_room_requires_role = 'guest' THEN
    -- Tutti possono entrare
    RETURN true;
  ELSIF v_room_requires_role = 'member' THEN
    RETURN v_user_role IN ('member', 'admin', 'owner');
  ELSIF v_room_requires_role = 'admin' THEN
    RETURN v_user_role IN ('admin', 'owner');
  ELSIF v_room_requires_role = 'owner' THEN
    RETURN v_user_role = 'owner';
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STORED PROCEDURES PER MODERAZIONE
-- ============================================

-- Kick utente da stanza
CREATE OR REPLACE FUNCTION public.kick_user_from_room(
  p_room_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT NULL -- NULL = kick semplice, altrimenti ban temporaneo
)
RETURNS VOID AS $$
DECLARE
  v_workspace_id UUID;
  v_kicker_role workspace_role;
  v_target_role workspace_role;
BEGIN
  -- Get workspace
  SELECT s.workspace_id INTO v_workspace_id
  FROM rooms r JOIN spaces s ON s.id = r.space_id
  WHERE r.id = p_room_id;
  
  -- Verifica permessi
  IF NOT public.has_workspace_permission(v_workspace_id, 'can_kick_from_rooms') THEN
    RAISE EXCEPTION 'Non hai i permessi per kickare utenti';
  END IF;
  
  -- Verifica che possa moderare questo utente
  IF NOT public.can_moderate_user(v_workspace_id, p_user_id) THEN
    RAISE EXCEPTION 'Non puoi moderare questo utente (ruolo troppo alto)';
  END IF;
  
  -- Rimuovi dai participants
  DELETE FROM room_participants WHERE room_id = p_room_id AND user_id = p_user_id;
  
  -- Log del kick
  INSERT INTO room_kicks (room_id, user_id, kicked_by, reason, can_reenter, banned_until)
  VALUES (
    p_room_id, p_user_id, auth.uid(), p_reason,
    p_duration_minutes IS NULL,
    CASE WHEN p_duration_minutes IS NOT NULL THEN NOW() + (p_duration_minutes || ' minutes')::INTERVAL END
  );
  
  -- Audit log
  PERFORM public.log_workspace_action(
    v_workspace_id, auth.uid(), 'user.kicked', 'room', p_room_id,
    jsonb_build_object('target_user', p_user_id, 'reason', p_reason, 'duration_min', p_duration_minutes)
  );
  
  -- Notifica al kickato
  INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
  VALUES (
    p_user_id, 'system', 'Sei stato rimosso da una stanza',
    COALESCE(p_reason, 'Sei stato rimosso dalla stanza da un moderatore'),
    'room', p_room_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ban utente da workspace
CREATE OR REPLACE FUNCTION public.ban_user_from_workspace(
  p_workspace_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL -- NULL = permanente
)
RETURNS VOID AS $$
BEGIN
  -- Verifica permessi
  IF NOT public.has_workspace_permission(p_workspace_id, 'can_ban_members') THEN
    RAISE EXCEPTION 'Non hai i permessi per bannare utenti';
  END IF;
  
  -- Verifica che possa moderare
  IF NOT public.can_moderate_user(p_workspace_id, p_user_id) THEN
    RAISE EXCEPTION 'Non puoi bannare questo utente';
  END IF;
  
  -- Non puoi bannare te stesso
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Non puoi bannare te stesso';
  END IF;
  
  -- Rimuovi da tutte le stanze attive
  DELETE FROM room_participants
  WHERE user_id = p_user_id
  AND room_id IN (
    SELECT r.id FROM rooms r
    JOIN spaces s ON s.id = r.space_id
    WHERE s.workspace_id = p_workspace_id
  );
  
  -- Imposta come removed con motivo
  UPDATE workspace_members
  SET removed_at = NOW(),
      removed_by = auth.uid(),
      remove_reason = 'BANNED: ' || COALESCE(p_reason, 'Violazione regole')
  WHERE workspace_id = p_workspace_id
  AND user_id = p_user_id;
  
  -- Crea ban record
  INSERT INTO workspace_bans (workspace_id, user_id, banned_by, reason, expires_at)
  VALUES (p_workspace_id, p_user_id, auth.uid(), p_reason, p_expires_at);
  
  -- Audit log
  PERFORM public.log_workspace_action(
    p_workspace_id, auth.uid(), 'user.banned', 'workspace', p_workspace_id,
    jsonb_build_object('target_user', p_user_id, 'reason', p_reason, 'expires', p_expires_at)
  );
  
  -- Notifica
  INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
  VALUES (
    p_user_id, 'system', 'Sei stato bannato',
    COALESCE(p_reason, 'Sei stato bannato dal workspace'),
    'workspace', p_workspace_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoca ban
CREATE OR REPLACE FUNCTION public.unban_user_from_workspace(
  p_workspace_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Verifica permessi
  IF NOT public.has_workspace_permission(p_workspace_id, 'can_ban_members') THEN
    RAISE EXCEPTION 'Non hai i permessi per revocare ban';
  END IF;
  
  -- Revoca ban
  UPDATE workspace_bans
  SET revoked_at = NOW(),
      revoked_by = auth.uid(),
      revoke_reason = p_reason
  WHERE workspace_id = p_workspace_id
  AND user_id = p_user_id
  AND revoked_at IS NULL;
  
  -- Audit log
  PERFORM public.log_workspace_action(
    p_workspace_id, auth.uid(), 'user.unbanned', 'workspace', p_workspace_id,
    jsonb_build_object('target_user', p_user_id, 'reason', p_reason)
  );
  
  -- Notifica
  INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
  VALUES (
    p_user_id, 'system', 'Ban revocato',
    'Il tuo ban è stato revocato. Puoi richiedere di unirti nuovamente.',
    'workspace', p_workspace_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mute utente
CREATE OR REPLACE FUNCTION public.mute_user_in_room(
  p_room_id UUID,
  p_user_id UUID,
  p_mute_type TEXT DEFAULT 'chat',
  p_duration_minutes INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  SELECT s.workspace_id INTO v_workspace_id
  FROM rooms r JOIN spaces s ON s.id = r.space_id
  WHERE r.id = p_room_id;
  
  IF NOT public.has_workspace_permission(v_workspace_id, 'can_mute_in_rooms') THEN
    RAISE EXCEPTION 'Non hai i permessi per mutare';
  END IF;
  
  IF NOT public.can_moderate_user(v_workspace_id, p_user_id) THEN
    RAISE EXCEPTION 'Non puoi moderare questo utente';
  END IF;
  
  INSERT INTO room_mutes (room_id, user_id, muted_by, mute_type, expires_at)
  VALUES (
    p_room_id, p_user_id, auth.uid(), p_mute_type,
    CASE WHEN p_duration_minutes IS NOT NULL THEN NOW() + (p_duration_minutes || ' minutes')::INTERVAL END
  )
  ON CONFLICT (room_id, user_id, mute_type) WHERE unmuted_at IS NULL
  DO UPDATE SET 
    expires_at = CASE WHEN p_duration_minutes IS NOT NULL THEN NOW() + (p_duration_minutes || ' minutes')::INTERVAL END,
    muted_by = auth.uid(),
    muted_at = NOW();
  
  -- Aggiorna participant
  UPDATE room_participants
  SET is_muted = true,
      muted_at = NOW(),
      muted_by = auth.uid(),
      mute_expires_at = CASE WHEN p_duration_minutes IS NOT NULL THEN NOW() + (p_duration_minutes || ' minutes')::INTERVAL END
  WHERE room_id = p_room_id AND user_id = p_user_id;
  
  -- Audit log
  PERFORM public.log_workspace_action(
    v_workspace_id, auth.uid(), 'user.muted', 'room', p_room_id,
    jsonb_build_object('target_user', p_user_id, 'type', p_mute_type)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unmute
CREATE OR REPLACE FUNCTION public.unmute_user_in_room(
  p_room_id UUID,
  p_user_id UUID,
  p_mute_type TEXT DEFAULT 'chat'
)
RETURNS VOID AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  SELECT s.workspace_id INTO v_workspace_id
  FROM rooms r JOIN spaces s ON s.id = r.space_id
  WHERE r.id = p_room_id;
  
  IF NOT public.has_workspace_permission(v_workspace_id, 'can_mute_in_rooms') THEN
    RAISE EXCEPTION 'Non hai i permessi';
  END IF;
  
  UPDATE room_mutes
  SET unmuted_at = NOW(),
      unmuted_by = auth.uid()
  WHERE room_id = p_room_id
  AND user_id = p_user_id
  AND mute_type = p_mute_type
  AND unmuted_at IS NULL;
  
  -- Aggiorna participant (se non ci sono altri mute attivi)
  IF NOT EXISTS (
    SELECT 1 FROM room_mutes
    WHERE room_id = p_room_id
    AND user_id = p_user_id
    AND unmuted_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  ) THEN
    UPDATE room_participants
    SET is_muted = false
    WHERE room_id = p_room_id AND user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cambia ruolo utente
CREATE OR REPLACE FUNCTION public.change_user_role(
  p_workspace_id UUID,
  p_user_id UUID,
  p_new_role workspace_role
)
RETURNS VOID AS $$
DECLARE
  v_old_role workspace_role;
BEGIN
  IF NOT public.has_workspace_permission(p_workspace_id, 'can_manage_member_roles') THEN
    RAISE EXCEPTION 'Non hai i permessi per cambiare ruoli';
  END IF;
  
  -- Get old role
  SELECT role INTO v_old_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
  
  -- Non puoi modificare owner (tranne se sei owner)
  IF v_old_role = 'owner' AND NOT public.is_workspace_owner(p_workspace_id) THEN
    RAISE EXCEPTION 'Solo l''owner può modificare l''owner';
  END IF;
  
  -- Non puoi promuovere a owner (solo owner può)
  IF p_new_role = 'owner' AND NOT public.is_workspace_owner(p_workspace_id) THEN
    RAISE EXCEPTION 'Solo l''owner può designare un nuovo owner';
  END IF;
  
  -- Non puoi degradare qualcuno di livello >= te
  IF NOT public.can_moderate_user(p_workspace_id, p_user_id) THEN
    RAISE EXCEPTION 'Non puoi modificare questo utente';
  END IF;
  
  UPDATE workspace_members
  SET role = p_new_role
  WHERE workspace_id = p_workspace_id
  AND user_id = p_user_id;
  
  -- Audit log
  PERFORM public.log_workspace_action(
    p_workspace_id, auth.uid(), 'user.role_changed', 'member', p_user_id,
    jsonb_build_object('user', p_user_id, 'old_role', v_old_role, 'new_role', p_new_role)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS PER NUOVE TABELLE
-- ============================================

ALTER TABLE workspace_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role permissions viewable by workspace members"
  ON workspace_role_permissions FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Role permissions manageable by admins"
  ON workspace_role_permissions FOR ALL
  USING (public.is_workspace_admin(workspace_id));

ALTER TABLE workspace_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bans viewable by admins"
  ON workspace_bans FOR SELECT
  USING (
    public.is_workspace_admin(workspace_id) OR
    (user_id = auth.uid() AND revoked_at IS NULL)
  );

CREATE POLICY "Bans manageable by admins"
  ON workspace_bans FOR ALL
  USING (public.is_workspace_admin(workspace_id));

ALTER TABLE room_kicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kicks viewable by room admins"
  ON room_kicks FOR SELECT
  USING (
    public.is_space_admin((SELECT space_id FROM rooms WHERE id = room_kicks.room_id)) OR
    user_id = auth.uid()
  );

ALTER TABLE room_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mutes viewable by room admins"
  ON room_mutes FOR SELECT
  USING (
    public.is_space_admin((SELECT space_id FROM rooms WHERE id = room_mutes.room_id)) OR
    user_id = auth.uid()
  );

-- ============================================
-- TRIGGER: Cleanup automatico mute scaduti
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_mutes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE room_participants
  SET is_muted = false
  WHERE is_muted = true
  AND user_id IN (
    SELECT user_id FROM room_mutes
    WHERE room_id = room_participants.room_id
    AND expires_at < NOW()
    AND unmuted_at IS NULL
  );
  
  UPDATE room_mutes
  SET unmuted_at = NOW()
  WHERE expires_at < NOW()
  AND unmuted_at IS NULL;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Esegui ogni minuto (da configurare in cron/extension pg_cron)
-- Oppure trigger su select delle room_participants

-- ============================================
-- REALTIME PER PRESENCE E MODERAZIONE
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE room_mutes;
ALTER PUBLICATION supabase_realtime ADD TABLE workspace_bans;

-- VISTA: Moderazione attiva in una stanza
CREATE VIEW room_moderation_status AS
SELECT 
  r.id as room_id,
  r.name as room_name,
  COUNT(DISTINCT rp.user_id) as active_users,
  COUNT(DISTINCT CASE WHEN rp.is_muted THEN rp.user_id END) as muted_users,
  jsonb_agg(DISTINCT jsonb_build_object(
    'user_id', rp.user_id,
    'is_muted', rp.is_muted,
    'muted_until', rp.mute_expires_at
  )) FILTER (WHERE rp.is_muted) as muted_list
FROM rooms r
LEFT JOIN room_participants rp ON rp.room_id = r.id
WHERE r.deleted_at IS NULL
GROUP BY r.id, r.name;

-- VISTA: Utenti bannati con info
CREATE VIEW workspace_ban_details AS
SELECT 
  wb.*,
  p.email as banned_user_email,
  p.full_name as banned_user_name,
  b.full_name as banned_by_name
FROM workspace_bans wb
JOIN profiles p ON p.id = wb.user_id
LEFT JOIN profiles b ON b.id = wb.banned_by
WHERE wb.revoked_at IS NULL
AND (wb.expires_at IS NULL OR wb.expires_at > NOW());
