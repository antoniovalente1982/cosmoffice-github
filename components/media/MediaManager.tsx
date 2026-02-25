'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { createClient } from '../../utils/supabase/client';

export function MediaManager() {
    const {
        isMicEnabled, isVideoEnabled, isScreenSharing, screenStream, isSpeaking,
        localStream, setLocalStream,
        setSpeaking, peers, updatePeer, setScreenSharing, setScreenStream
    } = useOfficeStore();
    const peersRef = useRef<Record<string, any>>({});
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const screenContainerRef = useRef<HTMLDivElement | null>(null);
    const initializedRef = useRef(false);
    const videoTrackRef = useRef<MediaStreamTrack | null>(null);
    const audioTrackRef = useRef<MediaStreamTrack | null>(null);
    const supabase = createClient();

    // Stop screen share function
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

    // Initialize camera/mic on first mount - get tracks separately
    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;
        
        const initMedia = async () => {
            try {
                // Get video and audio separately to have more control
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                
                // Store references to tracks
                const videoTrack = stream.getVideoTracks()[0];
                const audioTrack = stream.getAudioTracks()[0];
                
                if (videoTrack) videoTrackRef.current = videoTrack;
                if (audioTrack) audioTrackRef.current = audioTrack;
                
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

    // Handle video toggle - enable/disable track instead of removing
    useEffect(() => {
        if (videoTrackRef.current) {
            videoTrackRef.current.enabled = isVideoEnabled;
        }
        // Force a re-render by creating a new stream with same tracks
        if (localStream) {
            setLocalStream(new MediaStream(localStream.getTracks()));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVideoEnabled]);

    // Handle mic toggle - enable/disable track instead of removing
    useEffect(() => {
        if (audioTrackRef.current) {
            audioTrackRef.current.enabled = isMicEnabled;
        }
        // Force a re-render
        if (localStream) {
            setLocalStream(new MediaStream(localStream.getTracks()));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMicEnabled]);

    // Update track refs when stream changes
    useEffect(() => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            const audioTrack = localStream.getAudioTracks()[0];
            if (videoTrack) videoTrackRef.current = videoTrack;
            if (audioTrack) audioTrackRef.current = audioTrack;
        }
    }, [localStream]);

    // Screen sharing effect with drag/resize support
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
                user-select: none;
            `;
            
            // Make draggable and resizable
            let isDragging = false;
            let isResizing = false;
            let startX = 0, startY = 0, startWidth = 0, startHeight = 0, startLeft = 0, startTop = 0;
            
            const header = document.createElement('div');
            header.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 24px;
                background: rgba(99, 102, 241, 0.9);
                border-radius: 16px 16px 0 0;
                cursor: move;
                z-index: 10001;
                display: flex;
                align-items: center;
                padding: 0 10px;
                gap: 8px;
            `;
            
            header.addEventListener('mousedown', (e) => {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = container.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
                e.preventDefault();
            });
            
            const resizeHandle = document.createElement('div');
            resizeHandle.style.cssText = `
                position: absolute;
                bottom: 0;
                right: 0;
                width: 20px;
                height: 20px;
                cursor: se-resize;
                z-index: 10002;
                background: linear-gradient(135deg, transparent 50%, rgba(99, 102, 241, 0.8) 50%);
                border-radius: 0 0 16px 0;
            `;
            
            resizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = container.offsetWidth;
                startHeight = container.offsetHeight;
                e.preventDefault();
                e.stopPropagation();
            });
            
            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    container.style.left = `${startLeft + dx}px`;
                    container.style.top = `${startTop + dy}px`;
                    container.style.bottom = 'auto';
                }
                if (isResizing) {
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    container.style.width = `${Math.max(200, startWidth + dx)}px`;
                    container.style.height = `${Math.max(150, startHeight + dy)}px`;
                }
            });
            
            document.addEventListener('mouseup', () => {
                isDragging = false;
                isResizing = false;
            });
            
            const videoContainer = document.createElement('div');
            videoContainer.style.cssText = `
                width: 100%;
                height: 100%;
                position: relative;
                border-radius: 16px;
                overflow: hidden;
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
                background: #0f172a;
                border: 3px solid ${isSpeaking ? '#10b981' : '#6366f1'};
                border-radius: 16px;
                box-shadow: 0 10px 50px rgba(0,0,0,0.9), 0 0 30px ${isSpeaking ? 'rgba(16,185,129,0.6)' : 'rgba(99,102,241,0.6)'};
                transition: border-color 0.2s, box-shadow 0.2s;
            `;
            
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '✕';
            closeBtn.style.cssText = `
                position: absolute;
                top: 2px;
                right: 8px;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #ef4444;
                color: white;
                border: none;
                cursor: pointer;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10003;
            `;
            closeBtn.onclick = () => stopScreenShare();
            
            const label = document.createElement('div');
            label.id = 'screen-share-label';
            label.innerHTML = isSpeaking ? '🔴 Stai condividendo (parlando)' : '🔴 Stai condividendo';
            label.style.cssText = `
                position: absolute;
                top: 28px;
                left: 8px;
                background: ${isSpeaking ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)'};
                color: white;
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 600;
                z-index: 10000;
                transition: background 0.2s;
            `;
            
            header.appendChild(label);
            header.appendChild(closeBtn);
            videoContainer.appendChild(video);
            container.appendChild(header);
            container.appendChild(videoContainer);
            container.appendChild(resizeHandle);
            document.body.appendChild(container);
            screenContainerRef.current = container;
        } else {
            // Update border color based on speaking state
            const video = document.getElementById('screen-share-video') as HTMLVideoElement;
            const label = document.getElementById('screen-share-label');
            if (video) {
                video.style.borderColor = isSpeaking ? '#10b981' : '#6366f1';
                video.style.boxShadow = `0 10px 50px rgba(0,0,0,0.9), 0 0 30px ${isSpeaking ? 'rgba(16,185,129,0.6)' : 'rgba(99,102,241,0.6)'}`;
            }
            if (label) {
                label.innerHTML = isSpeaking ? '🔴 Stai condividendo (parlando)' : '🔴 Stai condividendo';
                label.style.background = isSpeaking ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)';
            }
        }
        
        const video = document.getElementById('screen-share-video') as HTMLVideoElement;
        if (video && video.srcObject !== screenStream) {
            video.srcObject = screenStream;
        }
        
        const handleTrackEnded = () => stopScreenShare();
        screenStream.getVideoTracks()[0]?.addEventListener('ended', handleTrackEnded);
        
        return () => {
            screenStream.getVideoTracks()[0]?.removeEventListener('ended', handleTrackEnded);
        };
    }, [isScreenSharing, screenStream, isSpeaking, stopScreenShare]);

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
