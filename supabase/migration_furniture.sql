-- ============================================
-- COSMOFFICE MIGRATION: FURNITURE & ROOM ENHANCEMENTS
-- ============================================

-- Furniture items within rooms
CREATE TABLE IF NOT EXISTS furniture (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT,
  x INTEGER DEFAULT 0,
  y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 40,
  height INTEGER DEFAULT 40,
  rotation INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE furniture ENABLE ROW LEVEL SECURITY;

-- Add department field to rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS department TEXT;
-- Add color/theme to rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#1e293b';

-- RLS policies for furniture
CREATE POLICY "Furniture viewable by space members" ON furniture
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rooms r
      JOIN spaces s ON s.id = r.space_id
      WHERE r.id = furniture.room_id
      AND public.is_org_member(s.org_id)
    )
  );

CREATE POLICY "Admins can manage furniture" ON furniture
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = furniture.room_id
      AND public.is_space_admin(r.space_id)
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_furniture_room ON furniture(room_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE furniture;
