import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore, ChatMessage } from '../stores/chatStore';

beforeEach(() => {
    useChatStore.setState({
        messages: [],
        officeMessages: [],
        isOpen: false,
    });
});

const makeMockMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId: 'user-1',
    userName: 'Alice',
    avatarUrl: null,
    content: 'Hello!',
    roomId: 'room-1',
    timestamp: new Date().toISOString(),
    ...overrides,
});

describe('chatStore', () => {
    describe('room messages', () => {
        it('should add a room message', () => {
            const msg = makeMockMessage({ content: 'Test message' });
            useChatStore.getState().addMessage(msg);
            expect(useChatStore.getState().messages).toHaveLength(1);
            expect(useChatStore.getState().messages[0].content).toBe('Test message');
        });

        it('should not add duplicate messages', () => {
            const msg = makeMockMessage({ id: 'msg-1' });
            useChatStore.getState().addMessage(msg);
            useChatStore.getState().addMessage(msg);
            expect(useChatStore.getState().messages).toHaveLength(1);
        });

        it('should set all room messages', () => {
            const msgs = [
                makeMockMessage({ id: 'msg-1', content: 'First' }),
                makeMockMessage({ id: 'msg-2', content: 'Second' }),
            ];
            useChatStore.getState().setMessages(msgs);
            expect(useChatStore.getState().messages).toHaveLength(2);
        });

        it('should remove a room message', () => {
            const msg = makeMockMessage({ id: 'msg-1' });
            useChatStore.getState().addMessage(msg);
            useChatStore.getState().removeMessage('msg-1');
            expect(useChatStore.getState().messages).toHaveLength(0);
        });

        it('should clear all room messages', () => {
            useChatStore.getState().addMessage(makeMockMessage({ id: 'msg-1' }));
            useChatStore.getState().addMessage(makeMockMessage({ id: 'msg-2' }));
            useChatStore.getState().clearMessages();
            expect(useChatStore.getState().messages).toHaveLength(0);
        });
    });

    describe('office messages', () => {
        it('should add an office message', () => {
            const msg = makeMockMessage({ content: 'Office msg', roomId: null });
            useChatStore.getState().addOfficeMessage(msg);
            expect(useChatStore.getState().officeMessages).toHaveLength(1);
        });

        it('should not add duplicate office messages', () => {
            const msg = makeMockMessage({ id: 'office-1', roomId: null });
            useChatStore.getState().addOfficeMessage(msg);
            useChatStore.getState().addOfficeMessage(msg);
            expect(useChatStore.getState().officeMessages).toHaveLength(1);
        });

        it('should remove an office message', () => {
            const msg = makeMockMessage({ id: 'office-1', roomId: null });
            useChatStore.getState().addOfficeMessage(msg);
            useChatStore.getState().removeOfficeMessage('office-1');
            expect(useChatStore.getState().officeMessages).toHaveLength(0);
        });

        it('should clear all office messages', () => {
            useChatStore.getState().addOfficeMessage(makeMockMessage({ id: 'o1' }));
            useChatStore.getState().addOfficeMessage(makeMockMessage({ id: 'o2' }));
            useChatStore.getState().clearOfficeMessages();
            expect(useChatStore.getState().officeMessages).toHaveLength(0);
        });
    });

    describe('chat UI state', () => {
        it('should toggle chat open/close', () => {
            expect(useChatStore.getState().isOpen).toBe(false);
            useChatStore.getState().toggleChat();
            expect(useChatStore.getState().isOpen).toBe(true);
            useChatStore.getState().toggleChat();
            expect(useChatStore.getState().isOpen).toBe(false);
        });


    });
});
