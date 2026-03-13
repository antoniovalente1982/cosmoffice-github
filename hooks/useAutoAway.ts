'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAvatarStore } from '../stores/avatarStore';

// ============================================
// useAutoAway — Automatic away status detection
//
// Triggers: 
//   1. Tab hidden (Page Visibility API) for VISIBILITY_AWAY_MS
//   2. No mouse/keyboard activity for IDLE_AWAY_MS
//
// On return: restores previous status (if still 'away')
// Respects: manual 'busy'/'offline' status — does NOT override
// ============================================

const VISIBILITY_AWAY_MS = 3 * 60 * 1000; // 3 minutes tab hidden → away
const IDLE_AWAY_MS = 5 * 60 * 1000;       // 5 minutes no input → away

export function useAutoAway() {
    const previousStatusRef = useRef<'online' | 'away' | 'busy' | 'offline' | null>(null);
    const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isAutoAwayRef = useRef(false);

    const goAway = useCallback(() => {
        const store = useAvatarStore.getState();
        // Only auto-away if currently 'online' — respect manual busy/offline
        if (store.myStatus !== 'online') return;

        previousStatusRef.current = store.myStatus;
        isAutoAwayRef.current = true;
        store.setMyStatus('away');
        store.setMyAway(true);
    }, []);

    const comeBack = useCallback(() => {
        if (!isAutoAwayRef.current) return;

        const store = useAvatarStore.getState();
        // Only restore if still in auto-away state
        if (store.myStatus !== 'away') {
            isAutoAwayRef.current = false;
            return;
        }

        const restoreTo = previousStatusRef.current || 'online';
        isAutoAwayRef.current = false;
        previousStatusRef.current = null;
        store.setMyStatus(restoreTo);
        store.setMyAway(false);
    }, []);

    const resetIdleTimer = useCallback(() => {
        // If we were auto-away and user is active again, come back
        if (isAutoAwayRef.current) {
            comeBack();
        }

        // Reset idle countdown
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(goAway, IDLE_AWAY_MS);
    }, [goAway, comeBack]);

    useEffect(() => {
        // ── Page Visibility API ──
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Tab hidden — start away countdown
                visibilityTimerRef.current = setTimeout(goAway, VISIBILITY_AWAY_MS);
            } else {
                // Tab visible again — cancel countdown + come back
                if (visibilityTimerRef.current) {
                    clearTimeout(visibilityTimerRef.current);
                    visibilityTimerRef.current = null;
                }
                comeBack();
                resetIdleTimer(); // Also reset idle timer on tab return
            }
        };

        // ── Idle detection (mouse/keyboard) ──
        const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

        // Throttle: only reset idle timer every 30 seconds max
        let lastActivity = Date.now();
        const handleActivity = () => {
            const now = Date.now();
            if (now - lastActivity < 30_000) return; // Throttle to prevent perf hit
            lastActivity = now;
            resetIdleTimer();
        };

        // Start listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        activityEvents.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        // Start initial idle timer
        idleTimerRef.current = setTimeout(goAway, IDLE_AWAY_MS);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            activityEvents.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
            if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        };
    }, [goAway, comeBack, resetIdleTimer]);
}
