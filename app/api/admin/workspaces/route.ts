import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

async function getAdminClient(req: NextRequest) {
    const res = NextResponse.next();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) { return req.cookies.get(name)?.value; },
                set(name: string, value: string, options: CookieOptions) { res.cookies.set({ name, value, ...options }); },
                remove(name: string, options: CookieOptions) { res.cookies.set({ name, value: '', ...options }); },
            },
        }
    );
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: 'Not authenticated', status: 401 };

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', session.user.id)
        .single();

    if (!profile?.is_super_admin) return { error: 'Forbidden', status: 403 };

    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    return { supabase: adminClient, userId: session.user.id };
}

export async function GET(req: NextRequest) {
    const auth = await getAdminClient(req);
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase } = auth;

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';
    const plan = url.searchParams.get('plan') || '';
    const status = url.searchParams.get('status') || ''; // active, suspended, deleted
    const offset = (page - 1) * limit;

    try {

        // Try with suspended_at first, fall back if column doesn't exist yet
        let hasSuspendedColumn = true;
        const buildQuery = (withSuspended: boolean) => {
            const selectFields = withSuspended
                ? `id, name, slug, plan, max_members, max_spaces, created_at, updated_at, deleted_at, suspended_at, created_by, workspace_members(id, user_id, role, joined_at, last_active_at, is_suspended, removed_at)`
                : `id, name, slug, plan, max_members, max_spaces, created_at, updated_at, deleted_at, created_by, workspace_members(id, user_id, role, joined_at, last_active_at, is_suspended, removed_at)`;

            let q = supabase
                .from('workspaces')
                .select(selectFields, { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            // Status filter
            if (withSuspended) {
                if (status === 'active') {
                    q = q.is('deleted_at', null).is('suspended_at', null);
                } else if (status === 'suspended') {
                    q = q.is('deleted_at', null).not('suspended_at', 'is', null);
                } else if (status === 'deleted') {
                    q = q.not('deleted_at', 'is', null);
                }
            } else {
                if (status === 'active' || status === 'suspended') {
                    q = q.is('deleted_at', null);
                } else if (status === 'deleted') {
                    q = q.not('deleted_at', 'is', null);
                }
            }

            if (search) {
                q = q.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
            }
            if (plan) {
                q = q.eq('plan', plan);
            }
            return q;
        };

        let data: any[] | null = null;
        let count: number | null = null;
        let error: any = null;

        // Attempt with suspended_at
        const res1 = await buildQuery(true);
        if (res1.error) {
            // Fallback without suspended_at
            hasSuspendedColumn = false;
            const res2 = await buildQuery(false);
            data = res2.data;
            count = res2.count ?? null;
            error = res2.error;
        } else {
            data = res1.data;
            count = res1.count ?? null;
        }
        if (error) throw error;

        // Collect all owner user IDs to batch-fetch profiles
        const ownerUserIds = new Set<string>();
        (data || []).forEach((ws: any) => {
            const members = ws.workspace_members || [];
            const owner = members.find((m: any) => m.role === 'owner' && !m.removed_at);
            if (owner) ownerUserIds.add(owner.user_id);
            // Also check created_by
            if (ws.created_by) ownerUserIds.add(ws.created_by);
        });

        // Fetch owner profiles (use safe select — suspended_at may not exist yet)
        let ownerProfiles: Record<string, any> = {};
        if (ownerUserIds.size > 0) {
            // First try with extended columns, fallback to basic if migration not applied
            let profiles: any[] | null = null;
            const { data: extProfiles, error: extError } = await supabase
                .from('profiles')
                .select('id, email, full_name, display_name, avatar_url, is_super_admin, suspended_at, deleted_at')
                .in('id', Array.from(ownerUserIds));

            if (extError) {
                // Fallback: suspended_at/deleted_at columns may not exist yet
                const { data: basicProfiles } = await supabase
                    .from('profiles')
                    .select('id, email, full_name, display_name, avatar_url, is_super_admin')
                    .in('id', Array.from(ownerUserIds));
                profiles = basicProfiles;
            } else {
                profiles = extProfiles;
            }

            if (profiles) {
                profiles.forEach((p: any) => { ownerProfiles[p.id] = p; });
            }
        }

        // Enrich with member counts and owner info
        const enriched = (data || []).map((ws: any) => {
            const members = ws.workspace_members || [];
            const activeMembers = members.filter((m: any) => !m.removed_at && !m.is_suspended);
            const memberUserIds = activeMembers.map((m: any) => m.user_id);
            const ownerMember = members.find((m: any) => m.role === 'owner' && !m.removed_at);
            const ownerUserId = ownerMember?.user_id || ws.created_by;
            const ownerProfile = ownerUserId ? ownerProfiles[ownerUserId] : null;

            // Determine workspace status
            let wsStatus: 'active' | 'suspended' | 'deleted' = 'active';
            if (ws.deleted_at) wsStatus = 'deleted';
            else if (ws.suspended_at) wsStatus = 'suspended';

            return {
                id: ws.id,
                name: ws.name,
                slug: ws.slug,
                plan: ws.plan,
                maxMembers: ws.max_members,
                maxSpaces: ws.max_spaces,
                totalMembers: activeMembers.length,
                memberUserIds,
                suspendedMembers: members.filter((m: any) => m.is_suspended).length,
                status: wsStatus,
                suspendedAt: ws.suspended_at,
                deletedAt: ws.deleted_at,
                createdAt: ws.created_at,
                lastActivity: Math.max(...members.map((m: any) => new Date(m.last_active_at || 0).getTime())) || null,
                owner: ownerProfile ? {
                    id: ownerProfile.id,
                    email: ownerProfile.email,
                    name: ownerProfile.display_name || ownerProfile.full_name || ownerProfile.email,
                    avatarUrl: ownerProfile.avatar_url,
                    isSuperAdmin: !!ownerProfile.is_super_admin,
                    suspended: !!ownerProfile.suspended_at,
                    deleted: !!ownerProfile.deleted_at,
                } : null,
            };
        });

        // ── Compute global summary stats ──
        const allUniqueUserIds = new Set<string>();
        let wsActive = 0, wsSuspended = 0, wsDeleted = 0;

        (data || []).forEach((ws: any) => {
            const members = ws.workspace_members || [];
            members.forEach((m: any) => {
                if (!m.removed_at) allUniqueUserIds.add(m.user_id);
            });

            if (ws.deleted_at) wsDeleted++;
            else if (ws.suspended_at) wsSuspended++;
            else wsActive++;
        });

        return NextResponse.json({
            workspaces: enriched,
            total: count || 0,
            page,
            totalPages: Math.ceil((count || 0) / limit),
            summary: {
                uniqueUsers: allUniqueUserIds.size,
                totalOwners: Object.keys(ownerProfiles).length,
                workspacesActive: wsActive,
                workspacesSuspended: wsSuspended,
                workspacesDeleted: wsDeleted,
            },
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await getAdminClient(req);
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase, userId } = auth;

    try {
        const body = await req.json();
        const { action, workspaceId, data: actionData } = body;

        // Helper to send notification to a user
        const sendNotification = async (targetUserId: string, title: string, body: string, entityType?: string, entityId?: string) => {
            await supabase.from('notifications').insert({
                user_id: targetUserId,
                type: 'system',
                title,
                body,
                entity_type: entityType || null,
                entity_id: entityId || null,
            });
        };

        // Helper to get workspace owner user_id
        const getOwnerUserId = async (wsId: string): Promise<string | null> => {
            const { data: members } = await supabase
                .from('workspace_members')
                .select('user_id')
                .eq('workspace_id', wsId)
                .eq('role', 'owner')
                .is('removed_at', null)
                .limit(1);
            return members?.[0]?.user_id || null;
        };

        switch (action) {
            case 'change_plan': {
                const { data: ws, error } = await supabase
                    .from('workspaces')
                    .update({ plan: actionData.plan })
                    .eq('id', workspaceId)
                    .select()
                    .single();
                if (error) throw error;

                await supabase.from('billing_events').insert({
                    workspace_id: workspaceId,
                    event_type: 'plan_upgrade',
                    plan_from: actionData.planFrom,
                    plan_to: actionData.plan,
                });

                return NextResponse.json({ success: true, workspace: ws });
            }

            case 'suspend_workspace': {
                // Suspend entire workspace
                const { error: wsError } = await supabase
                    .from('workspaces')
                    .update({ suspended_at: new Date().toISOString(), suspended_by: userId })
                    .eq('id', workspaceId);
                if (wsError) throw wsError;

                // Also suspend all members
                await supabase
                    .from('workspace_members')
                    .update({ is_suspended: true })
                    .eq('workspace_id', workspaceId)
                    .is('removed_at', null);

                // Notify owner
                const ownerId = await getOwnerUserId(workspaceId);
                if (ownerId) {
                    const { data: ws } = await supabase.from('workspaces').select('name').eq('id', workspaceId).single();
                    await sendNotification(
                        ownerId,
                        '⚠️ Workspace Sospeso',
                        `Il workspace "${ws?.name || ''}" è stato temporaneamente sospeso dall'amministratore della piattaforma. Contattaci per maggiori informazioni.`,
                        'workspace', workspaceId
                    );
                }

                return NextResponse.json({ success: true });
            }

            case 'reactivate_workspace': {
                // Clear suspension
                const { error: wsError } = await supabase
                    .from('workspaces')
                    .update({ suspended_at: null, suspended_by: null })
                    .eq('id', workspaceId);
                if (wsError) throw wsError;

                // Un-suspend all members
                await supabase
                    .from('workspace_members')
                    .update({ is_suspended: false })
                    .eq('workspace_id', workspaceId);

                // Notify owner
                const ownerId = await getOwnerUserId(workspaceId);
                if (ownerId) {
                    const { data: ws } = await supabase.from('workspaces').select('name').eq('id', workspaceId).single();
                    await sendNotification(
                        ownerId,
                        '✅ Workspace Riattivato',
                        `Il workspace "${ws?.name || ''}" è stato riattivato. Puoi tornare ad utilizzarlo normalmente.`,
                        'workspace', workspaceId
                    );
                }

                return NextResponse.json({ success: true });
            }

            case 'delete_workspace': {
                // Notify owner BEFORE deleting
                const ownerId = await getOwnerUserId(workspaceId);
                const { data: ws } = await supabase.from('workspaces').select('name').eq('id', workspaceId).single();
                const wsName = ws?.name || '';

                // Hard delete — CASCADE will handle workspace_members, spaces, etc.
                const { error } = await supabase
                    .from('workspaces')
                    .delete()
                    .eq('id', workspaceId);
                if (error) throw error;

                if (ownerId) {
                    await sendNotification(
                        ownerId,
                        '🔴 Workspace Eliminato',
                        `Il workspace "${wsName}" è stato eliminato definitivamente dall'amministratore della piattaforma. Se ritieni sia un errore, contattaci.`,
                        'workspace', workspaceId
                    );
                }

                return NextResponse.json({ success: true });
            }

            case 'restore_workspace': {
                // Restore from soft-delete
                const { error } = await supabase
                    .from('workspaces')
                    .update({ deleted_at: null, deleted_by: null, suspended_at: null, suspended_by: null })
                    .eq('id', workspaceId);
                if (error) throw error;

                // Un-suspend members
                await supabase
                    .from('workspace_members')
                    .update({ is_suspended: false })
                    .eq('workspace_id', workspaceId);

                // Notify owner
                const ownerId = await getOwnerUserId(workspaceId);
                if (ownerId) {
                    const { data: ws } = await supabase.from('workspaces').select('name').eq('id', workspaceId).single();
                    await sendNotification(
                        ownerId,
                        '🔄 Workspace Ripristinato',
                        `Il workspace "${ws?.name || ''}" è stato ripristinato. Tutto torna alla normalità.`,
                        'workspace', workspaceId
                    );
                }

                return NextResponse.json({ success: true });
            }

            case 'suspend_owner': {
                const { ownerId } = actionData;
                if (!ownerId) return NextResponse.json({ error: 'ownerId required' }, { status: 400 });

                const { error } = await supabase
                    .from('profiles')
                    .update({ suspended_at: new Date().toISOString(), suspended_by: userId })
                    .eq('id', ownerId);
                if (error) throw error;

                await sendNotification(
                    ownerId,
                    '⚠️ Account Sospeso',
                    'Il tuo account è stato temporaneamente sospeso dall\'amministratore della piattaforma. Contattaci per maggiori informazioni.',
                    'profile', ownerId
                );

                return NextResponse.json({ success: true });
            }

            case 'reactivate_owner': {
                const { ownerId } = actionData;
                if (!ownerId) return NextResponse.json({ error: 'ownerId required' }, { status: 400 });

                const { error } = await supabase
                    .from('profiles')
                    .update({ suspended_at: null, suspended_by: null })
                    .eq('id', ownerId);
                if (error) throw error;

                await sendNotification(
                    ownerId,
                    '✅ Account Riattivato',
                    'Il tuo account è stato riattivato. Puoi tornare ad utilizzare la piattaforma normalmente.',
                    'profile', ownerId
                );

                return NextResponse.json({ success: true });
            }

            case 'bulk_delete': {
                const ids: string[] = body.workspaceIds;
                if (!ids || !Array.isArray(ids) || ids.length === 0) {
                    return NextResponse.json({ error: 'workspaceIds richiesti' }, { status: 400 });
                }

                // Notify owners before deleting
                for (const wsId of ids) {
                    const ownId = await getOwnerUserId(wsId);
                    const { data: wsData } = await supabase.from('workspaces').select('name').eq('id', wsId).single();
                    if (ownId) {
                        await sendNotification(
                            ownId,
                            '🔴 Workspace Eliminato',
                            `Il workspace "${wsData?.name || ''}" è stato eliminato definitivamente dall'amministratore.`,
                            'workspace', wsId
                        );
                    }
                }

                // Hard delete all
                const { error: delErr } = await supabase.from('workspaces').delete().in('id', ids);
                if (delErr) throw delErr;

                return NextResponse.json({ success: true, deleted: ids.length });
            }

            case 'bulk_suspend': {
                const ids: string[] = body.workspaceIds;
                if (!ids || !Array.isArray(ids) || ids.length === 0) {
                    return NextResponse.json({ error: 'workspaceIds richiesti' }, { status: 400 });
                }

                for (const wsId of ids) {
                    await supabase.from('workspaces')
                        .update({ suspended_at: new Date().toISOString(), suspended_by: userId })
                        .eq('id', wsId);

                    await supabase.from('workspace_members')
                        .update({ is_suspended: true })
                        .eq('workspace_id', wsId)
                        .is('removed_at', null);

                    const ownId = await getOwnerUserId(wsId);
                    const { data: wsData } = await supabase.from('workspaces').select('name').eq('id', wsId).single();
                    if (ownId) {
                        await sendNotification(
                            ownId,
                            '🟡 Workspace Sospeso',
                            `Il workspace "${wsData?.name || ''}" è stato sospeso dall'amministratore.`,
                            'workspace', wsId
                        );
                    }
                }

                return NextResponse.json({ success: true, suspended: ids.length });
            }

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
