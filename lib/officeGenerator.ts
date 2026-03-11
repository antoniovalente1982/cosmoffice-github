// ============================================
// OFFICE GENERATOR — AI Setup Wizard engine
// Generates smart office layouts from user inputs
// ============================================

import type { TemplateRoom } from './officeTemplates';

export interface WizardConfig {
    teamSize: number;          // 3-100
    departments: string[];     // e.g. ['Marketing', 'Sales', 'Dev']
    meetingFrequency: 'rarely' | 'weekly' | 'daily';
    workStyle: 'focus' | 'collaborative' | 'mixed';
}

interface GeneratedLayout {
    rooms: TemplateRoom[];
    officeWidth: number;
    officeHeight: number;
}

// ─── Department visual config ───────────────────────────
const DEPT_CONFIG: Record<string, { color: string; type: string; icon: string }> = {
    'Marketing':       { color: '#a855f7', type: 'open', icon: '📊' },
    'Sales':           { color: '#ef4444', type: 'open', icon: '📞' },
    'Dev':             { color: '#3b82f6', type: 'open', icon: '💻' },
    'Design':          { color: '#f97316', type: 'open', icon: '🎨' },
    'HR':              { color: '#14b8a6', type: 'open', icon: '🤝' },
    'Finance':         { color: '#10b981', type: 'open', icon: '💰' },
    'Support':         { color: '#06b6d4', type: 'open', icon: '🎧' },
    'Management':      { color: '#f59e0b', type: 'open', icon: '👔' },
    'Coaching':        { color: '#f59e0b', type: 'focus', icon: '🎯' },
    'Operations':      { color: '#6366f1', type: 'open', icon: '⚙️' },
    'Content':         { color: '#ec4899', type: 'open', icon: '✍️' },
    'Legal':           { color: '#8b5cf6', type: 'focus', icon: '⚖️' },
};

const DEFAULT_DEPT_CONFIG = { color: '#6366f1', type: 'open', icon: '🏢' };

// ─── Main generator ─────────────────────────────────────
export function generateSmartLayout(config: WizardConfig): GeneratedLayout {
    const { teamSize, departments, meetingFrequency, workStyle } = config;

    const rooms: TemplateRoom[] = [];
    const COL_GAP = 60;
    const ROW_GAP = 80;
    let currentY = 120;

    // ═══ Row 1: Reception + Break Room (always) ═════════
    const receptionW = Math.min(400, Math.max(250, teamSize * 8));
    rooms.push({
        name: 'Reception',
        type: 'reception',
        x: 100,
        y: currentY,
        width: receptionW,
        height: 200,
        color: '#f59e0b',
        capacity: Math.min(10, Math.ceil(teamSize * 0.3)),
    });

    rooms.push({
        name: 'Break Room',
        type: 'break',
        x: 100 + receptionW + COL_GAP,
        y: currentY,
        width: Math.max(200, Math.min(300, teamSize * 5)),
        height: 200,
        color: '#10b981',
        capacity: Math.min(15, Math.ceil(teamSize * 0.4)),
    });

    currentY += 200 + ROW_GAP;

    // ═══ Row 2: Department rooms ════════════════════════
    if (departments.length > 0) {
        let rowX = 100;
        const deptCapacity = Math.max(3, Math.ceil(teamSize / departments.length));
        const deptWidth = Math.max(250, Math.min(450, deptCapacity * 30));
        const deptHeight = Math.max(200, Math.min(350, deptCapacity * 25));
        let maxDeptH = 0;
        const maxRoomsPerRow = 3;
        let deptInRow = 0;

        for (const dept of departments) {
            const cfg = DEPT_CONFIG[dept] || DEFAULT_DEPT_CONFIG;

            // Wrap to next row if needed
            if (deptInRow >= maxRoomsPerRow) {
                currentY += maxDeptH + ROW_GAP;
                rowX = 100;
                deptInRow = 0;
                maxDeptH = 0;
            }

            rooms.push({
                name: dept === 'Dev' ? 'Development' : dept,
                type: cfg.type,
                department: dept,
                x: rowX,
                y: currentY,
                width: deptWidth,
                height: deptHeight,
                color: cfg.color,
                capacity: deptCapacity,
            });

            rowX += deptWidth + COL_GAP;
            maxDeptH = Math.max(maxDeptH, deptHeight);
            deptInRow++;
        }

        currentY += maxDeptH + ROW_GAP;
    }

    // ═══ Row 3: Focus zones (if work style favors focus) ═
    if (workStyle === 'focus' || workStyle === 'mixed') {
        const focusCount = workStyle === 'focus' ? Math.max(2, Math.ceil(teamSize / 8)) : Math.max(1, Math.ceil(teamSize / 15));
        const capped = Math.min(focusCount, 4);
        let rowX = 100;

        for (let i = 0; i < capped; i++) {
            rooms.push({
                name: `Focus Zone ${i + 1}`,
                type: 'focus',
                x: rowX,
                y: currentY,
                width: 200,
                height: 180,
                color: '#06b6d4',
                capacity: Math.max(2, Math.ceil(teamSize / (capped * 3))),
            });
            rowX += 200 + COL_GAP;
        }

        currentY += 180 + ROW_GAP;
    }

    // ═══ Row 4: Meeting rooms ═══════════════════════════
    const meetingCount = meetingFrequency === 'daily' ? Math.max(3, Math.ceil(teamSize / 8))
        : meetingFrequency === 'weekly' ? Math.max(2, Math.ceil(teamSize / 15))
        : 1;
    const cappedMeetings = Math.min(meetingCount, 5);
    let meetRowX = 100;

    // Main meeting room (bigger)
    const mainMeetingW = Math.max(350, Math.min(500, teamSize * 6));
    rooms.push({
        name: 'Sala Riunioni',
        type: 'meeting',
        x: meetRowX,
        y: currentY,
        width: mainMeetingW,
        height: 280,
        color: '#8b5cf6',
        capacity: Math.min(30, Math.ceil(teamSize * 0.6)),
    });
    meetRowX += mainMeetingW + COL_GAP;

    // Smaller meeting rooms
    for (let i = 1; i < cappedMeetings; i++) {
        rooms.push({
            name: `Meeting ${i + 1}`,
            type: 'meeting',
            x: meetRowX,
            y: currentY,
            width: 250,
            height: 250,
            color: '#06b6d4',
            capacity: Math.max(4, Math.ceil(teamSize / 6)),
        });
        meetRowX += 250 + COL_GAP;
    }

    currentY += 280 + ROW_GAP;

    // ═══ Calculate office dimensions ════════════════════
    let maxX = 0;
    for (const room of rooms) {
        const rightEdge = room.x + room.width;
        if (rightEdge > maxX) maxX = rightEdge;
    }

    const officeWidth = Math.max(3000, Math.min(6000, maxX + 300));
    const officeHeight = Math.max(2500, Math.min(5000, currentY + 200));

    return { rooms, officeWidth, officeHeight };
}
