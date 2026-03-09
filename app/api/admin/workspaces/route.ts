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
        // Fetch active spaces count per workspace
        const wsIds = (data || []).map((ws: any) => ws.id);
        const spaceCounts: Record<string, number> = {};
        if (wsIds.length > 0) {
            const { data: spacesData } = await supabase
                .from('spaces')
                .select('workspace_id')
                .in('workspace_id', wsIds)
                .is('deleted_at', null);
            (spacesData || []).forEach((s: any) => {
                spaceCounts[s.workspace_id] = (spaceCounts[s.workspace_id] || 0) + 1;
            });
        }

        // Fetch active guest invites per workspace (each counts as 1 seat)
        const guestInviteCounts: Record<string, number> = {};
        if (wsIds.length > 0) {
            const { data: guestInvData } = await supabase
                .from('workspace_invitations')
                .select('workspace_id')
                .in('workspace_id', wsIds)
                .eq('role', 'guest')
                .is('revoked_at', null)
                .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);
            (guestInvData || []).forEach((g: any) => {
                guestInviteCounts[g.workspace_id] = (guestInviteCounts[g.workspace_id] || 0) + 1;
            });
        }

        // Enrich with member counts and owner info
        const enriched = (data || []).map((ws: any) => {
            const members = ws.workspace_members || [];
            const activeMembers = members.filter((m: any) => !m.removed_at && !m.is_suspended);
            const nonGuestMembers = activeMembers.filter((m: any) => m.role !== 'guest');
            const memberUserIds = activeMembers.map((m: any) => m.user_id);
            const ownerMember = members.find((m: any) => m.role === 'owner' && !m.removed_at);
            const ownerUserId = ownerMember?.user_id || ws.created_by;
            const ownerProfile = ownerUserId ? ownerProfiles[ownerUserId] : null;
            const wsGuestInvites = guestInviteCounts[ws.id] || 0;

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
                nonGuestMembers: nonGuestMembers.length,
                activeGuestInvites: wsGuestInvites,
                totalSeats: nonGuestMembers.length + wsGuestInvites,
                memberUserIds,
                suspendedMembers: members.filter((m: any) => m.is_suspended).length,
                status: wsStatus,
                suspendedAt: ws.suspended_at,
                deletedAt: ws.deleted_at,
                createdAt: ws.created_at,
                lastActivity: Math.max(...members.map((m: any) => new Date(m.last_active_at || 0).getTime())) || null,
                activeSpaces: spaceCounts[ws.id] || 0,
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

                // Clean up related tables that may not have ON DELETE CASCADE in production
                await supabase.from('workspace_invitations').delete().eq('workspace_id', workspaceId);

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

            // restore_workspace removed — hard deletes are permanent

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

                // Fetch workspace names and owners BEFORE deleting
                const { data: wsInfos } = await supabase
                    .from('workspaces')
                    .select('id, name, created_by')
                    .in('id', ids);

                // Clean up related tables that may not have ON DELETE CASCADE in production
                await supabase.from('workspace_invitations').delete().in('workspace_id', ids);

                // Hard delete all workspaces
                const { error: delErr } = await supabase.from('workspaces').delete().in('id', ids);
                if (delErr) throw delErr;

                // Try to notify owners (non-blocking, don't fail if notifications table doesn't exist)
                try {
                    const ownerIds = new Set<string>();
                    (wsInfos || []).forEach((ws: any) => { if (ws.created_by) ownerIds.add(ws.created_by); });
                    for (const oid of Array.from(ownerIds)) {
                        const count = (wsInfos || []).filter((ws: any) => ws.created_by === oid).length;
                        await sendNotification(
                            oid,
                            '🔴 Workspace Eliminati',
                            `${count} workspace sono stati eliminati definitivamente dall'amministratore.`,
                            'workspace', ''
                        );
                    }
                } catch { /* notifications are optional */ }

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

            case 'bulk_reactivate': {
                const ids: string[] = body.workspaceIds;
                if (!ids || !Array.isArray(ids) || ids.length === 0) {
                    return NextResponse.json({ error: 'workspaceIds richiesti' }, { status: 400 });
                }

                for (const wsId of ids) {
                    await supabase.from('workspaces')
                        .update({ suspended_at: null, suspended_by: null })
                        .eq('id', wsId);

                    await supabase.from('workspace_members')
                        .update({ is_suspended: false })
                        .eq('workspace_id', wsId)
                        .is('removed_at', null);

                    const ownId = await getOwnerUserId(wsId);
                    const { data: wsData } = await supabase.from('workspaces').select('name').eq('id', wsId).single();
                    if (ownId) {
                        await sendNotification(
                            ownId,
                            '✅ Workspace Riattivato',
                            `Il workspace "${wsData?.name || ''}" è stato riattivato dall'amministratore.`,
                            'workspace', wsId
                        );
                    }
                }

                return NextResponse.json({ success: true, reactivated: ids.length });
            }

            case 'get_owner_detail': {
                const { ownerId } = actionData;
                if (!ownerId) return NextResponse.json({ error: 'ownerId required' }, { status: 400 });

                // Fetch owner profile (with fallback for missing columns)
                let ownerProfile: any = null;
                const { data: extProfile, error: extProfErr } = await supabase
                    .from('profiles')
                    .select('id, email, full_name, display_name, avatar_url, is_super_admin, suspended_at, deleted_at, created_at')
                    .eq('id', ownerId)
                    .single();
                if (extProfErr) {
                    // Fallback: some columns may not exist
                    const { data: basicProfile, error: basicErr } = await supabase
                        .from('profiles')
                        .select('id, email, full_name, display_name, avatar_url, is_super_admin')
                        .eq('id', ownerId)
                        .single();
                    if (basicErr) throw basicErr;
                    ownerProfile = basicProfile;
                } else {
                    ownerProfile = extProfile;
                }

                // Find all workspaces where this user is owner (via workspace_members role)
                const { data: ownerMemberships } = await supabase
                    .from('workspace_members')
                    .select('workspace_id')
                    .eq('user_id', ownerId)
                    .eq('role', 'owner')
                    .is('removed_at', null);

                // Also find workspaces created_by this user (fallback)
                const { data: createdWs } = await supabase
                    .from('workspaces')
                    .select('id')
                    .eq('created_by', ownerId);

                // Merge unique workspace IDs
                const ownerWsIds = new Set<string>();
                (ownerMemberships || []).forEach((m: any) => ownerWsIds.add(m.workspace_id));
                (createdWs || []).forEach((w: any) => ownerWsIds.add(w.id));
                const uniqueWsIds = Array.from(ownerWsIds);

                // Fetch full workspace details
                let ownedWs: any[] = [];
                if (uniqueWsIds.length > 0) {
                    const { data: wsData } = await supabase
                        .from('workspaces')
                        .select('id, name, slug, plan, max_members, max_spaces, max_rooms_per_space, max_guests, price_per_seat, plan_expires_at, plan_notes, monthly_amount_cents, payment_status, last_payment_at, created_at, deleted_at, suspended_at')
                        .in('id', uniqueWsIds)
                        .order('created_at', { ascending: false });
                    ownedWs = wsData || [];
                }

                const wsIds = (ownedWs || []).map((w: any) => w.id);

                // Fetch ALL members for these workspaces with profiles
                let membersByWs: Record<string, any[]> = {};
                if (wsIds.length > 0) {
                    const { data: allMembers } = await supabase
                        .from('workspace_members')
                        .select('id, workspace_id, user_id, role, joined_at, last_active_at, is_suspended, removed_at')
                        .in('workspace_id', wsIds)
                        .is('removed_at', null)
                        .order('joined_at', { ascending: true });

                    // Batch fetch member profiles
                    const memberUserIds = Array.from(new Set((allMembers || []).map((m: any) => m.user_id)));
                    let memberProfiles: Record<string, any> = {};
                    if (memberUserIds.length > 0) {
                        const { data: mProfiles } = await supabase
                            .from('profiles')
                            .select('id, email, full_name, display_name, avatar_url')
                            .in('id', memberUserIds);
                        (mProfiles || []).forEach((p: any) => { memberProfiles[p.id] = p; });
                    }

                    (allMembers || []).forEach((m: any) => {
                        if (!membersByWs[m.workspace_id]) membersByWs[m.workspace_id] = [];
                        const prof = memberProfiles[m.user_id];
                        membersByWs[m.workspace_id].push({
                            id: m.id,
                            userId: m.user_id,
                            role: m.role,
                            joinedAt: m.joined_at,
                            lastActiveAt: m.last_active_at,
                            isSuspended: m.is_suspended,
                            email: prof?.email || '',
                            name: prof?.display_name || prof?.full_name || prof?.email || '—',
                            avatarUrl: prof?.avatar_url || null,
                        });
                    });
                }

                // Fetch spaces count per workspace
                let spacesByWs: Record<string, number> = {};
                if (wsIds.length > 0) {
                    const { data: spaces } = await supabase
                        .from('spaces')
                        .select('workspace_id')
                        .in('workspace_id', wsIds)
                        .is('deleted_at', null);
                    (spaces || []).forEach((s: any) => {
                        spacesByWs[s.workspace_id] = (spacesByWs[s.workspace_id] || 0) + 1;
                    });
                }

                // Fetch all payments for these workspaces
                let allPayments: any[] = [];
                if (wsIds.length > 0) {
                    const { data: pays } = await supabase
                        .from('payments')
                        .select('*')
                        .in('workspace_id', wsIds)
                        .order('payment_date', { ascending: false });
                    allPayments = pays || [];
                }

                // Fetch active guest invites for these workspaces
                let guestInvitesByWs: Record<string, number> = {};
                if (wsIds.length > 0) {
                    const { data: guestInvData } = await supabase
                        .from('workspace_invitations')
                        .select('workspace_id')
                        .in('workspace_id', wsIds)
                        .eq('role', 'guest')
                        .is('revoked_at', null)
                        .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);
                    (guestInvData || []).forEach((g: any) => {
                        guestInvitesByWs[g.workspace_id] = (guestInvitesByWs[g.workspace_id] || 0) + 1;
                    });
                }

                // Compute revenue KPIs
                const totalRevenueCents = allPayments.reduce((s: number, p: any) => s + (p.amount_cents || 0), 0);
                const mrrCents = (ownedWs || [])
                    .filter((w: any) => !w.deleted_at && !w.suspended_at && w.plan !== 'free')
                    .reduce((s: number, w: any) => s + (w.monthly_amount_cents || 0), 0);

                const workspacesEnriched = (ownedWs || []).map((w: any) => {
                    const members = membersByWs[w.id] || [];
                    const nonGuestMembersCount = members.filter(m => m.role !== 'guest').length;
                    const guestInvitesCount = guestInvitesByWs[w.id] || 0;
                    return {
                        ...w,
                        members,
                        totalMembers: members.length,
                        nonGuestMembers: nonGuestMembersCount,
                        activeGuestInvites: guestInvitesCount,
                        totalSeats: nonGuestMembersCount + guestInvitesCount,
                        activeSpaces: spacesByWs[w.id] || 0,
                        status: w.deleted_at ? 'deleted' : w.suspended_at ? 'suspended' : 'active',
                    };
                });

                return NextResponse.json({
                    owner: {
                        id: ownerProfile.id,
                        email: ownerProfile.email,
                        name: ownerProfile.display_name || ownerProfile.full_name || ownerProfile.email,
                        avatarUrl: ownerProfile.avatar_url,
                        isSuperAdmin: !!ownerProfile.is_super_admin,
                        suspended: !!ownerProfile.suspended_at,
                        deleted: !!ownerProfile.deleted_at,
                        createdAt: ownerProfile.created_at,
                    },
                    workspaces: workspacesEnriched,
                    payments: allPayments,
                    kpi: {
                        totalRevenueCents,
                        mrrCents,
                        totalWorkspaces: (ownedWs || []).length,
                        activeWorkspaces: (ownedWs || []).filter((w: any) => !w.deleted_at && !w.suspended_at).length,
                        totalMembers: workspacesEnriched.reduce((s: number, w: any) => s + w.totalSeats, 0),
                        lastPaymentAt: allPayments.length > 0 ? allPayments[0].payment_date : null,
                    },
                });
            }

            case 'change_member_role': {
                const { memberId, newRole } = actionData;
                if (!memberId || !newRole) return NextResponse.json({ error: 'memberId and newRole required' }, { status: 400 });
                if (!['owner', 'admin', 'member'].includes(newRole)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

                const { error } = await supabase
                    .from('workspace_members')
                    .update({ role: newRole })
                    .eq('id', memberId);
                if (error) throw error;

                // Get member info for notification
                const { data: memberInfo } = await supabase
                    .from('workspace_members')
                    .select('user_id, workspace_id')
                    .eq('id', memberId)
                    .single();
                if (memberInfo) {
                    const { data: ws } = await supabase.from('workspaces').select('name').eq('id', memberInfo.workspace_id).single();
                    const roleLabels: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: 'Membro' };
                    await sendNotification(
                        memberInfo.user_id,
                        '🔄 Ruolo Aggiornato',
                        `Il tuo ruolo nel workspace "${ws?.name || ''}" è stato modificato a ${roleLabels[newRole] || newRole}.`,
                        'workspace', memberInfo.workspace_id
                    );
                }

                return NextResponse.json({ success: true });
            }

            case 'remove_member': {
                const { memberId } = actionData;
                if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 });

                // Get member info before removing
                const { data: memberInfo } = await supabase
                    .from('workspace_members')
                    .select('user_id, workspace_id, role')
                    .eq('id', memberId)
                    .single();

                if (memberInfo?.role === 'owner') {
                    return NextResponse.json({ error: 'Cannot remove workspace owner' }, { status: 400 });
                }

                // Hard delete — remove completely from DB
                const { error } = await supabase
                    .from('workspace_members')
                    .delete()
                    .eq('id', memberId);
                if (error) throw error;

                // Revoke any pending invitations for this user in this workspace
                if (memberInfo) {
                    const { data: profile } = await supabase.from('profiles').select('email').eq('id', memberInfo.user_id).single();
                    if (profile?.email) {
                        await supabase.from('workspace_invitations')
                            .delete()
                            .eq('workspace_id', memberInfo.workspace_id)
                            .eq('email', profile.email);
                    }

                    const { data: ws } = await supabase.from('workspaces').select('name').eq('id', memberInfo.workspace_id).single();
                    await sendNotification(
                        memberInfo.user_id,
                        '🔴 Rimosso dal Workspace',
                        `Sei stato rimosso dal workspace "${ws?.name || ''}" dall'amministratore della piattaforma.`,
                        'workspace', memberInfo.workspace_id
                    );
                }

                return NextResponse.json({ success: true });
            }

            case 'fix_member_roles': {
                // Fix all member roles: only workspace creator (created_by) should be 'owner'
                // Everyone else who is incorrectly 'owner' gets reset to 'member'
                const { data: allWs, error: wsErr } = await supabase.from('workspaces').select('id, name, created_by');
                if (wsErr) return NextResponse.json({ success: false, error: wsErr.message });

                let fixed = 0;
                const debug: any[] = [];
                for (const w of (allWs || [])) {
                    const { data: allOwners } = await supabase
                        .from('workspace_members')
                        .select('id, user_id, role')
                        .eq('workspace_id', w.id)
                        .eq('role', 'owner')
                        .is('removed_at', null);

                    const wrongOwners = (allOwners || []).filter(m => m.user_id !== w.created_by);

                    debug.push({
                        ws: w.name,
                        created_by: w.created_by,
                        totalOwnerRole: (allOwners || []).length,
                        wrongOwners: wrongOwners.length,
                        wrongIds: wrongOwners.map(m => m.user_id),
                    });

                    for (const m of wrongOwners) {
                        const { error: upErr } = await supabase.from('workspace_members').update({ role: 'member' }).eq('id', m.id);
                        if (!upErr) fixed++;
                    }
                }
                return NextResponse.json({ success: true, fixed, totalWorkspaces: (allWs || []).length, debug });
            }


            case 'update_seats': {
                const { max_members, price_per_seat, monthly_amount_cents } = actionData;
                const updateData: any = {};
                if (max_members !== undefined) updateData.max_members = max_members;
                if (price_per_seat !== undefined) updateData.price_per_seat = price_per_seat;
                if (monthly_amount_cents !== undefined) updateData.monthly_amount_cents = monthly_amount_cents;

                const { error: seatsError } = await supabase
                    .from('workspaces')
                    .update(updateData)
                    .eq('id', workspaceId);

                if (seatsError) return NextResponse.json({ error: seatsError.message }, { status: 500 });
                return NextResponse.json({ success: true });
            }

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
