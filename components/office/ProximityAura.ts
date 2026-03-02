// ============================================
// ProximityAura — PixiJS rendering for proximity aura
// Draws a pulsing circle around avatars in open space
// States: idle (white), active (green), DND (red)
// Features:
//   - Movement-only visibility (fade in while moving, fade out when idle)
//   - Room wall clipping (aura doesn't penetrate room walls via cut() holes)
// ============================================

import { Graphics } from 'pixi.js';

export type AuraVisualState = 'idle' | 'active' | 'dnd' | 'none';

interface RoomRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

const AURA_CONFIGS = {
    idle: {
        fill: 0xffffff,
        fillAlpha: 0.04,
        stroke: 0xffffff,
        strokeAlpha: 0.12,
        strokeWidth: 1,
        pulseDurationMs: 2200,
        pulseScale: 0.04,
        pulseAlpha: 0.06,
    },
    active: {
        fill: 0x4ade80,    // green-400
        fillAlpha: 0.08,
        stroke: 0x4ade80,
        strokeAlpha: 0.30,
        strokeWidth: 1.5,
        pulseDurationMs: 1100,
        pulseScale: 0.06,
        pulseAlpha: 0.10,
    },
    dnd: {
        fill: 0xef4444,    // red-500
        fillAlpha: 0.06,
        stroke: 0xef4444,
        strokeAlpha: 0.25,
        strokeWidth: 1,
        pulseDurationMs: 0,
        pulseScale: 0,
        pulseAlpha: 0,
    },
};

const PROXIMITY_RADIUS = 250;

// Movement fade constants
const FADE_IN_SPEED = 4.0;   // per-second (reaches 1.0 in ~250ms)
const FADE_OUT_SPEED = 0.8;  // per-second (reaches 0 in ~1.25s)
const MOVE_THRESHOLD = 2;    // px — below this is considered still

export class ProximityAura {
    public graphics: Graphics;
    private state: AuraVisualState = 'none';
    private pulseTime: number = 0;
    private radius: number = PROXIMITY_RADIUS;

    // Movement fade state
    private movementAlpha: number = 0;
    private isMoving: boolean = false;
    private lastX: number = 0;
    private lastY: number = 0;
    private hasLastPosition: boolean = false;

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
            this.movementAlpha = 0;
        }
    }

    getState(): AuraVisualState {
        return this.state;
    }

    /**
     * Find rooms whose bounding box overlaps with the aura circle.
     */
    private getNearbyRooms(x: number, y: number, r: number, rooms: RoomRect[]): RoomRect[] {
        return rooms.filter(room => {
            const closestX = Math.max(room.x, Math.min(x, room.x + room.width));
            const closestY = Math.max(room.y, Math.min(y, room.y + room.height));
            const dx = x - closestX;
            const dy = y - closestY;
            return Math.sqrt(dx * dx + dy * dy) < r + 10;
        });
    }

    /**
     * Draw a circle with room-shaped holes cut out.
     * In PixiJS v8, cut() must be called BEFORE fill().
     */
    private drawCircleWithHoles(
        x: number, y: number, r: number,
        nearbyRooms: RoomRect[],
        color: number, alpha: number,
        mode: 'fill'
    ): void {
        this.graphics.circle(x, y, r);
        for (const room of nearbyRooms) {
            this.graphics.rect(room.x, room.y, room.width, room.height);
            this.graphics.cut();
        }
        this.graphics.fill({ color, alpha });
    }

    /**
     * Update aura animation. Call every frame or at ~15fps.
     */
    update(dt: number, x: number, y: number, rooms?: RoomRect[]) {
        if (this.state === 'none') {
            this.graphics.clear();
            return;
        }

        // ─── Movement detection ─────────────────────────
        if (this.hasLastPosition) {
            const dx = x - this.lastX;
            const dy = y - this.lastY;
            const moved = Math.sqrt(dx * dx + dy * dy);
            this.isMoving = moved > MOVE_THRESHOLD;
        }
        this.lastX = x;
        this.lastY = y;
        this.hasLastPosition = true;

        // ─── Movement alpha fade ───────────────────────
        const dtSec = dt / 1000;
        if (this.isMoving) {
            this.movementAlpha = Math.min(1, this.movementAlpha + FADE_IN_SPEED * dtSec);
        } else {
            this.movementAlpha = Math.max(0, this.movementAlpha - FADE_OUT_SPEED * dtSec);
        }

        // Skip rendering if fully invisible
        if (this.movementAlpha < 0.01) {
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
        const mAlpha = this.movementAlpha;

        this.graphics.clear();

        // Find rooms that overlap with the aura
        const nearbyRooms = rooms ? this.getNearbyRooms(x, y, r + 5, rooms) : [];

        // ─── Outer glow (with room holes) ───────────────
        this.drawCircleWithHoles(
            x, y, r + 5, nearbyRooms,
            config.fill, (config.fillAlpha + alphaBoost) * 0.3 * mAlpha,
            'fill'
        );

        // ─── Main fill (with room holes) ────────────────
        this.drawCircleWithHoles(
            x, y, r, nearbyRooms,
            config.fill, (config.fillAlpha + alphaBoost) * mAlpha,
            'fill'
        );

        // ─── Border stroke ──────────────────────────────
        // Note: stroke doesn't support cut(), so we draw it normally.
        // The fill-with-holes already hides the aura inside rooms visually.
        this.graphics.circle(x, y, r);
        this.graphics.stroke({
            color: config.stroke,
            width: config.strokeWidth,
            alpha: (config.strokeAlpha + alphaBoost * 0.5) * mAlpha,
        });

        // ─── Inner bright ring (proximity active) ───────
        if (this.state === 'active') {
            this.graphics.circle(x, y, 50);
            this.graphics.stroke({ color: 0x4ade80, width: 1, alpha: (0.3 + alphaBoost) * mAlpha });
        }
    }

    destroy() {
        this.graphics.clear();
        this.graphics.destroy();
    }
}
