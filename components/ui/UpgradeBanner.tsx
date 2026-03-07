'use client';

import { AlertTriangle, ArrowRight } from 'lucide-react';

interface UpgradeBannerProps {
    currentCount: number;
    maxCount: number;
    planName: string;
    className?: string;
}

export default function UpgradeBanner({ currentCount, maxCount, planName, className = '' }: UpgradeBannerProps) {
    return (
        <div className={`p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 ${className}`}>
            <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                    <p className="text-sm text-amber-200 font-semibold">
                        Limite raggiunto ({currentCount}/{maxCount})
                    </p>
                    <p className="text-xs text-amber-300/70">
                        Hai raggiunto il limite di {maxCount} persone per il piano <strong>{planName}</strong>.
                        Per aggiungere più persone, richiedi un upgrade.
                    </p>
                    {/* Usage bar */}
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                            width: `${Math.min(100, (currentCount / Math.max(maxCount, 1)) * 100)}%`,
                            height: '100%', borderRadius: 3,
                            background: currentCount >= maxCount ? '#ef4444' : '#f59e0b',
                        }} />
                    </div>
                    <a href="mailto:support@cosmoffice.io?subject=Richiesta%20Upgrade%20Piano"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 transition-opacity mt-1">
                        Richiedi Upgrade <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                </div>
            </div>
        </div>
    );
}
