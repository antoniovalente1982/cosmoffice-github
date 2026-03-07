/**
 * Plan Gate — Client-side feature access control
 * 
 * Plans: 'free' | 'team_10' | 'team_25' | 'team_50' | 'enterprise'
 * Guest count is INCLUDED in total people count (max_members + max_guests)
 */

export type PlanType = 'free' | 'team_10' | 'team_25' | 'team_50' | 'enterprise';

export const PLAN_DISPLAY: Record<PlanType, { name: string; maxPeople: number | null }> = {
    free: { name: 'Free', maxPeople: 3 },
    team_10: { name: 'Team 10', maxPeople: 10 },
    team_25: { name: 'Team 25', maxPeople: 25 },
    team_50: { name: 'Team 50', maxPeople: 50 },
    enterprise: { name: 'Enterprise', maxPeople: null }, // unlimited
};

// Feature access — Free = chat only
export function canUseVideo(plan: string): boolean {
    return plan !== 'free';
}

export function canUseMic(plan: string): boolean {
    return plan !== 'free';
}

export function canUseScreenShare(plan: string): boolean {
    return plan !== 'free';
}

export function isFreePlan(plan: string): boolean {
    return plan === 'free';
}

export function isPaidPlan(plan: string): boolean {
    return plan !== 'free';
}

// SuperAdmin always bypasses all limits
export function isSuperAdmin(profile: { is_super_admin?: boolean } | null): boolean {
    return profile?.is_super_admin === true;
}

/**
 * Check if total people (members + guests) is within workspace limit
 * For manual plans, the limit is stored in max_members (total people cap)
 */
export function canAddPerson(
    currentMembers: number,
    currentGuests: number,
    maxPeople: number,
): boolean {
    if (maxPeople <= 0) return true; // unlimited (enterprise)
    return (currentMembers + currentGuests) < maxPeople;
}

/**
 * Get upgrade message based on current plan
 */
export function getUpgradeMessage(plan: string): string {
    if (plan === 'free') {
        return 'Passa a un piano a pagamento per sbloccare video, microfono e screen share.';
    }
    return 'Contatta il team per un upgrade del piano.';
}
