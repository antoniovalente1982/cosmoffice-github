'use client';

import { useEffect, useRef, useState } from 'react';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { createClient } from '../../utils/supabase/client';

export function MediaManager() {
    const {
        isMicEnabled, isVideoEnabled,
        localStream, setLocalStream,
        setSpeaking, peers, updatePeer
    } = useOfficeStore();
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const peersRef = useRef<Record<string, any>>({});
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const supabase = createClient();

    // Local stream management
    useEffect(() => {
        const updateMedia = async () => {
            try {
                // If neither is enabled, stop all tracks and clear local stream
                if (!isMicEnabled && !isVideoEnabled) {
                    if (localStream) {
                        localStream.getTracks().forEach(t => t.stop());
                        setLocalStream(null);
                    }
                    return;
                }

                // If we need a stream but don't have one or it's missing tracks
                if (!localStream) {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: isVideoEnabled,
                        audio: isMicEnabled
                    });
                    setLocalStream(stream);
                } else {
                    // Sync active tracks with store state
                    const videoTracks = localStream.getVideoTracks();
                    const audioTracks = localStream.getAudioTracks();

                    if (isVideoEnabled && videoTracks.length === 0) {
                        const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
                        localStream.addTrack(vStream.getVideoTracks()[0]);
                    } else if (!isVideoEnabled && videoTracks.length > 0) {
                        videoTracks.forEach(t => {
                            t.stop();
                            localStream.removeTrack(t);
                        });
                    }

                    if (isMicEnabled && audioTracks.length === 0) {
                        const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        localStream.addTrack(aStream.getAudioTracks()[0]);
                    } else if (!isMicEnabled && audioTracks.length > 0) {
                        audioTracks.forEach(t => {
                            t.stop();
                            localStream.removeTrack(t);
                        });
                    }

                    // Trigger state update to refresh video elements
                    setLocalStream(new MediaStream(localStream.getTracks()));
                }
            } catch (err) {
                console.error('Failed to update local stream', err);
            }
        };
        updateMedia();
    }, [isMicEnabled, isVideoEnabled]);

    // Volume detection for speaking circle
    useEffect(() => {
        let animationFrame: number;
        let audioContext: AudioContext | null = null;

        const startDetection = async () => {
            try {
                if (!localStream || !isMicEnabled || localStream.getAudioTracks().length === 0) {
                    setSpeaking(false);
                    return;
                }

                audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }

                const analyzer = audioContext.createAnalyser();
                const source = audioContext.createMediaStreamSource(localStream);
                source.connect(analyzer);
                analyzer.fftSize = 256;

                const bufferLength = analyzer.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                let speakCount = 0;

                const checkVolume = () => {
                    if (!audioContext || audioContext.state === 'closed') return;

                    analyzer.getByteFrequencyData(dataArray);
                    let total = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        total += dataArray[i];
                    }
                    const average = total / bufferLength;

                    if (average > 25) {
                        speakCount = Math.min(speakCount + 1, 10);
                    } else {
                        speakCount = Math.max(speakCount - 1, 0);
                    }

                    setSpeaking(speakCount > 3);
                    animationFrame = requestAnimationFrame(checkVolume);
                };

                checkVolume();
                audioContextRef.current = audioContext;
                analyzerRef.current = analyzer;
            } catch (err) {
                console.warn('Audio detection failed to start:', err);
                setSpeaking(false);
            }
        };

        startDetection();

        return () => {
            if (animationFrame) cancelAnimationFrame(animationFrame);
            if (audioContext && audioContext.state !== 'closed') {
                audioContext.close().catch(console.error);
            }
            setSpeaking(false);
        };
    }, [localStream, isMicEnabled, setSpeaking]);

    // Signaling logic
    useEffect(() => {
        if (!localStream) return;

        // Note: Simple peer and signaling logic omitted for brevity as per original, 
        // but now it has access to a properly managed localStream from store
    }, [localStream]);

    return null;
}
