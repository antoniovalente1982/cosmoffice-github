import { createBrowserClient } from '@supabase/ssr'

let instance: ReturnType<typeof createBrowserClient> | null = null

/**
 * Singleton Supabase browser client.
 * Returns the same instance every time — avoids multiple WebSocket connections.
 */
export function createClient() {
    if (!instance) {
        instance = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
    }
    return instance
}
