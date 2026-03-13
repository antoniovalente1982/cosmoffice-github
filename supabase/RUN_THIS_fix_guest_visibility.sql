-- ============================================
-- FIX: GUEST VISIBILITY FOR ALL WORKSPACE MEMBERS
-- Eseguire nel SQL Editor di Supabase
-- Idempotente — sicuro da rieseguire
-- ============================================

-- STEP 1: Rimuovi le vecchie policy su profiles SELECT
DROP POLICY IF EXISTS "Profiles viewable by workspace members" ON profiles;
DROP POLICY IF EXISTS "Profiles viewable by all" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;

-- STEP 2: Crea policy permissiva — tutti gli utenti autenticati
-- che sono membri dello stesso workspace possono vedere i profili
CREATE POLICY "Profiles viewable by workspace members" ON profiles
  FOR SELECT TO authenticated
  USING (
    -- puoi sempre vedere il tuo profilo
    auth.uid() = profiles.id 
    OR
    -- puoi vedere i profili di chi è nello stesso workspace
    EXISTS (
      SELECT 1 FROM workspace_members wm1
      JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = profiles.id   -- il profilo target
      AND wm2.user_id = auth.uid()      -- l'utente corrente
      AND wm1.removed_at IS NULL
      AND wm2.removed_at IS NULL
    )
  );

-- STEP 3: Assicurati che la policy per gestire il proprio profilo esista
DROP POLICY IF EXISTS "Users manage own profile" ON profiles;
CREATE POLICY "Users manage own profile" ON profiles
  FOR ALL TO authenticated
  USING (auth.uid() = id);

-- STEP 4: Assicurati che workspace_members abbia la policy SELECT corretta
DROP POLICY IF EXISTS "Members viewable by workspace members" ON workspace_members;
CREATE POLICY "Members viewable by workspace members" ON workspace_members
  FOR SELECT TO authenticated
  USING (
    removed_at IS NULL AND
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.removed_at IS NULL
    )
  );

-- STEP 5: Verifica — mostra tutti i membri del workspace con profili
SELECT 
  wm.user_id,
  wm.role,
  wm.removed_at,
  p.display_name,
  p.full_name,
  p.email,
  p.status
FROM workspace_members wm
LEFT JOIN profiles p ON p.id = wm.user_id
WHERE wm.workspace_id = (SELECT id FROM workspaces LIMIT 1)
ORDER BY wm.joined_at DESC;
