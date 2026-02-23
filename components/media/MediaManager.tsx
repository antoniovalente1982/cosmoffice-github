'use client';

import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import { useOfficeStore } from '@/stores/useOfficeStore';
import { createClient } from '@/utils/supabase/client';

export function MediaManager() {
    const { peers, updatePeer } = useOfficeStore();
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const peersRef = useRef<Record<string, Peer.Instance>>({});
    const supabase = createClient();

    useEffect(() => {
        const getMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setLocalStream(stream);
                // Also update my own media status in store
            } catch (err) {
                console.error('Failed to get local stream', err);
            }
        };
        getMedia();
    }, []);

    // Signaling logic for simple-peer would go here using Supabase Channels
    // This is a partial implementation for now
    useEffect(() => {
        if (!localStream) return;

        const channel = supabase.channel('office_signaling')
            .on('broadcast', { event: 'signal' }, ({ payload }) => {
                const { from, signal } = payload;
                if (peersRef.current[from]) {
                    peersRef.current[from].signal(signal);
                } else {
                    // Create new peer if receiving an offer
                    const p = new Peer({
                        initiator: false,
                        trickle: false,
                        stream: localStream,
                    });

                    p.on('signal', data => {
                        supabase.channel('office_signaling').send({
                            type: 'broadcast',
                            event: 'signal',
                            payload: { from: 'my-id', to: from, signal: data },
                        });
                    });

                    p.on('stream', stream => {
                        updatePeer(from, {
                            // In a real app we'd store the stream ID or similar
                            // For simplicity, we assume VideoGrid will handle this
                        });
                    });

                    p.signal(signal);
                    peersRef.current[from] = p;
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            localStream.getTracks().forEach(track => track.stop());
        };
    }, [localStream, supabase, updatePeer]);

    const toggleScreenShare = async () => {
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
            setScreenStream(null);
            // In a real app, we'd notify peers to switch back to video
        } else {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                setScreenStream(stream);
                // In a real app, we'd replace the video track in all active peer connections
            } catch (err) {
                console.error('Failed to get display media', err);
            }
        }
    };

    return null; // This is a headless manager
}
