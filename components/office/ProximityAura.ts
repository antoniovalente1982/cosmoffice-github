// ============================================
// ProximityAura — PixiJS proximity aura (GPU-optimized)
// Draws circles ONCE, then only moves position + adjusts alpha/scale per frame
// States: idle (white), active (green), DND (red), none (hidden)
// ============================================

import { Graphics } from 'pixi.js';

export type AuraVisualState = 'idle' | 'active' | 'dnd' | 'none';

const AURA_CONFIGS = {
    idle: {
        fill: 0xffffff,
        fillAlpha: 0.05,
        stroke: 0xffffff,
        strokeAlpha: 0.15,
        strokeWidth: 1.2,
        pulseDurationMs: 2500,
        pulseScale: 0.03,
        pulseAlpha: 0.04,
    },
    active: {
        fill: 0x4ade80,
        fillAlpha: 0.08,
        stroke: 0x4ade80,
        strokeAlpha: 0.35,
        strokeWidth: 1.8,
        pulseDurationMs: 1200,
        pulseScale: 0.05,
        pulseAlpha: 0.08,
    },
    dnd: {
        fill: 0xef4444,
        fillAlpha: 0.06,
        stroke: 0xef4444,
        strokeAlpha: 0.25,
        strokeWidth: 1.2,
        pulseDurationMs: 0,
        pulseScale: 0,
        pulseAlpha: 0,
    },
};

const PROXIMITY_RADIUS = 500;
const FADE_IN_SPEED = 5.0;   // per-second — snappy fade in (~200ms)
const FADE_OUT_SPEED = 1.2;  // per-second — smooth fade out (~800ms)
const MOVE_THRESHOLD = 1.5;  // px

interface RoomRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export class ProximityAura {
    public graphics: Graphics;
    private state: AuraVisualState = 'none';
    private pulseTime: number = 0;
    private radius: number = PROXIMITY_RADIUS;

    // Movement fade state
    private movementAlpha: number = 0;
    private lastX: number = 0;
    private lastY: number = 0;
    private hasLastPosition: boolean = false;

    // Dirty flag — only redraw graphics when state changes
    private dirty: boolean = true;
    private lastDrawnState: AuraVisualState = 'none';

    constructor() {
        this.graphics = new Graphics();
        this.graphics.label = 'proximity-aura';
    }

    setState(newState: AuraVisualState) {
        if (this.state === newState) return;
        this.state = newState;
        this.pulseTime = 0;
        if (newState === 'none') {
            this.graphics.visible = false;
            this.movementAlpha = 0;
        } else {
            this.graphics.visible = true;
            this.dirty = true;
        }
    }

    getState(): AuraVisualState {
        return this.state;
    }

    /**
     * Redraw the static aura circles centered at (0,0).
     * Called ONLY when state changes — very cheap since it happens rarely.
     */
    private redrawShape() {
        if (this.state === 'none') return;
        const config = AURA_CONFIGS[this.state];

        this.graphics.clear();

        // Outer soft glow
        this.graphics.circle(0, 0, this.radius + 8);
        this.graphics.fill({ color: config.fill, alpha: config.fillAlpha * 0.3 });

        // Main fill
        this.graphics.circle(0, 0, this.radius);
        this.graphics.fill({ color: config.fill, alpha: config.fillAlpha });

        // Border
        this.graphics.circle(0, 0, this.radius);
        this.graphics.stroke({
            color: config.stroke,
            width: config.strokeWidth,
            alpha: config.strokeAlpha,
        });

        // Inner bright ring for active state
        if (this.state === 'active') {
            this.graphics.circle(0, 0, 55);
            this.graphics.stroke({ color: 0x4ade80, width: 1, alpha: 0.3 });
        }

        this.lastDrawnState = this.state;
        this.dirty = false;
    }

    /**
     * Update aura — call EVERY frame for smooth position tracking.
     * Only position/alpha/scale change per frame (GPU-cheap).
     * Full redraw happens only on state change.
     */
    update(dt: number, x: number, y: number, rooms?: RoomRect[]) {
        if (this.state === 'none') {
            this.graphics.visible = false;
            return;
        }

        // ─── Movement detection ─────────────────────────
        let isMoving = false;
        if (this.hasLastPosition) {
            const dx = x - this.lastX;
            const dy = y - this.lastY;
            isMoving = (dx * dx + dy * dy) > MOVE_THRESHOLD * MOVE_THRESHOLD;
        }
        this.lastX = x;
        this.lastY = y;
        this.hasLastPosition = true;

        // ─── Movement alpha fade ───────────────────────
        const dtSec = dt / 1000;
        if (isMoving) {
            this.movementAlpha = Math.min(1, this.movementAlpha + FADE_IN_SPEED * dtSec);
        } else {
            this.movementAlpha = Math.max(0, this.movementAlpha - FADE_OUT_SPEED * dtSec);
        }

        // Skip if fully invisible
        if (this.movementAlpha < 0.01) {
            this.graphics.visible = false;
            return;
        }

        this.graphics.visible = true;

        // ─── Redraw circles only when state changed ─────
        if (this.dirty || this.lastDrawnState !== this.state) {
            this.redrawShape();
        }

        // ─── Position — instant, every frame (GPU translate) ─
        this.graphics.position.set(x, y);

        // ─── Pulse via scale/alpha (no redraw needed!) ──────
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

        // ─── Wall-aware alpha reduction ─────────────────
        let wallFade = 1.0;
        if (rooms && rooms.length > 0) {
            for (const room of rooms) {
                const closestX = Math.max(room.x, Math.min(x, room.x + room.width));
                const closestY = Math.max(room.y, Math.min(y, room.y + room.height));
                const distX = x - closestX;
                const distY = y - closestY;
                const dist = Math.sqrt(distX * distX + distY * distY);
                const r = this.radius * scale;

                if (dist < r) {
                    const penetration = 1 - dist / r;
                    wallFade = Math.min(wallFade, 0.3 + 0.7 * (1 - penetration * penetration));
                }
            }
        }

        // ─── Apply scale + alpha (GPU-only, no redraw) ──────
        this.graphics.scale.set(scale);
        this.graphics.alpha = (this.movementAlpha + alphaBoost) * wallFade;
    }

    destroy() {
        this.graphics.clear();
        this.graphics.destroy();
    }
}
