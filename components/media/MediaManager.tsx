'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { createClient } from '../../utils/supabase/client';

// Map per tracciare i container degli schermi condivisi
const screenContainersMap = new Map<string, HTMLDivElement>();

export function MediaManager() {
    const {
        isMicEnabled, isVideoEnabled, isScreenSharing, screenStreams, isSpeaking,
        selectedAudioInput, selectedVideoInput, hasCompletedDeviceSetup,
        localStream, setLocalStream,
        setSpeaking, removeScreenStream, clearAllScreenStreams
    } = useOfficeStore();
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

    // Inizializza o aggiorna lo stream con i dispositivi selezionati
    const initOrUpdateMedia = useCallback(async () => {
        // Evita chiamate concorrenti
        if (isInitializingRef.current) {
            return;
        }

        // Se l'utente non ha completato il setup, non inizializzare automaticamente
        if (!hasCompletedDeviceSetup) {
            return;
        }

        isInitializingRef.current = true;

        try {
            // Costruisci i constraints in base ai dispositivi selezionati
            const constraints: MediaStreamConstraints = {};

            if (selectedAudioInput) {
                constraints.audio = { deviceId: { exact: selectedAudioInput } };
            } else {
                constraints.audio = true; // default
            }

            if (selectedVideoInput) {
                constraints.video = { deviceId: { exact: selectedVideoInput } };
            } else {
                constraints.video = true; // default
            }

            // Ferma lo stream precedente
            const currentStream = useOfficeStore.getState().localStream;
            if (currentStream) {
                currentStream.getTracks().forEach(t => t.stop());
            }

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            const videoTrack = stream.getVideoTracks()[0];
            const audioTrack = stream.getAudioTracks()[0];

            // Read current toggle state directly from store (not from closure)
            const { isMicEnabled: micOn, isVideoEnabled: vidOn } = useOfficeStore.getState();
            if (videoTrack) {
                videoTrack.enabled = vidOn;
                videoTrackRef.current = videoTrack;
            }
            if (audioTrack) {
                audioTrack.enabled = micOn;
                audioTrackRef.current = audioTrack;
            }

            setLocalStream(stream);
        } catch (err) {
            console.error('Failed to initialize/update media:', err);
        } finally {
            isInitializingRef.current = false;
        }
        // Only re-create when device selection or setup state changes, NOT on mic/video toggle
    }, [hasCompletedDeviceSetup, selectedAudioInput, selectedVideoInput, setLocalStream]);

    // Effect per inizializzare/aggiornare quando cambiano i dispositivi selezionati
    // o quando l'utente completa il setup iniziale
    useEffect(() => {
        const setupCompleted = hasCompletedDeviceSetup && !lastDeviceSetupRef.current;

        if (setupCompleted) {
            // Il setup è appena stato completato - verifica se c'è già uno stream valido
            const currentStream = useOfficeStore.getState().localStream;
            if (currentStream) {
                // Usa lo stream esistente, aggiorna solo i track refs
                const { isMicEnabled: micOn, isVideoEnabled: vidOn } = useOfficeStore.getState();
                const videoTrack = currentStream.getVideoTracks()[0];
                const audioTrack = currentStream.getAudioTracks()[0];
                if (videoTrack) {
                    videoTrack.enabled = vidOn;
                    videoTrackRef.current = videoTrack;
                }
                if (audioTrack) {
                    audioTrack.enabled = micOn;
                    audioTrackRef.current = audioTrack;
                }
            } else {
                // Nessuno stream esistente, inizializza
                initOrUpdateMedia();
            }
            initializedRef.current = true;
        }

        lastDeviceSetupRef.current = hasCompletedDeviceSetup;
        // Only run on setup completion or device selection change — NOT on mic/video toggle
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasCompletedDeviceSetup, selectedAudioInput, selectedVideoInput, initOrUpdateMedia]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            const currentStream = useOfficeStore.getState().localStream;
            if (currentStream) {
                currentStream.getTracks().forEach(t => t.stop());
            }
            setLocalStream(null);
        };
    }, [setLocalStream]);

    // Handle video toggle - enable/disable track instead of removing
    useEffect(() => {
        const currentStream = useOfficeStore.getState().localStream;
        if (!currentStream) return;

        const videoTrack = currentStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = isVideoEnabled;
            videoTrackRef.current = videoTrack;
            // Notifica il cambiamento creando un nuovo stream con lo stesso contenuto
            // ma stato aggiornato - questo triggera gli effect che dipendono da localStream
            const newStream = new MediaStream(currentStream.getTracks());
            setLocalStream(newStream);
        }
    }, [isVideoEnabled, setLocalStream]);

    // Handle mic toggle - enable/disable track instead of removing
    useEffect(() => {
        const currentStream = useOfficeStore.getState().localStream;
        if (!currentStream) return;

        const audioTrack = currentStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = isMicEnabled;
            audioTrackRef.current = audioTrack;
            // Notifica il cambiamento
            const newStream = new MediaStream(currentStream.getTracks());
            setLocalStream(newStream);
        }
    }, [isMicEnabled, setLocalStream]);

    // Update track refs when stream changes
    useEffect(() => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            const audioTrack = localStream.getAudioTracks()[0];
            if (videoTrack) videoTrackRef.current = videoTrack;
            if (audioTrack) audioTrackRef.current = audioTrack;
        }
    }, [localStream]);

    // Crea o aggiorna container per uno schermo
    const createScreenContainer = useCallback((stream: MediaStream, index: number) => {
        const streamId = stream.id;

        // Se il container esiste già, aggiorna solo il video
        let container = screenContainersMap.get(streamId);

        if (!container) {
            // Calcola posizione in base all'indice (a cascata)
            const baseLeft = 280 + (index * 40);
            const baseTop = 100 + (index * 40);

            container = document.createElement('div');
            container.id = `screen-share-container-${streamId}`;
            container.style.cssText = `
                position: fixed;
                bottom: ${baseTop}px;
                left: ${baseLeft}px;
                width: 360px;
                height: 220px;
                z-index: ${9999 + index};
                pointer-events: auto;
                user-select: none;
            `;

            // Drag and resize state
            let isDragging = false;
            let isResizing = false;
            let startX = 0, startY = 0, startWidth = 0, startHeight = 0, startLeft = 0, startTop = 0;

            // Wrapper with border
            const wrapper = document.createElement('div');
            wrapper.style.cssText = `
                width: 100%;
                height: 100%;
                background: #0f172a;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 30px ${isSpeaking ? 'rgba(16,185,129,0.5)' : 'rgba(99,102,241,0.5)'};
                border: 3px solid ${isSpeaking ? '#10b981' : '#6366f1'};
                transition: border-color 0.3s, box-shadow 0.3s;
                display: flex;
                flex-direction: column;
            `;

            // Toolbar
            const toolbar = document.createElement('div');
            toolbar.style.cssText = `
                height: 36px;
                background: linear-gradient(90deg, #1e1b4b 0%, #312e81 100%);
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 12px;
                cursor: grab;
                flex-shrink: 0;
            `;

            // Label con numero schermo
            const label = document.createElement('div');
            label.id = `screen-share-label-${streamId}`;
            label.innerHTML = `🔴 Schermo ${index + 1}`;
            label.style.cssText = `
                color: white;
                font-size: 12px;
                font-weight: 600;
                pointer-events: none;
            `;

            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '✕';
            closeBtn.title = 'Chiudi questo schermo';
            closeBtn.style.cssText = `
                width: 26px;
                height: 26px;
                border-radius: 6px;
                background: rgba(239, 68, 68, 0.8);
                color: white;
                border: none;
                cursor: pointer;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            `;
            closeBtn.onmouseenter = () => {
                closeBtn.style.background = 'rgba(239, 68, 68, 1)';
                closeBtn.style.transform = 'scale(1.05)';
            };
            closeBtn.onmouseleave = () => {
                closeBtn.style.background = 'rgba(239, 68, 68, 0.8)';
                closeBtn.style.transform = 'scale(1)';
            };
            closeBtn.onclick = () => {
                stream.getTracks().forEach(track => track.stop());
                removeScreenContainer(streamId);
            };

            // Add "+" button per aggiungere altri schermi
            const addBtn = document.createElement('button');
            addBtn.innerHTML = '+';
            addBtn.title = 'Aggiungi altro schermo';
            addBtn.style.cssText = `
                width: 26px;
                height: 26px;
                border-radius: 6px;
                background: rgba(16, 185, 129, 0.8);
                color: white;
                border: none;
                cursor: pointer;
                font-size: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                margin-right: 8px;
            `;
            addBtn.onmouseenter = () => {
                addBtn.style.background = 'rgba(16, 185, 129, 1)';
                addBtn.style.transform = 'scale(1.05)';
            };
            addBtn.onmouseleave = () => {
                addBtn.style.background = 'rgba(16, 185, 129, 0.8)';
                addBtn.style.transform = 'scale(1)';
            };
            addBtn.onclick = async () => {
                try {
                    const newStream = await navigator.mediaDevices.getDisplayMedia({
                        video: true,
                        audio: false
                    });
                    useOfficeStore.getState().addScreenStream(newStream);
                } catch (err) {
                    console.error('Failed to add screen:', err);
                }
            };

            toolbar.appendChild(label);
            toolbar.appendChild(addBtn);
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

            // Resize handle
            const resizeHandle = document.createElement('div');
            resizeHandle.innerHTML = '◢';
            resizeHandle.title = 'Trascina per ridimensionare';
            resizeHandle.style.cssText = `
                position: absolute;
                bottom: 4px;
                right: 4px;
                width: 32px;
                height: 32px;
                cursor: se-resize;
                z-index: 10010;
                background: linear-gradient(135deg, transparent 40%, rgba(99, 102, 241, 0.9) 40%);
                border-radius: 8px 0 8px 0;
                color: white;
                font-size: 12px;
                display: flex;
                align-items: flex-end;
                justify-content: flex-end;
                padding: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.5);
                transition: all 0.2s;
                pointer-events: auto;
            `;
            resizeHandle.onmouseenter = () => {
                resizeHandle.style.background = 'linear-gradient(135deg, transparent 40%, rgba(129, 140, 248, 1) 40%)';
                resizeHandle.style.transform = 'scale(1.1)';
            };
            resizeHandle.onmouseleave = () => {
                resizeHandle.style.background = 'linear-gradient(135deg, transparent 40%, rgba(99, 102, 241, 0.9) 40%)';
                resizeHandle.style.transform = 'scale(1)';
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
                label.innerHTML = `🔴 Schermo ${index + 1}`;
            }

            // Assicurati che il video abbia lo stream corretto
            const video = document.getElementById(`screen-share-video-${streamId}`) as HTMLVideoElement;
            if (video && video.srcObject !== stream) {
                video.srcObject = stream;
            }
        }
    }, [isSpeaking, removeScreenContainer]);

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

    // Volume detection for speaking indicator - OTTIMIZZATO
    useEffect(() => {
        let animationFrame: number;
        let audioContext: AudioContext | null = null;
        let isChecking = false;

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
                // Aumentato fftSize per migliore risoluzione e reattività
                analyzer.fftSize = 512;
                analyzer.smoothingTimeConstant = 0.3;

                const bufferLength = analyzer.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                let speakCount = 0;
                let lastUpdateTime = 0;

                const checkVolume = (timestamp: number) => {
                    if (!audioContext || audioContext.state === 'closed') return;

                    // Limita gli aggiornamenti a ~30fps per evitare sovraccarico
                    if (timestamp - lastUpdateTime < 33) {
                        animationFrame = requestAnimationFrame(checkVolume);
                        return;
                    }
                    lastUpdateTime = timestamp;

                    analyzer.getByteFrequencyData(dataArray);

                    // Calcolo ottimizzato della media
                    let total = 0;
                    // Campiona solo metà dei dati per performance
                    for (let i = 0; i < bufferLength; i += 2) {
                        total += dataArray[i];
                    }
                    const average = total / (bufferLength / 2);

                    // Soglia ridotta per maggiore sensibilità
                    if (average > 15) {
                        speakCount = Math.min(speakCount + 1, 5);
                    } else {
                        speakCount = Math.max(speakCount - 1, 0);
                    }

                    setSpeaking(speakCount > 1);
                    animationFrame = requestAnimationFrame(checkVolume);
                };

                animationFrame = requestAnimationFrame(checkVolume);
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
