-- ============================================
-- COSMOFFICE — Verifica Schema Database
-- Esegui questo nel SQL Editor di Supabase per
-- controllare che il DB sia allineato al codice
-- ============================================

-- 1. VERIFICA: Tutte le tabelle previste esistono?
SELECT '--- TABELLE ---' AS sezione;
SELECT tablename, 
  CASE WHEN tablename IN (
    'profiles', 'workspaces', 'workspace_members', 'workspace_role_permissions',
    'workspace_bans', 'workspace_audit_logs', 'workspace_invitations', 'workspace_join_requests',
    'spaces', 'space_members', 'rooms', 'room_connections', 'room_participants',
    'room_kicks', 'room_mutes', 'furniture', 'conversations', 'conversation_members',
    'messages', 'message_attachments', 'notifications', 'ai_agents', 'user_presence'
  ) THEN '✅ prevista' ELSE '⚠️ extra' END AS status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. VERIFICA: Colonne invite_type, max_uses, use_count, label su workspace_invitations
SELECT '--- COLONNE workspace_invitations ---' AS sezione;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'workspace_invitations'
ORDER BY ordinal_position;

-- 3. VERIFICA: Colonne moderazione su workspace_members
SELECT '--- COLONNE workspace_members ---' AS sezione;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'workspace_members'
ORDER BY ordinal_position;

-- 4. VERIFICA: Colonne moderazione su room_participants
SELECT '--- COLONNE room_participants ---' AS sezione;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'room_participants'
ORDER BY ordinal_position;

-- 5. VERIFICA: RLS abilitato su tutte le tabelle
SELECT '--- RLS STATUS ---' AS sezione;
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 6. VERIFICA: Funzioni SQL critiche esistono?
SELECT '--- FUNZIONI ---' AS sezione;
SELECT routine_name,
  CASE WHEN routine_name IN (
    'is_workspace_member', 'is_workspace_admin', 'is_workspace_owner',
    'can_access_space', 'is_space_admin', 'can_enter_room', 'can_enter_room_v2',
    'has_workspace_permission', 'can_moderate_user', 'is_user_banned', 'is_user_muted',
    'kick_user_from_room', 'ban_user_from_workspace', 'unban_user_from_workspace',
    'mute_user_in_room', 'unmute_user_in_room', 'change_user_role',
    'log_workspace_action', 'handle_new_user', 'handle_new_workspace',
    'get_invite_info', 'accept_invite_link', 'create_default_role_permissions',
    'update_updated_at', 'soft_delete'
  ) THEN '✅ prevista' ELSE '⚠️ extra' END AS status
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- 7. VERIFICA: Triggers attivi
SELECT '--- TRIGGERS ---' AS sezione;
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 8. VERIFICA: Realtime publications
SELECT '--- REALTIME ---' AS sezione;
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 9. VERIFICA: Enum workspace_role (ancora ha viewer?)
SELECT '--- ENUM workspace_role ---' AS sezione;
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (
  SELECT oid FROM pg_type WHERE typname = 'workspace_role'
)
ORDER BY enumsortorder;

-- 10. CHECK constraint su workspace_members.role e invitations.role
SELECT '--- CHECK CONSTRAINTS ---' AS sezione;
SELECT conname, conrelid::regclass, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid IN ('workspace_members'::regclass, 'workspace_invitations'::regclass, 'rooms'::regclass)
AND contype = 'c'
ORDER BY conrelid, conname;

SELECT '✅ Verifica completata!' AS risultato;
