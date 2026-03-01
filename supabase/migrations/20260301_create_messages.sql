-- ============================================
-- Migration: Room Chat Messages
-- Table for persisting room-scoped chat messages
-- ============================================

CREATE TABLE messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
    user_id uuid REFERENCES profiles(id),
    content text NOT NULL,
    type text DEFAULT 'text',
    created_at timestamptz DEFAULT now()
);

-- Performance index: fast lookups by workspace + room + time
CREATE INDEX idx_messages_room
    ON messages(workspace_id, room_id, created_at DESC);

-- Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Members can read messages from their workspace
CREATE POLICY "members_select" ON messages FOR SELECT
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
    ));

-- Members can insert messages in their workspace
CREATE POLICY "members_insert" ON messages FOR INSERT
    WITH CHECK (workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
    ));
