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

    // ─── Bottom subtle line (divider for occupants area) ────
    body.rect(room.x + 16, room.y + room.height - 30, room.width - 32, 1);
    body.fill({ color: 0xffffff, alpha: 0.06 });

    container.addChild(body);

    // ─── Room name — large, bold, very visible ────────────────
    const nameStyle = new TextStyle({
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 22,
        fontWeight: '800',
        fill: 0xffffff,
        letterSpacing: 0.5,
        dropShadow: {
            alpha: 0.6,
            angle: Math.PI / 4,
            blur: 4,
            distance: 0,
            color: colorNum,
        },
    });
    const nameText = new Text({ text: room.name, style: nameStyle });
    nameText.position.set(room.x + 16, room.y + 14);
    container.addChild(nameText);

    // ─── Pill label — shows department (white) or type (colored) ─────
    const pillText = department ? department.toUpperCase() : typeLabel;
    const pillIsDepart = !!department;

    const typePillBg = new Graphics();
    const typePillW = pillText.length * 8 + 18;
    typePillBg.roundRect(room.x + 16, room.y + 44, typePillW, 22, 11);
    typePillBg.fill({ color: pillIsDepart ? 0x1e293b : colorNum, alpha: pillIsDepart ? 0.6 : 0.22 });
    typePillBg.stroke({ color: pillIsDepart ? 0x475569 : colorNum, width: 1, alpha: pillIsDepart ? 0.5 : 0.4 });
    container.addChild(typePillBg);

    const typeStyle = new TextStyle({
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 12,
        fontWeight: '700',
        fill: pillIsDepart ? 0xf1f5f9 : hexColor(color),
        letterSpacing: 1.4,
    });
    const typeLabelText = new Text({ text: pillText, style: typeStyle });
    typeLabelText.position.set(room.x + 25, room.y + 48);
    container.addChild(typeLabelText);

    // ─── Bottom status line (bigger) ──────────────────────────
    if (occupants > 0) {
        // Dot
        const statusDot = new Graphics();
        statusDot.circle(room.x + 16, room.y + room.height - 18, 4);
        statusDot.fill({ color: 0x34d399, alpha: 1 });
        container.addChild(statusDot);

        const statusStyle = new TextStyle({
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 14,
            fontWeight: '700',
            fill: 0x34d399,
            letterSpacing: 0.3,
        });
        const status = new Text({ text: `${occupants} online`, style: statusStyle });
        status.position.set(room.x + 26, room.y + room.height - 27);
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
