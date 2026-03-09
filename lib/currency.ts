// Centralized currency formatting utility
// Currency is stored in platform_settings table, key='currency'

export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'JPY' | 'CAD' | 'AUD' | 'BRL' | 'CNY' | 'INR';

export const CURRENCIES: { code: CurrencyCode; symbol: string; label: string }[] = [
    { code: 'EUR', symbol: '€', label: 'Euro (€)' },
    { code: 'USD', symbol: '$', label: 'Dollaro USA ($)' },
    { code: 'GBP', symbol: '£', label: 'Sterlina (£)' },
    { code: 'CHF', symbol: 'CHF', label: 'Franco Svizzero (CHF)' },
    { code: 'JPY', symbol: '¥', label: 'Yen (¥)' },
    { code: 'CAD', symbol: 'C$', label: 'Dollaro Canadese (C$)' },
    { code: 'AUD', symbol: 'A$', label: 'Dollaro Australiano (A$)' },
    { code: 'BRL', symbol: 'R$', label: 'Real Brasiliano (R$)' },
    { code: 'CNY', symbol: '¥', label: 'Yuan Cinese (¥)' },
    { code: 'INR', symbol: '₹', label: 'Rupia Indiana (₹)' },
];

export function getCurrencySymbol(code: CurrencyCode): string {
    return CURRENCIES.find(c => c.code === code)?.symbol || '€';
}

/**
 * Format cents to a currency string.
 * @param cents - Amount in cents (e.g. 3000 = 30.00)
 * @param currencyCode - Currency code (default EUR)
 * @param showSymbol - Whether to prepend the symbol (default true)
 */
export function formatCurrency(cents: number, currencyCode: CurrencyCode = 'EUR', showSymbol = true): string {
    const symbol = getCurrencySymbol(currencyCode);
    // JPY has no decimals
    const decimals = currencyCode === 'JPY' ? 0 : 2;
    const formatted = (cents / 100).toFixed(decimals);
    return showSymbol ? `${symbol}${formatted}` : formatted;
}

/**
 * Shorthand: format cents with symbol prefix
 */
export function fc(cents: number, currencyCode: CurrencyCode = 'EUR'): string {
    return formatCurrency(cents, currencyCode);
}
