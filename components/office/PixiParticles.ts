// ============================================
// PixiParticles — Star particle system for background
// ============================================

import { Graphics } from 'pixi.js';

export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
}

/**
 * Create array of randomized particles
 */
export function createParticles(count: number, w: number, h: number): Particle[] {
    return Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.2,
    }));
}

/**
 * Update and draw particles (call at ~15fps)
 */
export function updateParticles(
    gfx: Graphics,
    particles: Particle[],
    oW: number,
    oH: number,
    isPerformanceMode: boolean
) {
    gfx.clear();
    if (isPerformanceMode) return;

    particles.forEach(p => {
        p.x = (p.x + p.vx * 4 + oW) % oW;
        p.y = (p.y + p.vy * 4 + oH) % oH;
        gfx.circle(p.x, p.y, p.size);
        gfx.fill({ color: 0x6366f1, alpha: p.alpha });
    });
}

// ─── Utility helpers ─────────────────────────────────────────

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function hexColor(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
}
