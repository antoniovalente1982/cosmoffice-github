-- ============================================================
-- Migration: Add company fields to profiles, create support_tickets table
-- ============================================================

-- 1. Add company/phone fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS vat_number TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS is_support_staff BOOLEAN DEFAULT FALSE;

-- 2. Create support_tickets table for the Assistance channel
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  workspace_id UUID REFERENCES public.workspaces(id),
  
  -- Requester info (denormalized for quick SuperAdmin view)
  requester_name TEXT,
  requester_email TEXT,
  requester_phone TEXT,
  requester_role TEXT, -- workspace role at time of submission
  requester_company TEXT,
  
  -- Ticket data
  category TEXT NOT NULL DEFAULT 'general', -- 'general', 'technical', 'billing', 'feature_request'
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
  
  -- Admin management
  assigned_to UUID REFERENCES auth.users(id),
  admin_notes TEXT,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON public.support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON public.support_tickets(created_at DESC);

-- RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can view their own tickets
CREATE POLICY "Users can view own tickets"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create tickets
CREATE POLICY "Users can create tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- SuperAdmin and support staff can view all tickets
CREATE POLICY "Admin can view all tickets"
  ON public.support_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (is_super_admin = TRUE OR is_support_staff = TRUE)
    )
  );

-- SuperAdmin and support staff can update tickets
CREATE POLICY "Admin can update tickets"
  ON public.support_tickets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (is_super_admin = TRUE OR is_support_staff = TRUE)
    )
  );

-- 3. Add phone/role to upgrade_requests (if columns don't exist)
DO $$ BEGIN
  ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS requester_phone TEXT;
  ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS requester_role TEXT;
  ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS requester_email TEXT;
  ALTER TABLE public.upgrade_requests ADD COLUMN IF NOT EXISTS requester_company TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Updated_at trigger for support_tickets
CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_tickets_updated ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_support_ticket_timestamp();
