// ============================================
// EDGE FUNCTION: join-workspace
// Gestisce accettazione invito o richiesta di accesso
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceRoleClient, getUserClient } from '../_shared/supabase.ts';
import { AppError, Errors, success, error } from '../_shared/errors.ts';

interface JoinRequest {
  type: 'invitation' | 'request';
  workspace_id?: string;
  invitation_token?: string;
  message?: string;
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const userClient = getUserClient(req);
    if (!userClient) throw Errors.UNAUTHORIZED;

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw Errors.UNAUTHORIZED;

    const supabase = getServiceRoleClient();
    const body: JoinRequest = await req.json();

    if (body.type === 'invitation') {
      // Accetta invito tramite token
      if (!body.invitation_token) {
        throw new AppError('Token invito richiesto', 'MISSING_TOKEN');
      }

      // Trova invito
      const { data: invitation } = await supabase
        .from('workspace_invitations')
        .select('*')
        .eq('token', body.invitation_token)
        .is('accepted_at', null)
        .is('revoked_at', null)
        .single();

      if (!invitation) {
        throw new AppError('Invito non valido o scaduto', 'INVALID_INVITATION');
      }

      if (new Date(invitation.expires_at) < new Date()) {
        throw new AppError('Invito scaduto', 'EXPIRED_INVITATION');
      }

      // Verifica che l'email corrisponda
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      if (profile?.email !== invitation.email) {
        throw new AppError('Questo invito è per un altro indirizzo email', 'WRONG_EMAIL');
      }

      // Verifica ban
      const { data: isBanned } = await supabase.rpc('is_user_banned', {
        p_workspace_id: invitation.workspace_id,
        p_user_id: user.id,
      });

      if (isBanned) throw Errors.BANNED;

      // Verifica se già membro
      const { data: existingMember } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', invitation.workspace_id)
        .eq('user_id', user.id)
        .is('removed_at', null)
        .single();

      if (existingMember) throw Errors.ALREADY_MEMBER;

      // Crea membro
      await supabase.from('workspace_members').insert({
        workspace_id: invitation.workspace_id,
        user_id: user.id,
        role: invitation.role,
        invited_by: invitation.invited_by,
        invited_at: invitation.invited_at,
      });

      // Marca invito come accettato
      await supabase
        .from('workspace_invitations')
        .update({
          accepted_at: new Date().toISOString(),
          accepted_by: user.id,
        })
        .eq('id', invitation.id);

      // Audit log
      await supabase.rpc('log_workspace_action', {
        p_workspace_id: invitation.workspace_id,
        p_user_id: user.id,
        p_action: 'member.joined_via_invite',
        p_entity_type: 'member',
        p_entity_id: user.id,
      });

      return success({ joined: true, workspace_id: invitation.workspace_id });

    } else if (body.type === 'request') {
      // Richiesta di accesso
      if (!body.workspace_id) {
        throw new AppError('Workspace ID richiesto', 'MISSING_WORKSPACE');
      }

      // Verifica ban
      const { data: isBanned } = await supabase.rpc('is_user_banned', {
        p_workspace_id: body.workspace_id,
        p_user_id: user.id,
      });

      if (isBanned) throw Errors.BANNED;

      // Verifica se già membro
      const { data: existingMember } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', body.workspace_id)
        .eq('user_id', user.id)
        .is('removed_at', null)
        .single();

      if (existingMember) throw Errors.ALREADY_MEMBER;

      // Verifica richiesta esistente
      const { data: existingRequest } = await supabase
        .from('workspace_join_requests')
        .select('id')
        .eq('workspace_id', body.workspace_id)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .single();

      if (existingRequest) {
        throw new AppError('Hai già una richiesta in attesa', 'PENDING_REQUEST');
      }

      // Crea richiesta
      const { data: request } = await supabase
        .from('workspace_join_requests')
        .insert({
          workspace_id: body.workspace_id,
          user_id: user.id,
          message: body.message,
        })
        .select()
        .single();

      // Notifica admin
      const { data: admins } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', body.workspace_id)
        .in('role', ['owner', 'admin'])
        .is('removed_at', null);

      if (admins) {
        await supabase.from('notifications').insert(
          admins.map(admin => ({
            user_id: admin.user_id,
            type: 'system',
            title: 'Nuova richiesta di accesso',
            body: `${profile?.full_name || 'Un utente'} vuole unirsi al workspace`,
            entity_type: 'workspace',
            entity_id: body.workspace_id,
          }))
        );
      }

      return success({ requested: true, request_id: request.id });
    }

    throw new AppError('Tipo richiesta non valido', 'INVALID_TYPE');

  } catch (err) {
    return error(err instanceof AppError ? err : new AppError((err as Error).message, 'INTERNAL_ERROR', 500));
  }
});
