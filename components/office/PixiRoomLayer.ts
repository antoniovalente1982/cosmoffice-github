// ============================================
// PixiRoomLayer — Room drawing helpers for Pixi.js
// ============================================

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { getRoomColor } from './OfficeBuilder';

// Room type labels (clean, no emoji)
const ROOM_TYPE_LABELS: Record<string, string> = {
    reception: 'RECEPTION',
    open: 'OPEN SPACE',
    meeting: 'MEETING',
    focus: 'FOCUS',
    break: 'BREAK',
    default: 'ROOM',
};

function hexColor(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
}

/**
 * Get the point on a room's border closest to a target point (edge intersection).
 * Used for edge-to-edge connections instead of center-to-center.
 */
function getRoomEdge(room: any, targetX: number, targetY: number): { x: number; y: number } {
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
export function drawRoom(container: Container, room: any, isHovered: boolean, occupants: number = 0) {
    container.removeChildren();

    const color = getRoomColor(room);
    const colorNum = hexColor(color);
    const department = room.settings?.department || room.department || null;
    const typeLabel = ROOM_TYPE_LABELS[room.type] || ROOM_TYPE_LABELS.default;
    const isCircle = room.shape === 'circle';

    // ─── Background layers ───────────────────────────────────
    const body = new Graphics();

    if (isCircle) {
        // Circle room: center + radius from bounding box
        const cx = room.x + room.width / 2;
        const cy = room.y + room.height / 2;
        const r = Math.min(room.width, room.height) / 2;

        // Outer soft glow
        body.circle(cx, cy, r + 8);
        body.fill({ color: colorNum, alpha: isHovered ? 0.20 : 0.10 });

        // Mid glow
        body.circle(cx, cy, r + 3);
        body.fill({ color: colorNum, alpha: isHovered ? 0.14 : 0.07 });

        // Main background — dark glass
        body.circle(cx, cy, r);
        body.fill({ color: 0x070c18, alpha: 0.85 });

        // Color tint overlay
        body.circle(cx, cy, r);
        body.fill({ color: colorNum, alpha: isHovered ? 0.12 : 0.05 });

        // Border — thick and glowing
        body.circle(cx, cy, r);
        body.stroke({ color: colorNum, width: isHovered ? 4 : 3, alpha: isHovered ? 0.95 : 0.6 });
    } else {
        // Rect room (original)
        // Outer soft glow
        body.roundRect(room.x - 8, room.y - 8, room.width + 16, room.height + 16, 24);
        body.fill({ color: colorNum, alpha: isHovered ? 0.20 : 0.10 });

        // Mid glow
        body.roundRect(room.x - 3, room.y - 3, room.width + 6, room.height + 6, 19);
        body.fill({ color: colorNum, alpha: isHovered ? 0.14 : 0.07 });

        // Main card background — dark glass
        body.roundRect(room.x, room.y, room.width, room.height, 16);
        body.fill({ color: 0x070c18, alpha: 0.85 });

        // Color tint overlay
        body.roundRect(room.x, room.y, room.width, room.height, 16);
        body.fill({ color: colorNum, alpha: isHovered ? 0.12 : 0.05 });

        // Border — thick and glowing
        body.roundRect(room.x, room.y, room.width, room.height, 16);
        body.stroke({ color: colorNum, width: isHovered ? 4 : 3, alpha: isHovered ? 0.95 : 0.6 });
    }

    container.addChild(body);

    // ═══════════════════════════════════════════════════════
    // LABELS — OUTSIDE the room, above
    // ═══════════════════════════════════════════════════════

    // ─── Room name ────────────────────────────────────────
    const nameStyle = new TextStyle({
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 18,
        fontWeight: '700',
        fill: 0xffffff,
        letterSpacing: 0.3,
    });
    const nameText = new Text({ text: room.name, style: nameStyle });
    if (isCircle) {
        nameText.anchor.set(0.5, 1);
        nameText.position.set(room.x + room.width / 2, room.y - 58);
    } else {
        nameText.position.set(room.x + 2, room.y - 58);
    }
    container.addChild(nameText);

    // ─── Subtitle line: DEPARTMENT · TYPE ──────────────────
    const subtitleParts: string[] = [];
    if (department) subtitleParts.push(department.toUpperCase());
    subtitleParts.push(typeLabel);
    const subtitleStr = subtitleParts.join('  ·  ');

    const subStyle = new TextStyle({
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 10,
        fontWeight: '600',
        fill: hexColor(color),
        letterSpacing: 1.2,
    });
    const subText = new Text({ text: subtitleStr, style: subStyle });
    if (isCircle) {
        subText.anchor.set(0.5, 1);
        subText.position.set(room.x + room.width / 2, room.y - 32);
    } else {
        subText.position.set(room.x + 2, room.y - 32);
    }
    container.addChild(subText);

    // ═══════════════════════════════════════════════════════
    // INSIDE — occupant status
    // ═══════════════════════════════════════════════════════

    if (occupants > 0) {
        const statusStyle = new TextStyle({
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 12,
            fontWeight: '700',
            fill: 0x34d399,
            letterSpacing: 0.3,
        });
        const statusText = `${occupants} online`;
        const status = new Text({ text: statusText, style: statusStyle });

        if (isCircle) {
            const cy = room.y + room.height / 2;
            const r = Math.min(room.width, room.height) / 2;
            // Inside circle, near bottom
            const statusY = cy + r - 22;
            status.anchor.set(0.5, 0.5);
            status.position.set(room.x + room.width / 2, statusY);
            // Green dot
            const statusDot = new Graphics();
            statusDot.circle(room.x + room.width / 2 - status.width / 2 - 10, statusY, 3.5);
            statusDot.fill({ color: 0x34d399, alpha: 1 });
            container.addChild(statusDot);
            container.addChild(status);
        } else {
            const statusY = room.y + room.height - 14;
            status.anchor.set(0, 0.5);
            status.position.set(room.x + 24, statusY);
            // Green dot
            const statusDot = new Graphics();
            statusDot.circle(room.x + 14, statusY, 3.5);
            statusDot.fill({ color: 0x34d399, alpha: 1 });
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
): { connId: string; x: number; y: number }[] {
    const handles: { connId: string; x: number; y: number }[] = [];
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
                    const labelText = new Text({ text: conn.label.toUpperCase(), style: labelStyle });
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

                gfx.moveTo(edgeA.x, edgeA.y);
                gfx.quadraticCurveTo(midX, midY, edgeB.x, edgeB.y);
                gfx.stroke({ color: connColor, width: 3, alpha: 0.7 });

                // Small dots at edge endpoints
                gfx.circle(edgeA.x, edgeA.y, 4);
                gfx.fill({ color: connColor, alpha: 0.9 });
                gfx.circle(edgeB.x, edgeB.y, 4);
                gfx.fill({ color: connColor, alpha: 0.9 });

                // Label at control point
                if (conn.label && labelContainer) {
                    const labelStyle = new TextStyle({
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontSize: 12,
                        fontWeight: '700',
                        fill: 0xffffff,
                        letterSpacing: 0.5,
                    });
                    const labelText = new Text({ text: conn.label.toUpperCase(), style: labelStyle });
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
