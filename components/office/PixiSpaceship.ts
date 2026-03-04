// ============================================
// PixiSpaceship — Landing pad rendering + drag
// ============================================

import { Container, Graphics, Text, TextStyle } from 'pixi.js';

/**
 * Draw spaceship landing pad with animated beam
 */
export function drawSpaceship(container: Container, x: number, y: number, frameCount: number = 0, padScale: number = 1) {
    container.removeChildren();
    const s = padScale;

    const beamAlpha = 0.12 + Math.sin(frameCount * 0.05) * 0.06;

    // Light beam cone (triangle from ship to ground)
    const beam = new Graphics();
    beam.moveTo(x - 6 * s, y + 10 * s);
    beam.lineTo(x + 6 * s, y + 10 * s);
    beam.lineTo(x + 40 * s, y + 70 * s);
    beam.lineTo(x - 40 * s, y + 70 * s);
    beam.closePath();
    beam.fill({ color: 0x06b6d4, alpha: beamAlpha });

    // Outer glow circle on ground
    beam.circle(x, y + 70 * s, 45 * s);
    beam.fill({ color: 0x06b6d4, alpha: beamAlpha * 0.5 });
    beam.circle(x, y + 70 * s, 30 * s);
    beam.fill({ color: 0x22d3ee, alpha: beamAlpha * 0.7 });
    container.addChild(beam);

    // Ship body (triangle/capsule shape)
    const ship = new Graphics();
    ship.moveTo(x, y - 18 * s);
    ship.lineTo(x + 16 * s, y + 8 * s);
    ship.lineTo(x + 8 * s, y + 14 * s);
    ship.lineTo(x - 8 * s, y + 14 * s);
    ship.lineTo(x - 16 * s, y + 8 * s);
    ship.closePath();
    ship.fill({ color: 0x1e293b, alpha: 0.95 });
    ship.stroke({ color: 0x06b6d4, width: 2, alpha: 0.8 });

    // Cockpit window
    ship.circle(x, y - 2 * s, 5 * s);
    ship.fill({ color: 0x22d3ee, alpha: 0.7 });

    // Engine glow
    ship.circle(x - 6 * s, y + 12 * s, 3 * s);
    ship.fill({ color: 0x06b6d4, alpha: 0.6 + Math.sin(frameCount * 0.1) * 0.3 });
    ship.circle(x + 6 * s, y + 12 * s, 3 * s);
    ship.fill({ color: 0x06b6d4, alpha: 0.6 + Math.sin(frameCount * 0.1 + 1) * 0.3 });

    container.addChild(ship);

    // Label
    const labelStyle = new TextStyle({
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: Math.max(7, 8 * s),
        fontWeight: '700',
        fill: 0x06b6d4,
        letterSpacing: 2,
    });
    const label = new Text({ text: 'LANDING ZONE', style: labelStyle });
    label.anchor.set(0.5, 0);
    label.position.set(x, y + 78 * s);
    container.addChild(label);
}
