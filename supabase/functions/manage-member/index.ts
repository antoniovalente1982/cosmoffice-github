// ============================================
// EDGE FUNCTION: manage-member
// Operazioni atomiche di moderazione con audit trail
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceRoleClient, getUserClient } from '../_shared/supabase.ts';
import { AppError, Errors, success, error } from '../_shared/errors.ts';

interface RequestBody {
  action: 'ban' | 'unban' | 'kick' | 'mute' | 'unmute' | 'change_role' | 'remove';
  workspace_id: string;
  target_user_id: string;
  room_id?: string;
  reason?: string;
  duration_minutes?: number;
  mute_type?: 'chat' | 'audio' | 'video' | 'all';
  new_role?: 'owner' | 'admin' | 'member' | 'guest';
}

serve(async (req) => {
  // Handle CORS
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Get authenticated user
    const userClient = getUserClient(req);
    if (!userClient) throw Errors.UNAUTHORIZED;

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw Errors.UNAUTHORIZED;

    const adminId = user.id;

    // Parse request
    const body: RequestBody = await req.json();
    const {
      action,
      workspace_id,
      target_user_id,
      room_id,
      reason,
      duration_minutes,
      mute_type = 'chat',
      new_role
    } = body;

    if (!action || !workspace_id || !target_user_id) {
      throw new AppError('Parametri mancanti', 'MISSING_PARAMS');
    }

    // Prevent self-actions (except leave)
    if (adminId === target_user_id && action !== 'remove') {
      throw new AppError('Non puoi eseguire questa azione su te stesso', 'SELF_ACTION');
    }

    // Use service role for admin operations
    const supabase = getServiceRoleClient();

    // Get admin's role and permissions
    const { data: adminMember } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', adminId)
      .is('removed_at', null)
      .single();

    if (!adminMember) throw Errors.FORBIDDEN;

    // Get target's role
    const { data: targetMember } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', target_user_id)
      .is('removed_at', null)
      .single();

    const adminRoleValue = { owner: 3, admin: 2, member: 1, guest: 0 }[adminMember.role] || 0;
    const targetRoleValue = targetMember
      ? { owner: 3, admin: 2, member: 1, guest: 0 }[targetMember.role] || 0
      : -1;

    // Check hierarchy - can't moderate equals or higher
    if (targetRoleValue >= adminRoleValue && adminMember.role !== 'owner') {
      throw Errors.CANNOT_MODERATE;
    }

    // Execute action
    let result: any;

    switch (action) {
      case 'ban': {
        // Check permission
        if (adminRoleValue < 3) throw Errors.FORBIDDEN; // Need admin+

        // Remove from all rooms first
        await supabase
          .from('room_participants')
          .delete()
          .eq('user_id', target_user_id)
          .in('room_id',
            supabase.from('rooms').select('id').in('space_id',
              supabase.from('spaces').select('id').eq('workspace_id', workspace_id)
            )
          );

        // Mark as removed from workspace
        await supabase
          .from('workspace_members')
          .update({
            removed_at: new Date().toISOString(),
            removed_by: adminId,
            remove_reason: `BANNED: ${reason || 'Violazione regole'}`,
          })
          .eq('workspace_id', workspace_id)
          .eq('user_id', target_user_id);

        // Create ban record
        const expiresAt = duration_minutes
          ? new Date(Date.now() + duration_minutes * 60000).toISOString()
          : null;

        const { data: ban } = await supabase
          .from('workspace_bans')
          .insert({
            workspace_id,
            user_id: target_user_id,
            banned_by: adminId,
            reason,
            expires_at: expiresAt,
          })
          .select()
          .single();

        // Send notification
        await supabase.from('notifications').insert({
          user_id: target_user_id,
          type: 'ban',
          title: 'Sei stato bannato',
          body: reason || 'Sei stato bannato dal workspace',
          entity_type: 'workspace',
          entity_id: workspace_id,
        });

        // Audit log
        await supabase.rpc('log_workspace_action', {
          p_workspace_id: workspace_id,
          p_user_id: adminId,
          p_action: 'user.banned',
          p_entity_type: 'member',
          p_entity_id: target_user_id,
          p_metadata: { reason, expires_at: expiresAt },
        });

        result = { ban };
        break;
      }

      case 'unban': {
        if (adminRoleValue < 3) throw Errors.FORBIDDEN;

        await supabase
          .from('workspace_bans')
          .update({
            revoked_at: new Date().toISOString(),
            revoked_by: adminId,
            revoke_reason: reason,
          })
          .eq('workspace_id', workspace_id)
          .eq('user_id', target_user_id)
          .is('revoked_at', null);

        // Allow user to request join again
        await supabase.from('notifications').insert({
          user_id: target_user_id,
          type: 'system',
          title: 'Ban revocato',
          body: 'Il tuo ban è stato revocato. Puoi richiedere di unirti nuovamente.',
          entity_type: 'workspace',
          entity_id: workspace_id,
        });

        result = { unbanned: true };
        break;
      }

      case 'kick': {
        if (!room_id) throw new AppError('Room ID richiesto per kick', 'MISSING_ROOM');
        if (adminRoleValue < 3) throw Errors.FORBIDDEN;

        // Delete participant
        await supabase
          .from('room_participants')
          .delete()
          .eq('room_id', room_id)
          .eq('user_id', target_user_id);

        // Log kick
        const bannedUntil = duration_minutes
          ? new Date(Date.now() + duration_minutes * 60000).toISOString()
          : null;

        await supabase
          .from('room_kicks')
          .insert({
            room_id,
            user_id: target_user_id,
            kicked_by: adminId,
            reason,
            can_reenter: !duration_minutes,
            banned_until: bannedUntil,
          });

        // Notify
        await supabase.from('notifications').insert({
          user_id: target_user_id,
          type: 'kick',
          title: 'Sei stato rimosso dalla stanza',
          body: reason || 'Sei stato rimosso da un moderatore',
          entity_type: 'room',
          entity_id: room_id,
        });

        result = { kicked: true };
        break;
      }

      case 'mute': {
        if (!room_id) throw new AppError('Room ID richiesto per mute', 'MISSING_ROOM');
        if (adminRoleValue < 3) throw Errors.FORBIDDEN;

        const expiresAt = duration_minutes
          ? new Date(Date.now() + duration_minutes * 60000).toISOString()
          : null;

        await supabase
          .from('room_mutes')
          .upsert({
            room_id,
            user_id: target_user_id,
            muted_by: adminId,
            mute_type: mute_type,
            expires_at: expiresAt,
          }, {
            onConflict: 'room_id,user_id,mute_type',
          });

        // Update participant state
        await supabase
          .from('room_participants')
          .update({
            is_muted: true,
            muted_at: new Date().toISOString(),
            muted_by: adminId,
            mute_expires_at: expiresAt,
          })
          .eq('room_id', room_id)
          .eq('user_id', target_user_id);

        result = { muted: true };
        break;
      }

      case 'unmute': {
        if (!room_id) throw new AppError('Room ID richiesto per unmute', 'MISSING_ROOM');
        if (adminRoleValue < 3) throw Errors.FORBIDDEN;

        await supabase
          .from('room_mutes')
          .update({
            unmuted_at: new Date().toISOString(),
            unmuted_by: adminId,
          })
          .eq('room_id', room_id)
          .eq('user_id', target_user_id)
          .eq('mute_type', mute_type)
          .is('unmuted_at', null);

        // Check if any mutes remain
        const { data: remainingMutes } = await supabase
          .from('room_mutes')
          .select('id')
          .eq('room_id', room_id)
          .eq('user_id', target_user_id)
          .is('unmuted_at', null)
          .limit(1);

        if (!remainingMutes?.length) {
          await supabase
            .from('room_participants')
            .update({ is_muted: false })
            .eq('room_id', room_id)
            .eq('user_id', target_user_id);
        }

        result = { unmuted: true };
        break;
      }

      case 'change_role': {
        if (!new_role) throw new AppError('Nuovo ruolo richiesto', 'MISSING_ROLE');
        if (adminRoleValue < 3) throw Errors.FORBIDDEN; // Admin+

        // Owner can do anything
        if (adminMember.role !== 'owner') {
          // Admin can only manage member/guest
          if (['owner', 'admin'].includes(new_role)) throw Errors.FORBIDDEN;
          if (targetRoleValue >= 3) throw Errors.CANNOT_MODERATE;
        }

        const oldRole = targetMember?.role;

        await supabase
          .from('workspace_members')
          .update({ role: new_role })
          .eq('workspace_id', workspace_id)
          .eq('user_id', target_user_id);

        // Audit log
        await supabase.rpc('log_workspace_action', {
          p_workspace_id: workspace_id,
          p_user_id: adminId,
          p_action: 'user.role_changed',
          p_entity_type: 'member',
          p_entity_id: target_user_id,
          p_metadata: { old_role: oldRole, new_role },
        });

        // Notify user
        await supabase.from('notifications').insert({
          user_id: target_user_id,
          type: 'system',
          title: 'Ruolo aggiornato',
          body: `Il tuo ruolo è stato cambiato in ${new_role}`,
          entity_type: 'workspace',
          entity_id: workspace_id,
        });

        result = { role_changed: true, old_role: oldRole, new_role };
        break;
      }

      case 'remove': {
        if (adminRoleValue < 3) throw Errors.FORBIDDEN;
        if (targetRoleValue >= adminRoleValue) throw Errors.CANNOT_MODERATE;

        // Remove from all rooms
        await supabase
          .from('room_participants')
          .delete()
          .eq('user_id', target_user_id)
          .in('room_id',
            supabase.from('rooms').select('id').in('space_id',
              supabase.from('spaces').select('id').eq('workspace_id', workspace_id)
            )
          );

        // Mark as removed
        await supabase
          .from('workspace_members')
          .update({
            removed_at: new Date().toISOString(),
            removed_by: adminId,
            remove_reason: reason,
          })
          .eq('workspace_id', workspace_id)
          .eq('user_id', target_user_id);

        result = { removed: true };
        break;
      }

      default:
        throw new AppError('Azione non valida', 'INVALID_ACTION');
    }

    return success(result);

  } catch (err) {
    return error(err instanceof AppError ? err : new AppError((err as Error).message, 'INTERNAL_ERROR', 500));
  }
});
