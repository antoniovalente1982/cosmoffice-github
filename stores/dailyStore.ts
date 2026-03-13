// ============================================
// BACKWARDS COMPATIBILITY SHIM
// This file re-exports everything from mediaStore.ts
// TODO: Delete this file once all external references are updated
// ============================================

export { useMediaStore as useDailyStore } from './mediaStore';
