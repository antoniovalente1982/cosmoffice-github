// ============================================
// Centralized Error Handler
// Replaces all alert() calls with structured error management
//
// Usage:
//   import { handleError, showToast } from '@/lib/errorHandler';
//   handleError(error, 'WorkspaceBilling.handleSubscription', 'warning');
//   showToast('Operazione completata!', 'success');
// ============================================

import { useNotificationStore } from '@/stores/notificationStore';

export type ErrorSeverity = 'info' | 'warning' | 'critical';

interface ErrorOptions {
    /** Show toast/notification to user. Default: true */
    showUser?: boolean;
    /** Custom user-facing message (overrides error.message) */
    userMessage?: string;
}

/**
 * Centralized error handler.
 * - Logs structured info to console
 * - Shows user-facing notification via notificationStore
 * - Never throws — safe to call anywhere
 */
export function handleError(
    error: unknown,
    context: string,
    severity: ErrorSeverity = 'warning',
    options: ErrorOptions = {}
) {
    const { showUser = true, userMessage } = options;

    // Extract message safely
    const message = error instanceof Error
        ? error.message
        : typeof error === 'string'
            ? error
            : 'Errore sconosciuto';

    // ── Structured console logging ──
    const logData = {
        context,
        severity,
        message,
        timestamp: new Date().toISOString(),
        ...(error instanceof Error && { stack: error.stack }),
    };

    switch (severity) {
        case 'critical':
            console.error(`[CRITICAL] ${context}:`, logData);
            break;
        case 'warning':
            console.warn(`[WARNING] ${context}:`, logData);
            break;
        case 'info':
            console.info(`[INFO] ${context}:`, logData);
            break;
    }

    // ── User-facing notification ──
    if (showUser) {
        const displayMessage = userMessage || message;
        const notificationType = severity === 'info' ? 'info' : 'system';
        const title = severity === 'critical'
            ? '❌ Errore Critico'
            : severity === 'warning'
                ? '⚠️ Attenzione'
                : 'ℹ️ Info';

        useNotificationStore.getState().addNotification({
            type: notificationType,
            title,
            body: displayMessage,
        });
    }
}

/**
 * Show a simple toast notification (non-error).
 * For success messages, confirmations, etc.
 */
export function showToast(
    message: string,
    type: 'success' | 'info' | 'warning' = 'info'
) {
    const titles: Record<string, string> = {
        success: '✅ Completato',
        info: 'ℹ️ Info',
        warning: '⚠️ Attenzione',
    };

    useNotificationStore.getState().addNotification({
        type: type === 'success' ? 'info' : 'system',
        title: titles[type],
        body: message,
    });
}
