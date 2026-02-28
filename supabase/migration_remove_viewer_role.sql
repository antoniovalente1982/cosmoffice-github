-- ============================================
-- MIGRATION: Rimuovi il ruolo 'viewer'
-- Guest è ora il livello più basso.
-- Il DB usa colonne TEXT con CHECK, non ENUM.
-- ============================================

-- 1. Aggiorna eventuali utenti/inviti con ruolo 'viewer' → 'guest'
UPDATE workspace_members SET role = 'guest' WHERE role = 'viewer';
UPDATE workspace_invitations SET role = 'guest' WHERE role = 'viewer';

-- 2. Aggiorna colonne rooms
UPDATE rooms SET who_can_enter = 'guest' WHERE who_can_enter = 'viewer';
UPDATE rooms SET who_can_moderate = 'guest' WHERE who_can_moderate = 'viewer';

-- 3. Aggiorna i CHECK constraint per escludere 'viewer'
ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_role_check 
  CHECK (role IN ('owner', 'admin', 'member', 'guest'));

ALTER TABLE workspace_invitations DROP CONSTRAINT IF EXISTS workspace_invitations_role_check;
ALTER TABLE workspace_invitations ADD CONSTRAINT workspace_invitations_role_check 
  CHECK (role IN ('owner', 'admin', 'member', 'guest'));

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_who_can_enter_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_who_can_enter_check 
  CHECK (who_can_enter IN ('owner', 'admin', 'member', 'guest'));

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_who_can_moderate_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_who_can_moderate_check 
  CHECK (who_can_moderate IN ('owner', 'admin', 'member', 'guest'));
