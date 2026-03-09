/**
 * Plan Limits Enforcement Utilities
 * Reads limits directly from workspace DB columns (no Stripe dependency)
 * 
 * Plans: 'demo' | 'premium'
 * Limits are stored per-workspace in DB columns, set by SuperAdmin.
 */

export type LimitCheckResult = {
    allowed: boolean;
    current: number;
    max: number;
    planName: string;
    upgradeRequired: boolean;
};

/**
 * Check if a workspace can add more members/guests (total people)
 * In manual plan model, max_members = total people cap (members + guests)
 */
export async function checkPeopleLimit(
    supabase: any,
    workspaceId: string,
): Promise<LimitCheckResult> {
    const { data: workspace } = await supabase
        .from('workspaces')
        .select('plan, max_members')
        .eq('id', workspaceId)
        .single();

    if (!workspace) return { allowed: false, current: 0, max: 0, planName: 'unknown', upgradeRequired: false };

    // Unlimited if max_members is 0 or negative
    if (workspace.max_members <= 0) {
        return { allowed: true, current: 0, max: 999, planName: workspace.plan || 'demo', upgradeRequired: false };
    }

    const { count: memberCount } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .is('removed_at', null);

    const current = memberCount || 0;
    const max = workspace.max_members || 3;

    return {
        allowed: current < max,
        current,
        max,
        planName: workspace.plan || 'demo',
        upgradeRequired: current >= max,
    };
}

// Keep legacy name for backwards compatibility
export const checkMemberLimit = checkPeopleLimit;

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

    // Unlimited if max_spaces is 0 or negative
    if (workspace.max_spaces <= 0) {
        return { allowed: true, current: 0, max: 999, planName: workspace.plan || 'demo', upgradeRequired: false };
    }

    const { count } = await supabase
        .from('spaces')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .is('archived_at', null);

    const current = count || 0;
    const max = workspace.max_spaces || 1;

    return {
        allowed: current < max,
        current,
        max,
        planName: workspace.plan || 'demo',
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

    // Unlimited if max_rooms_per_space is 0 or negative
    if (workspace.max_rooms_per_space <= 0) {
        return { allowed: true, current: 0, max: 999, planName: workspace.plan || 'demo', upgradeRequired: false };
    }

    const { count } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('space_id', spaceId)
        .is('deleted_at', null);

    const current = count || 0;
    const max = workspace.max_rooms_per_space || 5;

    return {
        allowed: current < max,
        current,
        max,
        planName: workspace.plan || 'demo',
        upgradeRequired: current >= max,
    };
}
