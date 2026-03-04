-- ============================================
-- MIGRAZIONE: Fix Chat Realtime + Policy
-- ============================================

-- Abilita REPLICA IDENTITY FULL su space_chat_messages
-- Necessario per ricevere tutti i campi (incluso space_id) negli eventi DELETE
-- di Supabase Realtime, permettendo filtri e sincronizzazione precisa.
ALTER TABLE space_chat_messages REPLICA IDENTITY FULL;

-- Aggiungi policy per permettere agli utenti di cancellare i propri messaggi
-- (opzionale - decommentare se si vuole che i membri possano cancellare i propri messaggi)
-- CREATE POLICY "Users can delete own messages"
--   ON space_chat_messages FOR DELETE USING (auth.uid() = sender_id);
