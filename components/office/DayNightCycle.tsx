'use client';

import { useEffect, useState, useMemo } from 'react';

// ============================================
// DayNightCycle — ambient lighting overlay
// Changes office ambiance based on real time
// OPTIMIZED: fewer stars, no backdrop-filter,
// pre-computed star positions via useMemo
// ============================================

function getTimePhase(hour: number): { name: string; overlay: string; stars: boolean } {
    if (hour >= 6 && hour < 8) return { name: 'dawn', overlay: 'rgba(255, 147, 66, 0.06)', stars: false };
    if (hour >= 8 && hour < 12) return { name: 'morning', overlay: 'rgba(255, 255, 200, 0.03)', stars: false };
    if (hour >= 12 && hour < 17) return { name: 'afternoon', overlay: 'rgba(255, 230, 150, 0.04)', stars: false };
    if (hour >= 17 && hour < 19) return { name: 'sunset', overlay: 'rgba(255, 100, 50, 0.07)', stars: false };
    if (hour >= 19 && hour < 21) return { name: 'dusk', overlay: 'rgba(80, 50, 150, 0.08)', stars: true };
    // Night: 21:00 - 06:00
    return { name: 'night', overlay: 'rgba(10, 15, 40, 0.12)', stars: true };
}

// Pre-generate star data once (stable across renders)
const STAR_DATA = Array.from({ length: 12 }, (_, i) => ({
    key: i,
    width: `${1 + (((i * 7 + 3) % 5) / 5) * 2}px`,
    height: `${1 + (((i * 7 + 3) % 5) / 5) * 2}px`,
    left: `${((i * 37 + 11) % 100)}%`,
    top: `${((i * 53 + 7) % 100)}%`,
    opacity: 0.2 + ((i * 13 + 5) % 10) / 20,
    animDelay: `${(i * 1.3) % 4}s`,
    animDuration: `${3 + (i % 3)}s`,
}));

export function DayNightCycle() {
    const [phase, setPhase] = useState(() => getTimePhase(new Date().getHours()));
    const [timeStr, setTimeStr] = useState(() => new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));

    useEffect(() => {
        const update = () => {
            setPhase(getTimePhase(new Date().getHours()));
            setTimeStr(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
        };
        const interval = setInterval(update, 60000);
        return () => clearInterval(interval);
    }, []);

    const phaseEmoji = phase.name === 'dawn' ? '🌅' :
        phase.name === 'morning' ? '☀️' :
            phase.name === 'afternoon' ? '🌤️' :
                phase.name === 'sunset' ? '🌇' :
                    phase.name === 'dusk' ? '🌆' : '🌙';

    return (
        <>
            {/* Ambient overlay */}
            <div
                className="absolute inset-0 pointer-events-none z-[1]"
                style={{ backgroundColor: phase.overlay, transition: 'background-color 3s' }}
            />

            {/* Stars (night/dusk only) — reduced count, pre-computed positions */}
            {phase.stars && (
                <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden">
                    {STAR_DATA.map(star => (
                        <div
                            key={star.key}
                            className="absolute rounded-full bg-white"
                            style={{
                                width: star.width,
                                height: star.height,
                                left: star.left,
                                top: star.top,
                                opacity: star.opacity,
                                animation: `starTwinkle ${star.animDuration} ease-in-out infinite ${star.animDelay}`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Time indicator — bottom right — NO backdrop-filter */}
            <div className="absolute bottom-4 right-4 z-[2] flex items-center gap-2 px-4 py-2 rounded-2xl border border-white/10 pointer-events-none"
                style={{ background: 'rgba(15, 23, 42, 0.85)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                <span className="text-lg leading-none">{phaseEmoji}</span>
                <span className="text-sm font-semibold text-white/80 tabular-nums tracking-wide">{timeStr}</span>
            </div>

            <style jsx global>{`
                @keyframes starTwinkle {
                    0%, 100% { opacity: 0.2; }
                    50% { opacity: 0.7; }
                }
            `}</style>
        </>
    );
}

export default DayNightCycle;
