import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCommsStore } from '../stores/commsStore';

beforeEach(() => {
    useCommsStore.getState().clearAll();
});

describe('commsStore', () => {
    describe('socket management', () => {
        it('should set and clear partykitSocket', () => {
            const mockSocket = { readyState: 1 } as any;
            useCommsStore.getState().setPartykitSocket(mockSocket);
            expect(useCommsStore.getState().partykitSocket).toBe(mockSocket);
            useCommsStore.getState().setPartykitSocket(null);
            expect(useCommsStore.getState().partykitSocket).toBeNull();
        });
    });

    describe('messaging function setters', () => {
        it('should set and retrieve sendChatMessage', () => {
            const fn = vi.fn();
            useCommsStore.getState().setSendChatMessage(fn);
            expect(useCommsStore.getState().sendChatMessage).toBe(fn);
        });

        it('should set and retrieve sendOfficeChatMessage', () => {
            const fn = vi.fn();
            useCommsStore.getState().setSendOfficeChatMessage(fn);
            expect(useCommsStore.getState().sendOfficeChatMessage).toBe(fn);
        });

        it('should set and retrieve sendKnock', () => {
            const fn = vi.fn();
            useCommsStore.getState().setSendKnock(fn);
            expect(useCommsStore.getState().sendKnock).toBe(fn);
        });

        it('should set and retrieve sendAdminCommand', () => {
            const fn = vi.fn();
            useCommsStore.getState().setSendAdminCommand(fn);
            expect(useCommsStore.getState().sendAdminCommand).toBe(fn);
        });

        it('should set all messaging functions and clear them', () => {
            const fns = {
                sendChatMessage: vi.fn(),
                sendDeleteMessage: vi.fn(),
                sendClearChat: vi.fn(),
                sendKnockResponse: vi.fn(),
                sendLeaveRoom: vi.fn(),
                sendStateUpdate: vi.fn(),
                sendMediaState: vi.fn(),
                sendStatusChange: vi.fn(),
            };
            useCommsStore.getState().setSendChatMessage(fns.sendChatMessage);
            useCommsStore.getState().setSendDeleteMessage(fns.sendDeleteMessage);
            useCommsStore.getState().setSendClearChat(fns.sendClearChat);
            useCommsStore.getState().setSendKnockResponse(fns.sendKnockResponse);
            useCommsStore.getState().setSendLeaveRoom(fns.sendLeaveRoom);
            useCommsStore.getState().setSendStateUpdate(fns.sendStateUpdate);
            useCommsStore.getState().setSendMediaState(fns.sendMediaState);
            useCommsStore.getState().setSendStatusChange(fns.sendStatusChange);

            // All should be set
            expect(useCommsStore.getState().sendChatMessage).toBe(fns.sendChatMessage);
            expect(useCommsStore.getState().sendDeleteMessage).toBe(fns.sendDeleteMessage);

            // Clear all
            useCommsStore.getState().clearAll();
            expect(useCommsStore.getState().sendChatMessage).toBeNull();
            expect(useCommsStore.getState().sendDeleteMessage).toBeNull();
            expect(useCommsStore.getState().sendClearChat).toBeNull();
        });
    });

    describe('avatar/room functions', () => {
        it('should set sendAvatarPosition', () => {
            const fn = vi.fn();
            useCommsStore.getState().setSendAvatarPosition(fn);
            expect(useCommsStore.getState().sendAvatarPosition).toBe(fn);
        });

        it('should set sendJoinRoom', () => {
            const fn = vi.fn();
            useCommsStore.getState().setSendJoinRoom(fn);
            expect(useCommsStore.getState().sendJoinRoom).toBe(fn);
        });
    });

    describe('LiveKit context', () => {
        it('should set joinContext and leaveContext', () => {
            const joinFn = vi.fn();
            const leaveFn = vi.fn();
            useCommsStore.getState().setJoinContext(joinFn);
            useCommsStore.getState().setLeaveContext(leaveFn);
            expect(useCommsStore.getState().joinContext).toBe(joinFn);
            expect(useCommsStore.getState().leaveContext).toBe(leaveFn);
        });

        it('should set livekitRoom', () => {
            const mockRoom = { name: 'test-room' };
            useCommsStore.getState().setLivekitRoom(mockRoom);
            expect(useCommsStore.getState().livekitRoom).toBe(mockRoom);
        });
    });

    describe('knock system', () => {
        it('should set knock handlers', () => {
            const reqFn = vi.fn();
            const accFn = vi.fn();
            const rejFn = vi.fn();
            useCommsStore.getState().setHandleKnockRequest(reqFn);
            useCommsStore.getState().setHandleKnockAccepted(accFn);
            useCommsStore.getState().setHandleKnockRejected(rejFn);
            expect(useCommsStore.getState().handleKnockRequest).toBe(reqFn);
            expect(useCommsStore.getState().handleKnockAccepted).toBe(accFn);
            expect(useCommsStore.getState().handleKnockRejected).toBe(rejFn);
        });

        it('should manage lastKnockTimes', () => {
            useCommsStore.getState().setLastKnockTime('user1-room1', 1000);
            expect(useCommsStore.getState().getLastKnockTime('user1-room1')).toBe(1000);
            expect(useCommsStore.getState().getLastKnockTime('nonexistent')).toBe(0);
        });

        it('should accumulate knock times without overwriting', () => {
            useCommsStore.getState().setLastKnockTime('key1', 100);
            useCommsStore.getState().setLastKnockTime('key2', 200);
            expect(useCommsStore.getState().getLastKnockTime('key1')).toBe(100);
            expect(useCommsStore.getState().getLastKnockTime('key2')).toBe(200);
        });
    });

    describe('activeSpaceId', () => {
        it('should set and clear activeSpaceId', () => {
            useCommsStore.getState().setActiveSpaceId('space-123');
            expect(useCommsStore.getState().activeSpaceId).toBe('space-123');
            useCommsStore.getState().setActiveSpaceId(null);
            expect(useCommsStore.getState().activeSpaceId).toBeNull();
        });
    });

    describe('clearAll', () => {
        it('should reset everything to null/initial', () => {
            // Set a bunch of state
            useCommsStore.getState().setPartykitSocket({} as any);
            useCommsStore.getState().setSendChatMessage(vi.fn());
            useCommsStore.getState().setJoinContext(vi.fn());
            useCommsStore.getState().setLivekitRoom({});
            useCommsStore.getState().setActiveSpaceId('space-1');
            useCommsStore.getState().setLastKnockTime('key', 999);

            useCommsStore.getState().clearAll();

            const state = useCommsStore.getState();
            expect(state.partykitSocket).toBeNull();
            expect(state.sendChatMessage).toBeNull();
            expect(state.joinContext).toBeNull();
            expect(state.livekitRoom).toBeNull();
            expect(state.activeSpaceId).toBeNull();
            expect(Object.keys(state.lastKnockTimes)).toHaveLength(0);
        });
    });
});
