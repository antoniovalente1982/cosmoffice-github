// ─── Office Theme System ─────────────────────────────────────────
// Visual themes: 'space' (cosmic), 'corporate' (professional), 'medical' (healthcare)
// Theme is stored in workspaces.settings.theme (jsonb)

export type OfficeThemeId = 'space' | 'corporate' | 'medical';

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

// ─── Corporate Theme (dark professional look) ──────────────────
const CORPORATE_THEME: OfficeThemeConfig = {
    id: 'corporate',
    label: 'Aziendale',
    icon: '🏢',
    description: 'Design elegante e professionale con toni scuri e accenti raffinati',

    canvasBg: 0x0c1222,

    bgGradientCSS: `
        radial-gradient(circle at 15% 25%, rgba(30, 58, 138, 0.15) 0%, transparent 45%),
        radial-gradient(circle at 85% 75%, rgba(51, 65, 85, 0.12) 0%, transparent 45%),
        radial-gradient(circle at 50% 50%, rgba(30, 41, 59, 0.08) 0%, transparent 60%),
        linear-gradient(145deg, #0c1222 0%, #111827 40%, #0f172a 100%)
    `,
    gridCSS: `
        radial-gradient(circle, rgba(100, 116, 139, 0.15) 1px, transparent 1px)
    `,
    gridOpacity: 0.3,

    platformFill: 0x1e3a8a,
    platformFillAlpha: 0.04,
    platformInnerFill: 0x111827,
    platformInnerAlpha: 0.7,
    platformBorder: 0x3b82f6,
    platformBorderAlpha: 0.12,

    roomBg: 0x111827,
    roomBgAlpha: 0.9,
    roomGlowAlpha: 0.08,
    roomGlowHoverAlpha: 0.16,
    roomTextColor: 0xe2e8f0,
    roomStatusTextColor: 0x22d3ee,

    connectionColor: 0x475569,
    connectionAlpha: 0.5,
    proximityLineColor: 0x475569,

    particleColors: [0x475569],
    particleAlpha: 0.2,

    showSpaceship: false,
    showStars: false,
    showParticles: false,

    landingPadLabel: 'Reception',

    hudBadgeText: 'Office',
    hudBadgeColor: 'text-blue-400',
    hudBgAlpha: 0.85,
    hudTextColor: 0xe2e8f0,
};

// ─── Medical Theme (Turquoise Harmony palette) ──────────────────
const MEDICAL_THEME: OfficeThemeConfig = {
    id: 'medical',
    label: 'Sanitario',
    icon: '⚕️',
    description: 'Ambiente sanitario con palette Turquoise Harmony',

    canvasBg: 0x062e36,  // darkened #0B6477

    bgGradientCSS: `
        radial-gradient(circle at 20% 30%, rgba(11, 100, 119, 0.28) 0%, transparent 45%),
        radial-gradient(circle at 80% 65%, rgba(20, 145, 155, 0.22) 0%, transparent 45%),
        radial-gradient(circle at 50% 85%, rgba(10, 209, 200, 0.12) 0%, transparent 50%),
        linear-gradient(155deg, #041e24 0%, #073842 30%, #0B6477 60%, #062e36 100%)
    `,
    gridCSS: `
        linear-gradient(rgba(20, 145, 155, 0.12) 1px, transparent 1px),
        linear-gradient(90deg, rgba(20, 145, 155, 0.12) 1px, transparent 1px)
    `,
    gridOpacity: 0.4,

    platformFill: 0x0B6477,
    platformFillAlpha: 0.08,
    platformInnerFill: 0x073842,
    platformInnerAlpha: 0.80,
    platformBorder: 0x14919B,
    platformBorderAlpha: 0.35,

    roomBg: 0x052a32,
    roomBgAlpha: 0.92,
    roomGlowAlpha: 0.18,
    roomGlowHoverAlpha: 0.30,
    roomTextColor: 0xE8FCC8,        // pale cream from palette
    roomStatusTextColor: 0x80ED99,  // light green from palette

    connectionColor: 0x0AD1C8,      // turquoise from palette
    connectionAlpha: 0.65,
    proximityLineColor: 0x14919B,   // dark teal from palette

    particleColors: [0x45DFB1, 0x0AD1C8, 0x80ED99, 0xE8FCC8],  // full palette particles
    particleAlpha: 0.4,

    showSpaceship: false,
    showStars: false,
    showParticles: true,

    landingPadLabel: 'Accettazione',

    hudBadgeText: 'Medical',
    hudBadgeColor: 'text-cyan-400',
    hudBgAlpha: 0.90,
    hudTextColor: 0xE8FCC8,
};

// ─── Theme Registry ─────────────────────────────────────────────
export const OFFICE_THEMES: Record<OfficeThemeId, OfficeThemeConfig> = {
    space: SPACE_THEME,
    corporate: CORPORATE_THEME,
    medical: MEDICAL_THEME,
};

export function getThemeConfig(id: OfficeThemeId | string | undefined): OfficeThemeConfig {
    if (id && id in OFFICE_THEMES) return OFFICE_THEMES[id as OfficeThemeId];
    return SPACE_THEME; // default
}
