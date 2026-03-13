import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'cosmoffice.antoniovalente1982.partykit.dev';

/**
 * GET /api/workspaces/online-count?workspaceIds=id1,id2,...
 * 
 * For each workspace, looks up its spaces, then queries PartyKit for the
 * online count of each space. Returns { [workspaceId]: onlineCount }.
 * 
 * PartyKit rooms use the spaceId as the room name, so we query:
 *   https://<PARTYKIT_HOST>/parties/avatar/<spaceId>
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const workspaceIds = request.nextUrl.searchParams.get('workspaceIds')?.split(',').filter(Boolean);
        if (!workspaceIds || workspaceIds.length === 0) {
            return NextResponse.json({ error: 'Missing workspaceIds' }, { status: 400 });
        }

        // Fetch all spaces for these workspaces
        const { data: spaces } = await supabase
            .from('spaces')
            .select('id, workspace_id')
            .in('workspace_id', workspaceIds)
            .is('deleted_at', null)
            .is('archived_at', null);

        if (!spaces || spaces.length === 0) {
            const result: Record<string, number> = {};
            workspaceIds.forEach(id => { result[id] = 0; });
            return NextResponse.json(result);
        }

        // Group spaces by workspace
        const spacesByWorkspace = new Map<string, string[]>();
        for (const space of spaces) {
            const arr = spacesByWorkspace.get(space.workspace_id) || [];
            arr.push(space.id);
            spacesByWorkspace.set(space.workspace_id, arr);
        }

        // Query PartyKit for each space's online count
        const protocol = PARTYKIT_HOST.includes('localhost') ? 'http' : 'https';
        const result: Record<string, number> = {};

        await Promise.all(
            workspaceIds.map(async (wsId) => {
                const spaceIds = spacesByWorkspace.get(wsId) || [];
                let totalOnline = 0;

                await Promise.all(
                    spaceIds.map(async (spaceId) => {
                        try {
                            const url = `${protocol}://${PARTYKIT_HOST}/parties/main/${spaceId}`;
                            const res = await fetch(url, {
                                signal: AbortSignal.timeout(3000),
                            });
                            if (res.ok) {
                                const data = await res.json();
                                totalOnline += data.onlineCount || 0;
                            }
                        } catch {
                            // PartyKit may be down or space has no active room — count as 0
                        }
                    })
                );

                result[wsId] = totalOnline;
            })
        );

        return NextResponse.json(result);
    } catch (err: any) {
        console.error('[Online Count API] Error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
