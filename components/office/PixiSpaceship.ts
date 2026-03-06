// ============================================
// PixiSpaceship — Landing pad rendering + drag
// OPTIMIZED: draw once, only update beam alpha
// ============================================

import { Container, Graphics, Text, TextStyle } from 'pixi.js';

// Cache to avoid redrawing static parts every frame
let cachedPadX = 0;
let cachedPadY = 0;
let cachedPadScale = 0;
let shipGraphics: Graphics | null = null;
let beamGraphics: Graphics | null = null;
let labelText: Text | null = null;

/**
 * Draw spaceship landing pad with animated beam.
 * Static parts (ship body, label) are drawn once and cached.
 * Only the beam alpha is animated per-frame.
 */
export function drawSpaceship(container: Container, x: number, y: number, frameCount: number = 0, padScale: number = 1) {
    const s = padScale;
    const posChanged = x !== cachedPadX || y !== cachedPadY || s !== cachedPadScale;

    // Only rebuild children if position/scale changed
    if (posChanged || !shipGraphics || !beamGraphics || !labelText) {
        container.removeChildren();
        cachedPadX = x;
        cachedPadY = y;
        cachedPadScale = s;

        // Beam (animated — redrawn only alpha changes)
        beamGraphics = new Graphics();
        container.addChild(beamGraphics);

        // Ship body (STATIC — drawn once)
        shipGraphics = new Graphics();
        shipGraphics.moveTo(x, y - 18 * s);
        shipGraphics.lineTo(x + 16 * s, y + 8 * s);
        shipGraphics.lineTo(x + 8 * s, y + 14 * s);
        shipGraphics.lineTo(x - 8 * s, y + 14 * s);
        shipGraphics.lineTo(x - 16 * s, y + 8 * s);
        shipGraphics.closePath();
        shipGraphics.fill({ color: 0x1e293b, alpha: 0.95 });
        shipGraphics.stroke({ color: 0x06b6d4, width: 2, alpha: 0.8 });
        shipGraphics.circle(x, y - 2 * s, 5 * s);
        shipGraphics.fill({ color: 0x22d3ee, alpha: 0.7 });
        container.addChild(shipGraphics);

        // Label (STATIC)
        const labelStyle = new TextStyle({
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: Math.max(7, 8 * s),
            fontWeight: '700',
            fill: 0x06b6d4,
            letterSpacing: 2,
        });
        labelText = new Text({ text: 'LANDING ZONE', style: labelStyle });
        labelText.anchor.set(0.5, 0);
        labelText.position.set(x, y + 78 * s);
        container.addChild(labelText);
    }

    // ANIMATED: Heartbeat-style beam pulse (lub-dub + rest)
    // Total cycle ~90 frames (~1.5s at 60fps) — natural resting heart rate
    const cycle = frameCount % 90;
    let beatIntensity: number;
    if (cycle < 8) {
        // First beat (lub) — quick sharp rise and fall
        const t = cycle / 8;
        beatIntensity = Math.sin(t * Math.PI) * 1.0;
    } else if (cycle < 14) {
        // Brief gap between beats
        beatIntensity = 0;
    } else if (cycle < 22) {
        // Second beat (dub) — slightly softer
        const t = (cycle - 14) / 8;
        beatIntensity = Math.sin(t * Math.PI) * 0.7;
    } else {
        // Rest period — gentle ambient glow
        beatIntensity = 0;
    }
    const beamAlpha = 0.08 + beatIntensity * 0.14;

    beamGraphics!.clear();
    beamGraphics!.moveTo(x - 6 * s, y + 10 * s);
    beamGraphics!.lineTo(x + 6 * s, y + 10 * s);
    beamGraphics!.lineTo(x + 40 * s, y + 70 * s);
    beamGraphics!.lineTo(x - 40 * s, y + 70 * s);
    beamGraphics!.closePath();
    beamGraphics!.fill({ color: 0x06b6d4, alpha: beamAlpha });
    beamGraphics!.circle(x, y + 70 * s, 45 * s);
    beamGraphics!.fill({ color: 0x06b6d4, alpha: beamAlpha * 0.5 });
    beamGraphics!.circle(x, y + 70 * s, 30 * s);
    beamGraphics!.fill({ color: 0x22d3ee, alpha: beamAlpha * 0.7 });

    // Engine glow — update ship only if we really need the shimmer
    // Skip engine shimmer for performance (static ship stays static)
}
