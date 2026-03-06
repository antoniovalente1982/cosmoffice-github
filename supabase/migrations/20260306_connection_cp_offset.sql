-- Add control point offsets for draggable curve connections
ALTER TABLE public.room_connections 
ADD COLUMN IF NOT EXISTS cp_offset_x REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cp_offset_y REAL DEFAULT 0;
