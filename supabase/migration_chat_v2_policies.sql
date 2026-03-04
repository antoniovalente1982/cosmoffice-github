-- ============================================
-- MIGRATION: Chat v2 — Schema Upgrade + RLS Policies + Agent Support
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 0: Upgrade conversations table from v1 to v2
-- Add missing columns that don't exist in the old schema
-- ============================================

-- Add workspace_id (CRITICAL: required for all RLS policies)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add other v2 columns
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_a_id UUID REFERENCES profiles(id);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_b_id UUID REFERENCES profiles(id);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- Backfill workspace_id for existing conversations via rooms → spaces → workspaces
UPDATE conversations c
SET workspace_id = s.workspace_id
FROM rooms r
JOIN spaces s ON s.id = r.space_id
WHERE c.room_id = r.id
AND c.workspace_id IS NULL;

-- Create index on workspace_id
CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_room ON conversations(room_id) WHERE type = 'room';

-- ============================================
-- STEP 1: Upgrade messages table from v1 to v2
-- Add missing columns
-- ============================================

ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_avatar_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS formatted_content JSONB;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_by UUID REFERENCES profiles(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES profiles(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_parent_id UUID REFERENCES messages(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_name TEXT;

-- Rename reply_to to reply_to_id if needed (v1 had reply_to, v2 has reply_to_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'reply_to')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'reply_to_id')
  THEN
    ALTER TABLE messages RENAME COLUMN reply_to TO reply_to_id;
  END IF;
END $$;

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_agent ON messages(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_parent_id) WHERE thread_parent_id IS NOT NULL;

-- ============================================
-- STEP 2: Create message_attachments table if not exists
-- ============================================

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
-- STEP 3: Create conversation_members table if not exists
-- ============================================

CREATE TABLE IF NOT EXISTS conversation_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  notification_settings JSONB DEFAULT '{"mute": false, "mentions_only": false}',
  UNIQUE(conversation_id, user_id)
);

-- ============================================
-- STEP 4: RLS Policies for CONVERSATIONS
-- ============================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select_workspace_members" ON conversations;
CREATE POLICY "conversations_select_workspace_members" ON conversations
  FOR SELECT USING (
    workspace_id IS NULL OR  -- allow legacy conversations without workspace_id
    public.is_workspace_member(workspace_id)
  );

DROP POLICY IF EXISTS "conversations_insert_workspace_members" ON conversations;
CREATE POLICY "conversations_insert_workspace_members" ON conversations
  FOR INSERT WITH CHECK (
    workspace_id IS NULL OR (
      public.is_workspace_member(workspace_id) AND
      (created_by = auth.uid() OR created_by IS NULL)
    )
  );

DROP POLICY IF EXISTS "conversations_update_admin" ON conversations;
CREATE POLICY "conversations_update_admin" ON conversations
  FOR UPDATE USING (
    workspace_id IS NULL OR
    public.is_workspace_admin(workspace_id)
  );

DROP POLICY IF EXISTS "conversations_delete_admin" ON conversations;
CREATE POLICY "conversations_delete_admin" ON conversations
  FOR DELETE USING (
    workspace_id IS NULL OR
    public.is_workspace_admin(workspace_id)
  );

-- ============================================
-- STEP 5: RLS Policies for MESSAGES
-- ============================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop any old conflicting policies
DROP POLICY IF EXISTS "Messages viewable by conversation participants" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can edit own messages" ON messages;
DROP POLICY IF EXISTS "Users can soft delete own messages" ON messages;

DROP POLICY IF EXISTS "messages_select_workspace_members" ON messages;
CREATE POLICY "messages_select_workspace_members" ON messages
  FOR SELECT USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.workspace_id IS NULL OR public.is_workspace_member(c.workspace_id))
    )
  );

DROP POLICY IF EXISTS "messages_insert_workspace_members" ON messages;
CREATE POLICY "messages_insert_workspace_members" ON messages
  FOR INSERT WITH CHECK (
    (auth.uid() = sender_id OR sender_id IS NULL) AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.workspace_id IS NULL OR public.is_workspace_member(c.workspace_id))
    )
  );

-- Users can edit/soft-delete their own messages
DROP POLICY IF EXISTS "messages_update_own" ON messages;
CREATE POLICY "messages_update_own" ON messages
  FOR UPDATE USING (
    auth.uid() = sender_id
  );

-- Workspace admins can soft-delete any message
DROP POLICY IF EXISTS "messages_update_admin" ON messages;
CREATE POLICY "messages_update_admin" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND c.workspace_id IS NOT NULL
      AND public.is_workspace_admin(c.workspace_id)
    )
  );

-- ============================================
-- STEP 6: RLS Policies for MESSAGE_ATTACHMENTS
-- ============================================

ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attachments_select_workspace_members" ON message_attachments;
CREATE POLICY "attachments_select_workspace_members" ON message_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = message_attachments.message_id
      AND (c.workspace_id IS NULL OR public.is_workspace_member(c.workspace_id))
    )
  );

DROP POLICY IF EXISTS "attachments_insert_workspace_members" ON message_attachments;
CREATE POLICY "attachments_insert_workspace_members" ON message_attachments
  FOR INSERT WITH CHECK (
    auth.uid() = uploaded_by AND
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = message_attachments.message_id
      AND (c.workspace_id IS NULL OR public.is_workspace_member(c.workspace_id))
    )
  );

-- ============================================
-- STEP 7: RLS Policies for CONVERSATION_MEMBERS
-- ============================================

ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_members_select" ON conversation_members;
CREATE POLICY "conv_members_select" ON conversation_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_members.conversation_id
      AND (c.workspace_id IS NULL OR public.is_workspace_member(c.workspace_id))
    )
  );

DROP POLICY IF EXISTS "conv_members_insert" ON conversation_members;
CREATE POLICY "conv_members_insert" ON conversation_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_members.conversation_id
      AND c.workspace_id IS NOT NULL
      AND public.is_workspace_admin(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS "conv_members_delete" ON conversation_members;
CREATE POLICY "conv_members_delete" ON conversation_members
  FOR DELETE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_members.conversation_id
      AND c.workspace_id IS NOT NULL
      AND public.is_workspace_admin(c.workspace_id)
    )
  );

-- ============================================
-- STEP 8: Ensure Realtime is enabled
-- ============================================

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
