-- ============================================
-- ADMIN TRANSFER — Tabella per tracciare i trasferimenti superadmin
-- ============================================

-- Audit log di tutti i trasferimenti di ruolo superadmin
CREATE TABLE IF NOT EXISTS admin_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID NOT NULL REFERENCES profiles(id),
  to_user_id UUID NOT NULL REFERENCES profiles(id),
  transfer_type TEXT NOT NULL DEFAULT 'transfer'
    CHECK (transfer_type IN ('transfer', 'grant', 'revoke')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_transfers_created ON admin_transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_transfers_from ON admin_transfers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_transfers_to ON admin_transfers(to_user_id);

-- RLS: solo super admin può leggere il log trasferimenti
ALTER TABLE admin_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage admin_transfers" ON admin_transfers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );
