-- Add max_workspaces column to profiles (default 1 workspace per owner)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_workspaces INTEGER DEFAULT 1;
