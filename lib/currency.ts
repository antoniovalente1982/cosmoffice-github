// Centralized currency formatting utility
// Currency is stored in platform_settings table, key='currency'
// All DB amounts are stored in EUR cents — conversion happens at display time

export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'JPY' | 'CAD' | 'AUD' | 'BRL' | 'CNY' | 'INR';

export const CURRENCIES: { code: CurrencyCode; symbol: string; label: string; flag: string }[] = [
    { code: 'EUR', symbol: '€', label: 'Euro', flag: '🇪🇺' },
    { code: 'USD', symbol: '$', label: 'Dollaro USA', flag: '🇺🇸' },
    { code: 'GBP', symbol: '£', label: 'Sterlina', flag: '🇬🇧' },
    { code: 'CHF', symbol: 'Fr', label: 'Franco Svizzero', flag: '🇨🇭' },
    { code: 'JPY', symbol: '¥', label: 'Yen', flag: '🇯🇵' },
    { code: 'CAD', symbol: 'C$', label: 'Dollaro Canadese', flag: '🇨🇦' },
    { code: 'AUD', symbol: 'A$', label: 'Dollaro Australiano', flag: '🇦🇺' },
    { code: 'BRL', symbol: 'R$', label: 'Real Brasiliano', flag: '🇧🇷' },
    { code: 'CNY', symbol: '¥', label: 'Yuan Cinese', flag: '🇨🇳' },
    { code: 'INR', symbol: '₹', label: 'Rupia Indiana', flag: '🇮🇳' },
];

export function getCurrencySymbol(code: CurrencyCode): string {
    return CURRENCIES.find(c => c.code === code)?.symbol || '€';
}

export function getCurrencyInfo(code: CurrencyCode) {
    return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
}

/**
 * Format an amount (already in target currency units) to a display string.
 * Uses Italian number formatting: 1.000.000,00
 * @param amount - Amount in minor units (cents/pence/etc)
 * @param currencyCode - Currency code
 * @param showSymbol - Whether to prepend the symbol
 */
export function formatAmount(amount: number, currencyCode: CurrencyCode = 'EUR', showSymbol = true): string {
    const symbol = getCurrencySymbol(currencyCode);
    const decimals = currencyCode === 'JPY' ? 0 : 2;
    const num = amount / 100;
    const formatted = new Intl.NumberFormat('it-IT', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num);
    return showSymbol ? `${symbol}${formatted}` : formatted;
}

/**
 * Format a plain number with Italian locale (1.000.000)
 * @param n - The number to format
 * @param decimals - Number of decimal places (default: 0)
 */
export function formatNumber(n: number, decimals = 0): string {
    return new Intl.NumberFormat('it-IT', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(n);
}

/**
 * Format EUR cents to Italian display string (e.g. "€1.440,00")
 * Standalone function for use outside React hooks (APIs, server-side).
 */
export function formatEurCents(cents: number): string {
    return formatAmount(cents, 'EUR', true);
}

/**
 * Convert EUR cents to target currency cents using an exchange rate.
 */
export function convertFromEUR(eurCents: number, rate: number): number {
    return Math.round(eurCents * rate);
}

// Cache for exchange rates (key = date string, value = rates map)
let ratesCache: { date: string; rates: Record<string, number> } | null = null;

/**
 * Fetch today's exchange rates from ECB via frankfurter.app (free, no key needed).
 * Returns rates relative to EUR (EUR = 1.0).
 * Results are cached per day.
 */
export async function fetchExchangeRates(): Promise<Record<string, number>> {
    const today = new Date().toISOString().split('T')[0];

    // Return cached if same day
    if (ratesCache && ratesCache.date === today) {
        return ratesCache.rates;
    }

    try {
        const codes = CURRENCIES.filter(c => c.code !== 'EUR').map(c => c.code).join(',');
        const res = await fetch(`https://api.frankfurter.app/latest?from=EUR&to=${codes}`);
        if (!res.ok) throw new Error('Exchange rate API error');
        const data = await res.json();
        const rates: Record<string, number> = { EUR: 1.0, ...data.rates };
        ratesCache = { date: today, rates };
        return rates;
    } catch {
        // Fallback: return 1:1 for all (display in EUR)
        const fallback: Record<string, number> = {};
        CURRENCIES.forEach(c => { fallback[c.code] = 1.0; });
        return fallback;
    }
}
