'use client';

import { useState } from 'react';
import { DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';

export default function RevenuePage() {
    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Revenue</h1>
                <p className="text-sm text-slate-400 mt-1">Guadagni, piani e andamenti</p>
            </div>

            {/* Placeholder — will be connected to billing_events API */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">MRR</p>
                    <p className="text-3xl font-bold text-white mt-1">€0.00</p>
                    <p className="text-xs text-slate-500 mt-2">Nessun pagamento registrato</p>
                </div>
                <div className="rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">ARR</p>
                    <p className="text-3xl font-bold text-white mt-1">€0.00</p>
                    <p className="text-xs text-slate-500 mt-2">Annual Recurring Revenue</p>
                </div>
                <div className="rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Clienti Paganti</p>
                    <p className="text-3xl font-bold text-white mt-1">0</p>
                    <p className="text-xs text-slate-500 mt-2">Workspace con piano a pagamento</p>
                </div>
            </div>

            <div className="rounded-2xl border border-white/5 p-8 text-center" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                <TrendingUp className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                <h3 className="text-lg font-semibold text-white mb-2">Revenue Tracking</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                    Quando integrerai un payment provider (Stripe, Paddle, etc.), i dati di revenue
                    appariranno qui automaticamente tramite webhook nella tabella <code className="text-cyan-400">billing_events</code>.
                </p>
                <p className="text-xs text-slate-500 mt-4">
                    Puoi anche inserire dati manualmente tramite l'API <code className="text-cyan-400">/api/admin/billing</code>
                </p>
            </div>
        </div>
    );
}
