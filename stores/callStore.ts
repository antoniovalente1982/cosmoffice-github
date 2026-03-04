'use client';

import { create } from 'zustand';

export interface CallRequest {
    id: string;
    fromUserId: string;
    fromName: string;
    fromAvatarUrl?: string;
    toUserId: string;
    timestamp: number;
    status: 'pending' | 'accepted' | 'declined' | 'timeout';
}

interface CallState {
    // Incoming call (I'm the receiver)
    incomingCall: CallRequest | null;
    // Outgoing call (I'm the sender)  
    outgoingCall: CallRequest | null;
    // Response message to show sender
    callResponse: { type: 'accepted' | 'declined' | 'timeout'; fromName: string } | null;

    // Actions
    setIncomingCall: (call: CallRequest | null) => void;
    setOutgoingCall: (call: CallRequest | null) => void;
    setCallResponse: (response: CallState['callResponse']) => void;
    clearAll: () => void;
}

export const useCallStore = create<CallState>((set) => ({
    incomingCall: null,
    outgoingCall: null,
    callResponse: null,

    setIncomingCall: (incomingCall) => set({ incomingCall }),
    setOutgoingCall: (outgoingCall) => set({ outgoingCall }),
    setCallResponse: (callResponse) => set({ callResponse }),
    clearAll: () => set({ incomingCall: null, outgoingCall: null, callResponse: null }),
}));
