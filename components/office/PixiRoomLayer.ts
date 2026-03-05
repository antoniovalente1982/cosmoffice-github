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
 * Draw a single room card onto its container
 */
export function drawRoom(container: Container, room: any, isHovered: boolean, occupants: number = 0) {
    container.removeChildren();

    const color = getRoomColor(room);
    const colorNum = hexColor(color);
    const department = room.settings?.department || room.department || null;
    const typeLabel = ROOM_TYPE_LABELS[room.type] || ROOM_TYPE_LABELS.default;

    // ─── Background layers ───────────────────────────────────
    const body = new Graphics();

    // Outer soft glow
    body.roundRect(room.x - 8, room.y - 8, room.width + 16, room.height + 16, 24);
    body.fill({ color: colorNum, alpha: isHovered ? 0.20 : 0.10 });

    // Mid glow
    body.roundRect(room.x - 3, room.y - 3, room.width + 6, room.height + 6, 19);
    body.fill({ color: colorNum, alpha: isHovered ? 0.14 : 0.07 });

    // ─── Main card background — dark glass ──────────────────
    body.roundRect(room.x, room.y, room.width, room.height, 16);
    body.fill({ color: 0x070c18, alpha: 0.85 });

    // ─── Color tint overlay ─────────────────────────────────
    body.roundRect(room.x, room.y, room.width, room.height, 16);
    body.fill({ color: colorNum, alpha: isHovered ? 0.12 : 0.05 });

    // ─── Premium Glass Shine (Top Edge Glow) ────────────────
    body.roundRect(room.x + 1, room.y + 1, room.width - 2, 2, 8);
    body.fill({ color: 0xffffff, alpha: isHovered ? 0.25 : 0.15 });

    // ─── Border — thick and glowing ─────────────────────────
    body.roundRect(room.x, room.y, room.width, room.height, 16);
    body.stroke({ color: colorNum, width: isHovered ? 2.5 : 1.5, alpha: isHovered ? 0.9 : 0.5 });



    container.addChild(body);

    // ═══════════════════════════════════════════════════════
    // LABELS — OUTSIDE the room, above top-left
    // Keeps the interior clean for avatars
    // ═══════════════════════════════════════════════════════

    // ─── Room name — above the room, left-aligned ─────────
    const nameStyle = new TextStyle({
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 14,
        fontWeight: '700',
        fill: 0xffffff,
        letterSpacing: 0.3,
    });
    const nameText = new Text({ text: room.name, style: nameStyle });
    nameText.position.set(room.x + 2, room.y - 34);
    container.addChild(nameText);

    // ─── Subtitle line: DEPARTMENT · TYPE — below name ────
    const subtitleParts: string[] = [];
    if (department) subtitleParts.push(department.toUpperCase());
    subtitleParts.push(typeLabel);
    const subtitleStr = subtitleParts.join('  ·  ');

    const subStyle = new TextStyle({
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 9,
        fontWeight: '600',
        fill: hexColor(color),
        letterSpacing: 1.2,
    });
    const subText = new Text({ text: subtitleStr, style: subStyle });
    subText.position.set(room.x + 2, room.y - 16);
    container.addChild(subText);

    // ═══════════════════════════════════════════════════════
    // INSIDE — only the occupant status at bottom-left
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

/**
 * Draw room connections (lines between close rooms)
 */
export function drawRoomConnections(gfx: Graphics, rooms: any[], isPerformanceMode: boolean) {
    gfx.clear();
    if (isPerformanceMode) return;

    for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
            const r1 = rooms[i];
            const r2 = rooms[j];
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
}
