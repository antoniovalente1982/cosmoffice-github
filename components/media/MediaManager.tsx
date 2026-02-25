'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { createClient } from '../../utils/supabase/client';

export function MediaManager() {
    const {
        isMicEnabled, isVideoEnabled, isScreenSharing, screenStream,
        localStream, setLocalStream,
        setSpeaking, peers, updatePeer, setScreenSharing, setScreenStream
    } = useOfficeStore();
    const peersRef = useRef<Record<string, any>>({});
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const screenContainerRef = useRef<HTMLDivElement | null>(null);
    const initializedRef = useRef(false);
    const supabase = createClient();

    // Stop screen share function - defined early for use in effects
    const stopScreenShare = useCallback(() => {
        if (screenContainerRef.current) {
            screenContainerRef.current.remove();
            screenContainerRef.current = null;
        }
        const currentStream = useOfficeStore.getState().screenStream;
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        setScreenSharing(false);
        setScreenStream(null);
    }, [setScreenSharing, setScreenStream]);

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

                setLocalStream(new MediaStream(localStream.getTracks()));
            } catch (err) {
                console.error('Failed to update media:', err);
            }
        };
        
        updateMedia();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMicEnabled, isVideoEnabled]);

    // Screen sharing effect
    useEffect(() => {
        if (!isScreenSharing || !screenStream) return;
        
        if (!screenContainerRef.current) {
            const container = document.createElement('div');
            container.id = 'screen-share-container';
            container.style.cssText = `
                position: fixed;
                bottom: 100px;
                left: 280px;
                width: 320px;
                height: 180px;
                z-index: 9999;
                pointer-events: auto;
            `;
            
            const video = document.createElement('video');
            video.id = 'screen-share-video';
            video.autoplay = true;
            video.playsInline = true;
            video.muted = true;
            video.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: contain;
                border-radius: 16px;
                background: #0f172a;
                border: 3px solid #6366f1;
                box-shadow: 0 10px 50px rgba(0,0,0,0.9), 0 0 30px rgba(99,102,241,0.6);
            `;
            
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '✕';
            closeBtn.style.cssText = `
                position: absolute;
                top: -10px;
                right: -10px;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: #ef4444;
                color: white;
                border: 2px solid white;
                cursor: pointer;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 8px rgba(0,0,0,0.5);
                z-index: 10000;
            `;
            closeBtn.onclick = () => stopScreenShare();
            
            const label = document.createElement('div');
            label.innerHTML = '🔴 Stai condividendo';
            label.style.cssText = `
                position: absolute;
                top: 8px;
                left: 8px;
                background: rgba(239, 68, 68, 0.9);
                color: white;
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 600;
                z-index: 10000;
            `;
            
            container.appendChild(video);
            container.appendChild(closeBtn);
            container.appendChild(label);
            document.body.appendChild(container);
            screenContainerRef.current = container;
        }
        
        const video = document.getElementById('screen-share-video') as HTMLVideoElement;
        if (video) video.srcObject = screenStream;
        
        const handleTrackEnded = () => stopScreenShare();
        screenStream.getVideoTracks()[0]?.addEventListener('ended', handleTrackEnded);
        
        return () => {
            screenStream.getVideoTracks()[0]?.removeEventListener('ended', handleTrackEnded);
        };
    }, [isScreenSharing, screenStream, stopScreenShare]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (screenContainerRef.current) {
                screenContainerRef.current.remove();
                screenContainerRef.current = null;
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
