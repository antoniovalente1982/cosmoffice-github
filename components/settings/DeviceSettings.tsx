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
        isMicEnabled,
        isVideoEnabled,
        setSelectedAudioInput,
        setSelectedAudioOutput,
        setSelectedVideoInput,
        refreshDevices,
        setLocalStream,
        setHasCompletedDeviceSetup,
        toggleMic,
        toggleVideo
    } = useOfficeStore();

    const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
    const [testAudioLevel, setTestAudioLevel] = useState<AudioLevel>({ value: 0, peak: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'input' | 'output' | 'video'>('input');
    const [error, setError] = useState<string | null>(null);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Filtra i dispositivi per tipo
    const audioInputs = availableDevices.filter(d => d.kind === 'audioinput');
    const audioOutputs = availableDevices.filter(d => d.kind === 'audiooutput');
    const videoInputs = availableDevices.filter(d => d.kind === 'videoinput');

    // Inizializza e aggiorna i dispositivi disponibili
    useEffect(() => {
        if (isOpen) {
            refreshDevices();
        }
    }, [isOpen, refreshDevices]);

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

                const constraints: MediaStreamConstraints = {
                    audio: selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true,
                    video: selectedVideoInput ? { deviceId: { exact: selectedVideoInput } } : true
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                setPreviewStream(stream);
                
                // Se c'è un video track, mostralo
                if (stream.getVideoTracks().length > 0 && videoRef.current) {
                    videoRef.current.srcObject = stream;
                }

                // Inizia il monitoring dell'audio
                startAudioMonitoring(stream);
                
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
    }, [isOpen, selectedAudioInput, selectedVideoInput]);

    // Aggiorna lo stream locale quando si confermano le impostazioni
    const applySettings = useCallback(() => {
        if (previewStream) {
            // Ferma lo stream locale precedente
            const currentStream = useOfficeStore.getState().localStream;
            if (currentStream) {
                currentStream.getTracks().forEach(t => t.stop());
            }
            
            // Crea un nuovo stream dai track del preview
            const newStream = new MediaStream(previewStream.getTracks());
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
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
        setTestAudioLevel({ value: 0, peak: 0 });
    };

    // Test audio output
    const testAudioOutput = async () => {
        try {
            const audio = new Audio('/test-sound.mp3'); // Puoi usare un beep generato
            if (selectedAudioOutput) {
                // @ts-ignore - setSinkId è supportato in Chrome/Edge
                if (audio.setSinkId) {
                    // @ts-ignore
                    await audio.setSinkId(selectedAudioOutput);
                }
            }
            
            // Genera un beep invece di usare un file
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
            
        } catch (err) {
            console.error('Audio test failed:', err);
        }
    };

    // Cleanup
    useEffect(() => {
        return () => {
            stopAudioMonitoring();
            if (previewStream) {
                previewStream.getTracks().forEach(t => t.stop());
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
                                        ? 'Seleziona e testa i dispositivi che vuoi usare' 
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
                                        <p className="text-slate-400 text-sm mb-4">Scegli il dispositivo di input audio</p>
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
                                        <p className="text-slate-400 text-sm mb-4">Scegli dove vuoi ascoltare l&apos;audio</p>
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
                                        <p className="text-slate-400 text-sm mb-4">Scegli la camera che vuoi usare</p>
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
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <VideoOff className="w-12 h-12 text-slate-600" />
                                            </div>
                                        )}
                                        
                                        {/* Overlay info */}
                                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                            <p className="text-white text-sm font-medium">Anteprima</p>
                                        </div>
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
