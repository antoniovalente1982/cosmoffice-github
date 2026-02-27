// ============================================
// COSMOFFICE - HOOKS EXPORTS
// ============================================

// Auth & User
export { useCurrentUser } from './useCurrentUser';

// Workspace
export {
  useWorkspace,
  useUserWorkspaces,
  useCreateWorkspace,
  useInviteMember,
  useRemoveMember,
  useJoinRequest,
} from './useWorkspace';

// Permissions & RBAC
export {
  usePermissions,
  useWorkspaceRole,
  useIsMember,
} from './usePermissions';

// Moderation
export {
  useModeration,
  useRoomModeration,
  useBannedUsers,
} from './useModeration';

// Room & Presence
export {
  useRoom,
  useRoomChat,
  usePresence,
} from './useRoom';

// Edge Functions
export { useEdgeFunctions } from './useEdgeFunctions';

// Presence Manager
export {
  usePresenceManager,
  useOnlineUsers,
} from './usePresenceManager';

// Re-export types
export type { PermissionResult, ModerationState } from './usePermissions';
