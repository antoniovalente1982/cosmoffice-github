'use client';

// ============================================
// useKnockToEnter — Handles knock-to-enter flow for rooms
// Sends knocks, listens for responses, handles timeout
// ============================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAvatarStore } from '../stores/avatarStore';
import { useMediaStore } from '../stores/mediaStore';

const KNOCK_TIMEOUT_MS = 30_000;

export interface KnockRequest {
    userId: string;
    roomId: string;
    name: string;
    avatarUrl: string | null;
    timestamp: number;
}

interface KnockToEnterState {
    // Incoming knock requests (for users already in a room)
    pendingKnocks: KnockRequest[];
    // Outgoing knock status (for user trying to enter)
    knockStatus: 'idle' | 'waiting' | 'accepted' | 'rejected' | 'timeout';
    knockRoomId: string | null;
}

export function useKnockToEnter() {
    const [state, setState] = useState<KnockToEnterState>({
        pendingKnocks: [],
        knockStatus: 'idle',
        knockRoomId: null,
    });
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── Respond to a knock (accept/reject) ──────────────────
    const respondToKnock = useCallback((request: KnockRequest, accepted: boolean) => {
        // Send response via PartyKit
        const sendKnockResponseFn = (window as any).__sendKnockResponse;
        if (sendKnockResponseFn) {
            sendKnockResponseFn(request.roomId, request.userId, accepted);
        }

        // Remove from pending list
        setState(prev => ({
            ...prev,
            pendingKnocks: prev.pendingKnocks.filter(k => k.userId !== request.userId || k.roomId !== request.roomId),
        }));
    }, []);

    // ─── Send a knock ────────────────────────────────────────
    const sendKnock = useCallback((roomId: string) => {
        setState({
            pendingKnocks: [],
            knockStatus: 'waiting',
            knockRoomId: roomId,
        });

        useAvatarStore.getState().setKnockingAtRoom(roomId);

        // Send knock via PartyKit
        const sendKnockFn = (window as any).__sendKnock;
        if (sendKnockFn) sendKnockFn(roomId);

        // Start timeout
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setState(prev => {
                if (prev.knockStatus === 'waiting') {
                    useAvatarStore.getState().setKnockingAtRoom(null);
                    return { ...prev, knockStatus: 'timeout', knockRoomId: null };
                }
                return prev;
            });
        }, KNOCK_TIMEOUT_MS);
    }, []);

    // ─── Cancel knock ────────────────────────────────────────
    const cancelKnock = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        useAvatarStore.getState().setKnockingAtRoom(null);
        setState({
            pendingKnocks: [],
            knockStatus: 'idle',
            knockRoomId: null,
        });
    }, []);

    // ─── Handle incoming PartyKit messages ───────────────────
    useEffect(() => {
        // Register handlers on window for PartyKit to call
        const handleKnockRequest = (data: KnockRequest) => {
            setState(prev => ({
                ...prev,
                pendingKnocks: [
                    ...prev.pendingKnocks.filter(k => k.userId !== data.userId),
                    { ...data, timestamp: Date.now() },
                ],
            }));

            // Auto-expire knock request after timeout
            setTimeout(() => {
                setState(prev => ({
                    ...prev,
                    pendingKnocks: prev.pendingKnocks.filter(k => k.userId !== data.userId),
                }));
            }, KNOCK_TIMEOUT_MS);
        };

        const handleKnockAccepted = (roomId: string) => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);

            const avatarStore = useAvatarStore.getState();
            avatarStore.setKnockingAtRoom(null);
            avatarStore.setMyRoom(roomId);
            useMediaStore.getState().setActiveContext('room', roomId);

            // Trigger Daily.co room join
            const joinFn = (window as any).__joinDailyContext;
            if (joinFn) joinFn('room', roomId);

            setState({
                pendingKnocks: [],
                knockStatus: 'accepted',
                knockRoomId: null,
            });

            // Reset status after brief display
            setTimeout(() => {
                setState(prev => ({ ...prev, knockStatus: 'idle' }));
            }, 2000);
        };

        const handleKnockRejected = (_roomId: string) => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            useAvatarStore.getState().setKnockingAtRoom(null);

            setState({
                pendingKnocks: [],
                knockStatus: 'rejected',
                knockRoomId: null,
            });

            // Reset status after brief display
            setTimeout(() => {
                setState(prev => ({ ...prev, knockStatus: 'idle' }));
            }, 3000);
        };

        // Register on window so PartyKit message handler can call them
        (window as any).__handleKnockRequest = handleKnockRequest;
        (window as any).__handleKnockAccepted = handleKnockAccepted;
        (window as any).__handleKnockRejected = handleKnockRejected;

        return () => {
            delete (window as any).__handleKnockRequest;
            delete (window as any).__handleKnockAccepted;
            delete (window as any).__handleKnockRejected;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return {
        ...state,
        sendKnock,
        cancelKnock,
        respondToKnock,
    };
}
