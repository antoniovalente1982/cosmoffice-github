'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '../utils/supabase/client';
import {
    CurrencyCode, CURRENCIES, getCurrencySymbol, getCurrencyInfo,
    formatAmount, convertFromEUR, fetchExchangeRates,
} from '../lib/currency';

export { CURRENCIES, getCurrencySymbol, getCurrencyInfo, formatAmount, convertFromEUR };
export type { CurrencyCode };

/**
 * Hook to load and manage the platform currency setting.
 * Fetches live exchange rates from ECB and converts EUR-stored amounts.
 */
export function useCurrency() {
    const [currency, setCurrencyState] = useState<CurrencyCode>('EUR');
    const [rates, setRates] = useState<Record<string, number>>({ EUR: 1 });
    const [loading, setLoading] = useState(true);
    const loadedRef = useRef(false);

    useEffect(() => {
        if (loadedRef.current) return;
        loadedRef.current = true;

        const load = async () => {
            const supabase = createClient();

            // Load saved currency preference
            const { data } = await supabase
                .from('platform_settings')
                .select('value')
                .eq('key', 'currency')
                .single();

            if (data?.value) {
                // JSONB returns the value directly (no extra quotes)
                let code: string;
                if (typeof data.value === 'string') {
                    code = data.value.replace(/"/g, '');
                } else {
                    code = String(data.value).replace(/"/g, '');
                }
                if (CURRENCIES.find(c => c.code === code)) {
                    setCurrencyState(code as CurrencyCode);
                }
            }

            // Fetch today's exchange rates
            const exchangeRates = await fetchExchangeRates();
            setRates(exchangeRates);

            setLoading(false);
        };
        load();
    }, []);

    const setCurrency = useCallback(async (code: CurrencyCode) => {
        setCurrencyState(code);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // Store as raw JSONB value (not JSON.stringify'd)
        await supabase.from('platform_settings').upsert({
            key: 'currency',
            value: code,
            updated_at: new Date().toISOString(),
            updated_by: user?.id,
        });
    }, []);

    const rate = rates[currency] || 1;
    const symbol = getCurrencySymbol(currency);
    const info = getCurrencyInfo(currency);

    /**
     * Format EUR cents → converted & formatted in the selected currency.
     * @param eurCents - Amount in EUR cents (as stored in DB)
     */
    const fmt = useCallback((eurCents: number) => {
        const converted = convertFromEUR(eurCents, rate);
        return formatAmount(converted, currency);
    }, [currency, rate]);

    /**
     * Get the currency symbol for display (e.g. in labels like "€/utente").
     */
    const cs = symbol;

    /**
     * Convert EUR cents to the display currency and return just the number string.
     */
    const fmtRaw = useCallback((eurCents: number) => {
        const converted = convertFromEUR(eurCents, rate);
        return formatAmount(converted, currency, false);
    }, [currency, rate]);

    return {
        currency,
        setCurrency,
        symbol: cs,
        fmt,
        fmtRaw,
        rate,
        rates,
        info,
        loading,
    };
}
