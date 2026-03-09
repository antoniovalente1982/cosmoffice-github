import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
    if (!_stripe) {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
        }
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2026-02-25.clover',
            typescript: true,
        });
    }
    return _stripe;
}

// Backward-compatible alias
export const stripe = new Proxy({} as Stripe, {
    get: (_, prop) => {
        return (getStripe() as any)[prop];
    },
});

// ─── Plan Configuration ────────────────────────────────
// Single per-user pricing model: €30 + IVA per user/month
// SuperAdmin manages max_members and price_per_seat per workspace.
// The PLAN_CONFIG below defines the DEFAULT plan settings.
// Actual limits are stored in the workspace table (managed by SuperAdmin).

export const DEFAULT_PRICE_PER_USER_EUR = 30; // €30 + IVA

export const PLAN_CONFIG: Record<string, {
    name: string;
    stripePriceId: string;
    maxMembers: number;
    maxSpaces: number;
    maxRoomsPerSpace: number;
    storageQuotaBytes: number;
    monthlyPricePerUserEur: number;
}> = {
    // Demo workspaces created by SuperAdmin for testing — no billing
    demo: {
        name: 'Demo',
        stripePriceId: '',
        maxMembers: 3,
        maxSpaces: 1,
        maxRoomsPerSpace: 5,
        storageQuotaBytes: 512 * 1024 * 1024, // 512MB
        monthlyPricePerUserEur: 0,
    },
    // Premium paid workspaces — per-user billing
    premium: {
        name: 'Premium',
        stripePriceId: process.env.STRIPE_PRICE_PER_USER || '',
        maxMembers: 10, // Default, SuperAdmin overrides via workspace.max_members
        maxSpaces: 50,
        maxRoomsPerSpace: 100,
        storageQuotaBytes: 50 * 1024 * 1024 * 1024, // 50GB
        monthlyPricePerUserEur: DEFAULT_PRICE_PER_USER_EUR,
    },
};

// Legacy compatibility: map old plan names to new ones
export function normalizePlanKey(plan: string): string {
    if (plan === 'premium' || plan === 'demo') return plan;
    // Map old plans to 'premium' (they were all paid)
    if (['active', 'starter', 'pro', 'team_10', 'team_25', 'team_50', 'team_100', 'enterprise'].includes(plan)) return 'premium';
    if (plan === 'free') return 'demo';
    return 'demo';
}

export function getPlanByPriceId(priceId: string): string | null {
    for (const [planKey, config] of Object.entries(PLAN_CONFIG)) {
        if (config.stripePriceId === priceId) return planKey;
    }
    return null;
}
