// ============================================
// EDGE FUNCTION: cleanup-presence
// Rimuove utenti inattivi e gestisce heartbeat
// Chiamata: ogni minuto da cron job o su heartbeat
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceRoleClient, getUserClient } from '../_shared/supabase.ts';
import { success, error } from '../_shared/errors.ts';

interface HeartbeatRequest {
  workspace_id: string;
  space_id?: string;
  room_id?: string;
  status?: 'online' | 'away' | 'busy' | 'in_call';
  status_message?: string;
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const userClient = getUserClient(req);
    if (!userClient) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = getServiceRoleClient();
    const body: HeartbeatRequest = await req.json();

    // Update presence
    const { error: upsertError } = await supabase
      .from('user_presence')
      .upsert({
        user_id: user.id,
        workspace_id: body.workspace_id,
        space_id: body.space_id || null,
        room_id: body.room_id || null,
        status: body.status || 'online',
        status_message: body.status_message || null,
        last_seen_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (upsertError) throw upsertError;

    // Update last_active in workspace_members
    await supabase
      .from('workspace_members')
      .update({ last_active_at: new Date().toISOString() })
      .eq('workspace_id', body.workspace_id)
      .eq('user_id', user.id);

    // Cleanup inactive users (chi non ha fatto heartbeat da 5 minuti)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60000).toISOString();
    
    const { data: inactiveUsers } = await supabase
      .from('user_presence')
      .select('user_id, room_id')
      .lt('last_seen_at', fiveMinutesAgo);

    if (inactiveUsers && inactiveUsers.length > 0) {
      // Rimuovi dai room_participants
      for (const inactive of inactiveUsers) {
        if (inactive.room_id) {
          await supabase
            .from('room_participants')
            .delete()
            .eq('user_id', inactive.user_id)
            .eq('room_id', inactive.room_id);
        }
      }

      // Rimuovi presence
      await supabase
        .from('user_presence')
        .delete()
        .lt('last_seen_at', fiveMinutesAgo);
    }

    return success({
      heartbeat_received: true,
      cleaned_inactive: inactiveUsers?.length || 0,
    });

  } catch (err) {
    return error(err as Error);
  }
});
