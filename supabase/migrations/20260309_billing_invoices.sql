-- ============================================
-- BILLING INVOICES SYSTEM
-- Recurring invoices, payment tracking, workspace billing config
-- ============================================

-- ─── Invoices Table ─────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Periodo di fatturazione
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'annual')),
  
  -- Importi (sempre in EUR cents)
  seats INTEGER NOT NULL,
  price_per_seat_cents INTEGER NOT NULL,
  subtotal_cents INTEGER NOT NULL,        -- seats × price_per_seat
  adjustment_cents INTEGER DEFAULT 0,     -- proration per upgrade
  total_cents INTEGER NOT NULL,           -- subtotal + adjustment
  
  -- Stato fattura
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded')),
  due_date DATE NOT NULL,
  
  -- Pagamento
  payment_method TEXT
    CHECK (payment_method IN ('bank_transfer', 'stripe', 'manual')),
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,       -- CRO per bonifici
  stripe_invoice_id TEXT,       -- futuro Stripe
  
  -- Metadata
  invoice_number TEXT,
  notes TEXT,
  is_upgrade BOOLEAN DEFAULT false,
  description TEXT,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_invoices_workspace ON invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at DESC);

-- ─── Workspace billing columns ──────────────────
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS next_invoice_date DATE;

-- ─── RLS ────────────────────────────────────────
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all invoices
CREATE POLICY "Super admins can manage invoices" ON invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Owners can read invoices for their workspaces
CREATE POLICY "Owners can read own invoices" ON invoices
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role = 'owner' AND removed_at IS NULL
    )
  );

-- ─── Updated_at trigger ─────────────────────────
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Invoice number sequence ────────────────────
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1001;
