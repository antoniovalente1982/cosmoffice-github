-- Add workspace info to support tickets
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS workspace_name TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS workspace_owner_email TEXT;

-- Add workspace info to bug reports
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS workspace_name TEXT;
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS workspace_owner_email TEXT;
