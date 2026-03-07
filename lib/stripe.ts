import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
    if (!_stripe) {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
        }
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2024-12-18.acacia',
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
// Maps internal plan names to Stripe Price IDs.
// Set these in your .env.local after creating products in Stripe Dashboard.
export const PLAN_CONFIG: Record<string, {
    name: string;
    stripePriceId: string;
    maxMembers: number;
    maxSpaces: number;
    maxRoomsPerSpace: number;
    storageQuotaBytes: number;
    monthlyPriceEur: number;
}> = {
    free: {
        name: 'Free',
        stripePriceId: '', // No Stripe price for free
        maxMembers: 5,
        maxSpaces: 1,
        maxRoomsPerSpace: 5,
        storageQuotaBytes: 512 * 1024 * 1024, // 512MB
        monthlyPriceEur: 0,
    },
    starter: {
        name: 'Starter',
        stripePriceId: process.env.STRIPE_PRICE_STARTER || '',
        maxMembers: 15,
        maxSpaces: 3,
        maxRoomsPerSpace: 10,
        storageQuotaBytes: 2 * 1024 * 1024 * 1024, // 2GB
        monthlyPriceEur: 19,
    },
    pro: {
        name: 'Pro',
        stripePriceId: process.env.STRIPE_PRICE_PRO || '',
        maxMembers: 50,
        maxSpaces: 10,
        maxRoomsPerSpace: 25,
        storageQuotaBytes: 10 * 1024 * 1024 * 1024, // 10GB
        monthlyPriceEur: 49,
    },
    enterprise: {
        name: 'Enterprise',
        stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE || '',
        maxMembers: 200,
        maxSpaces: 50,
        maxRoomsPerSpace: 100,
        storageQuotaBytes: 50 * 1024 * 1024 * 1024, // 50GB
        monthlyPriceEur: 149,
    },
};

export function getPlanByPriceId(priceId: string): string | null {
    for (const [planKey, config] of Object.entries(PLAN_CONFIG)) {
        if (config.stripePriceId === priceId) return planKey;
    }
    return null;
}
