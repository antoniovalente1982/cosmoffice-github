-- Migration: Enhanced AI Agents (V2)
-- Adds fields for provider, model, type, room assignment, and status

ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'openai';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'gpt-4';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'assistant'
  CHECK (type IN ('assistant', 'reviewer', 'sdr', 'support', 'custom'));
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS current_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'idle'
  CHECK (status IN ('idle', 'working', 'responding', 'offline'));
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Index for fast room-based agent lookups
CREATE INDEX IF NOT EXISTS idx_ai_agents_current_room ON ai_agents(current_room_id) WHERE current_room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_agents_org_active ON ai_agents(org_id) WHERE is_active = true;
