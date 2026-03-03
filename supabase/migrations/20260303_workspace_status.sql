-- ============================================
-- WORKSPACE & PROFILE STATUS — Suspension support
-- ============================================

-- Workspace-level suspension
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES profiles(id);

-- Profile-level suspension (owner suspension)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES profiles(id);
