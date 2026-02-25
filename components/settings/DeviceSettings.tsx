'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
    Mic, 
    MicOff, 
    Video, 
    VideoOff, 
    Volume2, 
    MonitorSpeaker,
    Check,
    Settings,
    X,
    RefreshCw,
    Headphones,
    AlertCircle,
    Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOfficeStore } from '../../stores/useOfficeStore';

interface DeviceSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    isInitialSetup?: boolean;
}

interface AudioLevel {
    value: number;
    peak: number;
}

interface DeviceInfo {
    deviceId: string;
    label: string;
    kind: MediaDeviceKind;
}

export function DeviceSettings({ isOpen, onClose, isInitialSetup = false }: DeviceSettingsProps) {
    const {
        selectedAudioInput,
        selectedAudioOutput,
        selectedVideoInput,
        setSelectedAudioInput,
        setSelectedAudioOutput,
        setSelectedVideoInput,
        setLocalStream,
        setHasCompletedDeviceSetup,
        isMicEnabled,
        isVideoEnabled,
        isRemoteAudioEnabled,
        toggleMic,
        toggleVideo,
        toggleRemoteAudio
    } = useOfficeStore();

    const [devices, setDevices] = useState<DeviceInfo[]>([]);
    const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
    const [testAudioLevel, setTestAudioLevel] = useState<AudioLevel>({ value: 0, peak: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const [isRequestingPermission, setIsRequestingPermission] = useState(false);
    const [activeTab, setActiveTab] = useState<'input' | 'output' | 'video'>('input');
    const [error, setError] = useState<string | null>(null);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [videoWarning, setVideoWarning] = useState<string | null>(null);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const testAudioElementRef = useRef<HTMLAudioElement | null>(null);
    const hasInitialized = useRef(false);
    const streamInitializedRef = useRef(false);
    const videoRetryCountRef = useRef(0);
    const maxVideoRetries = 3;

    // Filtra i dispositivi per tipo e aggiungi opzione "Default"
    const audioInputs = [
        { deviceId: 'default', label: 'Default di sistema', kind: 'audioinput' as MediaDeviceKind },
        ...devices.filter(d => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications')
    ];
    const audioOutputs = [
        { deviceId: 'default', label: 'Default di sistema', kind: 'audiooutput' as MediaDeviceKind },
        ...devices.filter(d => d.kind === 'audiooutput' && d.deviceId !== 'default' && d.deviceId !== 'communications')
    ];
    const videoInputs = [
        { deviceId: 'default', label: 'Default di sistema', kind: 'videoinput' as MediaDeviceKind },
        ...devices.filter(d => d.kind === 'videoinput' && d.deviceId !== 'default')
    ];

    // Funzione per ottenere i dispositivi con permessi
    const requestPermissionsAndGetDevices = useCallback(async () => {
        setIsRequestingPermission(true);
        setError(null);
        
        try {
            // Step 1: Richiedi permessi con getUserMedia
            const tempStream = await navigator.mediaDevices.getUserMedia({ 
                audio: true, 
                video: true 
            });
            
            // Step 2: Ora possiamo enumerare i dispositivi con i nomi
            const mediaDevices = await navigator.mediaDevices.enumerateDevices();
            
            // Step 3: Ferma lo stream temporaneo
            tempStream.getTracks().forEach(track => track.stop());
            
            // Step 4: Processa i dispositivi
            const processedDevices: DeviceInfo[] = mediaDevices.map(device => ({
                deviceId: device.deviceId,
                label: device.label || getDefaultLabel(device),
                kind: device.kind
            }));
            
            setDevices(processedDevices);
            setPermissionGranted(true);
            
            // Step 5: Seleziona i default se non già selezionati
            const store = useOfficeStore.getState();
            
            if (!store.selectedAudioInput) {
                setSelectedAudioInput('default');
            }
            
            if (!store.selectedAudioOutput) {
                setSelectedAudioOutput('default');
            }
            
            if (!store.selectedVideoInput) {
                setSelectedVideoInput('default');
            }
            
        } catch (err: any) {
            console.error('Permission denied:', err);
            setError('Permessi negati. Per favore consenti l\'accesso a microfono e webcam.');
            setPermissionGranted(false);
        } finally {
            setIsRequestingPermission(false);
        }
    }, [setSelectedAudioInput, setSelectedAudioOutput, setSelectedVideoInput]);

    // Funzione per ottenere video stream con retry e fallback
    const getVideoStreamWithRetry = async (deviceId: string | null, includeAudio: boolean): Promise<MediaStream> => {
        const videoConstraints = deviceId && deviceId !== 'default' 
            ? { deviceId: { exact: deviceId } }
            : true;
            
        const audioConstraints = includeAudio 
            ? (selectedAudioInput && selectedAudioInput !== 'default' 
                ? { deviceId: { exact: selectedAudioInput } } 
                : true)
            : false;

        // Prima prova: constraint base
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: videoConstraints,
                audio: audioConstraints
            });
            
            // Verifica che il video track sia effettivamente attivo
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack && videoTrack.readyState === 'live') {
                videoRetryCountRef.current = 0;
                return stream;
            }
            
            // Se il track esiste ma non è live, fermiamo e riproviamo
            stream.getTracks().forEach(t => t.stop());
            throw new Error('Video track not live');
            
        } catch (err) {
            if (videoRetryCountRef.current < maxVideoRetries) {
                videoRetryCountRef.current++;
                console.log(`Video retry attempt ${videoRetryCountRef.current}/${maxVideoRetries}`);
                
                // Piccolo delay prima di riprovare
                await new Promise(resolve => setTimeout(resolve, 500));
                return getVideoStreamWithRetry(deviceId, includeAudio);
            }
            
            // Fallback: prova con risoluzione più bassa
            try {
                console.log('Trying with lower resolution...');
                const lowResConstraints = deviceId && deviceId !== 'default'
                    ? { 
                        deviceId: { exact: deviceId },
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 15 }
                      }
                    : { 
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 15 }
                      };
                      
                return await navigator.mediaDevices.getUserMedia({
                    video: lowResConstraints,
                    audio: audioConstraints
                });
            } catch (fallbackErr) {
                throw err; // Rilancia l'errore originale
            }
        }
    };

    // Funzione helper per label di default
    const getDefaultLabel = (device: MediaDeviceInfo): string => {
        const index = device.kind === 'audioinput' ? 
            devices.filter(d => d.kind === 'audioinput').length + 1 :
            device.kind === 'videoinput' ?
                devices.filter(d => d.kind === 'videoinput').length + 1 :
                devices.filter(d => d.kind === 'audiooutput').length + 1;
        
        switch (device.kind) {
            case 'audioinput':
                return `Microfono ${index}`;
            case 'videoinput':
                return `Camera ${index}`;
            case 'audiooutput':
                return `Altoparlanti ${index}`;
            default:
                return `Dispositivo ${index}`;
        }
    };

    // Inizializza quando si apre il modal
    useEffect(() => {
        if (isOpen && !hasInitialized.current) {
            hasInitialized.current = true;
            streamInitializedRef.current = false;
            requestPermissionsAndGetDevices();
        }
        
        if (!isOpen) {
            hasInitialized.current = false;
            streamInitializedRef.current = false;
            // Cleanup solo se non abbiamo applicato (non c'è localStream)
            const currentLocalStream = useOfficeStore.getState().localStream;
            if (previewStream && previewStream !== currentLocalStream) {
                previewStream.getTracks().forEach(t => t.stop());
                setPreviewStream(null);
            }
            stopAudioMonitoring();
        }
    }, [isOpen, requestPermissionsAndGetDevices]);

    // Avvia la preview automaticamente quando i dispositivi sono selezionati
    useEffect(() => {
        if (!isOpen || !permissionGranted || streamInitializedRef.current) return;
        
        // Avvia la preview con i dispositivi correnti
        const startPreview = async () => {
            setIsLoading(true);
            videoRetryCountRef.current = 0;
            
            try {
                const stream = await getVideoStreamWithRetry(selectedVideoInput, true);
                setPreviewStream(stream);
                streamInitializedRef.current = true;
                
                // Verifica che il video sia effettivamente funzionante
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                    console.log('Video track info:', {
                        label: videoTrack.label,
                        readyState: videoTrack.readyState,
                        muted: videoTrack.muted,
                        enabled: videoTrack.enabled
                    });
                    
                    // Se il track è muted, potrebbe essere in uso da un'altra app
                    if (videoTrack.muted) {
                        setError('La telecamera potrebbe essere in uso da un\'altra applicazione. Chiudi altre app e riprova.');
                    }
                }
                
                // Inizia il monitoring dell'audio
                if (stream.getAudioTracks().length > 0) {
                    startAudioMonitoring(stream);
                }
                
            } catch (err: any) {
                console.error('Preview error:', err);
                let errorMsg = `Errore nell'accesso al dispositivo: ${err.message}`;
                
                if (err.name === 'NotAllowedError') {
                    errorMsg = 'Permesso negato. Verifica che il browser possa accedere alla telecamera.';
                } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                    errorMsg = 'La telecamera è in uso da un\'altra applicazione. Chiudi Skype, Zoom, Teams, o altre app che usano la webcam.';
                } else if (err.name === 'OverconstrainedError') {
                    errorMsg = 'La telecamera non supporta le impostazioni richieste. Prova a selezionare "Default di sistema".';
                } else if (err.name === 'NotFoundError') {
                    errorMsg = 'Telecamera non trovata. Verifica che sia collegata correttamente.';
                }
                
                setError(errorMsg);
            } finally {
                setIsLoading(false);
            }
        };
        
        const timeout = setTimeout(startPreview, 100);
        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, permissionGranted]);

    // Aggiorna la preview quando cambiano i dispositivi selezionati
    useEffect(() => {
        if (!isOpen || !permissionGranted || !streamInitializedRef.current) return;
        
        const updatePreview = async () => {
            setIsLoading(true);
            videoRetryCountRef.current = 0;
            
            try {
                // Ferma lo stream precedente
                if (previewStream) {
                    previewStream.getTracks().forEach(t => t.stop());
                }
                stopAudioMonitoring();
                
                const stream = await getVideoStreamWithRetry(selectedVideoInput, true);
                setPreviewStream(stream);
                
                // Inizia il monitoring dell'audio
                if (stream.getAudioTracks().length > 0) {
                    startAudioMonitoring(stream);
                }
                
            } catch (err: any) {
                console.error('Preview error:', err);
                setError(`Errore nell'accesso al dispositivo: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        };
        
        const timeout = setTimeout(updatePreview, 300);
        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedAudioInput, selectedVideoInput]);

    // Assegna lo stream al video element - FORZA IL PLAY con retry automatico
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !previewStream) return;

        let playAttempts = 0;
        const maxAttempts = 5;
        let retryTimeout: NodeJS.Timeout;

        const tryPlay = async () => {
            if (!video || !previewStream) return;
            
            // Assicurati che srcObject sia impostato
            if (video.srcObject !== previewStream) {
                video.srcObject = previewStream;
            }

            // Verifica che il video track sia attivo
            const videoTrack = previewStream.getVideoTracks()[0];
            if (!videoTrack || videoTrack.readyState !== 'live') {
                console.log('Video track not ready yet, waiting...');
                if (playAttempts < maxAttempts) {
                    playAttempts++;
                    retryTimeout = setTimeout(tryPlay, 300);
                }
                return;
            }

            try {
                // Forza il video a essere visibile
                video.style.opacity = '1';
                await video.play();
                console.log('Video playing successfully');
                playAttempts = 0;
            } catch (err: any) {
                console.warn(`Video play attempt ${playAttempts + 1} failed:`, err);
                if (playAttempts < maxAttempts) {
                    playAttempts++;
                    retryTimeout = setTimeout(tryPlay, 300);
                }
            }
        };

        // Inizia immediatamente
        tryPlay();

        // Aggiungi listener per loadedmetadata come backup
        const handleLoadedMetadata = () => {
            console.log('Video metadata loaded, attempting play');
            tryPlay();
        };

        // Aggiungi listener per when video track becomes unmuted
        const videoTrack = previewStream.getVideoTracks()[0];
        const handleUnmute = () => {
            console.log('Video track unmuted, attempting play');
            tryPlay();
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        videoTrack?.addEventListener('unmute', handleUnmute);

        // Forza un retry dopo un breve delay iniziale
        const initialRetry = setTimeout(tryPlay, 100);

        return () => {
            clearTimeout(retryTimeout);
            clearTimeout(initialRetry);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            videoTrack?.removeEventListener('unmute', handleUnmute);
        };
    }, [previewStream]);
    
    // Monitora lo stato del video track per rilevare problemi
    useEffect(() => {
        if (!previewStream) {
            setVideoWarning(null);
            return;
        }
        
        const videoTrack = previewStream.getVideoTracks()[0];
        if (!videoTrack) {
            setVideoWarning('Nessun video track trovato');
            return;
        }
        
        const checkVideoState = () => {
            if (videoTrack.muted) {
                setVideoWarning('La telecamera potrebbe essere in uso da un\'altra applicazione');
            } else if (videoTrack.readyState !== 'live') {
                setVideoWarning('La telecamera non è attiva');
            } else {
                setVideoWarning(null);
            }
        };
        
        checkVideoState();
        
        // Ascolta gli eventi del track
        videoTrack.addEventListener('mute', checkVideoState);
        videoTrack.addEventListener('unmute', checkVideoState);
        videoTrack.addEventListener('ended', checkVideoState);
        
        // Controlla periodicamente
        const interval = setInterval(checkVideoState, 1000);
        
        return () => {
            videoTrack.removeEventListener('mute', checkVideoState);
            videoTrack.removeEventListener('unmute', checkVideoState);
            videoTrack.removeEventListener('ended', checkVideoState);
            clearInterval(interval);
        };
    }, [previewStream]);

    // Quando la telecamera viene disattivata, disattiva anche microfono e audio in entrata
    useEffect(() => {
        if (!isOpen) return;
        
        if (!isVideoEnabled) {
            // Disattiva microfono se attivo
            if (isMicEnabled && previewStream) {
                const audioTrack = previewStream.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = false;
                }
                toggleMic();
            }
            // Disattiva audio in entrata se attivo
            if (isRemoteAudioEnabled) {
                toggleRemoteAudio();
            }
        }
    }, [isVideoEnabled, isOpen, isMicEnabled, isRemoteAudioEnabled, toggleMic, toggleRemoteAudio, previewStream]);

    // Monitoraggio livello audio - OTTIMIZZATO per maggiore reattività
    const startAudioMonitoring = (stream: MediaStream) => {
        stopAudioMonitoring();
        
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            
            // Configurazione ottimizzata per reattività
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.2;
            
            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
            
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const timeDomainArray = new Uint8Array(bufferLength);
            let peakDecay = 0;
            
            let frameCount = 0;
            
            const checkLevel = () => {
                if (!analyser) return;
                
                frameCount++;
                
                analyser.getByteTimeDomainData(timeDomainArray);
                analyser.getByteFrequencyData(dataArray);
                
                // Calcola il livello RMS dal time domain
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const sample = (timeDomainArray[i] - 128) / 128;
                    sum += sample * sample;
                }
                const rms = Math.sqrt(sum / bufferLength);
                
                // Calcola anche dalla frequenza
                let freqSum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    freqSum += dataArray[i];
                }
                const freqAvg = freqSum / bufferLength;
                
                // Combina i due metodi
                const combinedLevel = Math.max(rms * 200, (freqAvg / 255) * 100);
                const normalized = Math.min(100, combinedLevel * 1.5);
                
                peakDecay = Math.max(peakDecay - 5, 0);
                const peak = Math.max(normalized, peakDecay);
                peakDecay = peak;
                
                if (frameCount % 3 === 0) {
                    setTestAudioLevel({ value: normalized, peak });
                }
                
                animationFrameRef.current = requestAnimationFrame(checkLevel);
            };
            
            checkLevel();
        } catch (err) {
            console.warn('Audio monitoring failed:', err);
        }
    };

    const stopAudioMonitoring = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setTestAudioLevel({ value: 0, peak: 0 });
    };

    // Test audio output
    const testAudioOutput = async () => {
        try {
            if (!testAudioElementRef.current) {
                testAudioElementRef.current = new Audio();
            }
            
            const audio = testAudioElementRef.current;
            
            // Crea un beep
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const sampleRate = audioContext.sampleRate;
            const duration = 0.5;
            const numberOfSamples = duration * sampleRate;
            
            const buffer = audioContext.createBuffer(1, numberOfSamples, sampleRate);
            const data = buffer.getChannelData(0);
            
            for (let i = 0; i < numberOfSamples; i++) {
                const t = i / sampleRate;
                const envelope = Math.exp(-3 * t);
                data[i] = Math.sin(2 * Math.PI * 440 * t) * 0.3 * envelope;
            }
            
            const wavBlob = bufferToWave(buffer, numberOfSamples);
            const url = URL.createObjectURL(wavBlob);
            
            audio.src = url;
            audio.loop = false;
            
            // Prova a impostare il sink
            if (selectedAudioOutput && selectedAudioOutput !== 'default') {
                // @ts-ignore
                if (audio.setSinkId) {
                    try {
                        // @ts-ignore
                        await audio.setSinkId(selectedAudioOutput);
                    } catch (err) {
                        console.warn('setSinkId failed:', err);
                    }
                }
            }
            
            await audio.play();
            
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
        } catch (err) {
            console.error('Audio test failed:', err);
            // Fallback
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 440;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        }
    };

    // Helper per convertire buffer in WAV
    function bufferToWave(abuffer: AudioBuffer, len: number) {
        let numOfChan = abuffer.numberOfChannels,
            length = len * numOfChan * 2 + 44,
            buffer = new ArrayBuffer(length),
            view = new DataView(buffer),
            channels = [],
            i: number,
            sample: number,
            offset = 0,
            pos = 0;

        setUint32(0x46464952);
        setUint32(length - 8);
        setUint32(0x45564157);
        setUint32(0x20746d66);
        setUint32(16);
        setUint16(1);
        setUint16(numOfChan);
        setUint32(abuffer.sampleRate);
        setUint32(abuffer.sampleRate * 2 * numOfChan);
        setUint16(numOfChan * 2);
        setUint16(16);
        setUint32(0x61746164);
        setUint32(length - pos - 4);

        for(i = 0; i < abuffer.numberOfChannels; i++)
            channels.push(abuffer.getChannelData(i));

        while(pos < length) {
            for(i = 0; i < numOfChan; i++) {
                sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
                view.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }

        return new Blob([buffer], {type: "audio/wav"});

        function setUint16(data: number) {
            view.setUint16(pos, data, true);
            pos += 2;
        }

        function setUint32(data: number) {
            view.setUint32(pos, data, true);
            pos += 4;
        }
    }

    // Applica le impostazioni
    const applySettings = useCallback(() => {
        // Ferma lo stream precedente se esiste
        const currentStream = useOfficeStore.getState().localStream;
        if (currentStream) {
            currentStream.getTracks().forEach(t => t.stop());
        }
        
        // Se abbiamo uno stream di preview, usiamo quello come stream locale
        if (previewStream) {
            stopAudioMonitoring();
            setLocalStream(previewStream);
            setPreviewStream(null);
        }
        
        setHasCompletedDeviceSetup(true);
        onClose();
    }, [previewStream, setLocalStream, setHasCompletedDeviceSetup, onClose]);

    // Cleanup quando il componente si smonta o si chiude
    useEffect(() => {
        return () => {
            stopAudioMonitoring();
        };
    }, []);

    // Aggiorna dispositivi quando si ricollega qualcosa
    useEffect(() => {
        const handleDeviceChange = () => {
            if (permissionGranted) {
                requestPermissionsAndGetDevices();
            }
        };
        
        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        };
    }, [permissionGranted, requestPermissionsAndGetDevices]);

    if (!isOpen) return null;

    // Schermata di richiesta permessi
    if (!permissionGranted && !isRequestingPermission) {
        return (
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-8 text-center shadow-2xl"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mx-auto mb-6">
                            <Settings className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Configura i tuoi dispositivi</h2>
                        <p className="text-slate-400 mb-6">
                            Per accedere all&apos;ufficio virtuale, abbiamo bisogno del tuo permesso per utilizzare microfono e webcam.
                        </p>
                        
                        {error && (
                            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
                                <AlertCircle className="w-4 h-4 inline mr-2" />
                                {error}
                            </div>
                        )}
                        
                        <div className="flex items-center justify-center gap-4 text-slate-500 mb-8">
                            <Mic className="w-6 h-6" />
                            <Video className="w-6 h-6" />
                            <Headphones className="w-6 h-6" />
                        </div>
                        
                        <button
                            onClick={requestPermissionsAndGetDevices}
                            className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25"
                        >
                            Consenti accesso ai dispositivi
                        </button>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        );
    }

    // Loading state
    if (isRequestingPermission) {
        return (
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-8 text-center shadow-2xl"
                    >
                        <RefreshCw className="w-12 h-12 text-indigo-400 animate-spin mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">Accesso ai dispositivi...</h2>
                        <p className="text-slate-400">
                            Attendi mentre richiediamo l&apos;accesso a microfono e webcam
                        </p>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        );
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                                <Settings className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">
                                    {isInitialSetup ? 'Configura i tuoi dispositivi' : 'Cabina di Regia'}
                                </h2>
                                <p className="text-sm text-slate-400">
                                    Seleziona e testa i dispositivi che vuoi usare
                                </p>
                            </div>
                        </div>
                        {!isInitialSetup && (
                            <button 
                                onClick={onClose}
                                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        )}
                    </div>

                    <div className="flex h-[65vh]">
                        {/* Sidebar Tabs */}
                        <div className="w-72 bg-slate-950/50 border-r border-slate-800 p-4 space-y-2">
                            <button
                                onClick={() => setActiveTab('input')}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                                    activeTab === 'input' 
                                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                                        : 'text-slate-400 hover:bg-slate-800/50'
                                }`}
                            >
                                <Mic className="w-5 h-5" />
                                <div className="flex-1 text-left">
                                    <span className="font-medium">Microfono</span>
                                    <p className="text-xs text-slate-500 truncate">
                                        {selectedAudioInput === 'default' 
                                            ? 'Default di sistema' 
                                            : audioInputs.find(d => d.deviceId === selectedAudioInput)?.label || 'Non selezionato'}
                                    </p>
                                </div>
                                {selectedAudioInput && <Check className="w-4 h-4 text-emerald-400" />}
                            </button>
                            
                            <button
                                onClick={() => setActiveTab('output')}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                                    activeTab === 'output' 
                                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                                        : 'text-slate-400 hover:bg-slate-800/50'
                                }`}
                            >
                                <Headphones className="w-5 h-5" />
                                <div className="flex-1 text-left">
                                    <span className="font-medium">Audio Uscita</span>
                                    <p className="text-xs text-slate-500 truncate">
                                        {selectedAudioOutput === 'default' 
                                            ? 'Default di sistema' 
                                            : audioOutputs.find(d => d.deviceId === selectedAudioOutput)?.label || 'Default di sistema'}
                                    </p>
                                </div>
                                <Check className="w-4 h-4 text-emerald-400" />
                            </button>
                            
                            <button
                                onClick={() => setActiveTab('video')}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                                    activeTab === 'video' 
                                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                                        : 'text-slate-400 hover:bg-slate-800/50'
                                }`}
                            >
                                <Video className="w-5 h-5" />
                                <div className="flex-1 text-left">
                                    <span className="font-medium">Webcam</span>
                                    <p className="text-xs text-slate-500 truncate">
                                        {selectedVideoInput === 'default' 
                                            ? 'Default di sistema' 
                                            : videoInputs.find(d => d.deviceId === selectedVideoInput)?.label || 'Non selezionata'}
                                    </p>
                                </div>
                                {selectedVideoInput && <Check className="w-4 h-4 text-emerald-400" />}
                            </button>

                            <div className="pt-4 mt-4 border-t border-slate-800">
                                <button
                                    onClick={() => requestPermissionsAndGetDevices()}
                                    className="w-full flex items-center gap-2 p-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Aggiorna dispositivi
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-6 overflow-y-auto">
                            {error && (
                                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
                                    <AlertCircle className="w-4 h-4 inline mr-2" />
                                    {error}
                                </div>
                            )}

                            {/* MICROFONO */}
                            {activeTab === 'input' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-4">Seleziona Microfono</h3>
                                    </div>

                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {audioInputs.map((device) => (
                                            <button
                                                key={device.deviceId}
                                                onClick={() => setSelectedAudioInput(device.deviceId)}
                                                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                                                    selectedAudioInput === device.deviceId
                                                        ? 'bg-indigo-500/10 border-indigo-500/50'
                                                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                                                }`}
                                            >
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                    selectedAudioInput === device.deviceId
                                                        ? 'bg-indigo-500 text-white'
                                                        : 'bg-slate-700 text-slate-400'
                                                }`}>
                                                    {device.deviceId === 'default' 
                                                        ? <Mic className="w-5 h-5" />
                                                        : <Mic className="w-5 h-5" />
                                                    }
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-medium truncate ${
                                                        selectedAudioInput === device.deviceId ? 'text-white' : 'text-slate-300'
                                                    }`}>
                                                        {device.label}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {device.deviceId === 'default' ? 'Usa il microfono predefinito di sistema' : 'Dispositivo audio'}
                                                    </p>
                                                </div>
                                                {selectedAudioInput === device.deviceId && (
                                                    <Check className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                                                )}
                                            </button>
                                        ))}
                                        
                                        {audioInputs.length === 0 && (
                                            <p className="text-slate-500 text-center py-8">
                                                Nessun microfono trovato
                                            </p>
                                        )}
                                    </div>

                                    {/* Audio Level Meter */}
                                    <div className="mt-6 p-4 bg-slate-800/50 rounded-xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-slate-400">Livello Audio</span>
                                            <span className={`text-xs ${testAudioLevel.value > 5 ? 'text-emerald-400 font-medium' : 'text-slate-500'}`}>
                                                {testAudioLevel.value > 5 ? 'Rilevato audio!' : 'Parla per testare'}
                                            </span>
                                        </div>
                                        <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-500 transition-all duration-75 ease-out"
                                                style={{ width: `${testAudioLevel.value}%` }}
                                            />
                                        </div>
                                        <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden relative">
                                            <div 
                                                className="absolute h-full w-1 bg-white transition-all duration-75"
                                                style={{ left: `${testAudioLevel.peak}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2">
                                            Il livello si aggiorna in tempo reale mentre parli
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* AUDIO USCITA */}
                            {activeTab === 'output' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Seleziona Dispositivo Uscita</h3>
                                        <p className="text-sm text-slate-400 mb-4">
                                            Scegli dove vuoi ascoltare l&apos;audio. Il test emetterà un suono dal dispositivo selezionato.
                                        </p>
                                    </div>

                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {audioOutputs.map((device) => (
                                            <button
                                                key={device.deviceId}
                                                onClick={() => setSelectedAudioOutput(device.deviceId)}
                                                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                                                    selectedAudioOutput === device.deviceId
                                                        ? 'bg-indigo-500/10 border-indigo-500/50'
                                                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                                                }`}
                                            >
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                    selectedAudioOutput === device.deviceId
                                                        ? 'bg-indigo-500 text-white'
                                                        : 'bg-slate-700 text-slate-400'
                                                }`}>
                                                    {device.deviceId === 'default' 
                                                        ? <MonitorSpeaker className="w-5 h-5" />
                                                        : device.label.toLowerCase().includes('cuffia') || 
                                                          device.label.toLowerCase().includes('headphone') ||
                                                          device.label.toLowerCase().includes('airpod') ||
                                                          device.label.toLowerCase().includes('earbud')
                                                            ? <Headphones className="w-5 h-5" />
                                                            : <MonitorSpeaker className="w-5 h-5" />
                                                    }
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-medium truncate ${
                                                        selectedAudioOutput === device.deviceId ? 'text-white' : 'text-slate-300'
                                                    }`}>
                                                        {device.label}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {device.deviceId === 'default' ? 'Usa l\'output audio predefinito di sistema' : 'Dispositivo audio'}
                                                    </p>
                                                </div>
                                                {selectedAudioOutput === device.deviceId && (
                                                    <Check className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                                                )}
                                            </button>
                                        ))}
                                        
                                        {audioOutputs.length === 0 && (
                                            <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                                                <p className="text-slate-400">
                                                    Verrà usato il dispositivo di default del sistema
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Test Audio */}
                                    <button
                                        onClick={testAudioOutput}
                                        className="w-full mt-4 p-4 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl text-indigo-300 font-medium transition-all flex items-center justify-center gap-2"
                                    >
                                        <Volume2 className="w-5 h-5" />
                                        Test Audio
                                    </button>
                                    
                                    <p className="text-xs text-slate-500 text-center">
                                        Nota: Chrome/Edge supportano la selezione audio. Altri browser useranno il default.
                                    </p>
                                </div>
                            )}

                            {/* WEBCAM */}
                            {activeTab === 'video' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-4">Seleziona Webcam</h3>
                                    </div>

                                    {/* Preview Video */}
                                    <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border-2 border-slate-700">
                                        {isLoading ? (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <RefreshCw className="w-8 h-8 text-slate-500 animate-spin" />
                                            </div>
                                        ) : previewStream && previewStream.getVideoTracks().length > 0 ? (
                                            <video
                                                ref={videoRef}
                                                autoPlay
                                                playsInline
                                                muted
                                                className="w-full h-full object-cover"
                                                style={{ transform: 'scaleX(-1)' }}
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <VideoOff className="w-12 h-12 text-slate-600 mb-2" />
                                                <p className="text-slate-500">
                                                    {selectedVideoInput ? 'Caricamento preview...' : 'Seleziona una webcam'}
                                                </p>
                                            </div>
                                        )}
                                        
                                        {previewStream && previewStream.getVideoTracks().length > 0 && (
                                            <div className={`absolute top-3 left-3 px-2 py-1 rounded text-xs text-white font-medium ${videoWarning ? 'bg-amber-500/80' : 'bg-emerald-500/80'}`}>
                                                {videoWarning ? '⚠️ Problema rilevato' : 'Preview attiva'}
                                            </div>
                                        )}
                                        
                                        {videoWarning && (
                                            <div className="absolute bottom-3 left-3 right-3 p-3 bg-amber-500/90 rounded-lg text-xs text-white text-center">
                                                {videoWarning}
                                            </div>
                                        )}
                                    </div>

                                    {/* Lista webcam */}
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {videoInputs.map((device) => (
                                            <button
                                                key={device.deviceId}
                                                onClick={() => setSelectedVideoInput(device.deviceId)}
                                                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                                                    selectedVideoInput === device.deviceId
                                                        ? 'bg-indigo-500/10 border-indigo-500/50'
                                                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                                                }`}
                                            >
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                    selectedVideoInput === device.deviceId
                                                        ? 'bg-indigo-500 text-white'
                                                        : 'bg-slate-700 text-slate-400'
                                                }`}>
                                                    {device.deviceId === 'default' 
                                                        ? <Monitor className="w-5 h-5" />
                                                        : <Video className="w-5 h-5" />
                                                    }
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-medium truncate ${
                                                        selectedVideoInput === device.deviceId ? 'text-white' : 'text-slate-300'
                                                    }`}>
                                                        {device.label}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {device.deviceId === 'default' ? 'Usa la webcam predefinita di sistema' : 'Camera USB'}
                                                    </p>
                                                </div>
                                                {selectedVideoInput === device.deviceId && (
                                                    <Check className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                                                )}
                                            </button>
                                        ))}
                                        
                                        {videoInputs.length === 0 && (
                                            <p className="text-slate-500 text-center py-8">
                                                Nessuna webcam trovata
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-6 border-t border-slate-800 bg-slate-950/30">
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                            <div className="flex items-center gap-2">
                                {selectedAudioInput ? (
                                    <Mic className="w-4 h-4 text-emerald-400" />
                                ) : (
                                    <MicOff className="w-4 h-4 text-slate-600" />
                                )}
                                <span>Mic OK</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedVideoInput ? (
                                    <Video className="w-4 h-4 text-emerald-400" />
                                ) : (
                                    <VideoOff className="w-4 h-4 text-slate-600" />
                                )}
                                <span>Cam OK</span>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {!isInitialSetup && (
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2.5 text-slate-400 hover:text-white transition-colors"
                                >
                                    Annulla
                                </button>
                            )}
                            <button
                                onClick={applySettings}
                                className="px-8 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25"
                            >
                                {isInitialSetup ? 'Entra nell\'Office' : 'Applica'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
