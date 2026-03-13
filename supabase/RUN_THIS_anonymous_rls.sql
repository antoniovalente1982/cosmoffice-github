-- ============================================
-- RLS & SICUREZZA PER UTENTI ANONIMI (GUEST)
-- Eseguire nel SQL Editor di Supabase
-- Idempotente — sicuro da rieseguire
-- ============================================

-- ═══════════════════════════════════════════════
-- 1. POLITICHE RESTRITTIVE per utenti anonimi
--    Impediscono agli anonimi azioni privilegiate
-- ═══════════════════════════════════════════════

-- Utenti anonimi NON possono creare workspace
DROP POLICY IF EXISTS "anon_cannot_create_workspaces" ON workspaces;
CREATE POLICY "anon_cannot_create_workspaces" ON workspaces AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK ((select (auth.jwt()->>'is_anonymous')::boolean) IS NOT TRUE);

-- Utenti anonimi NON possono modificare workspace
DROP POLICY IF EXISTS "anon_cannot_update_workspaces" ON workspaces;
CREATE POLICY "anon_cannot_update_workspaces" ON workspaces AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING ((select (auth.jwt()->>'is_anonymous')::boolean) IS NOT TRUE);

-- Utenti anonimi NON possono eliminare workspace
DROP POLICY IF EXISTS "anon_cannot_delete_workspaces" ON workspaces;
CREATE POLICY "anon_cannot_delete_workspaces" ON workspaces AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING ((select (auth.jwt()->>'is_anonymous')::boolean) IS NOT TRUE);

-- Utenti anonimi NON possono creare spazi
DROP POLICY IF EXISTS "anon_cannot_create_spaces" ON spaces;
CREATE POLICY "anon_cannot_create_spaces" ON spaces AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK ((select (auth.jwt()->>'is_anonymous')::boolean) IS NOT TRUE);

-- Utenti anonimi NON possono eliminare spazi
DROP POLICY IF EXISTS "anon_cannot_delete_spaces" ON spaces;
CREATE POLICY "anon_cannot_delete_spaces" ON spaces AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING ((select (auth.jwt()->>'is_anonymous')::boolean) IS NOT TRUE);

-- Utenti anonimi NON possono creare inviti
DROP POLICY IF EXISTS "anon_cannot_create_invitations" ON workspace_invitations;
CREATE POLICY "anon_cannot_create_invitations" ON workspace_invitations AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK ((select (auth.jwt()->>'is_anonymous')::boolean) IS NOT TRUE);

-- Utenti anonimi NON possono modificare stanze (solo admin+)
DROP POLICY IF EXISTS "anon_cannot_modify_rooms" ON rooms;
CREATE POLICY "anon_cannot_modify_rooms" ON rooms AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK ((select (auth.jwt()->>'is_anonymous')::boolean) IS NOT TRUE);

DROP POLICY IF EXISTS "anon_cannot_update_rooms" ON rooms;
CREATE POLICY "anon_cannot_update_rooms" ON rooms AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING ((select (auth.jwt()->>'is_anonymous')::boolean) IS NOT TRUE);

DROP POLICY IF EXISTS "anon_cannot_delete_rooms" ON rooms;
CREATE POLICY "anon_cannot_delete_rooms" ON rooms AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING ((select (auth.jwt()->>'is_anonymous')::boolean) IS NOT TRUE);

-- ═══════════════════════════════════════════════
-- 2. Gli anonimi POSSONO: leggere spazi, stanze,
--    membri (per vedere l'ufficio), e aggiornare
--    il proprio profilo (display_name)
-- ═══════════════════════════════════════════════
-- (queste policy dovrebbero già esistere come permissive)

-- ═══════════════════════════════════════════════
-- 3. PULIZIA AUTOMATICA — eseguire periodicamente
--    Elimina utenti anonimi creati più di 30 giorni fa
-- ═══════════════════════════════════════════════
-- DA ESEGUIRE MANUALMENTE O VIA CRON:
-- DELETE FROM auth.users
-- WHERE is_anonymous IS TRUE
--   AND created_at < NOW() - INTERVAL '30 days';
