-- Migration: Dynamic Seat System + Upgrade Requests
-- Adds price_per_seat to workspaces and creates upgrade_requests table

-- 1. Add price_per_seat column to workspaces (cents per seat per month)
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS price_per_seat INTEGER DEFAULT 0;

-- 2. Create upgrade_requests table
CREATE TABLE IF NOT EXISTS upgrade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('seats', 'workspace')),
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE upgrade_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own requests
CREATE POLICY "Users can create upgrade requests" ON upgrade_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own requests
CREATE POLICY "Users can read own upgrade requests" ON upgrade_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Super admins can read/update all (via service role, bypasses RLS)
