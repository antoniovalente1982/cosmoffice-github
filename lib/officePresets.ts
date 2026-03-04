// ─── Office size presets ──────────────────────────────────────────
export const OFFICE_PRESETS = [
    { id: 'starter', label: 'Starter', capacity: '1–10', width: 2000, height: 1500, icon: '🏠' },
    { id: 'team', label: 'Team', capacity: '10–50', width: 4000, height: 3000, icon: '🏢' },
    { id: 'business', label: 'Business', capacity: '50–200', width: 6000, height: 4500, icon: '🏗️' },
    { id: 'enterprise', label: 'Enterprise', capacity: '200+', width: 10000, height: 7500, icon: '🌐' },
] as const;

export function getPresetForSize(w: number, h: number) {
    const area = w * h;
    if (area <= 2000 * 1500) return OFFICE_PRESETS[0];
    if (area <= 4000 * 3000) return OFFICE_PRESETS[1];
    if (area <= 6000 * 4500) return OFFICE_PRESETS[2];
    return OFFICE_PRESETS[3];
}
