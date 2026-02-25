'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { createClient } from '../../utils/supabase/client';

export function MediaManager() {
    const {
        isMicEnabled, isVideoEnabled, isScreenSharing, screenStream,
        localStream, setLocalStream, isSystemAudioEnabled,
        setSpeaking, peers, updatePeer, setScreenSharing, setScreenStream
    } = useOfficeStore();
    const peersRef = useRef<Record<string, any>>({});
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const screenVideoRef = useRef<HTMLVideoElement | null>(null);
    const initializedRef = useRef(false);
    const supabase = createClient();

    // Initialize camera/mic on first mount
    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;
        
        const initMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                setLocalStream(stream);
            } catch (err) {
                console.error('Failed to initialize media:', err);
            }
        };
        
        initMedia();
        
        return () => {
            // Cleanup on unmount
            const currentStream = useOfficeStore.getState().localStream;
            if (currentStream) {
                currentStream.getTracks().forEach(t => t.stop());
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Handle mic/video toggles
    useEffect(() => {
        const updateMedia = async () => {
            if (!localStream) return;
            
            try {
                // Sync video tracks
                const videoTracks = localStream.getVideoTracks();
                if (isVideoEnabled && videoTracks.length === 0) {
                    const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
                    localStream.addTrack(vStream.getVideoTracks()[0]);
                } else if (!isVideoEnabled && videoTracks.length > 0) {
                    videoTracks.forEach(t => {
                        t.stop();
                        localStream.removeTrack(t);
                    });
                }

                // Sync audio tracks
                const audioTracks = localStream.getAudioTracks();
                if (isMicEnabled && audioTracks.length === 0) {
                    const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    localStream.addTrack(aStream.getAudioTracks()[0]);
                } else if (!isMicEnabled && audioTracks.length > 0) {
                    audioTracks.forEach(t => {
                        t.stop();
                        localStream.removeTrack(t);
                    });
                }

                // Force update
                setLocalStream(new MediaStream(localStream.getTracks()));
            } catch (err) {
                console.error('Failed to update media:', err);
            }
        };
        
        updateMedia();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMicEnabled, isVideoEnabled]);

    // Screen sharing - separate component logic moved here
    useEffect(() => {
        if (!isScreenSharing || !screenStream) return;
        
        // Create screen sharing preview
        if (!screenVideoRef.current) {
            const video = document.createElement('video');
            video.autoplay = true;
            video.playsInline = true;
            video.muted = true;
            video.style.cssText = `
                position: fixed;
                top: 24px;
                right: 24px;
                width: 288px;
                height: 162px;
                object-fit: contain;
                border-radius: 16px;
                background: #0f172a;
                border: 3px solid #6366f1;
                box-shadow: 0 10px 50px rgba(0,0,0,0.7), 0 0 20px rgba(99,102,241,0.5);
                z-index: 200;
                pointer-events: auto;
            `;
            document.body.appendChild(video);
            screenVideoRef.current = video;
        }
        screenVideoRef.current.srcObject = screenStream;
        
        // Handle browser stop sharing button
        const handleTrackEnded = () => {
            stopScreenShare();
        };
        screenStream.getVideoTracks()[0]?.addEventListener('ended', handleTrackEnded);
        
        return () => {
            screenStream.getVideoTracks()[0]?.removeEventListener('ended', handleTrackEnded);
        };
    }, [isScreenSharing, screenStream]);

    const stopScreenShare = useCallback(() => {
        if (screenVideoRef.current) {
            screenVideoRef.current.remove();
            screenVideoRef.current = null;
        }
        const currentStream = useOfficeStore.getState().screenStream;
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        setScreenSharing(false);
        setScreenStream(null);
    }, [setScreenSharing, setScreenStream]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (screenVideoRef.current) {
                screenVideoRef.current.remove();
                screenVideoRef.current = null;
            }
        };
    }, []);

    // Volume detection for speaking indicator
    useEffect(() => {
        let animationFrame: number;
        let audioContext: AudioContext | null = null;

        const startDetection = async () => {
            try {
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

                    if (average > 20) {
                        speakCount = Math.min(speakCount + 1, 10);
                    } else {
                        speakCount = Math.max(speakCount - 1, 0);
                    }

                    setSpeaking(speakCount > 2);
                    animationFrame = requestAnimationFrame(checkVolume);
                };

                checkVolume();
                audioContextRef.current = audioContext;
                analyzerRef.current = analyzer;
            } catch (err) {
                console.warn('Audio detection failed:', err);
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

    return null;
}
