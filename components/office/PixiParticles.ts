// ============================================
// PixiParticles — Star particle system with constellation network
// ============================================

import { Graphics } from 'pixi.js';

export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    tier: 'tiny' | 'medium' | 'accent';
    phase: number; // breathing offset
}

// Constellation connection distance threshold
const CONSTELLATION_DIST = 250;
const CONSTELLATION_DIST_SQ = CONSTELLATION_DIST * CONSTELLATION_DIST;

// Breathing animation speed
let globalTime = 0;

/**
 * Create array of randomized particles with 3 tiers
 */
export function createParticles(count: number, w: number, h: number): Particle[] {
    return Array.from({ length: count }, (_, i) => {
        // 3-tier sizing: 60% tiny, 30% medium, 10% accent
        const roll = Math.random();
        let tier: 'tiny' | 'medium' | 'accent';
        let size: number;
        if (roll < 0.6) {
            tier = 'tiny';
            size = 0.5 + Math.random() * 0.8;
        } else if (roll < 0.9) {
            tier = 'medium';
            size = 1.2 + Math.random() * 1.0;
        } else {
            tier = 'accent';
            size = 2.0 + Math.random() * 2.0;
        }

        return {
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            size,
            alpha: Math.random() * 0.5 + 0.2,
            tier,
            phase: Math.random() * Math.PI * 2, // unique breathing offset
        };
    });
}

/**
 * Update and draw particles with constellation connections (call at ~4fps)
 */
export function updateParticles(
    gfx: Graphics,
    particles: Particle[],
    oW: number,
    oH: number,
    isPerformanceMode: boolean,
    colors?: number[],
    baseAlpha?: number,
) {
    gfx.clear();
    if (isPerformanceMode) return;

    const particleColors = colors || [0x6366f1];
    const alphaMultiplier = baseAlpha ?? 1;
    globalTime += 0.04; // ~4fps * 0.04 = smooth sine

    // Move particles and draw them
    particles.forEach((p, i) => {
        p.x = (p.x + p.vx * 4 + oW) % oW;
        p.y = (p.y + p.vy * 4 + oH) % oH;

        const color = particleColors[i % particleColors.length];
        // Sinusoidal breathing alpha — each particle has its own phase
        const breathe = 0.7 + 0.3 * Math.sin(globalTime + p.phase);
        const finalAlpha = p.alpha * alphaMultiplier * breathe;

        gfx.circle(p.x, p.y, p.size);
        gfx.fill({ color, alpha: finalAlpha });

        // Accent particles get a subtle outer glow
        if (p.tier === 'accent') {
            gfx.circle(p.x, p.y, p.size * 2.5);
            gfx.fill({ color, alpha: finalAlpha * 0.15 });
        }
    });

    // Draw constellation connections between nearby particles
    // Only check accent+medium particles to keep it performant
    const connectable = particles.filter(p => p.tier !== 'tiny');
    for (let i = 0; i < connectable.length; i++) {
        for (let j = i + 1; j < connectable.length; j++) {
            const a = connectable[i];
            const b = connectable[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < CONSTELLATION_DIST_SQ) {
                const dist = Math.sqrt(distSq);
                const lineAlpha = (1 - dist / CONSTELLATION_DIST) * 0.12 * alphaMultiplier;
                const lineColor = particleColors[0];
                gfx.moveTo(a.x, a.y);
                gfx.lineTo(b.x, b.y);
                gfx.stroke({ color: lineColor, width: 0.5, alpha: lineAlpha });
            }
        }
    }
}

// ─── Utility helpers ─────────────────────────────────────────

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function hexColor(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
}
