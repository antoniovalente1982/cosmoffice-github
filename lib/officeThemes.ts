// ─── Office Theme System ─────────────────────────────────────────
// Two visual themes: 'space' (cosmic) and 'corporate' (professional)
// Theme is stored in workspaces.settings.theme (jsonb)

export type OfficeThemeId = 'space' | 'corporate';

export interface OfficeThemeConfig {
    id: OfficeThemeId;
    label: string;
    icon: string;
    description: string;

    // PixiJS canvas
    canvasBg: number;

    // CSS background + grid
    bgGradientCSS: string;
    gridCSS: string;
    gridOpacity: number;

    // Platform (office floor)
    platformFill: number;
    platformFillAlpha: number;
    platformInnerFill: number;
    platformInnerAlpha: number;
    platformBorder: number;
    platformBorderAlpha: number;

    // Room cards
    roomBg: number;
    roomBgAlpha: number;
    roomGlowAlpha: number;
    roomGlowHoverAlpha: number;
    roomTextColor: number;
    roomStatusTextColor: number;

    // Connections
    connectionColor: number;
    connectionAlpha: number;
    proximityLineColor: number;

    // Particles
    particleColors: number[];
    particleAlpha: number;

    // Features toggle
    showSpaceship: boolean;
    showStars: boolean;
    showParticles: boolean;

    // Landing pad (corporate alternative)
    landingPadLabel: string;

    // HUD
    hudBadgeText: string;
    hudBadgeColor: string;
    hudBgAlpha: number;
    hudTextColor: number;
}

// ─── Space Theme (current cosmic look) ──────────────────────────
const SPACE_THEME: OfficeThemeConfig = {
    id: 'space',
    label: 'Spaziale',
    icon: '🚀',
    description: 'Atmosfera cosmica con stelle, navicella e sfumature galattiche',

    canvasBg: 0x050a15,

    bgGradientCSS: `
        radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.12) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.12) 0%, transparent 40%),
        radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.08) 0%, transparent 60%),
        linear-gradient(135deg, #050a15 0%, #0a0f1e 50%, #030712 100%)
    `,
    gridCSS: `
        linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px)
    `,
    gridOpacity: 0.2,

    platformFill: 0x06b6d4,
    platformFillAlpha: 0.02,
    platformInnerFill: 0x0a0f1e,
    platformInnerAlpha: 0.75,
    platformBorder: 0x06b6d4,
    platformBorderAlpha: 0.15,

    roomBg: 0x070c18,
    roomBgAlpha: 0.85,
    roomGlowAlpha: 0.10,
    roomGlowHoverAlpha: 0.20,
    roomTextColor: 0xffffff,
    roomStatusTextColor: 0x34d399,

    connectionColor: 0x6366f1,
    connectionAlpha: 0.7,
    proximityLineColor: 0x6366f1,

    particleColors: [0xffffff, 0xe2e8f0, 0xcbd5e1],
    particleAlpha: 0.6,

    showSpaceship: true,
    showStars: true,
    showParticles: true,

    landingPadLabel: 'Landing Pad',

    hudBadgeText: 'WebGL',
    hudBadgeColor: 'text-cyan-400',
    hudBgAlpha: 0.9,
    hudTextColor: 0xffffff,
};

// ─── Corporate Theme (professional look) ────────────────────────
const CORPORATE_THEME: OfficeThemeConfig = {
    id: 'corporate',
    label: 'Aziendale',
    icon: '🏢',
    description: 'Design pulito e professionale con toni chiari e moderni',

    canvasBg: 0xf0f4f8,

    bgGradientCSS: `
        radial-gradient(circle at 20% 30%, rgba(59, 130, 246, 0.06) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(99, 102, 241, 0.04) 0%, transparent 50%),
        linear-gradient(145deg, #f8fafc 0%, #f0f4f8 40%, #e8eef5 100%)
    `,
    gridCSS: `
        radial-gradient(circle, rgba(148, 163, 184, 0.3) 1px, transparent 1px)
    `,
    gridOpacity: 0.4,

    platformFill: 0x3b82f6,
    platformFillAlpha: 0.03,
    platformInnerFill: 0xffffff,
    platformInnerAlpha: 0.4,
    platformBorder: 0x93c5fd,
    platformBorderAlpha: 0.2,

    roomBg: 0xffffff,
    roomBgAlpha: 0.92,
    roomGlowAlpha: 0.06,
    roomGlowHoverAlpha: 0.12,
    roomTextColor: 0x1e293b,
    roomStatusTextColor: 0x059669,

    connectionColor: 0x94a3b8,
    connectionAlpha: 0.5,
    proximityLineColor: 0x94a3b8,

    particleColors: [0x94a3b8, 0xbfdbfe, 0xc7d2fe],
    particleAlpha: 0.3,

    showSpaceship: false,
    showStars: false,
    showParticles: false,

    landingPadLabel: 'Reception',

    hudBadgeText: 'Office',
    hudBadgeColor: 'text-blue-500',
    hudBgAlpha: 0.85,
    hudTextColor: 0x1e293b,
};

// ─── Theme Registry ─────────────────────────────────────────────
export const OFFICE_THEMES: Record<OfficeThemeId, OfficeThemeConfig> = {
    space: SPACE_THEME,
    corporate: CORPORATE_THEME,
};

export function getThemeConfig(id: OfficeThemeId | string | undefined): OfficeThemeConfig {
    if (id && id in OFFICE_THEMES) return OFFICE_THEMES[id as OfficeThemeId];
    return SPACE_THEME; // default
}
