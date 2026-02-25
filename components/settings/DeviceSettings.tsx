'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
    Mic, 
    MicOff, 
    Video, 
    VideoOff, 
    Volume2, 
    VolumeX,
    MonitorSpeaker,
    Check,
    Settings,
    X,
    RefreshCw,
    Headphones
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

export function DeviceSettings({ isOpen, onClose, isInitialSetup = false }: DeviceSettingsProps) {
    const {
        selectedAudioInput,
        selectedAudioOutput,
        selectedVideoInput,
        availableDevices,
        setSelectedAudioInput,
        setSelectedAudioOutput,
        setSelectedVideoInput,
        refreshDevices,
        setLocalStream,
        setHasCompletedDeviceSetup,
    } = useOfficeStore();

    const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
    const [testAudioLevel, setTestAudioLevel] = useState<AudioLevel>({ value: 0, peak: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'input' | 'output' | 'video'>('input');
    const [error, setError] = useState<string | null>(null);
    const [hasAutoSelectedDefaults, setHasAutoSelectedDefaults] = useState(false);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const testAudioElementRef = useRef<HTMLAudioElement | null>(null);

    // Filtra i dispositivi per tipo
    const audioInputs = availableDevices.filter(d => d.kind === 'audioinput');
    const audioOutputs = availableDevices.filter(d => d.kind === 'audiooutput');
    const videoInputs = availableDevices.filter(d => d.kind === 'videoinput');

    // Inizializza e aggiorna i dispositivi disponibili + auto-seleziona default
    useEffect(() => {
        if (isOpen) {
            const loadDevices = async () => {
                await refreshDevices();
            };
            loadDevices();
        }
    }, [isOpen, refreshDevices]);

    // Auto-seleziona i dispositivi di default quando vengono caricati
    useEffect(() => {
        if (!hasAutoSelectedDefaults && availableDevices.length > 0) {
            // Seleziona il primo dispositivo di ogni tipo (di solito il default del sistema)
            if (!selectedAudioInput && audioInputs.length > 0) {
                // Cerca il dispositivo default (solitamente label contiene "default" o è il primo)
                const defaultDevice = audioInputs.find(d => 
                    d.label.toLowerCase().includes('default') || 
                    d.deviceId === 'default'
                ) || audioInputs[0];
                setSelectedAudioInput(defaultDevice.deviceId);
            }
            
            if (!selectedAudioOutput && audioOutputs.length > 0) {
                const defaultDevice = audioOutputs.find(d => 
                    d.label.toLowerCase().includes('default') || 
                    d.deviceId === 'default'
                ) || audioOutputs[0];
                setSelectedAudioOutput(defaultDevice.deviceId);
            }
            
            if (!selectedVideoInput && videoInputs.length > 0) {
                const defaultDevice = videoInputs.find(d => 
                    d.label.toLowerCase().includes('default') || 
                    d.deviceId === 'default'
                ) || videoInputs[0];
                setSelectedVideoInput(defaultDevice.deviceId);
            }
            
            setHasAutoSelectedDefaults(true);
        }
    }, [availableDevices, hasAutoSelectedDefaults, selectedAudioInput, selectedAudioOutput, selectedVideoInput, 
        setSelectedAudioInput, setSelectedAudioOutput, setSelectedVideoInput, audioInputs, audioOutputs, videoInputs]);

    // Resetta il flag quando chiudi il modal
    useEffect(() => {
        if (!isOpen) {
            setHasAutoSelectedDefaults(false);
        }
    }, [isOpen]);

    // Ascolta i cambiamenti dei dispositivi (quando si collega/scollega)
    useEffect(() => {
        const handleDeviceChange = () => {
            refreshDevices();
        };
        
        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        };
    }, [refreshDevices]);

    // Crea lo stream di preview quando cambiano i dispositivi selezionati
    useEffect(() => {
        if (!isOpen) return;
        
        const initPreview = async () => {
            setIsLoading(true);
            setError(null);
            
            try {
                // Ferma lo stream precedente
                if (previewStream) {
                    previewStream.getTracks().forEach(t => t.stop());
                }

                // Attendi che i dispositivi siano selezionati
                if (!selectedAudioInput && !selectedVideoInput) {
                    setIsLoading(false);
                    return;
                }

                const constraints: MediaStreamConstraints = {};
                
                if (selectedAudioInput) {
                    constraints.audio = { deviceId: { exact: selectedAudioInput } };
                }
                
                if (selectedVideoInput) {
                    constraints.video = { deviceId: { exact: selectedVideoInput } };
                }

                // Se nessun constraint è stato impostato, non fare nulla
                if (!constraints.audio && !constraints.video) {
                    setIsLoading(false);
                    return;
                }

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                setPreviewStream(stream);
                
                // Inizia il monitoring dell'audio se c'è un audio track
                if (stream.getAudioTracks().length > 0) {
                    startAudioMonitoring(stream);
                }
                
            } catch (err: any) {
                console.error('Failed to get preview stream:', err);
                setError(err.message || 'Impossibile accedere ai dispositivi');
            } finally {
                setIsLoading(false);
            }
        };

        initPreview();

        return () => {
            stopAudioMonitoring();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, selectedAudioInput, selectedVideoInput]);

    // Assegna lo stream al video element quando cambia
    useEffect(() => {
        if (videoRef.current && previewStream) {
            videoRef.current.srcObject = previewStream;
            // Forza il play
            videoRef.current.play().catch(err => {
                console.warn('Autoplay prevented:', err);
            });
        }
    }, [previewStream]);

    // Aggiorna lo stream locale quando si confermano le impostazioni
    const applySettings = useCallback(() => {
        if (previewStream) {
            // Ferma lo stream locale precedente
            const currentStream = useOfficeStore.getState().localStream;
            if (currentStream) {
                currentStream.getTracks().forEach(t => t.stop());
            }
            
            // Crea un nuovo stream dai track del preview
            const newStream = new MediaStream(previewStream.getTracks().map(t => t.clone()));
            setLocalStream(newStream);
        }
        
        setHasCompletedDeviceSetup(true);
        onClose();
    }, [previewStream, setLocalStream, setHasCompletedDeviceSetup, onClose]);

    // Monitoraggio livello audio
    const startAudioMonitoring = (stream: MediaStream) => {
        stopAudioMonitoring();
        
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256;
            
            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
            
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            let peakDecay = 0;
            
            const checkLevel = () => {
                if (!analyser) return;
                
                analyser.getByteFrequencyData(dataArray);
                
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                const normalized = Math.min(100, (average / 128) * 100);
                
                // Decay del peak
                peakDecay = Math.max(peakDecay - 2, 0);
                const peak = Math.max(normalized, peakDecay);
                peakDecay = peak;
                
                setTestAudioLevel({ value: normalized, peak });
                
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

    // Test audio output - usando elemento audio HTML per supportare setSinkId
    const testAudioOutput = async () => {
        try {
            // Crea un elemento audio se non esiste
            if (!testAudioElementRef.current) {
                testAudioElementRef.current = new Audio();
            }
            
            const audio = testAudioElementRef.current;
            
            // Crea un beep usando Web Audio API e convertilo in blob per l'elemento audio
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const sampleRate = audioContext.sampleRate;
            const duration = 0.5;
            const numberOfSamples = duration * sampleRate;
            
            // Crea un buffer per il suono
            const buffer = audioContext.createBuffer(1, numberOfSamples, sampleRate);
            const data = buffer.getChannelData(0);
            
            // Genera un tono sinusoidale a 440Hz con fade out
            for (let i = 0; i < numberOfSamples; i++) {
                const t = i / sampleRate;
                const envelope = Math.exp(-3 * t); // fade out esponenziale
                data[i] = Math.sin(2 * Math.PI * 440 * t) * 0.3 * envelope;
            }
            
            // Converti il buffer in WAV blob
            const wavBlob = bufferToWave(buffer, numberOfSamples);
            const url = URL.createObjectURL(wavBlob);
            
            audio.src = url;
            audio.loop = false;
            
            // Imposta il dispositivo di uscita se supportato (Chrome/Edge)
            if (selectedAudioOutput) {
                // @ts-ignore - setSinkId è supportato in Chrome/Edge
                if (audio.setSinkId) {
                    try {
                        // @ts-ignore
                        await audio.setSinkId(selectedAudioOutput);
                        console.log('Audio output set to:', selectedAudioOutput);
                    } catch (err) {
                        console.warn('setSinkId failed:', err);
                    }
                } else {
                    console.warn('setSinkId not supported in this browser');
                }
            }
            
            // Riproduci il suono
            await audio.play();
            
            // Cleanup dopo la riproduzione
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);
            
        } catch (err) {
            console.error('Audio test failed:', err);
            // Fallback: emetti un beep usando l'audio di sistema
            try {
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
            } catch (fallbackErr) {
                console.error('Fallback audio test also failed:', fallbackErr);
            }
        }
    };

    // Funzione per convertire AudioBuffer in WAV blob
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

        // scrivi l'header WAV
        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // file length - 8
        setUint32(0x45564157); // "WAVE"
        setUint32(0x20746d66); // "fmt " chunk
        setUint32(16); // length = 16
        setUint16(1); // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(abuffer.sampleRate);
        setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2); // block-align
        setUint16(16); // 16-bit (hardcoded in this example)
        setUint32(0x61746164); // "data" - chunk
        setUint32(length - pos - 4); // chunk length

        // scrivi i dati
        for(i = 0; i < abuffer.numberOfChannels; i++)
            channels.push(abuffer.getChannelData(i));

        while(pos < length) {
            for(i = 0; i < numOfChan; i++) {
                sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
                view.setInt16(pos, sample, true); // write 16-bit sample
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

    // Cleanup
    useEffect(() => {
        return () => {
            stopAudioMonitoring();
            if (previewStream) {
                previewStream.getTracks().forEach(t => t.stop());
            }
            if (testAudioElementRef.current) {
                testAudioElementRef.current.pause();
                testAudioElementRef.current = null;
            }
        };
    }, [previewStream]);

    if (!isOpen) return null;

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
                    className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                                <Settings className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">
                                    {isInitialSetup ? 'Benvenuto! Configura i tuoi dispositivi' : 'Cabina di Regia'}
                                </h2>
                                <p className="text-sm text-slate-400">
                                    {isInitialSetup 
                                        ? 'I dispositivi di sistema sono già selezionati. Puoi modificarli se vuoi.' 
                                        : 'Gestisci i tuoi dispositivi audio e video'}
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

                    <div className="flex h-[60vh]">
                        {/* Sidebar Tabs */}
                        <div className="w-64 bg-slate-950/50 border-r border-slate-800 p-4 space-y-2">
                            <button
                                onClick={() => setActiveTab('input')}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                                    activeTab === 'input' 
                                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                                        : 'text-slate-400 hover:bg-slate-800/50'
                                }`}
                            >
                                <Mic className="w-5 h-5" />
                                <span className="font-medium">Microfono</span>
                                {selectedAudioInput && <Check className="w-4 h-4 ml-auto text-emerald-400" />}
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
                                <span className="font-medium">Audio Uscita</span>
                                {selectedAudioOutput && <Check className="w-4 h-4 ml-auto text-emerald-400" />}
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
                                <span className="font-medium">Webcam</span>
                                {selectedVideoInput && <Check className="w-4 h-4 ml-auto text-emerald-400" />}
                            </button>

                            <div className="pt-4 mt-4 border-t border-slate-800">
                                <button
                                    onClick={() => refreshDevices()}
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
                                    ⚠️ {error}
                                </div>
                            )}

                            {/* MICROFONO */}
                            {activeTab === 'input' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Seleziona Microfono</h3>
                                        <p className="text-slate-400 text-sm mb-4">
                                            Dispositivo selezionato: <span className="text-indigo-300">
                                                {audioInputs.find(d => d.deviceId === selectedAudioInput)?.label || 'Default'}
                                            </span>
                                        </p>
                                    </div>

                                    {/* Lista dispositivi */}
                                    <div className="space-y-2">
                                        {audioInputs.map((device) => (
                                            <button
                                                key={device.deviceId}
                                                onClick={() => setSelectedAudioInput(device.deviceId)}
                                                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                                                    selectedAudioInput === device.deviceId
                                                        ? 'bg-indigo-500/10 border-indigo-500/50'
                                                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                                                }`}
                                            >
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                    selectedAudioInput === device.deviceId
                                                        ? 'bg-indigo-500 text-white'
                                                        : 'bg-slate-700 text-slate-400'
                                                }`}>
                                                    <Mic className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <p className={`font-medium ${
                                                        selectedAudioInput === device.deviceId ? 'text-white' : 'text-slate-300'
                                                    }`}>
                                                        {device.label || `Microfono ${audioInputs.indexOf(device) + 1}`}
                                                    </p>
                                                    {selectedAudioInput === device.deviceId && (
                                                        <p className="text-xs text-indigo-400">Selezionato</p>
                                                    )}
                                                </div>
                                                {selectedAudioInput === device.deviceId && (
                                                    <Check className="w-5 h-5 text-indigo-400" />
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
                                    {selectedAudioInput && (
                                        <div className="mt-6 p-4 bg-slate-800/50 rounded-xl">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-slate-400">Livello Audio</span>
                                                <span className="text-xs text-slate-500">
                                                    {testAudioLevel.value > 0 ? 'Rilevato audio!' : 'Parla per testare'}
                                                </span>
                                            </div>
                                            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-75"
                                                    style={{ width: `${testAudioLevel.value}%` }}
                                                />
                                            </div>
                                            {/* Peak indicator */}
                                            <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden relative">
                                                <div 
                                                    className="absolute h-full w-1 bg-amber-400 transition-all"
                                                    style={{ left: `${testAudioLevel.peak}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* AUDIO USCITA */}
                            {activeTab === 'output' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Seleziona Dispositivo Uscita</h3>
                                        <p className="text-slate-400 text-sm mb-4">
                                            Dispositivo selezionato: <span className="text-indigo-300">
                                                {audioOutputs.find(d => d.deviceId === selectedAudioOutput)?.label || 'Default di sistema'}
                                            </span>
                                        </p>
                                        <p className="text-xs text-amber-400 mb-4">
                                            Nota: Il test audio usa il dispositivo di default se il browser non supporta la selezione.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        {audioOutputs.map((device) => (
                                            <button
                                                key={device.deviceId}
                                                onClick={() => setSelectedAudioOutput(device.deviceId)}
                                                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                                                    selectedAudioOutput === device.deviceId
                                                        ? 'bg-indigo-500/10 border-indigo-500/50'
                                                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                                                }`}
                                            >
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                    selectedAudioOutput === device.deviceId
                                                        ? 'bg-indigo-500 text-white'
                                                        : 'bg-slate-700 text-slate-400'
                                                }`}>
                                                    {device.label.toLowerCase().includes('cuffia') || 
                                                     device.label.toLowerCase().includes('headphone')
                                                        ? <Headphones className="w-5 h-5" />
                                                        : <MonitorSpeaker className="w-5 h-5" />
                                                    }
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <p className={`font-medium ${
                                                        selectedAudioOutput === device.deviceId ? 'text-white' : 'text-slate-300'
                                                    }`}>
                                                        {device.label || `Dispositivo ${audioOutputs.indexOf(device) + 1}`}
                                                    </p>
                                                    {selectedAudioOutput === device.deviceId && (
                                                        <p className="text-xs text-indigo-400">Selezionato</p>
                                                    )}
                                                </div>
                                                {selectedAudioOutput === device.deviceId && (
                                                    <Check className="w-5 h-5 text-indigo-400" />
                                                )}
                                            </button>
                                        ))}
                                        
                                        {audioOutputs.length === 0 && (
                                            <p className="text-slate-500 text-center py-8">
                                                Usa il dispositivo di default del sistema
                                            </p>
                                        )}
                                    </div>

                                    {/* Test Audio */}
                                    <button
                                        onClick={testAudioOutput}
                                        className="w-full mt-4 p-4 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl text-indigo-300 font-medium transition-all flex items-center justify-center gap-2"
                                    >
                                        <Volume2 className="w-5 h-5" />
                                        Test Audio (Suono di prova)
                                    </button>
                                </div>
                            )}

                            {/* WEBCAM */}
                            {activeTab === 'video' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Seleziona Webcam</h3>
                                        <p className="text-slate-400 text-sm mb-4">
                                            Dispositivo selezionato: <span className="text-indigo-300">
                                                {videoInputs.find(d => d.deviceId === selectedVideoInput)?.label || 'Default'}
                                            </span>
                                        </p>
                                    </div>

                                    {/* Preview Video */}
                                    <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-700">
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
                                                <p className="text-slate-500 text-sm">
                                                    {selectedVideoInput ? 'Caricamento...' : 'Nessuna webcam selezionata'}
                                                </p>
                                            </div>
                                        )}
                                        
                                        {/* Overlay info */}
                                        {previewStream && previewStream.getVideoTracks().length > 0 && (
                                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                                <p className="text-white text-sm font-medium">Anteprima attiva</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Lista webcam */}
                                    <div className="space-y-2">
                                        {videoInputs.map((device) => (
                                            <button
                                                key={device.deviceId}
                                                onClick={() => setSelectedVideoInput(device.deviceId)}
                                                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                                                    selectedVideoInput === device.deviceId
                                                        ? 'bg-indigo-500/10 border-indigo-500/50'
                                                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                                                }`}
                                            >
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                    selectedVideoInput === device.deviceId
                                                        ? 'bg-indigo-500 text-white'
                                                        : 'bg-slate-700 text-slate-400'
                                                }`}>
                                                    <Video className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <p className={`font-medium ${
                                                        selectedVideoInput === device.deviceId ? 'text-white' : 'text-slate-300'
                                                    }`}>
                                                        {device.label || `Camera ${videoInputs.indexOf(device) + 1}`}
                                                    </p>
                                                    {selectedVideoInput === device.deviceId && (
                                                        <p className="text-xs text-indigo-400">Selezionata</p>
                                                    )}
                                                </div>
                                                {selectedVideoInput === device.deviceId && (
                                                    <Check className="w-5 h-5 text-indigo-400" />
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
                                <span>Mic</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedVideoInput ? (
                                    <Video className="w-4 h-4 text-emerald-400" />
                                ) : (
                                    <VideoOff className="w-4 h-4 text-slate-600" />
                                )}
                                <span>Cam</span>
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
