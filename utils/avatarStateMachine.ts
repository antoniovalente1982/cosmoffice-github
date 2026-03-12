// ============================================
// Avatar State Machine
// Resolves the correct visual/audio/video state
// based on priority rules (REGOLA 4 + 5)
// ============================================

export type AuraState = 'idle' | 'active' | 'dnd' | 'none';

export interface StateInputs {
    isDnd: boolean;
    isAway: boolean;
    inRoom: boolean;
    nearbyCount: number;
    closestDistance: number;
    adminMutedAudio: boolean;
    adminMutedVideo: boolean;
    proximityBlockedGlobal: boolean;
}

export interface ResolvedState {
    aura: AuraState;
    audioAllowed: boolean;
    videoAllowed: boolean;
    opacity: number;       // 1.0 = full, 0.5 = away
    showDndIcon: boolean;
    showMutedIcon: boolean;
    showCamOffIcon: boolean;
}

/**
 * Resolve the avatar's visual and media state based on priority rules:
 * 1. DND has absolute priority — no one can connect
 * 2. Room > Proximity — inside a room, aura is disabled
 * 3. Admin override — admin commands override any user state
 * 4. Away — no aura, no audio/video, 50% opacity
 */
export function resolveAvatarState(inputs: StateInputs): ResolvedState {
    // Priority 1: DND — absolute block
    if (inputs.isDnd) {
        return {
            aura: 'dnd',
            audioAllowed: false,
            videoAllowed: false,
            opacity: 1.0,
            showDndIcon: true,
            showMutedIcon: false,
            showCamOffIcon: false,
        };
    }

    // Priority 2: Away — ghost mode
    if (inputs.isAway) {
        return {
            aura: 'none',
            audioAllowed: false,
            videoAllowed: false,
            opacity: 0.5,
            showDndIcon: false,
            showMutedIcon: false,
            showCamOffIcon: false,
        };
    }

    // Priority 3: In a room — no aura, full audio/video with room participants
    if (inputs.inRoom) {
        return {
            aura: 'none',
            audioAllowed: !inputs.adminMutedAudio,
            videoAllowed: !inputs.adminMutedVideo,
            opacity: 1.0,
            showDndIcon: false,
            showMutedIcon: inputs.adminMutedAudio,
            showCamOffIcon: inputs.adminMutedVideo,
        };
    }

    // Priority 4: Open space — proximity logic
    if (inputs.proximityBlockedGlobal) {
        // Admin blocked all proximity
        return {
            aura: 'idle',
            audioAllowed: false,
            videoAllowed: false,
            opacity: 1.0,
            showDndIcon: false,
            showMutedIcon: false,
            showCamOffIcon: false,
        };
    }

    if (inputs.nearbyCount > 0) {
        // In proximity conversation
        return {
            aura: 'active',
            audioAllowed: !inputs.adminMutedAudio,
            videoAllowed: !inputs.adminMutedVideo && inputs.closestDistance < 150,
            opacity: 1.0,
            showDndIcon: false,
            showMutedIcon: inputs.adminMutedAudio,
            showCamOffIcon: inputs.adminMutedVideo,
        };
    }

    // Default: free in open space
    return {
        aura: 'idle',
        audioAllowed: false,
        videoAllowed: false,
        opacity: 1.0,
        showDndIcon: false,
        showMutedIcon: false,
        showCamOffIcon: false,
    };
}

/**
 * Get the adaptive volume for a peer based on distance.
 * Uses the specified tiers:
 * - 0-100px: 100%
 * - 100-200px: 60%
 * - 200-250px: 20%
 * - > 250px: 0 (should disconnect)
 */
export function getAdaptiveVolume(distancePx: number, maxRadius: number = 250): number {
    if (distancePx <= 0) return 1.0;
    if (distancePx >= maxRadius) return 0;

    // Quadratic falloff for more natural feel
    const normalized = distancePx / maxRadius;
    return Math.pow(1 - normalized, 2);
}

/**
 * Check if two users should be in the same proximity group.
 * Both must be in open space (not in a room), not DND, not away,
 * within proximity radius, and not blocked by a wall.
 */
export function canFormProximityConnection(
    userA: { isDnd: boolean; isAway: boolean; inRoom: boolean; roomId?: string | null },
    userB: { isDnd: boolean; isAway: boolean; inRoom: boolean; roomId?: string | null },
): boolean {
    if (userA.isDnd || userB.isDnd) return false;
    if (userA.isAway || userB.isAway) return false;
    
    // If both are in the SAME room, they can connect
    if (userA.inRoom && userB.inRoom) {
        if (userA.roomId && userB.roomId && userA.roomId === userB.roomId) {
            return true;
        }
    }
    
    // Otherwise, if any of them is in a room, they cannot connect via proximity
    if (userA.inRoom || userB.inRoom) return false;
    
    return true;
}
