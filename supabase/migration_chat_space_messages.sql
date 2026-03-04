-- ============================================
-- MIGRAZIONE: Chat Space Messages
-- Aggiunge tabella per messaggi di chat persistenti per ogni space
-- ============================================

-- Tabella messaggi chat per space
CREATE TABLE IF NOT EXISTS space_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_avatar_url TEXT,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'file', 'system')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilita RLS
ALTER TABLE space_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Tutti possono vedere i messaggi dello space
CREATE POLICY "Messages viewable by space members"
  ON space_chat_messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM spaces s
      JOIN organization_members om ON om.org_id = s.org_id
      WHERE s.id = space_id AND om.user_id = auth.uid()
    )
  );

-- Policy: Tutti possono inviare messaggi
CREATE POLICY "Users can send messages to spaces"
  ON space_chat_messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM spaces s
      JOIN organization_members om ON om.org_id = s.org_id
      WHERE s.id = space_id AND om.user_id = auth.uid()
    )
  );

-- Policy: Solo admin/owner possono cancellare messaggi
CREATE POLICY "Only admins can delete messages"
  ON space_chat_messages FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM spaces s
      JOIN organizations o ON o.id = s.org_id
      WHERE s.id = space_id 
      AND (
        o.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM organization_members om
          WHERE om.org_id = s.org_id 
          AND om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin')
        )
      )
    )
  );

-- Policy: Utenti possono cancellare solo i propri messaggi (opzionale, togliere se non si vuole)
-- CREATE POLICY "Users can delete own messages"
--   ON space_chat_messages FOR DELETE USING (auth.uid() = sender_id);

-- Aggiungi a realtime
ALTER PUBLICATION supabase_realtime ADD TABLE space_chat_messages;

-- Indici per performance
CREATE INDEX idx_space_chat_messages_space ON space_chat_messages(space_id);
CREATE INDEX idx_space_chat_messages_created ON space_chat_messages(created_at);

-- Funzione helper per verificare se utente è admin di uno space
CREATE OR REPLACE FUNCTION public.is_space_message_admin(check_space_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM spaces s
    JOIN organizations o ON o.id = s.org_id
    WHERE s.id = check_space_id 
    AND (
      o.created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.org_id = s.org_id 
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
