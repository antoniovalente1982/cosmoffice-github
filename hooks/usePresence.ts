import { useEffect, useRef, useCallback } from 'react';
import { useAvatarStore } from '../stores/avatarStore';
import { useWorkspaceStore } from '../stores/workspaceStore';

/**
 * usePresence — Online/offline detection via PartyKit ONLY.
 * 
 * Previously used Supabase Presence (an extra Realtime channel per user).
 * Now fully handled by PartyKit which already tracks all connected users
 * via useAvatarSync. This hook is kept as a lightweight wrapper for
 * components that need to react to status changes.
 * 
 * Media state (mic/cam/speaking) is broadcast via PartyKit (useAvatarSync).
 */
export function usePresence() {
    // PartyKit already handles all presence via useAvatarSync:
    // - Users are added to peers on 'init' and 'user_update'
    // - Users are removed on 'leave'
    // - Status/profile is synced on 'identify'
    // 
    // No Supabase Realtime channel needed.
}
