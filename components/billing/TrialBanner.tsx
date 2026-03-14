'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, ArrowRight, X } from 'lucide-react';

interface TrialBannerProps {
    workspaceId: string;
}

export function TrialBanner({ workspaceId }: TrialBannerProps) {
    const [daysLeft, setDaysLeft] = useState<number | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const fetchTrialStatus = async () => {
            try {
                const res = await fetch(`/api/stripe/plan-status?workspaceId=${workspaceId}`);
                if (!res.ok) return;
                const data = await res.json();

                if (data.subscription?.status === 'trialing' && data.subscription?.trialEndsAt) {
                    const endDate = new Date(data.subscription.trialEndsAt);
                    const now = new Date();
                    const diff = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    setDaysLeft(Math.max(0, diff));
                }
            } catch { /* silent */ }
        };
        fetchTrialStatus();
    }, [workspaceId]);

    // Don't render if no trial, expired, or dismissed
    if (daysLeft === null || dismissed) return null;

    const isUrgent = daysLeft <= 3;
    const isWarning = daysLeft <= 7 && !isUrgent;

    const bgClass = isUrgent
        ? 'from-red-500/20 to-orange-500/20 border-red-500/30'
        : isWarning
            ? 'from-amber-500/20 to-yellow-500/20 border-amber-500/30'
            : 'from-cyan-500/15 to-blue-500/15 border-cyan-500/20';

    const textClass = isUrgent ? 'text-red-300' : isWarning ? 'text-amber-300' : 'text-cyan-300';
    const iconColor = isUrgent ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-cyan-400';

    return (
        <div className={`relative flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r ${bgClass} border animate-in fade-in slide-in-from-top-2 duration-300`}>
            <div className={`shrink-0 ${iconColor}`}>
                {isUrgent ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${textClass}`}>
                    {daysLeft === 0
                        ? 'Il trial scade oggi!'
                        : daysLeft === 1
                            ? 'Il trial scade domani!'
                            : `${daysLeft} giorni rimasti nel trial`}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                    {isUrgent
                        ? 'Effettua l\'upgrade per non perdere l\'accesso'
                        : 'Passa a un piano a pagamento per continuare senza interruzioni'}
                </p>
            </div>
            <button
                onClick={() => window.location.href = `/api/stripe/portal?workspaceId=${workspaceId}`}
                className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold ${textClass} bg-white/10 hover:bg-white/20 transition-all border border-white/10`}
            >
                Upgrade <ArrowRight className="w-3 h-3" />
            </button>
            <button
                onClick={() => setDismissed(true)}
                className="shrink-0 p-1 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors"
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
}
