'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, RefreshCw } from 'lucide-react';
import { useCurrency, CURRENCIES, CurrencyCode } from '../hooks/useCurrency';

/**
 * Beautiful currency selector — shows flag, code, rate.
 * Drop-in for admin/superadmin sidebars.
 */
export default function CurrencySelector() {
    const { currency, setCurrency, rate, rates, loading } = useCurrency();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const current = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];

    return (
        <div ref={ref} className="relative px-2 pt-1">
            {/* Trigger button */}
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium
                    bg-black/20 border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all cursor-pointer"
            >
                <span className="text-base leading-none">{current.flag}</span>
                <span className="text-white font-semibold">{current.code}</span>
                {currency !== 'EUR' && (
                    <span className="text-slate-500 text-[10px]">
                        1€ = {rates[currency]?.toFixed(2) || '...'} {current.symbol}
                    </span>
                )}
                <ChevronDown className={`w-3 h-3 text-slate-500 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute bottom-full left-2 right-2 mb-1 rounded-xl border border-white/10 overflow-hidden shadow-2xl shadow-black/40 z-50"
                    style={{ background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(20px)' }}>
                    <div className="px-3 py-2 border-b border-white/5">
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Valuta di riferimento</p>
                    </div>
                    <div className="max-h-[280px] overflow-y-auto py-1">
                        {CURRENCIES.map(c => {
                            const isActive = c.code === currency;
                            const rateVal = rates[c.code];
                            return (
                                <button
                                    key={c.code}
                                    onClick={() => { setCurrency(c.code); setOpen(false); }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-all ${isActive
                                            ? 'bg-cyan-500/10 text-cyan-300'
                                            : 'text-slate-300 hover:bg-white/5'
                                        }`}
                                >
                                    <span className="text-base leading-none w-5 text-center">{c.flag}</span>
                                    <span className={`font-semibold w-8 ${isActive ? 'text-cyan-300' : 'text-white'}`}>
                                        {c.code}
                                    </span>
                                    <span className="text-slate-500 flex-1 text-left truncate">{c.label}</span>
                                    {c.code !== 'EUR' && rateVal && (
                                        <span className="text-[10px] text-slate-600 tabular-nums">
                                            {rateVal.toFixed(2)}
                                        </span>
                                    )}
                                    {isActive && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                                </button>
                            );
                        })}
                    </div>
                    <div className="px-3 py-1.5 border-t border-white/5 flex items-center gap-1.5">
                        <RefreshCw className="w-2.5 h-2.5 text-slate-600" />
                        <span className="text-[9px] text-slate-600">Tassi ECB aggiornati oggi</span>
                    </div>
                </div>
            )}
        </div>
    );
}
