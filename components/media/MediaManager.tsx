'use client';

import { useEffect, useRef } from 'react';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { createClient } from '../../utils/supabase/client';

export function MediaManager() {
    const {
        isMicEnabled, isVideoEnabled, isScreenSharing, screenStream,
        localStream, setLocalStream,
        setSpeaking, peers, updatePeer
    } = useOfficeStore();
    const peersRef = useRef<Record<string, any>>({});
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const screenVideoRef = useRef<HTMLVideoElement | null>(null);
    const supabase = createClient();

    // Local stream management (mic + camera)
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMicEnabled, isVideoEnabled]);

    // Screen sharing stream management
    useEffect(() => {
        // Create or update screen sharing video element
        if (isScreenSharing && screenStream) {
            if (!screenVideoRef.current) {
                const video = document.createElement('video');
                video.autoplay = true;
                video.playsInline = true;
                video.muted = true; // Mute to avoid feedback
                video.style.cssText = `
                    position: fixed;
                    top: 80px;
                    right: 320px;
                    width: 320px;
                    height: 180px;
                    object-fit: contain;
                    border-radius: 12px;
                    background: #0f172a;
                    border: 2px solid #6366f1;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                    z-index: 100;
                `;
                document.body.appendChild(video);
                screenVideoRef.current = video;
            }
            screenVideoRef.current.srcObject = screenStream;
        } else {
            // Clean up screen sharing video element
            if (screenVideoRef.current) {
                screenVideoRef.current.remove();
                screenVideoRef.current = null;
            }
        }

        return () => {
            if (screenVideoRef.current) {
                screenVideoRef.current.remove();
                screenVideoRef.current = null;
            }
        };
    }, [isScreenSharing, screenStream]);

    // Volume detection for speaking circle (from mic only, not screen audio)
    useEffect(() => {
        let animationFrame: number;
        let audioContext: AudioContext | null = null;

        const startDetection = async () => {
            try {
                // Only detect speaking from microphone, not from screen share audio
                const micStream = localStream;
                if (!micStream || !isMicEnabled || micStream.getAudioTracks().length === 0) {
                    setSpeaking(false);
                    return;
                }

                audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }

                const analyzer = audioContext.createAnalyser();
                const source = audioContext.createMediaStreamSource(micStream);
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

    // Signaling logic placeholder
    useEffect(() => {
        if (!localStream) return;

        // Note: Simple peer and signaling logic would go here
        // Now it has access to both localStream and screenStream from store
    }, [localStream, screenStream]);

    return null;
}
