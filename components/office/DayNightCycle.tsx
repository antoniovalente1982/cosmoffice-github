'use client';

import { useEffect, useState, useMemo } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { getThemeConfig } from '../../lib/officeThemes';

// ============================================
// DayNightCycle — ambient time indicator + stars
// Shows current time + emoji, always-on stars (space theme)
// ============================================

function getPhaseEmoji(hour: number): string {
    if (hour >= 6 && hour < 8) return '🌅';
    if (hour >= 8 && hour < 12) return '☀️';
    if (hour >= 12 && hour < 17) return '🌤️';
    if (hour >= 17 && hour < 19) return '🌇';
    if (hour >= 19 && hour < 21) return '🌆';
    return '🌙';
}

// Pre-generate 25 stars with varied sizes and positions
const STAR_DATA = Array.from({ length: 25 }, (_, i) => ({
    key: i,
    size: `${1.5 + (((i * 7 + 3) % 6) / 6) * 2}px`,
    left: `${((i * 37 + 11) % 100)}%`,
    top: `${((i * 53 + 7) % 100)}%`,
    opacity: 0.3 + ((i * 13 + 5) % 10) / 15,
    animDelay: `${(i * 1.1) % 5}s`,
    animDuration: `${3 + (i % 4)}s`,
}));

export function DayNightCycle() {
    const [timeStr, setTimeStr] = useState(() => new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
    const [emoji, setEmoji] = useState(() => getPhaseEmoji(new Date().getHours()));
    const theme = useWorkspaceStore(s => s.theme);
    const themeConfig = useMemo(() => getThemeConfig(theme), [theme]);

    useEffect(() => {
        const update = () => {
            const now = new Date();
            setTimeStr(now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
            setEmoji(getPhaseEmoji(now.getHours()));
        };
        const interval = setInterval(update, 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <>
            {/* Stars — only in space theme */}
            {themeConfig.showStars && (
                <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden">
                    {STAR_DATA.map(star => (
                        <div
                            key={star.key}
                            className="absolute rounded-full bg-white"
                            style={{
                                width: star.size,
                                height: star.size,
                                left: star.left,
                                top: star.top,
                                opacity: star.opacity,
                                animation: `starTwinkle ${star.animDuration} ease-in-out infinite ${star.animDelay}`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Time indicator — bottom right */}
            <div className="absolute bottom-4 right-4 z-[2] flex items-center gap-2 px-4 py-2 rounded-2xl border border-white/10 pointer-events-none"
                style={{ background: 'rgba(15, 23, 42, 0.85)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                <span className="text-lg leading-none">{emoji}</span>
                <span className="text-sm font-semibold text-white/80 tabular-nums tracking-wide">{timeStr}</span>
            </div>

            {themeConfig.showStars && (
                <style jsx global>{`
                    @keyframes starTwinkle {
                        0%, 100% { opacity: 0.15; }
                        50% { opacity: 0.8; }
                    }
                `}</style>
            )}
        </>
    );
}

export default DayNightCycle;

