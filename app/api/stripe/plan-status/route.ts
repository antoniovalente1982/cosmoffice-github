import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { PLAN_CONFIG, normalizePlanKey, DEFAULT_PRICE_PER_USER_EUR } from '../../../../lib/stripe';

/**
 * GET /api/stripe/plan-status?workspaceId=xxx
 * Returns workspace plan status, limits, and usage
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

        const workspaceId = req.nextUrl.searchParams.get('workspaceId');
        if (!workspaceId) return NextResponse.json({ error: 'workspaceId richiesto' }, { status: 400 });

        // Verify membership
        const { data: member } = await supabase
            .from('workspace_members')
            .select('role')
            .eq('workspace_id', workspaceId)
            .eq('user_id', user.id)
            .single();

        if (!member) return NextResponse.json({ error: 'Non sei membro di questo workspace' }, { status: 403 });

        // Get workspace
        const { data: workspace } = await supabase
            .from('workspaces')
            .select('id, name, plan, max_capacity, max_spaces, max_rooms_per_space, storage_quota_bytes, stripe_subscription_status, stripe_customer_id, trial_ends_at, created_at')
            .eq('id', workspaceId)
            .single();

        if (!workspace) return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 });

        // Count current usage
        const { count: memberCount } = await supabase
            .from('workspace_members')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .is('removed_at', null);

        const { count: spaceCount } = await supabase
            .from('spaces')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .is('deleted_at', null)
            .is('archived_at', null);

        const normalizedPlan = normalizePlanKey(workspace.plan);
        const plan = PLAN_CONFIG[normalizedPlan] || PLAN_CONFIG.demo;

        return NextResponse.json({
            plan: {
                key: normalizedPlan,
                name: plan.name,
                monthlyPricePerUserEur: plan.monthlyPricePerUserEur || DEFAULT_PRICE_PER_USER_EUR,
            },
            limits: {
                maxCapacity: workspace.max_capacity,
                maxSpaces: workspace.max_spaces,
                maxRoomsPerSpace: workspace.max_rooms_per_space,
                storageQuotaBytes: workspace.storage_quota_bytes,
            },
            usage: {
                members: memberCount || 0,
                spaces: spaceCount || 0,
            },
            subscription: {
                status: workspace.stripe_subscription_status || 'none',
                hasCustomer: !!workspace.stripe_customer_id,
                trialEndsAt: workspace.trial_ends_at,
            },
            isOwner: member.role === 'owner',
        });
    } catch (error: any) {
        console.error('[Plan Status Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
