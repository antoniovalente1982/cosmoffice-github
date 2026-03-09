-- ==========================================
-- Migration: Dynamic Workspace Limits & Owner Registration Tokens
-- ==========================================

-- 1. Add max_workspaces to profiles (default 1 for owners)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_workspaces INTEGER DEFAULT 1;

-- 2. Owner Registration Tokens table
CREATE TABLE IF NOT EXISTS owner_registration_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    email TEXT, -- optional pre-filled email
    created_by UUID REFERENCES auth.users(id),
    max_workspaces INTEGER DEFAULT 1,
    max_capacity INTEGER DEFAULT 50, -- default max participants per workspace
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
    used_at TIMESTAMPTZ,
    used_by UUID REFERENCES auth.users(id)
);

-- RLS policies for owner_registration_tokens
ALTER TABLE owner_registration_tokens ENABLE ROW LEVEL SECURITY;

-- SuperAdmins can manage tokens
CREATE POLICY "superadmins_manage_tokens"
ON owner_registration_tokens FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
);

-- Anyone can read a specific token (to verify it during registration)
CREATE POLICY "anyone_can_read_valid_token"
ON owner_registration_tokens FOR SELECT
TO anon, authenticated
USING (used_at IS NULL AND (expires_at IS NULL OR expires_at > now()));
