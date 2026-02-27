-- ============================================
-- COSMOFFICE DATABASE SCHEMA v2 - ENTERPRISE SaaS
-- Multi-tenant | RBAC | Audit | Soft Delete
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- LIVELLO 1: AUTH & PROFILES
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  display_name TEXT, -- Nome visualizzato negli spazi
  avatar_url TEXT,
  timezone TEXT DEFAULT 'Europe/Rome',
  locale TEXT DEFAULT 'it',
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline', 'invisible')),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  preferences JSONB DEFAULT '{}', -- UI preferences, notifications, etc.
  
  -- Soft delete & Audit
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log per profili (GDPR compliance)
CREATE TABLE profile_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'restored', 'login', 'logout', 'email_changed')),
  performed_by UUID REFERENCES profiles(id),
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LIVELLO 2: WORKSPACES (Multi-tenancy)
-- ============================================

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  
  -- Billing & Plan
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  plan_expires_at TIMESTAMP WITH TIME ZONE,
  max_members INTEGER DEFAULT 10,
  max_spaces INTEGER DEFAULT 3,
  max_rooms_per_space INTEGER DEFAULT 10,
  storage_quota_bytes BIGINT DEFAULT 1073741824, -- 1GB
  
  -- Settings
  settings JSONB DEFAULT '{
    "allow_guest_invites": true,
    "allow_member_create_spaces": false,
    "require_approval_for_invites": false,
    "default_space_visibility": "private",
    "enable_ai_agents": false,
    "enable_analytics": true,
    "theme": "default"
  }',
  
  -- Branding (white-label per enterprise)
  branding JSONB DEFAULT '{}',
  
  -- Soft delete & Audit
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Ruoli nel workspace (RBAC)
CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'member', 'guest', 'viewer');

CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role workspace_role DEFAULT 'member',
  
  -- Permessi specifici (override del ruolo)
  permissions JSONB DEFAULT '{}', -- es: {"can_create_spaces": true}
  
  -- Meta
  invited_by UUID REFERENCES profiles(id),
  invited_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE,
  
  -- Soft delete (utente rimosso ma dati preservati)
  removed_at TIMESTAMP WITH TIME ZONE,
  removed_by UUID REFERENCES profiles(id),
  remove_reason TEXT,
  
  UNIQUE(workspace_id, user_id)
);

-- Audit log workspace (tutte le azioni importanti)
CREATE TABLE workspace_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  
  -- Cosa è successo
  action TEXT NOT NULL, -- 'member.invited', 'member.removed', 'space.created', 'space.deleted', etc.
  entity_type TEXT NOT NULL, -- 'member', 'space', 'room', 'settings', etc.
  entity_id UUID, -- ID dell'entità coinvolta
  
  -- Dettagli
  metadata JSONB DEFAULT '{}', -- dettagli specifici dell'azione
  old_values JSONB,
  new_values JSONB,
  
  -- Contesto
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per audit logs (ricerca veloce)
CREATE INDEX idx_workspace_audit_workspace ON workspace_audit_logs(workspace_id, created_at DESC);
CREATE INDEX idx_workspace_audit_action ON workspace_audit_logs(action, created_at DESC);
CREATE INDEX idx_workspace_audit_user ON workspace_audit_logs(user_id, created_at DESC);

-- ============================================
-- LIVELLO 3: SPACES (Uffici Virtuali)
-- ============================================

CREATE TABLE spaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Info base
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL, -- unico per workspace
  
  -- Visibilità
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'invitation_only')),
  
  -- Layout
  layout_data JSONB DEFAULT '{
    "grid_size": 20,
    "show_grid": true,
    "background": "#f8fafc",
    "zoom_default": 1
  }',
  
  -- Settings
  settings JSONB DEFAULT '{
    "max_participants": 50,
    "enable_chat": true,
    "enable_video": true,
    "enable_screen_share": true,
    "enable_reactions": true,
    "chat_history_days": 90
  }',
  
  -- Thumbnail/preview
  thumbnail_url TEXT,
  
  -- Soft delete & Audit
  archived_at TIMESTAMP WITH TIME ZONE, -- archiviazione (non visibile ma recuperabile)
  archived_by UUID REFERENCES profiles(id),
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  UNIQUE(workspace_id, slug)
);

-- Membri dello space (chi ha accesso a quali spaces)
-- NOTA: Tutti i workspace_members hanno accesso di default, 
-- ma qui si possono aggiungere guest o escludere membri specifici
CREATE TABLE space_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Ruolo specifico nello space (ereditato da workspace_member se null)
  role workspace_role,
  
  -- Permessi specifici nello space
  can_create_rooms BOOLEAN DEFAULT false,
  can_delete_rooms BOOLEAN DEFAULT false,
  can_moderate_chat BOOLEAN DEFAULT false,
  can_manage_furniture BOOLEAN DEFAULT false,
  
  added_by UUID REFERENCES profiles(id),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(space_id, user_id)
);

-- ============================================
-- LIVELLO 4: ROOMS (Stanze)
-- ============================================

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  
  -- Info base
  name TEXT NOT NULL,
  type TEXT DEFAULT 'open' CHECK (type IN ('open', 'meeting', 'focus', 'break', 'reception', 'private')),
  description TEXT,
  
  -- Posizione e dimensioni
  x INTEGER DEFAULT 0,
  y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 200,
  height INTEGER DEFAULT 150,
  z_index INTEGER DEFAULT 0,
  
  -- Aspetto
  color TEXT DEFAULT '#1e293b',
  icon TEXT, -- emoji o icon name
  background_image_url TEXT,
  
  -- Settings
  capacity INTEGER DEFAULT 10,
  is_secret BOOLEAN DEFAULT false, -- non visibile nella mappa se non sei dentro
  is_locked BOOLEAN DEFAULT false, -- richiede permesso per entrare
  
  -- Permessi specifici stanza
  who_can_enter workspace_role DEFAULT 'guest', -- minimo ruolo richiesto
  who_can_moderate workspace_role DEFAULT 'admin', -- chi può kickare/mutare
  
  department TEXT,
  settings JSONB DEFAULT '{}',
  
  -- Soft delete
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Connessioni tra stanze (porte/portali)
CREATE TABLE room_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  room_a_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  room_b_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  
  type TEXT DEFAULT 'door' CHECK (type IN ('door', 'portal', 'stairs', 'elevator')),
  
  -- Posizioni
  x_a INTEGER DEFAULT 0,
  y_a INTEGER DEFAULT 0,
  x_b INTEGER DEFAULT 0,
  y_b INTEGER DEFAULT 0,
  
  -- Se locked, serve permesso per passare
  is_locked BOOLEAN DEFAULT false,
  
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(room_a_id, room_b_id),
  CONSTRAINT no_self_loop CHECK (room_a_id != room_b_id)
);

-- Mobili/Oggetti nelle stanze
CREATE TABLE furniture (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL, -- 'desk', 'chair', 'sofa', 'whiteboard', 'plant', 'tv', etc.
  label TEXT,
  
  -- Posizione
  x INTEGER DEFAULT 0,
  y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 40,
  height INTEGER DEFAULT 40,
  rotation INTEGER DEFAULT 0,
  z_index INTEGER DEFAULT 0,
  
  -- Interattività
  is_interactable BOOLEAN DEFAULT false,
  interaction_type TEXT, -- 'link', 'embed', 'app', 'whiteboard', etc.
  interaction_data JSONB, -- URL, app config, etc.
  
  -- Aspetto
  color TEXT DEFAULT '#64748b',
  icon TEXT,
  image_url TEXT,
  
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- ============================================
-- LIVELLO 5: PRESENCE (Chi è dove)
-- ============================================

-- Utenti attualmente nelle stanze
CREATE TABLE room_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Posizione avatar
  x INTEGER DEFAULT 100,
  y INTEGER DEFAULT 100,
  direction INTEGER DEFAULT 0, -- 0-360 gradi
  
  -- Stato media
  audio_enabled BOOLEAN DEFAULT true,
  video_enabled BOOLEAN DEFAULT false,
  screen_sharing BOOLEAN DEFAULT false,
  hand_raised BOOLEAN DEFAULT false,
  
  -- Stato presenza
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'away', 'dnd', 'in_call')),
  
  -- Meta
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(room_id, user_id)
);

-- Storico partecipazioni (analytics)
CREATE TABLE room_participant_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL,
  left_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  
  -- Stats
  messages_sent INTEGER DEFAULT 0,
  reactions_sent INTEGER DEFAULT 0,
  screen_share_duration_seconds INTEGER DEFAULT 0
);

-- ============================================
-- LIVELLO 6: CHAT (Unificata)
-- ============================================

-- Conversazioni (stanza, canale, o DM)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN ('room', 'channel', 'direct')),
  
  -- Se type = 'room', collegata a una stanza
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  
  -- Se type = 'direct', è una DM tra 2 utenti (no room_id)
  -- Se type = 'channel', è un canale workspace-wide
  
  name TEXT, -- per canali (es: "general", "random")
  topic TEXT, -- descrizione canale
  
  -- Settings
  is_private BOOLEAN DEFAULT false, -- per canali
  is_archived BOOLEAN DEFAULT false,
  
  -- Per DM
  user_a_id UUID REFERENCES profiles(id), -- ordinati per consistenza
  user_b_id UUID REFERENCES profiles(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  -- Vincoli
  CONSTRAINT dm_has_users CHECK (
    (type != 'direct') OR (user_a_id IS NOT NULL AND user_b_id IS NOT NULL)
  ),
  CONSTRAINT room_has_room_id CHECK (
    (type != 'room') OR (room_id IS NOT NULL)
  ),
  CONSTRAINT channel_has_name CHECK (
    (type != 'channel') OR (name IS NOT NULL)
  )
);

-- Partecipanti conversazione (per canali privati e per tracciare "leave")
CREATE TABLE conversation_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE, -- se null, è ancora membro
  
  -- Notifiche
  notification_settings JSONB DEFAULT '{"mute": false, "mentions_only": false}',
  
  UNIQUE(conversation_id, user_id)
);

-- Messaggi
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  
  -- Mittente (null per messaggi di sistema)
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sender_name TEXT, -- denormalizzato per storico
  sender_avatar_url TEXT,
  
  -- Contenuto
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'file', 'system', 'join', 'leave', 'call_start', 'call_end')),
  
  -- Formattazione
  formatted_content JSONB, -- structured content (blocks, mentions, etc.)
  
  -- Reply
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  
  -- Reazioni (denormalizzate per performance)
  reactions JSONB DEFAULT '[]', -- [{"emoji": "👍", "users": ["uuid1", "uuid2"], "count": 2}]
  
  -- Edit
  edited_at TIMESTAMP WITH TIME ZONE,
  edited_by UUID REFERENCES profiles(id),
  
  -- Soft delete
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES profiles(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Thread (per risposte inline)
  thread_parent_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  reply_count INTEGER DEFAULT 0
);

-- Files allegati ai messaggi
CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL, -- path in Supabase Storage
  public_url TEXT,
  
  -- Preview
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  
  uploaded_by UUID REFERENCES profiles(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LIVELLO 7: INVITATIONS & REQUESTS
-- ============================================

-- Inviti a workspace
CREATE TABLE workspace_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  
  email TEXT NOT NULL,
  role workspace_role DEFAULT 'member',
  
  -- Token per accettazione
  token TEXT UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
  
  -- Scadenza
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  
  -- Chi ha invitato
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Stato
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES profiles(id), -- profilo creato
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by UUID REFERENCES profiles(id),
  
  -- Prevenzione duplicati
  UNIQUE(workspace_id, email)
);

-- Inviti a specifici spaces (per guest)
CREATE TABLE space_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  
  email TEXT NOT NULL,
  
  token TEXT UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '3 days'),
  
  invited_by UUID REFERENCES profiles(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  accepted_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Richieste di accesso (per workspaces private)
CREATE TABLE workspace_join_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  message TEXT, -- messaggio opzionale del richiedente
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_note TEXT,
  
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(workspace_id, user_id)
);

-- ============================================
-- LIVELLO 8: NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Cosa è successo
  type TEXT NOT NULL, -- 'mention', 'invite', 'room_enter', 'message', 'system'
  title TEXT NOT NULL,
  body TEXT,
  
  -- Link all'entità
  entity_type TEXT, -- 'workspace', 'space', 'room', 'message', 'invitation'
  entity_id UUID,
  
  -- Deep link
  action_url TEXT,
  
  -- Stato
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Icona
  icon TEXT,
  image_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LIVELLO 9: AI AGENTS
-- ============================================

CREATE TABLE ai_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  
  -- Personalità
  role TEXT NOT NULL, -- 'assistant', 'moderator', 'scribe', 'fun', etc.
  personality TEXT,
  system_prompt TEXT NOT NULL,
  
  -- Capacità
  capabilities JSONB DEFAULT '[]', -- ['chat', 'summarize', 'schedule', 'moderate']
  
  -- Dove agisce
  allowed_spaces UUID[], -- se null, tutti gli spaces
  allowed_rooms UUID[], -- se null, tutte le stanze
  
  -- Stato
  is_active BOOLEAN DEFAULT true,
  
  -- Usage stats
  messages_sent INTEGER DEFAULT 0,
  last_active_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- ============================================
-- LIVELLO 10: REALTIME PRESENCE
-- ============================================

-- Tabella per realtime presence (chi è online dove)
CREATE TABLE user_presence (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'away', 'busy', 'in_call', 'offline')),
  status_message TEXT, -- "In riunione", "Pranzo", etc.
  
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Client info per debugging
  client_version TEXT,
  platform TEXT -- 'web', 'desktop', 'mobile'
);

-- ============================================
-- INDICES FOR PERFORMANCE
-- ============================================

-- Profiles
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_status ON profiles(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_deleted ON profiles(deleted_at);

-- Workspace members
CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id) WHERE removed_at IS NULL;
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id) WHERE removed_at IS NULL;

-- Spaces
CREATE INDEX idx_spaces_workspace ON spaces(workspace_id) WHERE deleted_at IS NULL AND archived_at IS NULL;

-- Rooms
CREATE INDEX idx_rooms_space ON rooms(space_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_rooms_space_secret ON rooms(space_id, is_secret) WHERE deleted_at IS NULL;

-- Room participants (realtime)
CREATE INDEX idx_room_participants_room ON room_participants(room_id);
CREATE INDEX idx_room_participants_user ON room_participants(user_id);

-- Conversations
CREATE INDEX idx_conversations_workspace ON conversations(workspace_id);
CREATE INDEX idx_conversations_room ON conversations(room_id) WHERE type = 'room';
CREATE INDEX idx_conversations_direct ON conversations(user_a_id, user_b_id) WHERE type = 'direct';

-- Messages
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_thread ON messages(thread_parent_id) WHERE thread_parent_id IS NOT NULL;
CREATE INDEX idx_messages_sender ON messages(sender_id, created_at DESC);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- Audit logs (time-series pattern)
CREATE INDEX idx_workspace_audit_time ON workspace_audit_logs(workspace_id, created_at DESC);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers updated_at
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER spaces_updated_at BEFORE UPDATE ON spaces FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER furniture_updated_at BEFORE UPDATE ON furniture FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ai_agents_updated_at BEFORE UPDATE ON ai_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-add owner to workspace_members
CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (NEW.id, NEW.created_by, 'owner', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_workspace_created
  AFTER INSERT ON workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();

-- Log workspace actions
CREATE OR REPLACE FUNCTION public.log_workspace_action(
  p_workspace_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.workspace_audit_logs (workspace_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (p_workspace_id, p_user_id, p_action, p_entity_type, p_entity_id, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Soft delete helper
CREATE OR REPLACE FUNCTION public.soft_delete(
  table_name TEXT,
  record_id UUID,
  deleted_by_id UUID
)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2',
    table_name
  ) USING deleted_by_id, record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: is workspace member
CREATE OR REPLACE FUNCTION public.is_workspace_member(check_workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = check_workspace_id 
    AND user_id = auth.uid()
    AND removed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: is workspace admin/owner
CREATE OR REPLACE FUNCTION public.is_workspace_admin(check_workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = check_workspace_id 
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
    AND removed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: is workspace owner
CREATE OR REPLACE FUNCTION public.is_workspace_owner(check_workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = check_workspace_id 
    AND user_id = auth.uid()
    AND role = 'owner'
    AND removed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: can access space
CREATE OR REPLACE FUNCTION public.can_access_space(check_space_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.spaces s
    JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
    WHERE s.id = check_space_id
    AND wm.user_id = auth.uid()
    AND wm.removed_at IS NULL
    AND s.deleted_at IS NULL
    AND s.archived_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: is space admin
CREATE OR REPLACE FUNCTION public.is_space_admin(check_space_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.spaces s
    JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
    WHERE s.id = check_space_id
    AND wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
    AND wm.removed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: can enter room
CREATE OR REPLACE FUNCTION public.can_enter_room(check_room_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  required_role workspace_role;
  user_role workspace_role;
BEGIN
  -- Get required role for room
  SELECT who_can_enter INTO required_role
  FROM public.rooms WHERE id = check_room_id;
  
  -- Get user role in workspace
  SELECT wm.role INTO user_role
  FROM public.rooms r
  JOIN public.spaces s ON s.id = r.space_id
  JOIN public.workspace_members wm ON wm.workspace_id = s.workspace_id
  WHERE r.id = check_room_id
  AND wm.user_id = auth.uid()
  AND wm.removed_at IS NULL;
  
  -- Role hierarchy: owner(4) > admin(3) > member(2) > guest(1) > viewer(0)
  RETURN CASE required_role
    WHEN 'owner' THEN user_role = 'owner'
    WHEN 'admin' THEN user_role IN ('owner', 'admin')
    WHEN 'member' THEN user_role IN ('owner', 'admin', 'member')
    WHEN 'guest' THEN user_role IN ('owner', 'admin', 'member', 'guest')
    ELSE true
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-cleanup room_participants quando utente va offline
CREATE OR REPLACE FUNCTION public.cleanup_inactive_participants()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.room_participants
  WHERE last_activity_at < NOW() - INTERVAL '5 minutes';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by workspace members"
  ON profiles FOR SELECT
  USING (
    deleted_at IS NULL AND (
      auth.uid() = id OR
      EXISTS (
        SELECT 1 FROM workspace_members wm
        JOIN workspace_members wm2 ON wm.workspace_id = wm2.workspace_id
        WHERE wm.user_id = profiles.id
        AND wm2.user_id = auth.uid()
        AND wm.removed_at IS NULL
        AND wm2.removed_at IS NULL
      )
    )
  );

CREATE POLICY "Users manage own profile"
  ON profiles FOR ALL
  USING (auth.uid() = id);

-- Workspaces
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspaces viewable by members"
  ON workspaces FOR SELECT
  USING (
    deleted_at IS NULL AND
    public.is_workspace_member(id)
  );

CREATE POLICY "Workspaces creatable by anyone"
  ON workspaces FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Workspaces updatable by admins"
  ON workspaces FOR UPDATE
  USING (public.is_workspace_admin(id));

CREATE POLICY "Workspaces deletable by owner"
  ON workspaces FOR DELETE
  USING (public.is_workspace_owner(id));

-- Workspace members
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members viewable by workspace members"
  ON workspace_members FOR SELECT
  USING (
    removed_at IS NULL AND
    public.is_workspace_member(workspace_id)
  );

CREATE POLICY "Members manageable by admins"
  ON workspace_members FOR ALL
  USING (
    public.is_workspace_admin(workspace_id) OR
    (user_id = auth.uid() AND removed_at IS NULL) -- Self remove
  );

-- Spaces
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Spaces viewable by workspace members"
  ON spaces FOR SELECT
  USING (
    deleted_at IS NULL AND
    archived_at IS NULL AND
    public.is_workspace_member(workspace_id)
  );

CREATE POLICY "Spaces creatable by admins/member with permission"
  ON spaces FOR INSERT
  WITH CHECK (
    public.is_workspace_admin(workspace_id) OR
    EXISTS (
      SELECT 1 FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE w.id = spaces.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.removed_at IS NULL
      AND (w.settings->>'allow_member_create_spaces')::boolean = true
    )
  );

CREATE POLICY "Spaces manageable by admins"
  ON spaces FOR UPDATE
  USING (public.is_workspace_admin(workspace_id));

-- Rooms
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rooms viewable by space members"
  ON rooms FOR SELECT
  USING (
    deleted_at IS NULL AND
    public.can_access_space(space_id) AND
    (NOT is_secret OR EXISTS (
      SELECT 1 FROM room_participants WHERE room_id = rooms.id AND user_id = auth.uid()
    ))
  );

CREATE POLICY "Rooms creatable by space admins"
  ON rooms FOR INSERT
  WITH CHECK (public.is_space_admin(space_id));

CREATE POLICY "Rooms manageable by space admins"
  ON rooms FOR UPDATE
  USING (public.is_space_admin(space_id));

-- Room participants
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants viewable by room members"
  ON room_participants FOR SELECT
  USING (public.can_access_space(
    (SELECT space_id FROM rooms WHERE id = room_participants.room_id)
  ));

CREATE POLICY "Users manage own participation"
  ON room_participants FOR ALL
  USING (user_id = auth.uid());

-- Conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversations viewable by workspace members"
  ON conversations FOR SELECT
  USING (
    public.is_workspace_member(workspace_id) AND
    (
      type != 'direct' OR
      auth.uid() IN (user_a_id, user_b_id)
    )
  );

-- Messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages viewable by conversation members"
  ON messages FOR SELECT
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND public.is_workspace_member(c.workspace_id)
    )
  );

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND public.is_workspace_member(c.workspace_id)
    )
  );

CREATE POLICY "Users can edit own messages"
  ON messages FOR UPDATE
  USING (
    auth.uid() = sender_id AND
    deleted_at IS NULL
  );

CREATE POLICY "Users can soft delete own messages"
  ON messages FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (deleted_at IS NOT NULL);

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notifications viewable by owner"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Notifications manageable by owner"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- AI Agents
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI agents viewable by workspace members"
  ON ai_agents FOR SELECT
  USING (
    is_active = true AND
    public.is_workspace_member(workspace_id)
  );

CREATE POLICY "AI agents manageable by admins"
  ON ai_agents FOR ALL
  USING (public.is_workspace_admin(workspace_id));

-- ============================================
-- REALTIME SETUP
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_connections;
ALTER PUBLICATION supabase_realtime ADD TABLE furniture;
ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Per realtime presence tracking
ALTER TABLE room_participants REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE user_presence REPLICA IDENTITY FULL;

-- ============================================
-- VIEWS UTILI
-- ============================================

-- Vista workspace con conteggi
CREATE VIEW workspace_stats AS
SELECT 
  w.id,
  w.name,
  w.plan,
  w.created_at,
  COUNT(DISTINCT wm.user_id) FILTER (WHERE wm.removed_at IS NULL) as member_count,
  COUNT(DISTINCT s.id) FILTER (WHERE s.deleted_at IS NULL AND s.archived_at IS NULL) as space_count,
  COUNT(DISTINCT r.id) FILTER (WHERE r.deleted_at IS NULL) as room_count,
  COUNT(DISTINCT m.id) FILTER (WHERE m.deleted_at IS NULL) as total_messages
FROM workspaces w
LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
LEFT JOIN spaces s ON s.workspace_id = w.id
LEFT JOIN rooms r ON r.space_id = s.id
LEFT JOIN conversations c ON c.workspace_id = w.id
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE w.deleted_at IS NULL
GROUP BY w.id;

-- Vista utenti online per workspace
CREATE VIEW workspace_online_users AS
SELECT 
  w.id as workspace_id,
  COUNT(DISTINCT up.user_id) as online_count,
  array_agg(DISTINCT up.user_id) as online_user_ids
FROM workspaces w
LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
LEFT JOIN user_presence up ON up.user_id = wm.user_id
WHERE w.deleted_at IS NULL
AND wm.removed_at IS NULL
AND up.status = 'online'
GROUP BY w.id;
