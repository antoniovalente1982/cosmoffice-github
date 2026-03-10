-- ============================================================
-- Migration: Add DELETE policy for support tickets + category upgrade
-- ============================================================

-- Allow users to delete their own tickets
CREATE POLICY IF NOT EXISTS "Users can delete own tickets"
  ON public.support_tickets FOR DELETE
  USING (auth.uid() = user_id);
