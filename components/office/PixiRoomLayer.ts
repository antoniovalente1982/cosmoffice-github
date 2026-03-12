// ============================================
// PixiRoomLayer — Room drawing helpers for Pixi.js
// ============================================

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { getRoomColor } from './OfficeBuilder';
import type { OfficeThemeConfig } from '../../lib/officeThemes';

// ─── Zoom-Adaptive Font Size ─────────────────────────────────────
// Counter-scales font size so labels remain readable at any zoom.
// At zoom=1 → returns basePx. At zoom=0.38 → returns ~basePx*2.1
// Capped at basePx*2.5 to avoid oversized labels.
function getAdaptiveFontSize(basePx: number, zoom: number): number {
    const scale = Math.max(1, 1.2 / Math.max(zoom, 0.2));
    return Math.min(basePx * scale, basePx * 2.5);
}

// ─── Room Type Emoji ─────────────────────────────────────────────
function getRoomTypeIcon(type: string): string {
    switch (type) {
        case 'focus': return '🎯';
        case 'meeting': return '🤝';
        case 'break': return '☕';
        case 'open': return '🚀';
        case 'reception': return '🏛️';
        default: return '◆';
    }
}


function hexColor(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
}

/**
 * Get the point on a room's border closest to a target point (edge intersection).
 * Used for edge-to-edge connections instead of center-to-center.
 */
export function getRoomEdge(room: any, targetX: number, targetY: number): { x: number; y: number } {
    const cx = room.x + room.width / 2;
    const cy = room.y + room.height / 2;
    const dx = targetX - cx;
    const dy = targetY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { x: cx, y: cy };

    if (room.shape === 'circle') {
        // Circle: intersection at center + direction * radius
        const r = Math.min(room.width, room.height) / 2;
        return { x: cx + (dx / dist) * r, y: cy + (dy / dist) * r };
    } else {
        // Rectangle: find where the ray from center exits the rect
        const hw = room.width / 2;
        const hh = room.height / 2;
        const scaleX = Math.abs(dx) > 0 ? hw / Math.abs(dx) : Infinity;
        const scaleY = Math.abs(dy) > 0 ? hh / Math.abs(dy) : Infinity;
        const scale = Math.min(scaleX, scaleY);
        return { x: cx + dx * scale, y: cy + dy * scale };
    }
}

/**
 * Draw a single room card onto its container
 * Supports shape: 'rect' (default) and 'circle'
 */
export function drawRoom(container: Container, room: any, isHovered: boolean, occupants: number = 0, theme?: OfficeThemeConfig, zoom: number = 1) {
    container.removeChildren();

    const color = getRoomColor(room);
    const colorNum = hexColor(color);
    const department = room.settings?.department || room.department || null;
    const isCircle = room.shape === 'circle';

    // Theme-driven colors
    const roomBgColor = theme?.roomBg ?? 0x070c18;
    const roomBgAlpha = theme?.roomBgAlpha ?? 0.85;
    const glowAlpha = isHovered ? (theme?.roomGlowHoverAlpha ?? 0.20) : (theme?.roomGlowAlpha ?? 0.10);
    const midGlowAlpha = isHovered ? (glowAlpha * 0.7) : (glowAlpha * 0.7);
    const textColor = theme?.roomTextColor ?? 0xffffff;
    const statusColor = theme?.roomStatusTextColor ?? 0x34d399;

    // ─── Background layers ───────────────────────────────────
    const body = new Graphics();

    if (isCircle) {
        const cx = room.x + room.width / 2;
        const cy = room.y + room.height / 2;
        const r = Math.min(room.width, room.height) / 2;

        // Outer soft glow
        body.circle(cx, cy, r + 8);
        body.fill({ color: colorNum, alpha: glowAlpha });

        // Mid glow
        body.circle(cx, cy, r + 3);
        body.fill({ color: colorNum, alpha: midGlowAlpha });

        // Main background
        body.circle(cx, cy, r);
        body.fill({ color: roomBgColor, alpha: roomBgAlpha });

        // Color tint overlay
        body.circle(cx, cy, r);
        body.fill({ color: colorNum, alpha: isHovered ? 0.12 : 0.05 });

        // Border
        body.circle(cx, cy, r);
        body.stroke({ color: colorNum, width: isHovered ? 4 : 3, alpha: isHovered ? 0.95 : 0.6 });
    } else {
        // Rect room
        // Outer soft glow
        body.roundRect(room.x - 8, room.y - 8, room.width + 16, room.height + 16, 24);
        body.fill({ color: colorNum, alpha: glowAlpha });

        // Mid glow
        body.roundRect(room.x - 3, room.y - 3, room.width + 6, room.height + 6, 19);
        body.fill({ color: colorNum, alpha: midGlowAlpha });

        // Main card background
        body.roundRect(room.x, room.y, room.width, room.height, 16);
        body.fill({ color: roomBgColor, alpha: roomBgAlpha });

        // Color tint overlay
        body.roundRect(room.x, room.y, room.width, room.height, 16);
        body.fill({ color: colorNum, alpha: isHovered ? 0.12 : 0.05 });

        // Border
        body.roundRect(room.x, room.y, room.width, room.height, 16);
        body.stroke({ color: colorNum, width: isHovered ? 4 : 3, alpha: isHovered ? 0.95 : 0.6 });
    }

    container.addChild(body);

    // ─── Accent Strip (top edge, colored by room type) ────
    const accentGfx = new Graphics();
    if (isCircle) {
        const cx = room.x + room.width / 2;
        const topY = room.y + room.height / 2 - Math.min(room.width, room.height) / 2;
        accentGfx.roundRect(cx - 20, topY - 1, 40, 3, 1.5);
    } else {
        accentGfx.roundRect(room.x + 12, room.y, room.width - 24, 3, 1.5);
    }
    accentGfx.fill({ color: colorNum, alpha: 0.7 });
    container.addChild(accentGfx);

    // ═══════════════════════════════════════════════════════
    // LABELS — OUTSIDE the room, above (ZOOM-ADAPTIVE)
    // ═══════════════════════════════════════════════════════

    const adaptiveNameSize = getAdaptiveFontSize(28, zoom);
    const adaptiveSubSize = getAdaptiveFontSize(16, zoom);
    const adaptiveStatusSize = getAdaptiveFontSize(18, zoom);

    // ─── Room type icon + Room name ───────────────────────
    const icon = getRoomTypeIcon(room.type);
    const nameStr = `${icon} ${room.name.toUpperCase()}`;

    const nameStyle = new TextStyle({
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: adaptiveNameSize,
        fontWeight: '800',
        fill: textColor,
        letterSpacing: 1,
        dropShadow: { color: 0x000000, alpha: 0.9, blur: 12, distance: 0 },
    });
    const nameText = new Text({ text: nameStr, style: nameStyle, resolution: 4 });

    // ─── Subtitle line: DEPARTMENT (positioned first to calculate total height) ──
    let subText: Text | null = null;
    if (department) {
        const subtitleStr = department.toUpperCase();
        const subStyle = new TextStyle({
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: adaptiveSubSize,
            fontWeight: '700',
            fill: hexColor(color),
            letterSpacing: 1.5,
            dropShadow: { color: 0x000000, alpha: 0.8, blur: 10, distance: 0 },
        });
        subText = new Text({ text: subtitleStr, style: subStyle, resolution: 4 });
    }

    // Calculate total label block height: name + gap + department
    const nameH = nameText.height;
    const subH = subText ? subText.height : 0;
    const labelSpacing = subText ? Math.max(4, adaptiveSubSize * 0.3) : 0; // gap between name & dept
    const totalLabelH = nameH + labelSpacing + subH;
    const labelMargin = Math.max(12, adaptiveNameSize * 0.4); // gap between bottom label and room top

    // Position name label above room — anchored from bottom of label block
    if (isCircle) {
        nameText.anchor.set(0.5, 0);
        nameText.position.set(room.x + room.width / 2, room.y - labelMargin - totalLabelH);
    } else {
        nameText.anchor.set(0, 0);
        nameText.position.set(room.x + 2, room.y - labelMargin - totalLabelH);
    }
    container.addChild(nameText);

    // Position department directly below the name — never overlaps
    if (subText) {
        const subY = (isCircle
            ? room.y - labelMargin - totalLabelH + nameH + labelSpacing
            : room.y - labelMargin - totalLabelH + nameH + labelSpacing);
        if (isCircle) {
            subText.anchor.set(0.5, 0);
            subText.position.set(room.x + room.width / 2, subY);
        } else {
            subText.anchor.set(0, 0);
            subText.position.set(room.x + 2, subY);
        }
        container.addChild(subText);
    }

    // ═══════════════════════════════════════════════════════
    // INSIDE — occupant status + capacity bar
    // ═══════════════════════════════════════════════════════

    // ─── Capacity Progress Bar (bottom of room) ─────────
    const capacity = room.capacity || room.settings?.capacity || 0;
    if (capacity > 0) {
        const barWidth = isCircle ? Math.min(room.width, room.height) * 0.6 : room.width - 32;
        const barHeight = 3;
        const barX = isCircle ? room.x + room.width / 2 - barWidth / 2 : room.x + 16;
        const barY = isCircle
            ? room.y + room.height / 2 + Math.min(room.width, room.height) / 2 - 12
            : room.y + room.height - 8;
        const fillRatio = Math.min(1, occupants / capacity);
        const barColor = fillRatio > 0.8 ? 0xef4444 : fillRatio > 0.5 ? 0xf59e0b : statusColor;

        const barGfx = new Graphics();
        // Track
        barGfx.roundRect(barX, barY, barWidth, barHeight, 1.5);
        barGfx.fill({ color: 0xffffff, alpha: 0.08 });
        // Fill
        if (fillRatio > 0) {
            barGfx.roundRect(barX, barY, barWidth * fillRatio, barHeight, 1.5);
            barGfx.fill({ color: barColor, alpha: 0.7 });
        }
        container.addChild(barGfx);
    }

    if (occupants > 0) {
        const statusStyle = new TextStyle({
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: adaptiveStatusSize,
            fontWeight: '700',
            fill: statusColor,
            letterSpacing: 0.5,
            dropShadow: { color: 0x000000, alpha: 0.5, blur: 6, distance: 0 },
        });
        const statusText = `${occupants} online`;
        const status = new Text({ text: statusText, style: statusStyle, resolution: 4 });

        if (isCircle) {
            const cy = room.y + room.height / 2;
            const r = Math.min(room.width, room.height) / 2;
            const statusY = cy + r - 28;
            status.anchor.set(0.5, 0.5);
            status.position.set(room.x + room.width / 2, statusY);
            // Pulsing green dot
            const statusDot = new Graphics();
            const dotX = room.x + room.width / 2 - status.width / 2 - 12;
            statusDot.circle(dotX, statusY, 4.5);
            statusDot.fill({ color: statusColor, alpha: 1 });
            statusDot.circle(dotX, statusY, 7);
            statusDot.fill({ color: statusColor, alpha: 0.2 });
            container.addChild(statusDot);
            container.addChild(status);
        } else {
            const statusY = room.y + room.height - 20;
            status.anchor.set(0, 0.5);
            status.position.set(room.x + 28, statusY);
            // Pulsing green dot with glow ring
            const statusDot = new Graphics();
            statusDot.circle(room.x + 16, statusY, 4.5);
            statusDot.fill({ color: statusColor, alpha: 1 });
            statusDot.circle(room.x + 16, statusY, 7);
            statusDot.fill({ color: statusColor, alpha: 0.2 });
            container.addChild(statusDot);
            container.addChild(status);
        }
    }
}

/**
 * Draw room connections — DB-driven with labels, plus proximity fallback
 */
export function drawRoomConnections(
    gfx: Graphics,
    rooms: any[],
    isPerformanceMode: boolean,
    connections?: any[],      // DB connections from room_connections table
    labelContainer?: Container, // Container for label Text objects
    layoutMode?: string,       // 'free' | 'hierarchical' | 'teamsmap'
    isBuilderMode?: boolean    // Show draggable control point handles
): { connId: string; x: number; y: number; side?: 'a' | 'b' }[] {
    const handles: { connId: string; x: number; y: number; side?: 'a' | 'b' }[] = [];
    gfx.clear();
    if (labelContainer) labelContainer.removeChildren();
    if (isPerformanceMode) return handles;

    // ─── 1. DB connections (explicit Mind Map links) ─────────
    if (connections && connections.length > 0) {
        for (const conn of connections) {
            const roomA = rooms.find(r => r.id === conn.room_a_id);
            const roomB = rooms.find(r => r.id === conn.room_b_id);
            if (!roomA || !roomB) continue;

            const cx1 = roomA.x + roomA.width / 2;
            const cy1 = roomA.y + roomA.height / 2;
            const cx2 = roomB.x + roomB.width / 2;
            const cy2 = roomB.y + roomB.height / 2;

            const connColor = conn.color ? hexColor(conn.color) : 0x6366f1;

            if (layoutMode === 'hierarchical') {
                // Straight elbow connector (org chart style: vertical down, horizontal, vertical down)
                const bottomA = roomA.y + roomA.height;
                const topB = roomB.y;
                const midY = (bottomA + topB) / 2;

                gfx.moveTo(cx1, bottomA);
                gfx.lineTo(cx1, midY);
                gfx.lineTo(cx2, midY);
                gfx.lineTo(cx2, topB);
                gfx.stroke({ color: connColor, width: 2.5, alpha: 0.6 });

                // Small dots at connection points
                gfx.circle(cx1, bottomA, 4);
                gfx.fill({ color: connColor, alpha: 0.8 });
                gfx.circle(cx2, topB, 4);
                gfx.fill({ color: connColor, alpha: 0.8 });

                // Label at midpoint
                if (conn.label && labelContainer) {
                    const labelStyle = new TextStyle({
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontSize: 10,
                        fontWeight: '600',
                        fill: 0xffffff,
                        letterSpacing: 0.5,
                    });
                    const labelText = new Text({ text: conn.label.toUpperCase(), style: labelStyle, resolution: 4 });
                    labelText.anchor.set(0.5, 0.5);
                    labelText.position.set((cx1 + cx2) / 2, midY);

                    const labelBg = new Graphics();
                    const padding = 6;
                    const lw = labelText.width + padding * 2;
                    const lh = labelText.height + padding;
                    labelBg.roundRect((cx1 + cx2) / 2 - lw / 2, midY - lh / 2, lw, lh, 8);
                    labelBg.fill({ color: connColor, alpha: 0.85 });

                    labelContainer.addChild(labelBg);
                    labelContainer.addChild(labelText);
                }
            } else {
                // Edge-to-edge connections — teamsmap / free
                // Find intersection with room border (edge) instead of center
                const edgeA = getRoomEdge(roomA, cx2, cy2);
                const edgeB = getRoomEdge(roomB, cx1, cy1);

                // Controlpoint: default at mid, offset by cp_offset from connection data
                const cpOffsetX = conn.cp_offset_x ?? 0;
                const cpOffsetY = conn.cp_offset_y ?? 0;
                const midX = (edgeA.x + edgeB.x) / 2 + cpOffsetX;
                const midY = (edgeA.y + edgeB.y) / 2 + cpOffsetY;

                // Glow line (wider, transparent — underneath)
                gfx.moveTo(edgeA.x, edgeA.y);
                gfx.quadraticCurveTo(midX, midY, edgeB.x, edgeB.y);
                gfx.stroke({ color: connColor, width: 8, alpha: 0.12 });

                // Main line (sharp, on top)
                gfx.moveTo(edgeA.x, edgeA.y);
                gfx.quadraticCurveTo(midX, midY, edgeB.x, edgeB.y);
                gfx.stroke({ color: connColor, width: 3, alpha: 0.7 });

                // Endpoint dots with glow
                gfx.circle(edgeA.x, edgeA.y, 6);
                gfx.fill({ color: connColor, alpha: 0.15 });
                gfx.circle(edgeA.x, edgeA.y, 4);
                gfx.fill({ color: connColor, alpha: 0.9 });
                gfx.circle(edgeB.x, edgeB.y, 6);
                gfx.fill({ color: connColor, alpha: 0.15 });
                gfx.circle(edgeB.x, edgeB.y, 4);
                gfx.fill({ color: connColor, alpha: 0.9 });

                // Store endpoint handles for drag-and-drop in builder
                handles.push({ connId: conn.id, x: edgeA.x, y: edgeA.y, side: 'a' });
                handles.push({ connId: conn.id, x: edgeB.x, y: edgeB.y, side: 'b' });

                // Render large endpoint handles in builder mode
                if (isBuilderMode && labelContainer) {
                    for (const ep of [{ ex: edgeA.x, ey: edgeA.y }, { ex: edgeB.x, ey: edgeB.y }]) {
                        const epHandle = new Graphics();
                        epHandle.circle(ep.ex, ep.ey, 10);
                        epHandle.fill({ color: 0xffffff, alpha: 0.15 });
                        epHandle.circle(ep.ex, ep.ey, 6);
                        epHandle.fill({ color: connColor, alpha: 1 });
                        epHandle.circle(ep.ex, ep.ey, 3);
                        epHandle.fill({ color: 0xffffff, alpha: 0.9 });
                        labelContainer.addChild(epHandle);
                    }
                }

                // Label at control point
                if (conn.label && labelContainer) {
                    const labelStyle = new TextStyle({
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontSize: 12,
                        fontWeight: '700',
                        fill: 0xffffff,
                        letterSpacing: 0.5,
                    });
                    const labelText = new Text({ text: conn.label.toUpperCase(), style: labelStyle, resolution: 4 });
                    labelText.anchor.set(0.5, 0.5);
                    labelText.position.set(midX, midY);

                    const labelBg = new Graphics();
                    const padding = 8;
                    const lw = labelText.width + padding * 2;
                    const lh = labelText.height + padding;
                    labelBg.roundRect(midX - lw / 2, midY - lh / 2, lw, lh, 10);
                    labelBg.fill({ color: connColor, alpha: 0.85 });

                    labelContainer.addChild(labelBg);
                    labelContainer.addChild(labelText);
                }

                // Store handle data for draggable control point
                handles.push({ connId: conn.id, x: midX, y: midY });

                // Render visual handle in builder mode
                if (isBuilderMode && labelContainer) {
                    const handle = new Graphics();
                    handle.circle(midX, midY, 8);
                    handle.fill({ color: 0xffffff, alpha: 0.9 });
                    handle.circle(midX, midY, 5);
                    handle.fill({ color: connColor, alpha: 1 });
                    labelContainer.addChild(handle);
                }
            }
        }
    }

    // ─── 2. Proximity fallback (faint lines for close rooms without explicit connections) ─
    const connectedPairs = new Set<string>();
    if (connections) {
        for (const c of connections) {
            connectedPairs.add(`${c.room_a_id}_${c.room_b_id}`);
            connectedPairs.add(`${c.room_b_id}_${c.room_a_id}`);
        }
    }

    for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
            const r1 = rooms[i];
            const r2 = rooms[j];
            if (connectedPairs.has(`${r1.id}_${r2.id}`)) continue;
            const cx1 = r1.x + r1.width / 2;
            const cy1 = r1.y + r1.height / 2;
            const cx2 = r2.x + r2.width / 2;
            const cy2 = r2.y + r2.height / 2;
            const dist = Math.sqrt((cx2 - cx1) ** 2 + (cy2 - cy1) ** 2);
            if (dist > 800) continue;
            const alpha = 0.15 * (1 - dist / 800);
            gfx.moveTo(cx1, cy1);
            gfx.lineTo(cx2, cy2);
            gfx.stroke({ color: 0x6366f1, width: 1, alpha });
        }
    }
    return handles;
}
