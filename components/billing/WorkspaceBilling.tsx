'use client';

import { useEffect, useState } from 'react';
import {
    CreditCard, ArrowRight, Users, Building2, Box,
    Crown, Zap, BarChart2, Loader2, ExternalLink, AlertTriangle,
} from 'lucide-react';

interface PlanStatus {
    plan: { key: string; name: string; monthlyPriceEur: number };
    limits: { maxMembers: number; maxSpaces: number; maxRoomsPerSpace: number; storageQuotaBytes: number };
    usage: { members: number; spaces: number };
    subscription: { status: string; hasCustomer: boolean; trialEndsAt: string | null };
    isOwner: boolean;
}

function UsageBar({ current, max, label, icon: Icon, color }: {
    current: number; max: number; label: string; icon: any; color: string;
}) {
    const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
    const isNearLimit = pct >= 80;
    const isAtLimit = pct >= 100;

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                    <span className="text-xs text-slate-400">{label}</span>
                </div>
                <span className={`text-xs font-bold ${isAtLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-slate-300'}`}>
                    {current}/{max}
                </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : `bg-gradient-to-r ${color === 'text-cyan-400' ? 'from-cyan-500 to-blue-500' : 'from-purple-500 to-indigo-500'}`}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

const statusLabels: Record<string, { label: string; color: string }> = {
    none: { label: 'Nessuno', color: 'text-slate-400' },
    active: { label: 'Attivo', color: 'text-emerald-400' },
    trialing: { label: 'Trial', color: 'text-cyan-400' },
    past_due: { label: 'Pagamento scaduto', color: 'text-red-400' },
    canceled: { label: 'Cancellato', color: 'text-amber-400' },
    incomplete: { label: 'Incompleto', color: 'text-amber-400' },
};

const planColors: Record<string, string> = {
    free: 'from-slate-500/20 to-slate-600/20 border-slate-500/20',
    starter: 'from-blue-500/20 to-cyan-500/20 border-blue-500/20',
    pro: 'from-purple-500/20 to-indigo-500/20 border-purple-500/20',
    enterprise: 'from-amber-500/20 to-orange-500/20 border-amber-500/20',
};

export default function WorkspaceBilling({ workspaceId }: { workspaceId: string }) {
    const [status, setStatus] = useState<PlanStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
    const [portalLoading, setPortalLoading] = useState(false);

    useEffect(() => {
        fetch(`/api/stripe/plan-status?workspaceId=${workspaceId}`)
            .then(r => r.json())
            .then(data => { setStatus(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [workspaceId]);

    const handleUpgrade = async (planKey: string) => {
        setUpgradeLoading(planKey);
        try {
            const res = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId, planKey }),
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else alert(data.error || 'Errore');
        } catch { alert('Errore di rete'); }
        setUpgradeLoading(null);
    };

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

    return (
        <div className="space-y-4">
            {/* Current Plan Card */}
            <div className={`rounded-2xl border bg-gradient-to-br p-5 ${planColors[status.plan.key] || planColors.free}`}
                style={{ background: 'rgba(15, 23, 42, 0.7)' }}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                            <Crown className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Piano {status.plan.name}</h3>
                            <p className={`text-xs font-semibold ${s.color}`}>
                                {s.label}
                                {status.subscription.trialEndsAt && (
                                    <span className="text-slate-500 ml-2">
                                        scade {new Date(status.subscription.trialEndsAt).toLocaleDateString('it-IT')}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-extrabold text-white">€{status.plan.monthlyPriceEur}</p>
                        {status.plan.monthlyPriceEur > 0 && <p className="text-[10px] text-slate-500">/mese</p>}
                    </div>
                </div>

                {/* Usage Bars */}
                <div className="space-y-3">
                    <UsageBar
                        current={status.usage.members}
                        max={status.limits.maxMembers}
                        label="Membri"
                        icon={Users}
                        color="text-cyan-400"
                    />
                    <UsageBar
                        current={status.usage.spaces}
                        max={status.limits.maxSpaces}
                        label="Uffici"
                        icon={Building2}
                        color="text-purple-400"
                    />
                </div>

                {/* Near limit warning */}
                {(status.usage.members >= status.limits.maxMembers || status.usage.spaces >= status.limits.maxSpaces) && (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <p className="text-xs text-amber-300">Hai raggiunto il limite del piano. Fai upgrade per continuare a crescere.</p>
                    </div>
                )}
            </div>

            {/* Actions */}
            {status.isOwner && (
                <div className="flex gap-3">
                    {status.plan.key === 'free' ? (
                        <>
                            <button
                                onClick={() => handleUpgrade('starter')}
                                disabled={!!upgradeLoading}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 transition-all shadow-lg shadow-blue-500/20"
                            >
                                {upgradeLoading === 'starter' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                Upgrade a Starter
                            </button>
                            <button
                                onClick={() => handleUpgrade('pro')}
                                disabled={!!upgradeLoading}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 transition-all shadow-lg shadow-purple-500/20"
                            >
                                {upgradeLoading === 'pro' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                                Upgrade a Pro
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handlePortal}
                            disabled={portalLoading}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                        >
                            {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                            Gestisci Abbonamento
                            <ExternalLink className="w-3 h-3" />
                        </button>
                    )}
                </div>
            )}

            {/* See all plans */}
            <a
                href="/pricing"
                target="_blank"
                className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
                <BarChart2 className="w-3.5 h-3.5" />
                Confronta tutti i piani
                <ArrowRight className="w-3 h-3" />
            </a>
        </div>
    );
}
