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

// GET — Analyze orphaned data
export async function GET(req: NextRequest) {
    const auth = await getAdminClient(req);
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase } = auth;

    try {
        // Get active workspaces
        const { data: workspaces } = await supabase.from('workspaces').select('id, deleted_at');
        const activeWsIds = new Set((workspaces || []).filter((w: any) => !w.deleted_at).map((w: any) => w.id));

        // Get all spaces
        const { data: spaces } = await supabase.from('spaces').select('id, name, workspace_id, deleted_at');

        // Active spaces: not deleted AND workspace is active
        const activeSpaces = (spaces || []).filter((s: any) => !s.deleted_at && activeWsIds.has(s.workspace_id));
        const activeSpaceIds = new Set(activeSpaces.map((s: any) => s.id));

        // Stale spaces: deleted or workspace doesn't exist/is deleted
        const staleSpaces = (spaces || []).filter((s: any) => !activeSpaceIds.has(s.id));

        // Get all rooms
        const { data: rooms } = await supabase.from('rooms').select('id, name, space_id, created_at');

        // Orphaned rooms = rooms NOT in an active space
        const orphanedRooms = (rooms || []).filter((r: any) => !activeSpaceIds.has(r.space_id));
        const validRooms = (rooms || []).filter((r: any) => activeSpaceIds.has(r.space_id));

        // Get orphaned furniture (furniture whose room_id doesn't match any room)
        const roomIds = new Set((rooms || []).map((r: any) => r.id));
        const { data: furniture } = await supabase.from('furniture').select('id, room_id');
        const orphanedFurniture = (furniture || []).filter((f: any) => !roomIds.has(f.room_id));

        // Get orphaned room_participants
        const { data: participants } = await supabase.from('room_participants').select('id, room_id');
        const orphanedParticipants = (participants || []).filter((p: any) => !roomIds.has(p.room_id));

        // Get orphaned room_connections
        const { data: connections } = await supabase.from('room_connections').select('id, room_a_id, room_b_id');
        const orphanedConnections = (connections || []).filter(
            (c: any) => !roomIds.has(c.room_a_id) || !roomIds.has(c.room_b_id)
        );

        // Rooms per active space
        const roomsPerSpace: Record<string, { spaceName: string; count: number }> = {};
        for (const space of activeSpaces) {
            roomsPerSpace[space.id] = {
                spaceName: space.name,
                count: validRooms.filter((r: any) => r.space_id === space.id).length,
            };
        }

        return NextResponse.json({
            totalRoomsInDb: (rooms || []).length,
            validRooms: validRooms.length,
            orphanedRooms: orphanedRooms.length,
            orphanedRoomsList: orphanedRooms.map((r: any) => ({ id: r.id, name: r.name, space_id: r.space_id })),
            staleSpaces: staleSpaces.length,
            orphanedFurniture: orphanedFurniture.length,
            orphanedParticipants: orphanedParticipants.length,
            orphanedConnections: orphanedConnections.length,
            roomsPerSpace,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST — Clean up orphaned data
export async function POST(req: NextRequest) {
    const auth = await getAdminClient(req);
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabase } = auth;

    try {
        // Get active workspaces
        const { data: workspaces } = await supabase.from('workspaces').select('id, deleted_at');
        const activeWsIds = new Set((workspaces || []).filter((w: any) => !w.deleted_at).map((w: any) => w.id));

        // Get all spaces — active = not deleted AND workspace is active
        const { data: spaces } = await supabase.from('spaces').select('id, workspace_id, deleted_at');
        const activeSpaceIds = new Set(
            (spaces || []).filter((s: any) => !s.deleted_at && activeWsIds.has(s.workspace_id)).map((s: any) => s.id)
        );
        const staleSpaceIds = (spaces || []).filter((s: any) => !activeSpaceIds.has(s.id)).map((s: any) => s.id);

        // Get all rooms
        const { data: rooms } = await supabase.from('rooms').select('id, space_id');
        const allRoomIds = new Set((rooms || []).map((r: any) => r.id));

        // Orphaned rooms = rooms in stale or missing spaces
        const orphanedRoomIds = (rooms || []).filter((r: any) => !activeSpaceIds.has(r.space_id)).map((r: any) => r.id);

        let deletedRooms = 0;
        let deletedSpaces = 0;
        let deletedFurniture = 0;
        let deletedParticipants = 0;
        let deletedConnections = 0;

        // 1. Delete globally orphaned furniture/participants/connections (pointing to non-existent rooms)
        const { data: furniture } = await supabase.from('furniture').select('id, room_id');
        const orphFurnIds = (furniture || []).filter((f: any) => !allRoomIds.has(f.room_id)).map((f: any) => f.id);
        if (orphFurnIds.length > 0) {
            await supabase.from('furniture').delete().in('id', orphFurnIds);
            deletedFurniture += orphFurnIds.length;
        }

        const { data: participants } = await supabase.from('room_participants').select('id, room_id');
        const orphPartIds = (participants || []).filter((p: any) => !allRoomIds.has(p.room_id)).map((p: any) => p.id);
        if (orphPartIds.length > 0) {
            await supabase.from('room_participants').delete().in('id', orphPartIds);
            deletedParticipants += orphPartIds.length;
        }

        const { data: connections } = await supabase.from('room_connections').select('id, room_a_id, room_b_id');
        const orphConnIds = (connections || []).filter(
            (c: any) => !allRoomIds.has(c.room_a_id) || !allRoomIds.has(c.room_b_id)
        ).map((c: any) => c.id);
        if (orphConnIds.length > 0) {
            await supabase.from('room_connections').delete().in('id', orphConnIds);
            deletedConnections += orphConnIds.length;
        }

        // 2. Delete related data for orphaned rooms, then the rooms themselves
        for (const roomId of orphanedRoomIds) {
            await Promise.all([
                supabase.from('furniture').delete().eq('room_id', roomId),
                supabase.from('room_participants').delete().eq('room_id', roomId),
                supabase.from('room_connections').delete().or(`room_a_id.eq.${roomId},room_b_id.eq.${roomId}`),
            ]);
        }
        if (orphanedRoomIds.length > 0) {
            await supabase.from('rooms').delete().in('id', orphanedRoomIds);
            deletedRooms = orphanedRoomIds.length;
        }

        // 3. Delete stale spaces
        if (staleSpaceIds.length > 0) {
            await supabase.from('spaces').delete().in('id', staleSpaceIds);
            deletedSpaces = staleSpaceIds.length;
        }

        return NextResponse.json({
            success: true,
            cleaned: {
                rooms: deletedRooms,
                spaces: deletedSpaces,
                furniture: deletedFurniture,
                participants: deletedParticipants,
                connections: deletedConnections,
            },
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
