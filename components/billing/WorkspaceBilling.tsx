'use client';

import { useEffect, useState } from 'react';
import {
    CreditCard, Users, Crown, Loader2, ExternalLink, Activity,
    CheckCircle2,
} from 'lucide-react';

interface PlanStatus {
    plan: { key: string; name: string; monthlyPricePerUserEur: number };
    limits: { maxCapacity: number; maxSpaces: number; maxRoomsPerSpace: number; storageQuotaBytes: number };
    usage: { members: number; spaces: number };
    subscription: { status: string; hasCustomer: boolean; trialEndsAt: string | null };
    isOwner: boolean;
}

const statusLabels: Record<string, { label: string; color: string }> = {
    none: { label: 'Nessuno', color: 'text-slate-400' },
    active: { label: 'Attivo', color: 'text-emerald-400' },
    trialing: { label: 'Trial', color: 'text-cyan-400' },
    past_due: { label: 'Pagamento scaduto', color: 'text-red-400' },
    canceled: { label: 'Cancellato', color: 'text-amber-400' },
    incomplete: { label: 'Incompleto', color: 'text-amber-400' },
};

export default function WorkspaceBilling({ workspaceId }: { workspaceId: string }) {
    const [status, setStatus] = useState<PlanStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [portalLoading, setPortalLoading] = useState(false);

    useEffect(() => {
        fetch(`/api/stripe/plan-status?workspaceId=${workspaceId}`)
            .then(r => r.json())
            .then(data => { setStatus(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [workspaceId]);

    const handlePortal = async () => {
        setPortalLoading(true);
        try {
            const res = await fetch('/api/stripe/portal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId }),
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else alert(data.error || 'Errore');
        } catch { alert('Errore di rete'); }
        setPortalLoading(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
        );
    }

    if (!status) return null;

    const s = statusLabels[status.subscription.status] || statusLabels.none;
    const monthlyCost = status.limits.maxCapacity * (status.plan.monthlyPricePerUserEur || 30);

    return (
        <div className="space-y-4">
            {/* Current Plan Card */}
            <div
                className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 p-5 shadow-[0_0_30px_rgba(6,182,212,0.1)]"
                style={{ background: 'rgba(15, 23, 42, 0.7)' }}
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/5 box-shadow-glow">
                            <Crown className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Piano {status.plan.name}</h3>
                            <p className={`text-xs font-semibold ${s.color}`}>{s.label}</p>
                        </div>
                    </div>
                    <div className="sm:text-right border-t sm:border-t-0 border-white/10 pt-3 sm:pt-0">
                        <p className="text-2xl font-extrabold text-white">€{monthlyCost}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mt-1">
                            {status.limits.maxCapacity} {status.limits.maxCapacity === 1 ? 'accesso' : 'accessi'} × €{status.plan.monthlyPricePerUserEur || 30}/mese
                        </p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mt-5">
                    <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                        <div className="flex items-center gap-2 mb-1">
                            <Users className="w-4 h-4 text-cyan-400" />
                            <span className="text-xs font-semibold text-slate-300">Membri Registrati</span>
                        </div>
                        <p className="text-xl font-bold text-white">{status.usage.members}</p>
                        <p className="text-[10px] text-emerald-400/80 mt-1 font-medium">Inviti e membri illimitati</p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                        <div className="flex items-center gap-2 mb-1">
                            <Activity className="w-4 h-4 text-purple-400" />
                            <span className="text-xs font-semibold text-slate-300">Posti Acquistati</span>
                        </div>
                        <p className="text-xl font-bold text-white">{status.limits.maxCapacity}</p>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">Accessi simultanei nell'ufficio</p>
                    </div>
                </div>
            </div>

            {/* Features */}
            <div className="rounded-2xl border border-white/5 p-4 space-y-2" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Incluso nel piano</h4>
                {[
                    'Video/Audio HD illimitato',
                    'Screen sharing',
                    'Chat in tempo reale',
                    'Stanze personalizzabili',
                    'Lavagna collaborativa',
                    'Logo personalizzato',
                ].map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-xs text-slate-300">{feature}</span>
                    </div>
                ))}
            </div>

            {/* Actions */}
            {status.isOwner && status.subscription.hasCustomer && (
                <button
                    onClick={handlePortal}
                    disabled={portalLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                >
                    {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    Gestisci Abbonamento
                    <ExternalLink className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}
