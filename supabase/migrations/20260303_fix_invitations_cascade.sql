-- Fix: workspace_invitations FK missing ON DELETE CASCADE
-- The schema defines it but it wasn't applied to the actual DB

ALTER TABLE workspace_invitations
  DROP CONSTRAINT IF EXISTS workspace_invitations_workspace_id_fkey;

ALTER TABLE workspace_invitations
  ADD CONSTRAINT workspace_invitations_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
