// ============================================
// PixiSpaceship — Landing pad rendering + drag
// OPTIMIZED: draw once, only rebuild on change
// ============================================

import { Container, Graphics, Text, TextStyle } from 'pixi.js';

/**
 * Draw spaceship landing pad — fully static.
 * Ship body, beam, and label are drawn once and cached per-container.
 * No per-frame animation = zero ongoing GPU cost.
 *
 * We store cache on the container itself (via custom properties)
 * to avoid stale global state across component remounts.
 */
export function drawSpaceship(container: Container, x: number, y: number, _frameCount: number = 0, padScale: number = 1) {
    const s = padScale;
    const c = container as any;

    // Check if position/scale changed from what we last drew on THIS container
    if (c._cachedPadX === x && c._cachedPadY === y && c._cachedPadScale === s && container.children.length > 0) {
        return; // Nothing changed, skip redraw
    }

    container.removeChildren();
    c._cachedPadX = x;
    c._cachedPadY = y;
    c._cachedPadScale = s;

    // Beam (STATIC — fixed alpha, drawn once)
    const beamAlpha = 0.12;
    const beamGraphics = new Graphics();
    beamGraphics.moveTo(x - 6 * s, y + 10 * s);
    beamGraphics.lineTo(x + 6 * s, y + 10 * s);
    beamGraphics.lineTo(x + 40 * s, y + 70 * s);
    beamGraphics.lineTo(x - 40 * s, y + 70 * s);
    beamGraphics.closePath();
    beamGraphics.fill({ color: 0x06b6d4, alpha: beamAlpha });
    beamGraphics.circle(x, y + 70 * s, 45 * s);
    beamGraphics.fill({ color: 0x06b6d4, alpha: beamAlpha * 0.5 });
    beamGraphics.circle(x, y + 70 * s, 30 * s);
    beamGraphics.fill({ color: 0x22d3ee, alpha: beamAlpha * 0.7 });
    container.addChild(beamGraphics);

    // Ship body (STATIC)
    const shipGraphics = new Graphics();
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
    const labelText = new Text({ text: 'LANDING ZONE', style: labelStyle });
    labelText.anchor.set(0.5, 0);
    labelText.position.set(x, y + 78 * s);
    container.addChild(labelText);
}
