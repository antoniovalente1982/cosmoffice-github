import { describe, it, expect, beforeEach } from 'vitest';
import { useAvatarStore } from '../stores/avatarStore';

beforeEach(() => {
    useAvatarStore.setState({
        myPosition: { x: 0, y: 0 },
        myStatus: 'online',
        myRoomId: undefined,
        myProfile: null,
        myRole: null,
        myDnd: false,
        myAway: false,
        myAdminMutedAudio: false,
        myAdminMutedVideo: false,
        myProximityGroupId: null,
        knockingAtRoom: null,
        peers: {},
        isDragging: false,
    });
});

describe('avatarStore', () => {
    describe('my position', () => {
        it('should set position', () => {
            useAvatarStore.getState().setMyPosition({ x: 100, y: 200 });
            expect(useAvatarStore.getState().myPosition).toEqual({ x: 100, y: 200 });
        });
    });

    describe('my status', () => {
        it('should set status', () => {
            useAvatarStore.getState().setMyStatus('busy');
            expect(useAvatarStore.getState().myStatus).toBe('busy');
        });

        it('should accept all status values', () => {
            const statuses: Array<'online' | 'away' | 'busy' | 'offline'> = ['online', 'away', 'busy', 'offline'];
            for (const s of statuses) {
                useAvatarStore.getState().setMyStatus(s);
                expect(useAvatarStore.getState().myStatus).toBe(s);
            }
        });
    });

    describe('my room', () => {
        it('should set room id', () => {
            useAvatarStore.getState().setMyRoom('room-123');
            expect(useAvatarStore.getState().myRoomId).toBe('room-123');
        });

        it('should clear room with undefined', () => {
            useAvatarStore.getState().setMyRoom('room-123');
            useAvatarStore.getState().setMyRoom(undefined);
            expect(useAvatarStore.getState().myRoomId).toBeUndefined();
        });
    });

    describe('my role', () => {
        it('should set role', () => {
            useAvatarStore.getState().setMyRole('admin');
            expect(useAvatarStore.getState().myRole).toBe('admin');
        });
    });

    describe('DnD and Away', () => {
        it('should toggle DnD', () => {
            useAvatarStore.getState().setMyDnd(true);
            expect(useAvatarStore.getState().myDnd).toBe(true);
            useAvatarStore.getState().setMyDnd(false);
            expect(useAvatarStore.getState().myDnd).toBe(false);
        });

        it('should toggle Away', () => {
            useAvatarStore.getState().setMyAway(true);
            expect(useAvatarStore.getState().myAway).toBe(true);
        });
    });

    describe('admin mute flags', () => {
        it('should set admin muted audio', () => {
            useAvatarStore.getState().setMyAdminMutedAudio(true);
            expect(useAvatarStore.getState().myAdminMutedAudio).toBe(true);
        });

        it('should set admin muted video', () => {
            useAvatarStore.getState().setMyAdminMutedVideo(true);
            expect(useAvatarStore.getState().myAdminMutedVideo).toBe(true);
        });
    });

    describe('proximity', () => {
        it('should set proximity group id', () => {
            useAvatarStore.getState().setMyProximityGroup('group-abc');
            expect(useAvatarStore.getState().myProximityGroupId).toBe('group-abc');
        });

        it('should clear proximity group', () => {
            useAvatarStore.getState().setMyProximityGroup('group-abc');
            useAvatarStore.getState().setMyProximityGroup(null);
            expect(useAvatarStore.getState().myProximityGroupId).toBeNull();
        });
    });

    describe('knocking', () => {
        it('should set knocking at room', () => {
            useAvatarStore.getState().setKnockingAtRoom('room-456');
            expect(useAvatarStore.getState().knockingAtRoom).toBe('room-456');
        });
    });

    describe('peers', () => {
        it('should add a new peer', () => {
            useAvatarStore.getState().updatePeer('peer-1', {
                id: 'peer-1',
                full_name: 'Alice',
                position: { x: 50, y: 50 },
            });
            const peer = useAvatarStore.getState().peers['peer-1'];
            expect(peer).toBeDefined();
            expect(peer.full_name).toBe('Alice');
            expect(peer.position).toEqual({ x: 50, y: 50 });
        });

        it('should update existing peer without losing other fields', () => {
            useAvatarStore.getState().updatePeer('peer-1', {
                id: 'peer-1',
                full_name: 'Alice',
                position: { x: 50, y: 50 },
                audioEnabled: true,
            });
            useAvatarStore.getState().updatePeer('peer-1', {
                id: 'peer-1',
                position: { x: 100, y: 100 },
            });
            const peer = useAvatarStore.getState().peers['peer-1'];
            expect(peer.full_name).toBe('Alice');
            expect(peer.audioEnabled).toBe(true);
            expect(peer.position).toEqual({ x: 100, y: 100 });
        });

        it('should remove a peer', () => {
            useAvatarStore.getState().updatePeer('peer-1', {
                id: 'peer-1',
                full_name: 'Alice',
            });
            useAvatarStore.getState().updatePeer('peer-2', {
                id: 'peer-2',
                full_name: 'Bob',
            });
            useAvatarStore.getState().removePeer('peer-1');
            expect(useAvatarStore.getState().peers['peer-1']).toBeUndefined();
            expect(useAvatarStore.getState().peers['peer-2']).toBeDefined();
        });

        it('should clear all peers', () => {
            useAvatarStore.getState().updatePeer('peer-1', { id: 'peer-1' });
            useAvatarStore.getState().updatePeer('peer-2', { id: 'peer-2' });
            useAvatarStore.getState().clearPeers();
            expect(Object.keys(useAvatarStore.getState().peers)).toHaveLength(0);
        });
    });

    describe('dragging', () => {
        it('should set dragging state', () => {
            useAvatarStore.getState().setDragging(true);
            expect(useAvatarStore.getState().isDragging).toBe(true);
            useAvatarStore.getState().setDragging(false);
            expect(useAvatarStore.getState().isDragging).toBe(false);
        });
    });
});
