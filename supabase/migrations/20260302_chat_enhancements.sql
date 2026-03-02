-- ============================================
-- Migration: Chat Enhancements
-- 1. Allow room_id NULL for global office messages
-- 2. Add index for global messages
-- 3. Add RLS DELETE policy (owner/admin only)
-- ============================================

-- Allow room_id to be nullable (for office-wide global messages)
ALTER TABLE messages ALTER COLUMN room_id DROP NOT NULL;

-- Index for global messages (room_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_messages_office_global
    ON messages(workspace_id, created_at DESC)
    WHERE room_id IS NULL;

-- RLS DELETE policy: only workspace owner/admin can delete messages
CREATE POLICY "admins_delete" ON messages FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = messages.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('owner', 'admin')
              AND wm.removed_at IS NULL
        )
    );
