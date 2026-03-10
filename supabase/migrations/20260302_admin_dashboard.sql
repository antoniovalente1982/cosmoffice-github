-- ============================================
-- ADMIN DASHBOARD — Tabelle per SaaS management
-- Bug reports, billing events, platform metrics, login events
-- ============================================

-- Super admin flag su profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- ─── Bug Reports ────────────────────────────────
CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'wont_fix')),
  category TEXT DEFAULT 'bug'
    CHECK (category IN ('bug', 'feature', 'performance', 'security', 'other', 'general', 'ui', 'audio_video', 'chat')),
  screenshot_url TEXT,
  browser_info JSONB DEFAULT '{}',
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_severity ON bug_reports(severity);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created ON bug_reports(created_at DESC);

-- ─── Billing Events ────────────────────────────
CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('plan_upgrade', 'plan_downgrade', 'payment', 'refund', 'trial_start', 'trial_end', 'cancellation')),
  plan_from TEXT,
  plan_to TEXT,
  amount_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_workspace ON billing_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_created ON billing_events(created_at DESC);

-- ─── Platform Metrics (daily snapshots) ─────────
CREATE TABLE IF NOT EXISTS platform_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_date DATE NOT NULL UNIQUE,
  total_users INTEGER DEFAULT 0,
  active_users_24h INTEGER DEFAULT 0,
  new_users_today INTEGER DEFAULT 0,
  total_workspaces INTEGER DEFAULT 0,
  active_workspaces_24h INTEGER DEFAULT 0,
  total_rooms INTEGER DEFAULT 0,
  total_messages_today INTEGER DEFAULT 0,
  daily_api_calls INTEGER DEFAULT 0,
  mrr_cents INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Login Events (security) ────────────────────
CREATE TABLE IF NOT EXISTS login_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT,
  event_type TEXT NOT NULL DEFAULT 'login'
    CHECK (event_type IN ('login', 'logout', 'failed_login', 'password_reset', 'signup')),
  ip_address TEXT,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  success BOOLEAN DEFAULT true,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_events_user ON login_events(user_id);
CREATE INDEX IF NOT EXISTS idx_login_events_created ON login_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_events_type ON login_events(event_type);

-- ─── RLS Policies ───────────────────────────────
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_events ENABLE ROW LEVEL SECURITY;

-- Super admin can read everything
CREATE POLICY "Super admins can read bug_reports" ON bug_reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Users can create their own bug reports
CREATE POLICY "Users can create bug_reports" ON bug_reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- Users can read their own bug reports
CREATE POLICY "Users can read own bug_reports" ON bug_reports
  FOR SELECT USING (reporter_id = auth.uid());

CREATE POLICY "Super admins can manage billing_events" ON billing_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Super admins can manage platform_metrics" ON platform_metrics
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Super admins can read login_events" ON login_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Allow inserting login events from auth hooks
CREATE POLICY "Service role can insert login_events" ON login_events
  FOR INSERT WITH CHECK (true);

-- ─── Updated_at trigger ─────────────────────────
CREATE TRIGGER bug_reports_updated_at
  BEFORE UPDATE ON bug_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
