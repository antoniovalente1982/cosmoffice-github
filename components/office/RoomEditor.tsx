'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Group, Rect, Text, Circle, Line } from 'react-konva';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { createClient } from '../../utils/supabase/client';

const GRID_SIZE = 20;
const HANDLE_SIZE = 8;

function snapToGrid(value: number): number {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// Color map for room types
function getRoomColor(type: string, color?: string): string {
    if (color) return color;
    switch (type) {
        case 'meeting': return '#1e3a8a';
        case 'focus': return '#312e81';
        case 'break': return '#065f46';
        case 'reception': return '#7c2d12';
        default: return '#1e293b';
    }
}

// Department label emoji
function getDeptIcon(department?: string): string {
    if (!department) return '';
    switch (department.toLowerCase()) {
        case 'engineering': return '💻';
        case 'marketing': return '📊';
        case 'sales': return '📞';
        case 'design': return '🎨';
        case 'hr': return '👥';
        case 'finance': return '💰';
        default: return '🏢';
    }
}

interface EditableRoomProps {
    room: any;
    isSelected: boolean;
    onSelect: (id: string) => void;
}

function EditableRoom({ room, isSelected, onSelect }: EditableRoomProps) {
    const supabase = createClient();
    const { updateRoomPosition, updateRoomSize } = useOfficeStore();
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const startRef = useRef({ x: 0, y: 0, width: 0, height: 0, handlePos: '' });

    const roomColor = getRoomColor(room.type, room.color);
    const deptIcon = getDeptIcon(room.department);

    // Handle room drag
    const handleDragStart = useCallback(() => {
        setIsDragging(true);
    }, []);

    const handleDragEnd = useCallback(async (e: any) => {
        setIsDragging(false);
        const newX = snapToGrid(e.target.x());
        const newY = snapToGrid(e.target.y());
        e.target.position({ x: newX, y: newY });
        updateRoomPosition(room.id, newX, newY);

        // Persist to DB
        await supabase
            .from('rooms')
            .update({ x: newX, y: newY })
            .eq('id', room.id);
    }, [room.id, supabase, updateRoomPosition]);

    // Handle resize via corner handles
    const handleResizeStart = useCallback((handlePos: string, e: any) => {
        e.cancelBubble = true;
        setIsResizing(true);
        startRef.current = {
            x: room.x,
            y: room.y,
            width: room.width,
            height: room.height,
            handlePos,
        };
    }, [room]);

    const handleResizeDrag = useCallback((handlePos: string, e: any) => {
        const { x: startX, y: startY, width: startW, height: startH } = startRef.current;
        const nodeX = e.target.x();
        const nodeY = e.target.y();

        let newX = room.x;
        let newY = room.y;
        let newW = room.width;
        let newH = room.height;

        if (handlePos.includes('right')) {
            newW = snapToGrid(Math.max(80, nodeX - room.x));
        }
        if (handlePos.includes('bottom')) {
            newH = snapToGrid(Math.max(60, nodeY - room.y));
        }
        if (handlePos.includes('left')) {
            const delta = snapToGrid(nodeX) - room.x;
            newX = room.x + delta;
            newW = Math.max(80, room.width - delta);
        }
        if (handlePos.includes('top')) {
            const delta = snapToGrid(nodeY) - room.y;
            newY = room.y + delta;
            newH = Math.max(60, room.height - delta);
        }

        updateRoomPosition(room.id, newX, newY);
        updateRoomSize(room.id, newW, newH);
    }, [room, updateRoomPosition, updateRoomSize]);

    const handleResizeEnd = useCallback(async () => {
        setIsResizing(false);
        const state = useOfficeStore.getState();
        const updatedRoom = state.rooms.find(r => r.id === room.id);
        if (updatedRoom) {
            await supabase
                .from('rooms')
                .update({
                    x: updatedRoom.x,
                    y: updatedRoom.y,
                    width: updatedRoom.width,
                    height: updatedRoom.height,
                })
                .eq('id', room.id);
        }
    }, [room.id, supabase]);

    // Resize handle positions
    const handles = isSelected ? [
        { pos: 'top-left', x: 0, y: 0 },
        { pos: 'top', x: room.width / 2, y: 0 },
        { pos: 'top-right', x: room.width, y: 0 },
        { pos: 'right', x: room.width, y: room.height / 2 },
        { pos: 'bottom-right', x: room.width, y: room.height },
        { pos: 'bottom', x: room.width / 2, y: room.height },
        { pos: 'bottom-left', x: 0, y: room.height },
        { pos: 'left', x: 0, y: room.height / 2 },
    ] : [];

    return (
        <Group
            x={room.x}
            y={room.y}
            draggable={isSelected}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={(e) => {
                e.cancelBubble = true;
                onSelect(room.id);
            }}
            onTap={(e) => {
                e.cancelBubble = true;
                onSelect(room.id);
            }}
        >
            {/* Room background */}
            <Rect
                width={room.width}
                height={room.height}
                fill={roomColor}
                opacity={isSelected ? 0.5 : 0.3}
                cornerRadius={12}
                stroke={isSelected ? '#6366f1' : '#334155'}
                strokeWidth={isSelected ? 2 : 1}
                dash={isDragging ? [8, 4] : undefined}
                shadowColor={isSelected ? '#6366f1' : undefined}
                shadowBlur={isSelected ? 15 : 0}
                shadowOpacity={isSelected ? 0.3 : 0}
            />

            {/* Room name */}
            <Text
                text={`${deptIcon} ${room.name}`}
                fontSize={13}
                fill={isSelected ? '#e2e8f0' : '#94a3b8'}
                x={10}
                y={-22}
                fontStyle="bold"
            />

            {/* Type badge */}
            <Text
                text={room.type.toUpperCase()}
                fontSize={9}
                fill="#64748b"
                x={10}
                y={room.height + 6}
            />

            {/* Department badge */}
            {room.department && (
                <>
                    <Rect
                        x={room.width - 70}
                        y={-18}
                        width={68}
                        height={16}
                        fill="rgba(99,102,241,0.2)"
                        cornerRadius={8}
                    />
                    <Text
                        text={room.department}
                        fontSize={9}
                        fill="#a5b4fc"
                        x={room.width - 66}
                        y={-15}
                        width={64}
                        align="center"
                    />
                </>
            )}

            {/* Capacity indicator */}
            <Text
                text={`👥 ${room.settings?.capacity || room.capacity || '?'}`}
                fontSize={10}
                fill="#475569"
                x={room.width - 50}
                y={room.height + 6}
            />

            {/* Resize handles */}
            {handles.map(({ pos, x, y }) => (
                <Rect
                    key={pos}
                    x={x - HANDLE_SIZE / 2}
                    y={y - HANDLE_SIZE / 2}
                    width={HANDLE_SIZE}
                    height={HANDLE_SIZE}
                    fill="#6366f1"
                    stroke="#312e81"
                    strokeWidth={1}
                    cornerRadius={2}
                    draggable
                    onDragStart={(e) => handleResizeStart(pos, e)}
                    onDragMove={(e) => handleResizeDrag(pos, e)}
                    onDragEnd={handleResizeEnd}
                    hitStrokeWidth={12}
                />
            ))}

            {/* Dimension labels while selected */}
            {isSelected && (
                <>
                    <Text
                        text={`${room.width}`}
                        fontSize={10}
                        fill="#6366f1"
                        x={room.width / 2 - 12}
                        y={room.height + 20}
                        fontStyle="bold"
                    />
                    <Text
                        text={`${room.height}`}
                        fontSize={10}
                        fill="#6366f1"
                        x={room.width + 8}
                        y={room.height / 2 - 5}
                        fontStyle="bold"
                    />
                </>
            )}
        </Group>
    );
}

interface RoomEditorProps {
    rooms: any[];
}

export function RoomEditor({ rooms }: RoomEditorProps) {
    const { selectedRoomId, setSelectedRoom } = useOfficeStore();

    const handleSelect = useCallback((id: string) => {
        setSelectedRoom(id);
        // Also update the builder sidebar
        const room = useOfficeStore.getState().rooms.find(r => r.id === id);
        if (room) {
            // Dispatch custom event for OfficeBuilder
            window.dispatchEvent(new CustomEvent('builder-select-room', { detail: { roomId: id } }));
        }
    }, [setSelectedRoom]);

    return (
        <>
            {rooms.map(room => (
                <EditableRoom
                    key={room.id}
                    room={room}
                    isSelected={selectedRoomId === room.id}
                    onSelect={handleSelect}
                />
            ))}
        </>
    );
}
