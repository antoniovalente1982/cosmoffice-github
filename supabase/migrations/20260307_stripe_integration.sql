-- ============================================
-- STRIPE INTEGRATION MIGRATION
-- Adds Stripe references to workspaces and trial support
-- ============================================

-- Add Stripe columns to workspaces
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT DEFAULT 'none'
    CHECK (stripe_subscription_status IN ('none', 'active', 'past_due', 'canceled', 'trialing', 'incomplete')),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- Index for Stripe lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_customer ON workspaces(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_sub ON workspaces(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Add stripe_event_id to billing_events to prevent duplicate processing
ALTER TABLE billing_events
  ADD COLUMN IF NOT EXISTS stripe_event_id TEXT UNIQUE;
