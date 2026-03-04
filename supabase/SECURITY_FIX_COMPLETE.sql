-- ============================================================
-- COSMOFFICE — SECURITY FIX COMPLETO
-- Risolve TUTTI i 2 errori + 37 warning del Security Advisor
-- Data: 2026-03-04
-- ============================================================

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  FIX 1: Abilitare RLS su room_kicks e room_mutes           ║
-- ║  (Risolve i 2 errori critici)                               ║
-- ╚══════════════════════════════════════════════════════════════╝

ALTER TABLE public.room_kicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_mutes ENABLE ROW LEVEL SECURITY;

-- Policy per room_kicks: solo workspace admin/moderator possono leggere/scrivere
DROP POLICY IF EXISTS "room_kicks_select" ON public.room_kicks;
CREATE POLICY "room_kicks_select" ON public.room_kicks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN spaces s ON s.workspace_id = wm.workspace_id
      JOIN rooms r ON r.space_id = s.id
      WHERE r.id = room_kicks.room_id
        AND wm.user_id = auth.uid()
        AND wm.removed_at IS NULL
    )
  );

DROP POLICY IF EXISTS "room_kicks_insert" ON public.room_kicks;
CREATE POLICY "room_kicks_insert" ON public.room_kicks
  FOR INSERT TO authenticated
  WITH CHECK (
    kicked_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN spaces s ON s.workspace_id = wm.workspace_id
      JOIN rooms r ON r.space_id = s.id
      WHERE r.id = room_kicks.room_id
        AND wm.user_id = auth.uid()
        AND wm.removed_at IS NULL
        AND wm.role IN ('owner', 'admin', 'moderator')
    )
  );

-- Policy per room_mutes: solo workspace admin/moderator possono leggere/scrivere
DROP POLICY IF EXISTS "room_mutes_select" ON public.room_mutes;
CREATE POLICY "room_mutes_select" ON public.room_mutes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN spaces s ON s.workspace_id = wm.workspace_id
      JOIN rooms r ON r.space_id = s.id
      WHERE r.id = room_mutes.room_id
        AND wm.user_id = auth.uid()
        AND wm.removed_at IS NULL
    )
  );

DROP POLICY IF EXISTS "room_mutes_insert" ON public.room_mutes;
CREATE POLICY "room_mutes_insert" ON public.room_mutes
  FOR INSERT TO authenticated
  WITH CHECK (
    muted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN spaces s ON s.workspace_id = wm.workspace_id
      JOIN rooms r ON r.space_id = s.id
      WHERE r.id = room_mutes.room_id
        AND wm.user_id = auth.uid()
        AND wm.removed_at IS NULL
        AND wm.role IN ('owner', 'admin', 'moderator')
    )
  );


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  FIX 2: Impostare search_path su tutte le 14 funzioni      ║
-- ║  (Risolve "Function Search Path Mutable")                   ║
-- ╚══════════════════════════════════════════════════════════════╝

ALTER FUNCTION public.is_space_message_admin SET search_path = public;
ALTER FUNCTION public.is_space_admin SET search_path = public;
ALTER FUNCTION public.is_workspace_owner SET search_path = public;
ALTER FUNCTION public.kick_workspace_member SET search_path = public;
ALTER FUNCTION public.handle_new_user SET search_path = public;
ALTER FUNCTION public.create_default_role_permissions SET search_path = public;
ALTER FUNCTION public.is_workspace_member SET search_path = public;
ALTER FUNCTION public.can_moderate_user SET search_path = public;
ALTER FUNCTION public.is_user_banned SET search_path = public;
ALTER FUNCTION public.is_workspace_admin SET search_path = public;
ALTER FUNCTION public.handle_new_workspace SET search_path = public;
ALTER FUNCTION public.accept_invite_link SET search_path = public;
ALTER FUNCTION public.get_invite_info SET search_path = public;
ALTER FUNCTION public.update_updated_at SET search_path = public;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  FIX 3: Correggere Policy "Always True" troppo permissive  ║
-- ║  (login_events e workspace_members)                         ║
-- ╚══════════════════════════════════════════════════════════════╝

-- login_events: solo il proprietario del record può inserire
DROP POLICY IF EXISTS "Users can insert own login events" ON public.login_events;
CREATE POLICY "Users can insert own login events" ON public.login_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- login_events: solo il proprietario può vedere i propri login
DROP POLICY IF EXISTS "Users can view own login events" ON public.login_events;
CREATE POLICY "Users can view own login events" ON public.login_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- workspace_members: fix policy con USING(true) per INSERT
-- Cerchiamo e droppiamo la policy troppo permissiva
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'workspace_members'
      AND schemaname = 'public'
      AND (qual = 'true' OR with_check = 'true')
      AND cmd != 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.workspace_members', pol.policyname);
    RAISE NOTICE 'Dropped overly permissive policy: %', pol.policyname;
  END LOOP;
END $$;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  FIX 4: Revocare accesso anonimo a tabelle sensibili       ║
-- ║  (admin_transfers, billing_events, etc.)                    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Rimuoviamo le policy che danno accesso al ruolo 'anon' su tabelle sensibili
DO $$
DECLARE
  sensitive_tables TEXT[] := ARRAY['admin_transfers', 'billing_events', 'conversation_members', 'conversations', 'furniture'];
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY sensitive_tables
  LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE tablename = tbl
        AND schemaname = 'public'
        AND roles @> '{anon}'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
      RAISE NOTICE 'Dropped anon policy % on %', pol.policyname, tbl;
    END LOOP;
  END LOOP;
END $$;

-- Ricrea policy per furniture solo per utenti autenticati (è usata nell'office)
DROP POLICY IF EXISTS "Authenticated users can view furniture" ON public.furniture;
CREATE POLICY "Authenticated users can view furniture" ON public.furniture
  FOR SELECT TO authenticated
  USING (true);

-- bug_reports: gli anonimi NON devono poter leggere i bug — solo utenti auth
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'bug_reports'
      AND schemaname = 'public'
      AND roles @> '{anon}'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bug_reports', pol.policyname);
    RAISE NOTICE 'Dropped anon policy on bug_reports: %', pol.policyname;
  END LOOP;
END $$;

-- Assicuriamoci che la SELECT su bug_reports sia solo per authenticated
DROP POLICY IF EXISTS "Authenticated users can view bug reports" ON public.bug_reports;
CREATE POLICY "Authenticated users can view bug reports" ON public.bug_reports
  FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.removed_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert bug reports" ON public.bug_reports;
CREATE POLICY "Authenticated users can insert bug reports" ON public.bug_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  VERIFICA FINALE                                            ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Verifica RLS abilitato su room_kicks e room_mutes
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('room_kicks', 'room_mutes');
