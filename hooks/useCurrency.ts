'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../utils/supabase/client';
import { CurrencyCode, CURRENCIES, getCurrencySymbol, formatCurrency, fc } from '../lib/currency';

export { CURRENCIES, getCurrencySymbol, formatCurrency, fc };
export type { CurrencyCode };

/**
 * Hook to load and manage the platform currency setting.
 * Returns the current currency code, symbol, format helper, and a setter.
 */
export function useCurrency() {
    const [currency, setCurrencyState] = useState<CurrencyCode>('EUR');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const supabase = createClient();
            const { data } = await supabase
                .from('platform_settings')
                .select('value')
                .eq('key', 'currency')
                .single();
            if (data?.value) {
                // value is stored as JSON string like "EUR"
                const val = typeof data.value === 'string' ? data.value : JSON.stringify(data.value);
                const code = val.replace(/"/g, '') as CurrencyCode;
                if (CURRENCIES.find(c => c.code === code)) {
                    setCurrencyState(code);
                }
            }
            setLoading(false);
        };
        load();
    }, []);

    const setCurrency = async (code: CurrencyCode) => {
        setCurrencyState(code);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('platform_settings').upsert({
            key: 'currency',
            value: JSON.stringify(code),
            updated_at: new Date().toISOString(),
            updated_by: user?.id,
        });
    };

    const symbol = getCurrencySymbol(currency);
    const fmt = (cents: number) => fc(cents, currency);
    const fmtRaw = (cents: number) => formatCurrency(cents, currency, false);

    return { currency, setCurrency, symbol, fmt, fmtRaw, loading };
}
