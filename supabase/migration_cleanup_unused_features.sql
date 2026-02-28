-- ===================================================================
-- CLEANUP: Remove Chat, AI Agents, Analytics, and Badges/Gamification
-- Run this ONCE in Supabase SQL Editor to drop unused tables & policies.
-- ===================================================================

-- ─── Drop Chat tables ────────────────────────────────────────────
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS space_messages CASCADE;

-- ─── Drop AI Agents tables ───────────────────────────────────────
DROP TABLE IF EXISTS ai_agents CASCADE;
DROP TABLE IF EXISTS ai_agent_conversations CASCADE;
DROP TABLE IF EXISTS ai_agent_messages CASCADE;

-- ─── Drop Gamification / Badges tables ───────────────────────────
DROP TABLE IF EXISTS badges CASCADE;
DROP TABLE IF EXISTS user_badges CASCADE;
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS user_achievements CASCADE;

-- ─── Drop Analytics tables ───────────────────────────────────────
DROP TABLE IF EXISTS analytics_events CASCADE;
DROP TABLE IF EXISTS user_activity_logs CASCADE;

-- ─── Done ────────────────────────────────────────────────────────
-- After running this, verify with:
--   SELECT tablename FROM pg_tables WHERE schemaname = 'public'
--     ORDER BY tablename;
