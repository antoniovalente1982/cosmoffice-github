/**
 * Plan Gate — Client-side feature access control
 * 
 * Plans: 'demo' | 'premium'
 * - demo: limited features (chat only, basic access)
 * - premium: full features (video, mic, screen share, etc.)
 * 
 * Limits are stored in workspace DB columns (max_members, max_spaces, etc.)
 * NOT derived from plan name — SuperAdmin sets them per-workspace.
 */

export type PlanType = 'demo' | 'premium';

export const PLAN_DISPLAY: Record<PlanType, { name: string; icon: string }> = {
    demo: { name: 'Demo', icon: '🔹' },
    premium: { name: 'Premium', icon: '⭐' },
};

// Feature access — Demo = chat only, Premium = everything
export function canUseVideo(plan: string): boolean {
    return plan === 'premium';
}

export function canUseMic(plan: string): boolean {
    return plan === 'premium';
}

export function canUseScreenShare(plan: string): boolean {
    return plan === 'premium';
}

export function isDemoPlan(plan: string): boolean {
    return plan !== 'premium';
}

// Legacy alias
export function isFreePlan(plan: string): boolean {
    return isDemoPlan(plan);
}

export function isPaidPlan(plan: string): boolean {
    return plan === 'premium';
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
    if (maxPeople <= 0) return true; // unlimited
    return (currentMembers + currentGuests) < maxPeople;
}

/**
 * Get upgrade message based on current plan
 */
export function getUpgradeMessage(plan: string): string {
    if (plan !== 'premium') {
        return 'Passa al piano Premium per sbloccare video, microfono e screen share.';
    }
    return 'Contatta il team per modificare il tuo piano.';
}
