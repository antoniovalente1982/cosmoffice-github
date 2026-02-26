-- ============================================
-- MIGRAZIONE: Fix RLS policies per rooms
-- Aggiunge policy DELETE e UPDATE mancanti
-- ============================================

-- Policy DELETE: solo gli admin dello space possono cancellare stanze
CREATE POLICY "Admins can delete rooms"
  ON rooms FOR DELETE USING (
    public.is_space_admin(space_id)
  );

-- Policy UPDATE: solo gli admin dello space possono modificare stanze
CREATE POLICY "Admins can update rooms"
  ON rooms FOR UPDATE USING (
    public.is_space_admin(space_id)
  );
