// ============================================
// OFFICE TEMPLATES — Pre-built office layouts
// Owners/admins can apply these to set up
// their workspace with one click.
// ============================================

export interface TemplateRoom {
    name: string;
    type: string;
    department?: string | null;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    capacity: number;
}

export interface OfficeTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    officeWidth: number;
    officeHeight: number;
    rooms: TemplateRoom[];
    tags: string[];
}

export const OFFICE_TEMPLATES: OfficeTemplate[] = [
    // ─── Sales & Marketing Agency ────────────────────────
    {
        id: 'sales-agency',
        name: 'Agenzia Sales & Marketing',
        description: 'Amministrazione, Marketing, Setter, Sales, Coach, HR, stanze clienti e sala riunioni',
        icon: '🏢',
        officeWidth: 5000,
        officeHeight: 4000,
        tags: ['sales', 'marketing', 'agency'],
        rooms: [
            // Row 1 — Leadership & Admin (top)
            { name: 'Amministrazione', type: 'open', department: 'Admin', x: 100, y: 100, width: 400, height: 300, color: '#3b82f6', capacity: 6 },
            { name: 'HR', type: 'open', department: 'HR', x: 560, y: 100, width: 300, height: 300, color: '#14b8a6', capacity: 4 },
            { name: 'Coach', type: 'focus', department: 'Coaching', x: 920, y: 100, width: 280, height: 300, color: '#f59e0b', capacity: 3 },

            // Row 2 — Core Teams (middle)
            { name: 'Marketing', type: 'open', department: 'Marketing', x: 100, y: 500, width: 450, height: 350, color: '#a855f7', capacity: 12 },
            { name: 'Setter', type: 'open', department: 'Sales', x: 610, y: 500, width: 350, height: 350, color: '#ef4444', capacity: 8 },
            { name: 'Sales', type: 'open', department: 'Sales', x: 1020, y: 500, width: 450, height: 350, color: '#f97316', capacity: 10 },

            // Row 3 — Meeting & Client Rooms (bottom)
            { name: 'Sala Riunioni', type: 'meeting', department: null, x: 100, y: 950, width: 500, height: 350, color: '#8b5cf6', capacity: 20 },
            { name: 'Meeting Cliente 1', type: 'meeting', department: null, x: 660, y: 950, width: 250, height: 250, color: '#06b6d4', capacity: 4 },
            { name: 'Meeting Cliente 2', type: 'meeting', department: null, x: 970, y: 950, width: 250, height: 250, color: '#06b6d4', capacity: 4 },
            { name: 'Meeting Cliente 3', type: 'meeting', department: null, x: 1280, y: 950, width: 250, height: 250, color: '#06b6d4', capacity: 4 },
        ],
    },

    // ─── Startup Tech ────────────────────────────────────
    {
        id: 'tech-startup',
        name: 'Startup Tech',
        description: 'Dev, Design, Product, QA con stanze daily standup e war room',
        icon: '🚀',
        officeWidth: 5000,
        officeHeight: 3500,
        tags: ['tech', 'startup', 'development'],
        rooms: [
            // Top — Product & Leadership
            { name: 'Product', type: 'open', department: 'Product', x: 100, y: 100, width: 350, height: 280, color: '#f59e0b', capacity: 6 },
            { name: 'Design Studio', type: 'open', department: 'Design', x: 510, y: 100, width: 350, height: 280, color: '#f97316', capacity: 8 },
            { name: 'QA Lab', type: 'focus', department: 'QA', x: 920, y: 100, width: 280, height: 280, color: '#14b8a6', capacity: 5 },

            // Middle — Dev Teams
            { name: 'Frontend Team', type: 'open', department: 'Engineering', x: 100, y: 480, width: 400, height: 300, color: '#3b82f6', capacity: 10 },
            { name: 'Backend Team', type: 'open', department: 'Engineering', x: 560, y: 480, width: 400, height: 300, color: '#6366f1', capacity: 10 },
            { name: 'DevOps', type: 'focus', department: 'Engineering', x: 1020, y: 480, width: 250, height: 300, color: '#8b5cf6', capacity: 4 },

            // Bottom — Meeting spaces
            { name: 'Daily Standup', type: 'meeting', x: 100, y: 880, width: 300, height: 250, color: '#10b981', capacity: 15 },
            { name: 'War Room', type: 'meeting', x: 460, y: 880, width: 350, height: 250, color: '#ef4444', capacity: 10 },
            { name: 'Break Room', type: 'break', x: 870, y: 880, width: 250, height: 250, color: '#06b6d4', capacity: 8 },
        ],
    },

    // ─── Agenzia Creativa ────────────────────────────────
    {
        id: 'creative-agency',
        name: 'Agenzia Creativa',
        description: 'Account Manager, Graphic, Video, Copy, Social con brainstorming room',
        icon: '🎨',
        officeWidth: 5000,
        officeHeight: 3500,
        tags: ['creative', 'agency', 'design'],
        rooms: [
            // Top — Management
            { name: 'Direzione', type: 'open', department: 'Management', x: 100, y: 100, width: 350, height: 280, color: '#3b82f6', capacity: 4 },
            { name: 'Account Manager', type: 'open', department: 'Account', x: 510, y: 100, width: 380, height: 280, color: '#f59e0b', capacity: 6 },

            // Middle — Creative Studios
            { name: 'Graphic Design', type: 'open', department: 'Creative', x: 100, y: 480, width: 350, height: 300, color: '#f97316', capacity: 8 },
            { name: 'Video Editing', type: 'focus', department: 'Creative', x: 510, y: 480, width: 300, height: 300, color: '#ef4444', capacity: 5 },
            { name: 'Copywriting', type: 'focus', department: 'Content', x: 870, y: 480, width: 280, height: 300, color: '#a855f7', capacity: 6 },

            // Bottom
            { name: 'Social Media', type: 'open', department: 'Social', x: 100, y: 880, width: 320, height: 280, color: '#ec4899', capacity: 6 },
            { name: 'Brainstorming', type: 'meeting', x: 480, y: 880, width: 400, height: 280, color: '#10b981', capacity: 12 },
            { name: 'Call Clienti', type: 'meeting', x: 940, y: 880, width: 250, height: 250, color: '#06b6d4', capacity: 4 },
        ],
    },

    // ─── Consulenza / Studio Professionale ───────────────
    {
        id: 'consulting',
        name: 'Studio Professionale',
        description: 'Reception, studi privati, sala consulenze e archivio',
        icon: '⚖️',
        officeWidth: 4000,
        officeHeight: 3500,
        tags: ['consulting', 'legal', 'professional'],
        rooms: [
            // Entrance
            { name: 'Reception', type: 'reception', x: 100, y: 100, width: 400, height: 200, color: '#f59e0b', capacity: 3 },

            // Private offices
            { name: 'Studio 1', type: 'focus', department: 'Senior', x: 100, y: 400, width: 250, height: 250, color: '#3b82f6', capacity: 2 },
            { name: 'Studio 2', type: 'focus', department: 'Senior', x: 410, y: 400, width: 250, height: 250, color: '#6366f1', capacity: 2 },
            { name: 'Studio 3', type: 'focus', department: 'Senior', x: 720, y: 400, width: 250, height: 250, color: '#8b5cf6', capacity: 2 },

            // Meeting rooms
            { name: 'Sala Consulenze', type: 'meeting', x: 100, y: 750, width: 400, height: 300, color: '#14b8a6', capacity: 8 },
            { name: 'Sala Riunioni', type: 'meeting', x: 560, y: 750, width: 350, height: 300, color: '#a855f7', capacity: 10 },

            // Support
            { name: 'Back Office', type: 'open', department: 'Admin', x: 560, y: 100, width: 300, height: 200, color: '#10b981', capacity: 6 },
        ],
    },

    // ─── Small Team / Startup Minimo ─────────────────────
    {
        id: 'small-team',
        name: 'Team Piccolo',
        description: 'Ufficio aperto, meeting room e zona relax per team fino a 15 persone',
        icon: '🏠',
        officeWidth: 3000,
        officeHeight: 2500,
        tags: ['small', 'minimal', 'startup'],
        rooms: [
            { name: 'Open Space', type: 'open', x: 100, y: 100, width: 500, height: 350, color: '#3b82f6', capacity: 15 },
            { name: 'Meeting Room', type: 'meeting', x: 700, y: 100, width: 300, height: 250, color: '#8b5cf6', capacity: 6 },
            { name: 'Focus Zone', type: 'focus', x: 700, y: 420, width: 300, height: 200, color: '#06b6d4', capacity: 3 },
            { name: 'Break Room', type: 'break', x: 100, y: 550, width: 350, height: 250, color: '#10b981', capacity: 8 },
        ],
    },
];
