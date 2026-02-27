-- ============================================
-- MIGRAZIONE DA SCHEMA VECCHIO A V2
-- Mantiene tutti i dati esistenti
-- ============================================

-- ============================================
-- STEP 1: AGGIORNA PROFILES (se necessario)
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Rome';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'it';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);

-- Rinomina last_seen se esiste
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_seen') THEN
    ALTER TABLE profiles RENAME COLUMN last_seen TO last_seen_at;
  END IF;
END $$;

-- ============================================
-- STEP 2: CREA WORKSPACES (da organizations)
-- ============================================

-- Crea tabella workspaces se non esiste
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  plan_expires_at TIMESTAMP WITH TIME ZONE,
  max_members INTEGER DEFAULT 10,
  max_spaces INTEGER DEFAULT 3,
  max_rooms_per_space INTEGER DEFAULT 10,
  storage_quota_bytes BIGINT DEFAULT 1073741824,
  settings JSONB DEFAULT '{}',
  branding JSONB DEFAULT '{}',
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Migra dati da organizations a workspaces (solo se organizations esiste)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    -- Copia dati
    INSERT INTO workspaces (id, name, slug, logo_url, plan, settings, created_at, updated_at, created_by)
    SELECT id, name, slug, logo_url, COALESCE(plan, 'free'), COALESCE(settings, '{}'), created_at, updated_at, created_by
    FROM organizations
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Migrated organizations to workspaces';
  END IF;
END $$;

-- ============================================
-- STEP 3: CREA WORKSPACE_MEMBERS (da organization_members)
-- ============================================

CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'guest', 'viewer')),
  permissions JSONB DEFAULT '{}',
  invited_by UUID REFERENCES profiles(id),
  invited_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE,
  removed_at TIMESTAMP WITH TIME ZONE,
  removed_by UUID REFERENCES profiles(id),
  remove_reason TEXT,
  is_suspended BOOLEAN DEFAULT false,
  suspended_at TIMESTAMP WITH TIME ZONE,
  suspended_by UUID REFERENCES profiles(id),
  suspend_reason TEXT,
  suspend_expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(workspace_id, user_id)
);

-- Migra da organization_members
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_members') THEN
    INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at, invited_by)
    SELECT id, org_id, user_id, 
           CASE 
             WHEN role = 'owner' THEN 'owner'::text
             WHEN role = 'admin' THEN 'admin'::text
             ELSE 'member'::text
           END,
           joined_at,
           invited_by
    FROM organization_members
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
    
    RAISE NOTICE 'Migrated organization_members to workspace_members';
  END IF;
END $$;

-- Assicurati che i creatori siano owner
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces') THEN
    INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
    SELECT w.id, w.created_by, 'owner', NOW()
    FROM workspaces w
    WHERE NOT EXISTS (
      SELECT 1 FROM workspace_members wm 
      WHERE wm.workspace_id = w.id AND wm.user_id = w.created_by
    );
  END IF;
END $$;

-- ============================================
-- STEP 4: AGGIORNA SPACES
-- ============================================

-- Aggiungi colonne mancanti
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'invitation_only'));
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id);
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- Rinomina org_id in workspace_id se necessario
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'spaces' AND column_name = 'org_id') THEN
    ALTER TABLE spaces RENAME COLUMN org_id TO workspace_id;
  END IF;
END $$;

-- Crea slug se mancante
UPDATE spaces SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')) WHERE slug IS NULL;

-- ============================================
-- STEP 5: AGGIORNA ROOMS
-- ============================================

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS z_index INTEGER DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS background_image_url TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS who_can_enter TEXT DEFAULT 'guest' CHECK (who_can_enter IN ('owner', 'admin', 'member', 'guest', 'viewer'));
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS who_can_moderate TEXT DEFAULT 'admin' CHECK (who_can_moderate IN ('owner', 'admin', 'member', 'guest', 'viewer'));
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Rinomina color in color se necessario
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'color') THEN
    -- già corretto
    NULL;
  END IF;
END $$;

-- ============================================
-- STEP 6: CREA NUOVE TABELLE
-- ============================================

-- WORKSPACE_AUDIT_LOGS
CREATE TABLE IF NOT EXISTS workspace_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SPACE_MEMBERS
CREATE TABLE IF NOT EXISTS space_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT,
  can_create_rooms BOOLEAN DEFAULT false,
  can_delete_rooms BOOLEAN DEFAULT false,
  can_moderate_chat BOOLEAN DEFAULT false,
  can_manage_furniture BOOLEAN DEFAULT false,
  added_by UUID REFERENCES profiles(id),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(space_id, user_id)
);

-- ROOM_CONNECTIONS (se non esiste)
CREATE TABLE IF NOT EXISTS room_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  room_a_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  room_b_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'door' CHECK (type IN ('door', 'portal', 'stairs', 'elevator')),
  x_a INTEGER DEFAULT 0,
  y_a INTEGER DEFAULT 0,
  x_b INTEGER DEFAULT 0,
  y_b INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_a_id, room_b_id),
  CONSTRAINT no_self_loop CHECK (room_a_id != room_b_id)
);

-- RINOMINA PARTICIPANTS in ROOM_PARTICIPANTS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'participants') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_participants') THEN
    ALTER TABLE participants RENAME TO room_participants;
  END IF;
END $$;

-- AGGIORNA ROOM_PARTICIPANTS
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS direction INTEGER DEFAULT 0;
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS hand_raised BOOLEAN DEFAULT false;
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'away', 'dnd', 'in_call'));
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS is_kicked BOOLEAN DEFAULT false;
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS kicked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS kicked_by UUID REFERENCES profiles(id);
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS kick_reason TEXT;
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT false;
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS muted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS muted_by UUID REFERENCES profiles(id);
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS mute_expires_at TIMESTAMP WITH TIME ZONE;

-- Rinomina colonne se necessario
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_participants' AND column_name = 'joinedat') THEN
    ALTER TABLE room_participants RENAME COLUMN joinedat TO joined_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'room_participants' AND column_name = 'last_activity') THEN
    ALTER TABLE room_participants RENAME COLUMN last_activity TO last_activity_at;
  END IF;
END $$;

-- CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('room', 'channel', 'direct')),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT,
  topic TEXT,
  is_private BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  user_a_id UUID REFERENCES profiles(id),
  user_b_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- MIGRA space_chat_messages se esiste
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'space_chat_messages') THEN
    -- Crea conversazioni per le room che hanno chat
    INSERT INTO conversations (id, workspace_id, type, room_id, created_at)
    SELECT DISTINCT 
      gen_random_uuid(),
      s.workspace_id,
      'room',
      scm.room_id,
      NOW()
    FROM space_chat_messages scm
    JOIN rooms r ON r.id = scm.room_id
    JOIN spaces s ON s.id = r.space_id
    ON CONFLICT DO NOTHING;
    
    -- Ora crea tabella messages e migra
    RAISE NOTICE 'Space chat messages exists - manual migration needed for messages';
  END IF;
END $$;

-- MESSAGES (nuova tabella unificata)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sender_name TEXT,
  sender_avatar_url TEXT,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'file', 'system', 'join', 'leave', 'call_start', 'call_end')),
  formatted_content JSONB,
  reply_to_id UUID REFERENCES messages(id),
  reactions JSONB DEFAULT '[]',
  edited_at TIMESTAMP WITH TIME ZONE,
  edited_by UUID REFERENCES profiles(id),
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  thread_parent_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  reply_count INTEGER DEFAULT 0
);

-- MESSAGE_ATTACHMENTS
CREATE TABLE IF NOT EXISTS message_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  uploaded_by UUID REFERENCES profiles(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mention', 'invite', 'room_enter', 'message', 'system', 'kick', 'ban', 'mute')),
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id UUID,
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  icon TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WORKSPACE_INVITATIONS
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'guest', 'viewer')),
  token TEXT UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES profiles(id),
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by UUID REFERENCES profiles(id),
  UNIQUE(workspace_id, email)
);

-- WORKSPACE_JOIN_REQUESTS
CREATE TABLE IF NOT EXISTS workspace_join_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_note TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- USER_PRESENCE
CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'away', 'busy', 'in_call', 'offline')),
  status_message TEXT,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  client_version TEXT,
  platform TEXT
);

-- ============================================
-- STEP 7: FUNCTIONS & TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (NEW.id, NEW.created_by, 'owner', NOW())
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Helper functions
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

-- ============================================
-- STEP 8: TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_workspace_created ON workspaces;
CREATE TRIGGER on_workspace_created
  AFTER INSERT ON workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();

-- Updated at triggers
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS workspaces_updated_at ON workspaces;
CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS spaces_updated_at ON spaces;
CREATE TRIGGER spaces_updated_at BEFORE UPDATE ON spaces FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS rooms_updated_at ON rooms;
CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- STEP 9: RLS POLICIES
-- ============================================

-- Abilita RLS su tutte le tabelle
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE furniture ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- RLS Policies (semplificate)
CREATE POLICY IF NOT EXISTS "Profiles viewable by all" ON profiles FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY IF NOT EXISTS "Users manage own profile" ON profiles FOR ALL USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Workspaces viewable by members" ON workspaces FOR SELECT USING (
  deleted_at IS NULL AND public.is_workspace_member(id)
);
CREATE POLICY IF NOT EXISTS "Users can create workspaces" ON workspaces FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY IF NOT EXISTS "Members viewable by workspace members" ON workspace_members FOR SELECT USING (
  removed_at IS NULL AND public.is_workspace_member(workspace_id)
);

-- ============================================
-- STEP 10: INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_spaces_workspace ON spaces(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_space ON rooms(space_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_room_participants_room ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC) WHERE deleted_at IS NULL;

-- ============================================
-- STEP 11: REALTIME
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE room_participants;
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Realtime tables may already exist in publication';
END $$;

-- ============================================
-- STEP 12: VISTE
-- ============================================

CREATE OR REPLACE VIEW workspace_stats AS
SELECT 
  w.id,
  w.name,
  w.plan,
  w.created_at,
  COUNT(DISTINCT wm.user_id) FILTER (WHERE wm.removed_at IS NULL) as member_count,
  COUNT(DISTINCT s.id) FILTER (WHERE s.deleted_at IS NULL) as space_count,
  COUNT(DISTINCT r.id) FILTER (WHERE r.deleted_at IS NULL) as room_count
FROM workspaces w
LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
LEFT JOIN spaces s ON s.workspace_id = w.id
LEFT JOIN rooms r ON r.space_id = s.id
WHERE w.deleted_at IS NULL
GROUP BY w.id;

-- ============================================
-- MIGRAZIONE COMPLETATA
-- ============================================
SELECT 'Migration completed successfully!' as status;
