'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useDailyStore } from '../../stores/dailyStore';
import { createClient } from '../../utils/supabase/client';

// Map per tracciare i container degli schermi condivisi
const screenContainersMap = new Map<string, HTMLDivElement>();

export function MediaManager() {
    // Granular selectors to avoid re-render on every store change
    const isScreenSharing = useDailyStore(s => s.isScreenSharing);
    const screenStreams = useDailyStore(s => s.screenStreams);
    const isSpeaking = useDailyStore(s => s.isSpeaking);
    const localStream = useDailyStore(s => s.localStream);
    const setSpeaking = useDailyStore(s => s.setSpeaking);
    const removeScreenStream = useDailyStore(s => s.removeScreenStream);
    const clearAllScreenStreams = useDailyStore(s => s.clearAllScreenStreams);
    const isMicEnabled = useDailyStore(s => s.isAudioOn);
    const isVideoEnabled = useDailyStore(s => s.isVideoOn);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const initializedRef = useRef(false);
    const videoTrackRef = useRef<MediaStreamTrack | null>(null);
    const audioTrackRef = useRef<MediaStreamTrack | null>(null);
    const lastDeviceSetupRef = useRef(false);
    const isInitializingRef = useRef(false);
    const supabase = createClient();

    // Rimuovi un singolo schermo
    const removeScreenContainer = useCallback((streamId: string) => {
        const container = screenContainersMap.get(streamId);
        if (container) {
            container.remove();
            screenContainersMap.delete(streamId);
        }
        removeScreenStream(streamId);
    }, [removeScreenStream]);

    // Stop tutti gli schermi
    const stopAllScreens = useCallback(() => {
        screenContainersMap.forEach((container) => {
            container.remove();
        });
        screenContainersMap.clear();
        clearAllScreenStreams();
    }, [clearAllScreenStreams]);

    // NOTE: Camera/mic hardware is managed exclusively by Daily.co (useDaily.ts).
    // MediaManager only handles screen sharing and speaking detection.
    // Do NOT call getUserMedia here — it creates a second stream that conflicts.

    // Crea o aggiorna container per uno schermo
    const createScreenContainer = useCallback((stream: MediaStream, index: number) => {
        const streamId = stream.id;

        // Se il container esiste già, aggiorna solo il video
        let container = screenContainersMap.get(streamId);

        if (!container) {
            // Cascade position from center-bottom, above the toolbar
            const baseLeft = window.innerWidth / 2 - 180 + (index * 30);
            const baseBottom = 100 + (index * 30);

            container = document.createElement('div');
            container.id = `screen-share-container-${streamId}`;
            container.style.cssText = `
                position: fixed;
                bottom: ${baseBottom}px;
                left: ${baseLeft}px;
                width: 400px;
                height: 250px;
                z-index: ${9999 + index};
                pointer-events: auto;
                user-select: none;
            `;

            // Drag and resize state
            let isDragging = false;
            let isResizing = false;
            let startX = 0, startY = 0, startWidth = 0, startHeight = 0, startLeft = 0, startTop = 0;

            // Wrapper — glass design matching app
            const wrapper = document.createElement('div');
            wrapper.style.cssText = `
                width: 100%;
                height: 100%;
                background: rgba(10, 15, 30, 0.92);
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08);
                border: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                flex-direction: column;
                transition: box-shadow 0.3s;
            `;

            // Toolbar — glass style
            const toolbar = document.createElement('div');
            toolbar.style.cssText = `
                height: 38px;
                background: rgba(15, 23, 42, 0.95);
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 14px;
                cursor: grab;
                flex-shrink: 0;
            `;

            // Label
            const label = document.createElement('div');
            label.id = `screen-share-label-${streamId}`;
            label.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:#ef4444;box-shadow:0 0 6px #ef4444;display:inline-block"></span><span>Schermo ${index + 1}</span></span>`;
            label.style.cssText = `
                color: rgba(226, 232, 240, 0.9);
                font-size: 12px;
                font-weight: 600;
                font-family: 'Inter', system-ui, sans-serif;
                letter-spacing: 0.02em;
                pointer-events: none;
            `;

            // Close button — matching app style
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '✕';
            closeBtn.title = 'Chiudi questo schermo';
            closeBtn.style.cssText = `
                width: 24px;
                height: 24px;
                border-radius: 8px;
                background: rgba(239, 68, 68, 0.15);
                color: #f87171;
                border: 1px solid rgba(239, 68, 68, 0.2);
                cursor: pointer;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                font-weight: 600;
            `;
            closeBtn.onmouseenter = () => {
                closeBtn.style.background = 'rgba(239, 68, 68, 0.3)';
                closeBtn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                closeBtn.style.color = '#fca5a5';
            };
            closeBtn.onmouseleave = () => {
                closeBtn.style.background = 'rgba(239, 68, 68, 0.15)';
                closeBtn.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                closeBtn.style.color = '#f87171';
            };
            closeBtn.onclick = () => {
                stream.getTracks().forEach(track => track.stop());
                removeScreenContainer(streamId);
            };

            toolbar.appendChild(label);
            toolbar.appendChild(closeBtn);

            // Drag handlers for toolbar
            toolbar.addEventListener('mousedown', (e) => {
                isDragging = true;
                toolbar.style.cursor = 'grabbing';
                startX = e.clientX;
                startY = e.clientY;
                const rect = container!.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
                e.preventDefault();
            });

            // Video container
            const videoContainer = document.createElement('div');
            videoContainer.style.cssText = `
                flex: 1;
                position: relative;
                background: #000;
                cursor: grab;
                overflow: hidden;
            `;

            // Video
            const video = document.createElement('video');
            video.id = `screen-share-video-${streamId}`;
            video.autoplay = true;
            video.playsInline = true;
            video.muted = true;
            video.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: contain;
            `;

            // Drag handlers for video container too
            videoContainer.addEventListener('mousedown', (e) => {
                isDragging = true;
                videoContainer.style.cursor = 'grabbing';
                toolbar.style.cursor = 'grabbing';
                startX = e.clientX;
                startY = e.clientY;
                const rect = container!.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
                e.preventDefault();
            });

            videoContainer.appendChild(video);

            // Resize handle — subtle, matching glass style
            const resizeHandle = document.createElement('div');
            resizeHandle.title = 'Trascina per ridimensionare';
            resizeHandle.style.cssText = `
                position: absolute;
                bottom: 0;
                right: 0;
                width: 20px;
                height: 20px;
                cursor: se-resize;
                z-index: 10010;
                background: transparent;
                border-right: 3px solid rgba(148, 163, 184, 0.3);
                border-bottom: 3px solid rgba(148, 163, 184, 0.3);
                border-radius: 0 0 16px 0;
                transition: border-color 0.2s;
                pointer-events: auto;
            `;
            resizeHandle.onmouseenter = () => {
                resizeHandle.style.borderRightColor = 'rgba(148, 163, 184, 0.7)';
                resizeHandle.style.borderBottomColor = 'rgba(148, 163, 184, 0.7)';
            };
            resizeHandle.onmouseleave = () => {
                resizeHandle.style.borderRightColor = 'rgba(148, 163, 184, 0.3)';
                resizeHandle.style.borderBottomColor = 'rgba(148, 163, 184, 0.3)';
            };

            resizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = container!.offsetWidth;
                startHeight = container!.offsetHeight;
                e.preventDefault();
                e.stopPropagation();
            });

            // Global mouse events
            const handleMouseMove = (e: MouseEvent) => {
                if (isDragging) {
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    container!.style.left = `${startLeft + dx}px`;
                    container!.style.top = `${startTop + dy}px`;
                    container!.style.bottom = 'auto';
                    container!.style.right = 'auto';
                }
                if (isResizing) {
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    container!.style.width = `${Math.max(280, startWidth + dx)}px`;
                    container!.style.height = `${Math.max(180, startHeight + dy)}px`;
                }
            };

            const handleMouseUp = () => {
                isDragging = false;
                isResizing = false;
                toolbar.style.cursor = 'grab';
                videoContainer.style.cursor = 'grab';
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            // Cleanup on remove
            container.addEventListener('remove', () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            });

            wrapper.appendChild(toolbar);
            wrapper.appendChild(videoContainer);
            wrapper.appendChild(resizeHandle);
            container.appendChild(wrapper);
            document.body.appendChild(container);
            screenContainersMap.set(streamId, container);

            // Imposta lo stream video
            video.srcObject = stream;

            // Ascolta quando il track finisce (utente ferma condivisione dal browser)
            const handleTrackEnded = () => {
                removeScreenContainer(streamId);
            };
            stream.getVideoTracks()[0]?.addEventListener('ended', handleTrackEnded);

        } else {
            // Container esistente - aggiorna label se necessario
            const label = document.getElementById(`screen-share-label-${streamId}`);
            if (label) {
                label.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:#ef4444;box-shadow:0 0 6px #ef4444;display:inline-block"></span><span>Schermo ${index + 1}</span></span>`;
            }

            // Assicurati che il video abbia lo stream corretto
            const video = document.getElementById(`screen-share-video-${streamId}`) as HTMLVideoElement;
            if (video && video.srcObject !== stream) {
                video.srcObject = stream;
            }
        }
    }, [removeScreenContainer]);

    // Effect per gestire gli schermi condivisi
    useEffect(() => {
        // Crea/aggiorna container per ogni schermo
        screenStreams.forEach((stream, index) => {
            createScreenContainer(stream, index);
        });

        // Rimuovi container per schermi che non esistono più
        const currentStreamIds = new Set(screenStreams.map(s => s.id));
        screenContainersMap.forEach((container, streamId) => {
            if (!currentStreamIds.has(streamId)) {
                container.remove();
                screenContainersMap.delete(streamId);
            }
        });

    }, [screenStreams, createScreenContainer]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopAllScreens();
        };
    }, [stopAllScreens]);

    // Volume detection for speaking indicator - OPTIMIZED (setInterval instead of rAF)
    useEffect(() => {
        let speakingInterval: ReturnType<typeof setInterval> | null = null;
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
                // Reduced FFT size: 256 is sufficient for speech detection
                analyzer.fftSize = 256;
                analyzer.smoothingTimeConstant = 0.3;

                const bufferLength = analyzer.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                let speakCount = 0;

                const checkVolume = () => {
                    if (!audioContext || audioContext.state === 'closed') return;

                    analyzer.getByteFrequencyData(dataArray);

                    // Optimized average calculation
                    let total = 0;
                    for (let i = 0; i < bufferLength; i += 2) {
                        total += dataArray[i];
                    }
                    const average = total / (bufferLength / 2);

                    if (average > 15) {
                        speakCount = Math.min(speakCount + 1, 5);
                    } else {
                        speakCount = Math.max(speakCount - 1, 0);
                    }

                    const speakingNow = speakCount > 1;
                    const prevSpeaking = useDailyStore.getState().isSpeaking;
                    if (speakingNow !== prevSpeaking) {
                        setSpeaking(speakingNow);
                    }
                };

                // 250ms = 4 checks/sec — plenty for speech detection
                speakingInterval = setInterval(checkVolume, 250);
                audioContextRef.current = audioContext;
                analyzerRef.current = analyzer;
            } catch (err) {
                console.warn('Audio detection failed:', err);
                setSpeaking(false);
            }
        };

        startDetection();

        return () => {
            if (speakingInterval) clearInterval(speakingInterval);
            if (audioContext && audioContext.state !== 'closed') {
                audioContext.close().catch(console.error);
            }
            setSpeaking(false);
        };
    }, [localStream, isMicEnabled, setSpeaking]);

    return null;
}
