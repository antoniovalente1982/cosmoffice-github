-- ============================================
-- FIX COMPLETO SCHEMA - Aggiunge colonne mancanti
-- ============================================

-- 1. Aggiungi colonne mancanti a workspaces
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS max_spaces INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS max_rooms_per_space INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT DEFAULT 1073741824,
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}';

-- 2. Aggiungi colonne mancanti a spaces (se non esistono)
ALTER TABLE spaces
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id),
ADD COLUMN IF NOT EXISTS slug TEXT,
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private',
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- 3. Se spaces ha ancora org_id, convertilo in workspace_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'spaces' AND column_name = 'org_id') THEN
    -- Aggiorna workspace_id con i valori di org_id dove workspace_id è null
    UPDATE spaces SET workspace_id = org_id WHERE workspace_id IS NULL;
    -- Rimuovi la colonna vecchia
    ALTER TABLE spaces DROP COLUMN org_id;
  END IF;
END $$;

-- 4. Crea workspace_members se non esiste
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

-- 5. Crea tabella conversations se non esiste (per la chat)
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

-- 6. Crea tabella messages se non esiste (per la chat)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sender_name TEXT,
  sender_avatar_url TEXT,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'file', 'system', 'join', 'leave', 'call_start', 'call_end')),
  formatted_content JSONB,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  reactions JSONB DEFAULT '[]',
  edited_at TIMESTAMP WITH TIME ZONE,
  edited_by UUID REFERENCES profiles(id),
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  thread_parent_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  reply_count INTEGER DEFAULT 0
);

-- 7. Crea tabella message_attachments se non esiste
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

-- ============================================
-- FIX RLS POLICIES
-- ============================================

-- Abilita RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy workspaces: creazione
DROP POLICY IF EXISTS "Users can create workspaces" ON workspaces;
CREATE POLICY "Users can create workspaces" 
ON workspaces FOR INSERT 
WITH CHECK (auth.uid() = created_by);

-- Policy workspaces: lettura
DROP POLICY IF EXISTS "Workspaces viewable by members" ON workspaces;
CREATE POLICY "Workspaces viewable by members"
ON workspaces FOR SELECT
USING (
  deleted_at IS NULL AND
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspaces.id
    AND wm.user_id = auth.uid()
    AND wm.removed_at IS NULL
  )
);

-- Policy workspace_members: lettura
DROP POLICY IF EXISTS "Members viewable by workspace members" ON workspace_members;
CREATE POLICY "Members viewable by workspace members"
ON workspace_members FOR SELECT
USING (
  removed_at IS NULL AND
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspace_members.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.removed_at IS NULL
  )
);

-- Policy workspace_members: inserimento (per il trigger)
DROP POLICY IF EXISTS "Allow insert for trigger" ON workspace_members;
CREATE POLICY "Allow insert for trigger"
ON workspace_members FOR INSERT
WITH CHECK (true);

-- Policy spaces: lettura
DROP POLICY IF EXISTS "Spaces viewable by workspace members" ON spaces;
CREATE POLICY "Spaces viewable by workspace members"
ON spaces FOR SELECT
USING (
  deleted_at IS NULL AND
  archived_at IS NULL AND
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = spaces.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.removed_at IS NULL
  )
);

-- Policy spaces: inserimento
DROP POLICY IF EXISTS "Spaces creatable by members" ON spaces;
CREATE POLICY "Spaces creatable by members"
ON spaces FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = spaces.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.removed_at IS NULL
  )
);

-- Policy rooms: lettura
DROP POLICY IF EXISTS "Rooms viewable by space members" ON rooms;
CREATE POLICY "Rooms viewable by space members"
ON rooms FOR SELECT
USING (
  deleted_at IS NULL AND
  EXISTS (
    SELECT 1 FROM spaces s
    JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
    WHERE s.id = rooms.space_id
    AND wm.user_id = auth.uid()
    AND wm.removed_at IS NULL
  )
);

-- ============================================
-- TRIGGER PER WORKSPACE
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (NEW.id, NEW.created_by, 'owner', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_workspace_created ON workspaces;
CREATE TRIGGER on_workspace_created
  AFTER INSERT ON workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();

-- ============================================
-- VERIFICA FINALE
-- ============================================
SELECT '✅ Schema aggiornato! Ora prova a creare un workspace.' as result;
