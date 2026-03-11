-- Presence Events Table — stores spatial analytics data
-- Run this migration on your Supabase project

CREATE TABLE IF NOT EXISTS public.presence_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    room_id uuid,
    x integer DEFAULT 0,
    y integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_presence_events_workspace_created
    ON public.presence_events (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_presence_events_user
    ON public.presence_events (user_id, created_at DESC);

-- RLS: Allow service role to insert (API route uses service key)
ALTER TABLE public.presence_events ENABLE ROW LEVEL SECURITY;

-- Policy: service role can do everything (analytics API uses service key)
CREATE POLICY "Service role full access" ON public.presence_events
    FOR ALL USING (true) WITH CHECK (true);

-- Auto-cleanup: delete events older than 30 days (run via pg_cron or scheduled function)
-- If pg_cron is available:
-- SELECT cron.schedule('cleanup-presence-events', '0 4 * * *', 'DELETE FROM public.presence_events WHERE created_at < NOW() - INTERVAL ''30 days''');
