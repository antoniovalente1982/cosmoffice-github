import { describe, it, expect, beforeEach } from 'vitest';
import { useMediaStore } from '../stores/mediaStore';

// Reset store between tests
beforeEach(() => {
    useMediaStore.setState({
        isVideoOn: false,
        isAudioOn: false,
        isSpeaking: false,
        localStream: null,
        isRemoteAudioEnabled: true,
        isScreenSharing: false,
        screenStreams: [],
        isGridViewOpen: false,
        selectedAudioInput: null,
        selectedAudioOutput: null,
        selectedVideoInput: null,
        availableDevices: [],
        hasCompletedDeviceSetup: false,
        activeContext: 'none',
        activeContextId: null,
        adminMutedAudio: false,
        adminMutedVideo: false,
        proximityBlockedGlobal: false,
        isConnected: false,
        mediaError: null,
        participants: {},
    });
});

describe('mediaStore', () => {
    describe('audio/video toggles', () => {
        it('should toggle audio on/off', () => {
            expect(useMediaStore.getState().isAudioOn).toBe(false);
            useMediaStore.getState().toggleAudio();
            expect(useMediaStore.getState().isAudioOn).toBe(true);
            useMediaStore.getState().toggleAudio();
            expect(useMediaStore.getState().isAudioOn).toBe(false);
        });

        it('should toggle video on/off', () => {
            expect(useMediaStore.getState().isVideoOn).toBe(false);
            useMediaStore.getState().toggleVideo();
            expect(useMediaStore.getState().isVideoOn).toBe(true);
            useMediaStore.getState().toggleVideo();
            expect(useMediaStore.getState().isVideoOn).toBe(false);
        });

        it('should toggle remote audio', () => {
            expect(useMediaStore.getState().isRemoteAudioEnabled).toBe(true);
            useMediaStore.getState().toggleRemoteAudio();
            expect(useMediaStore.getState().isRemoteAudioEnabled).toBe(false);
        });

        it('should toggle grid view', () => {
            expect(useMediaStore.getState().isGridViewOpen).toBe(false);
            useMediaStore.getState().toggleGridView();
            expect(useMediaStore.getState().isGridViewOpen).toBe(true);
        });
    });

    describe('speaking state', () => {
        it('should set speaking state', () => {
            useMediaStore.getState().setSpeaking(true);
            expect(useMediaStore.getState().isSpeaking).toBe(true);
            useMediaStore.getState().setSpeaking(false);
            expect(useMediaStore.getState().isSpeaking).toBe(false);
        });
    });

    describe('device selection', () => {
        it('should set selected audio input', () => {
            useMediaStore.getState().setSelectedAudioInput('device-123');
            expect(useMediaStore.getState().selectedAudioInput).toBe('device-123');
        });

        it('should set selected audio output', () => {
            useMediaStore.getState().setSelectedAudioOutput('output-456');
            expect(useMediaStore.getState().selectedAudioOutput).toBe('output-456');
        });

        it('should set selected video input', () => {
            useMediaStore.getState().setSelectedVideoInput('cam-789');
            expect(useMediaStore.getState().selectedVideoInput).toBe('cam-789');
        });

        it('should track device setup completion', () => {
            expect(useMediaStore.getState().hasCompletedDeviceSetup).toBe(false);
            useMediaStore.getState().setHasCompletedDeviceSetup(true);
            expect(useMediaStore.getState().hasCompletedDeviceSetup).toBe(true);
        });

        it('should clear device selection with null', () => {
            useMediaStore.getState().setSelectedAudioInput('device-123');
            useMediaStore.getState().setSelectedAudioInput(null);
            expect(useMediaStore.getState().selectedAudioInput).toBeNull();
        });
    });

    describe('participants', () => {
        it('should add a participant', () => {
            useMediaStore.getState().setParticipant('user-1', {
                sessionId: 'session-1',
                userName: 'Alice',
                audioEnabled: true,
                videoEnabled: false,
            });
            const p = useMediaStore.getState().participants['user-1'];
            expect(p).toBeDefined();
            expect(p.userName).toBe('Alice');
            expect(p.audioEnabled).toBe(true);
            expect(p.videoEnabled).toBe(false);
        });

        it('should update a participant without replacing other fields', () => {
            useMediaStore.getState().setParticipant('user-1', {
                sessionId: 'session-1',
                userName: 'Alice',
                audioEnabled: true,
                videoEnabled: false,
            });
            useMediaStore.getState().setParticipant('user-1', {
                videoEnabled: true,
            });
            const p = useMediaStore.getState().participants['user-1'];
            expect(p.userName).toBe('Alice');
            expect(p.videoEnabled).toBe(true);
        });

        it('should skip update if nothing changed', () => {
            useMediaStore.getState().setParticipant('user-1', {
                sessionId: 'session-1',
                userName: 'Alice',
                audioEnabled: true,
                videoEnabled: false,
            });
            const before = useMediaStore.getState().participants;
            useMediaStore.getState().setParticipant('user-1', {
                audioEnabled: true,
            });
            // Should be same reference due to no-op optimization
            expect(useMediaStore.getState().participants).toBe(before);
        });

        it('should remove a participant', () => {
            useMediaStore.getState().setParticipant('user-1', {
                sessionId: 's1', userName: 'Alice', audioEnabled: false, videoEnabled: false,
            });
            useMediaStore.getState().setParticipant('user-2', {
                sessionId: 's2', userName: 'Bob', audioEnabled: false, videoEnabled: false,
            });
            useMediaStore.getState().removeParticipant('user-1');
            expect(useMediaStore.getState().participants['user-1']).toBeUndefined();
            expect(useMediaStore.getState().participants['user-2']).toBeDefined();
        });

        it('should clear all participants', () => {
            useMediaStore.getState().setParticipant('user-1', {
                sessionId: 's1', userName: 'Alice', audioEnabled: false, videoEnabled: false,
            });
            useMediaStore.getState().clearParticipants();
            expect(Object.keys(useMediaStore.getState().participants)).toHaveLength(0);
        });
    });

    describe('active context', () => {
        it('should set room context', () => {
            useMediaStore.getState().setActiveContext('room', 'room-123');
            expect(useMediaStore.getState().activeContext).toBe('room');
            expect(useMediaStore.getState().activeContextId).toBe('room-123');
        });

        it('should set proximity context', () => {
            useMediaStore.getState().setActiveContext('proximity', 'group-456');
            expect(useMediaStore.getState().activeContext).toBe('proximity');
            expect(useMediaStore.getState().activeContextId).toBe('group-456');
        });

        it('should clear context', () => {
            useMediaStore.getState().setActiveContext('room', 'room-123');
            useMediaStore.getState().setActiveContext('none', null);
            expect(useMediaStore.getState().activeContext).toBe('none');
            expect(useMediaStore.getState().activeContextId).toBeNull();
        });
    });

    describe('admin controls', () => {
        it('should set admin muted audio', () => {
            useMediaStore.getState().setAdminMutedAudio(true);
            expect(useMediaStore.getState().adminMutedAudio).toBe(true);
        });

        it('should set admin muted video', () => {
            useMediaStore.getState().setAdminMutedVideo(true);
            expect(useMediaStore.getState().adminMutedVideo).toBe(true);
        });

        it('should set proximity blocked globally', () => {
            useMediaStore.getState().setProximityBlockedGlobal(true);
            expect(useMediaStore.getState().proximityBlockedGlobal).toBe(true);
        });
    });

    describe('connection state', () => {
        it('should track connection', () => {
            useMediaStore.getState().setConnected(true);
            expect(useMediaStore.getState().isConnected).toBe(true);
        });

        it('should set and clear media error', () => {
            useMediaStore.getState().setMediaError('Connection failed');
            expect(useMediaStore.getState().mediaError).toBe('Connection failed');
            useMediaStore.getState().clearMediaError();
            expect(useMediaStore.getState().mediaError).toBeNull();
        });
    });

    describe('screen sharing', () => {
        it('should toggle screen sharing flag', () => {
            useMediaStore.getState().setScreenSharing(true);
            expect(useMediaStore.getState().isScreenSharing).toBe(true);
        });
    });
});
