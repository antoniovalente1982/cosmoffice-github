'use client';

import { useEffect, useState } from 'react';

// ============================================
// DayNightCycle — ambient lighting overlay
// Changes office ambiance based on real time
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

export function DayNightCycle() {
    const [phase, setPhase] = useState(() => getTimePhase(new Date().getHours()));

    useEffect(() => {
        const update = () => setPhase(getTimePhase(new Date().getHours()));
        const interval = setInterval(update, 60000); // check every minute
        return () => clearInterval(interval);
    }, []);

    return (
        <>
            {/* Ambient overlay */}
            <div
                className="absolute inset-0 pointer-events-none z-[1] transition-all duration-[3000ms]"
                style={{ backgroundColor: phase.overlay }}
            />

            {/* Stars (night/dusk only) */}
            {phase.stars && (
                <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden">
                    {Array.from({ length: 30 }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute rounded-full bg-white"
                            style={{
                                width: `${1 + Math.random() * 2}px`,
                                height: `${1 + Math.random() * 2}px`,
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                opacity: 0.2 + Math.random() * 0.5,
                                animation: `starTwinkle ${2 + Math.random() * 4}s ease-in-out infinite ${Math.random() * 3}s`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Time indicator — bottom right */}
            <div className="absolute bottom-4 right-4 z-[2] flex items-center gap-2 px-4 py-2 rounded-2xl border border-white/10 pointer-events-none"
                style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                <span className="text-lg leading-none">
                    {phase.name === 'dawn' ? '🌅' :
                        phase.name === 'morning' ? '☀️' :
                            phase.name === 'afternoon' ? '🌤️' :
                                phase.name === 'sunset' ? '🌇' :
                                    phase.name === 'dusk' ? '🌆' : '🌙'}
                </span>
                <span className="text-sm font-semibold text-white/80 tabular-nums tracking-wide">
                    {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>

            <style jsx global>{`
                @keyframes starTwinkle {
                    0%, 100% { opacity: 0.2; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.3); }
                }
            `}</style>
        </>
    );
}

export default DayNightCycle;
