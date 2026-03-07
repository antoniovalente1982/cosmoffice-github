import { PLAN_CONFIG } from '../lib/stripe';

/**
 * Plan Limits Enforcement Utilities
 * Import and call these before allowing workspace operations
 */

export type LimitCheckResult = {
    allowed: boolean;
    current: number;
    max: number;
    planName: string;
    upgradeRequired: boolean;
};

/**
 * Check if a workspace can add more members
 */
export async function checkMemberLimit(
    supabase: any,
    workspaceId: string,
): Promise<LimitCheckResult> {
    const { data: workspace } = await supabase
        .from('workspaces')
        .select('plan, max_members')
        .eq('id', workspaceId)
        .single();

    if (!workspace) return { allowed: false, current: 0, max: 0, planName: 'unknown', upgradeRequired: false };

    const { count } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .is('removed_at', null);

    const current = count || 0;
    const max = workspace.max_members || PLAN_CONFIG[workspace.plan]?.maxMembers || 5;
    const plan = PLAN_CONFIG[workspace.plan];

    return {
        allowed: current < max,
        current,
        max,
        planName: plan?.name || workspace.plan,
        upgradeRequired: current >= max,
    };
}

/**
 * Check if a workspace can create more spaces
 */
export async function checkSpaceLimit(
    supabase: any,
    workspaceId: string,
): Promise<LimitCheckResult> {
    const { data: workspace } = await supabase
        .from('workspaces')
        .select('plan, max_spaces')
        .eq('id', workspaceId)
        .single();

    if (!workspace) return { allowed: false, current: 0, max: 0, planName: 'unknown', upgradeRequired: false };

    const { count } = await supabase
        .from('spaces')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .is('archived_at', null);

    const current = count || 0;
    const max = workspace.max_spaces || PLAN_CONFIG[workspace.plan]?.maxSpaces || 1;
    const plan = PLAN_CONFIG[workspace.plan];

    return {
        allowed: current < max,
        current,
        max,
        planName: plan?.name || workspace.plan,
        upgradeRequired: current >= max,
    };
}

/**
 * Check if a space can have more rooms
 */
export async function checkRoomLimit(
    supabase: any,
    spaceId: string,
): Promise<LimitCheckResult> {
    // Get space → workspace → plan
    const { data: space } = await supabase
        .from('spaces')
        .select('workspace_id')
        .eq('id', spaceId)
        .single();

    if (!space) return { allowed: false, current: 0, max: 0, planName: 'unknown', upgradeRequired: false };

    const { data: workspace } = await supabase
        .from('workspaces')
        .select('plan, max_rooms_per_space')
        .eq('id', space.workspace_id)
        .single();

    if (!workspace) return { allowed: false, current: 0, max: 0, planName: 'unknown', upgradeRequired: false };

    const { count } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('space_id', spaceId)
        .is('deleted_at', null);

    const current = count || 0;
    const max = workspace.max_rooms_per_space || PLAN_CONFIG[workspace.plan]?.maxRoomsPerSpace || 5;
    const plan = PLAN_CONFIG[workspace.plan];

    return {
        allowed: current < max,
        current,
        max,
        planName: plan?.name || workspace.plan,
        upgradeRequired: current >= max,
    };
}
