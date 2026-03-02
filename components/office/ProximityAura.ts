// ============================================
// ProximityAura — PixiJS rendering for proximity aura
// Draws a pulsing circle around avatars in open space
// States: idle (white), active (green), DND (red)
// ============================================

import { Graphics } from 'pixi.js';

export type AuraVisualState = 'idle' | 'active' | 'dnd' | 'none';

const AURA_CONFIGS = {
    idle: {
        fill: 0xffffff,
        fillAlpha: 0.08,
        stroke: 0xffffff,
        strokeAlpha: 0.25,
        strokeWidth: 1.5,
        pulseDurationMs: 2200,
        pulseScale: 0.06,
        pulseAlpha: 0.10,
    },
    active: {
        fill: 0x4ade80,    // green-400
        fillAlpha: 0.12,
        stroke: 0x4ade80,
        strokeAlpha: 0.45,
        strokeWidth: 2,
        pulseDurationMs: 1100,
        pulseScale: 0.08,
        pulseAlpha: 0.15,
    },
    dnd: {
        fill: 0xef4444,    // red-500
        fillAlpha: 0.10,
        stroke: 0xef4444,
        strokeAlpha: 0.4,
        strokeWidth: 1.5,
        pulseDurationMs: 0, // static
        pulseScale: 0,
        pulseAlpha: 0,
    },
};

const PROXIMITY_RADIUS = 250;

export class ProximityAura {
    public graphics: Graphics;
    private state: AuraVisualState = 'none';
    private pulseTime: number = 0;
    private radius: number = PROXIMITY_RADIUS;

    constructor() {
        this.graphics = new Graphics();
        this.graphics.label = 'proximity-aura';
    }

    setState(newState: AuraVisualState) {
        if (this.state === newState) return;
        this.state = newState;
        this.pulseTime = 0;
        if (newState === 'none') {
            this.graphics.clear();
        }
    }

    getState(): AuraVisualState {
        return this.state;
    }

    /**
     * Update aura animation. Call every frame or at ~15fps.
     * @param dt - time delta in ms
     * @param x - center x position (world coords)
     * @param y - center y position (world coords)
     */
    update(dt: number, x: number, y: number) {
        if (this.state === 'none') {
            this.graphics.clear();
            return;
        }

        const config = AURA_CONFIGS[this.state];
        this.pulseTime += dt;

        let scale = 1.0;
        let alphaBoost = 0;

        if (config.pulseDurationMs > 0) {
            const t = (this.pulseTime % config.pulseDurationMs) / config.pulseDurationMs;
            const eased = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
            scale = 1.0 + eased * config.pulseScale;
            alphaBoost = eased * config.pulseAlpha;
        }

        const r = this.radius * scale;

        this.graphics.clear();

        // Outer glow
        this.graphics.circle(x, y, r + 5);
        this.graphics.fill({ color: config.fill, alpha: (config.fillAlpha + alphaBoost) * 0.3 });

        // Main fill
        this.graphics.circle(x, y, r);
        this.graphics.fill({ color: config.fill, alpha: config.fillAlpha + alphaBoost });

        // Border
        this.graphics.circle(x, y, r);
        this.graphics.stroke({
            color: config.stroke,
            width: config.strokeWidth,
            alpha: config.strokeAlpha + alphaBoost * 0.5,
        });

        // Inner bright ring (close proximity indicator)
        if (this.state === 'active') {
            this.graphics.circle(x, y, 50);
            this.graphics.stroke({ color: 0x4ade80, width: 1, alpha: 0.3 + alphaBoost });
        }
    }

    destroy() {
        this.graphics.clear();
        this.graphics.destroy();
    }
}
