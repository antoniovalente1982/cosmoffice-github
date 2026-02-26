'use client';

import React, { useCallback, useState } from 'react';
import { Group, Rect, Text } from 'react-konva';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { createClient } from '../../utils/supabase/client';

const GRID_SIZE = 20;
const HANDLE_SIZE = 10;
const MIN_ROOM_W = 80;
const MIN_ROOM_H = 60;

function snapToGrid(value: number): number {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// Department label emoji
function getDeptIcon(department?: string): string {
    if (!department) return '';
    const d = department.toLowerCase();
    if (d.includes('eng') || d.includes('dev')) return '💻 ';
    if (d.includes('market')) return '📊 ';
    if (d.includes('sales') || d.includes('vendite')) return '📞 ';
    if (d.includes('design')) return '🎨 ';
    if (d.includes('hr') || d.includes('risorse')) return '👥 ';
    if (d.includes('finance') || d.includes('finanz')) return '💰 ';
    return '🏢 ';
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

    const roomColor = (room as any).color ||
        (room.type === 'meeting' ? '#1e3a8a' :
            room.type === 'focus' ? '#312e81' :
                room.type === 'break' ? '#065f46' :
                    room.type === 'reception' ? '#7c2d12' : '#1e293b');

    const deptIcon = getDeptIcon((room as any).department);

    // Handle room body drag
    const handleDragEnd = useCallback(async (e: any) => {
        setIsDragging(false);
        const newX = snapToGrid(e.target.x());
        const newY = snapToGrid(e.target.y());
        // Snap position on the Group node
        e.target.position({ x: newX, y: newY });
        updateRoomPosition(room.id, newX, newY);

        // Persist to DB (skip for temp IDs)
        if (!room.id.startsWith('temp_')) {
            await supabase
                .from('rooms')
                .update({ x: newX, y: newY })
                .eq('id', room.id);
        }
    }, [room.id, supabase, updateRoomPosition]);

    // Handle resize via corner/edge handles
    const handleResizeDragEnd = useCallback(async (handlePos: string, e: any) => {
        const handleX = e.target.x();
        const handleY = e.target.y();

        let newX = room.x;
        let newY = room.y;
        let newW = room.width;
        let newH = room.height;

        // handleX / handleY are relative to the Group (room.x, room.y)
        if (handlePos.includes('right')) {
            newW = snapToGrid(Math.max(MIN_ROOM_W, handleX));
        }
        if (handlePos.includes('bottom')) {
            newH = snapToGrid(Math.max(MIN_ROOM_H, handleY));
        }
        if (handlePos.includes('left')) {
            const snappedX = snapToGrid(handleX);
            const delta = snappedX; // relative to group origin
            newX = room.x + delta;
            newW = Math.max(MIN_ROOM_W, room.width - delta);
        }
        if (handlePos.includes('top')) {
            const snappedY = snapToGrid(handleY);
            const delta = snappedY;
            newY = room.y + delta;
            newH = Math.max(MIN_ROOM_H, room.height - delta);
        }

        // Reset handle position back to corner
        e.target.position(getHandleOffset(handlePos, newW, newH));

        updateRoomPosition(room.id, newX, newY);
        updateRoomSize(room.id, newW, newH);

        // Persist
        if (!room.id.startsWith('temp_')) {
            await supabase
                .from('rooms')
                .update({ x: newX, y: newY, width: newW, height: newH })
                .eq('id', room.id);
        }
    }, [room, supabase, updateRoomPosition, updateRoomSize]);

    // Calculate handle offset position within the group
    function getHandleOffset(pos: string, w: number, h: number): { x: number; y: number } {
        const hs = HANDLE_SIZE / 2;
        switch (pos) {
            case 'top-left': return { x: -hs, y: -hs };
            case 'top': return { x: w / 2 - hs, y: -hs };
            case 'top-right': return { x: w - hs, y: -hs };
            case 'right': return { x: w - hs, y: h / 2 - hs };
            case 'bottom-right': return { x: w - hs, y: h - hs };
            case 'bottom': return { x: w / 2 - hs, y: h - hs };
            case 'bottom-left': return { x: -hs, y: h - hs };
            case 'left': return { x: -hs, y: h / 2 - hs };
            default: return { x: 0, y: 0 };
        }
    }

    const handles = isSelected ? [
        'top-left', 'top', 'top-right', 'right',
        'bottom-right', 'bottom', 'bottom-left', 'left'
    ] : [];

    return (
        <Group
            x={room.x}
            y={room.y}
            draggable={isSelected}
            onDragStart={() => setIsDragging(true)}
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
            {/* Selection glow */}
            {isSelected && (
                <Rect
                    x={-4}
                    y={-4}
                    width={room.width + 8}
                    height={room.height + 8}
                    fill="transparent"
                    stroke="#6366f1"
                    strokeWidth={2}
                    cornerRadius={14}
                    dash={[8, 4]}
                    shadowColor="#6366f1"
                    shadowBlur={20}
                    shadowOpacity={0.4}
                />
            )}

            {/* Room background */}
            <Rect
                width={room.width}
                height={room.height}
                fill={roomColor}
                opacity={isSelected ? 0.5 : 0.3}
                cornerRadius={12}
                stroke={isSelected ? '#818cf8' : '#334155'}
                strokeWidth={isSelected ? 2 : 1}
            />

            {/* Grid lines inside room when selected */}
            {isSelected && Array.from({ length: Math.floor(room.width / GRID_SIZE) }).map((_, i) => (
                <Rect
                    key={`vline-${i}`}
                    x={(i + 1) * GRID_SIZE}
                    y={0}
                    width={0.5}
                    height={room.height}
                    fill="#475569"
                    opacity={0.15}
                />
            ))}
            {isSelected && Array.from({ length: Math.floor(room.height / GRID_SIZE) }).map((_, i) => (
                <Rect
                    key={`hline-${i}`}
                    x={0}
                    y={(i + 1) * GRID_SIZE}
                    width={room.width}
                    height={0.5}
                    fill="#475569"
                    opacity={0.15}
                />
            ))}

            {/* Room name */}
            <Text
                text={`${deptIcon}${room.name || 'Stanza'}`}
                fontSize={13}
                fill={isSelected ? '#e2e8f0' : '#94a3b8'}
                x={10}
                y={-22}
                fontStyle="bold"
            />

            {/* Type badge inside room */}
            <Rect
                x={8}
                y={8}
                width={room.type.length * 7 + 16}
                height={18}
                fill="rgba(0,0,0,0.3)"
                cornerRadius={9}
            />
            <Text
                text={room.type.toUpperCase()}
                fontSize={9}
                fill="#94a3b8"
                x={16}
                y={12}
            />

            {/* Department badge */}
            {(room as any).department && (
                <>
                    <Rect
                        x={8}
                        y={room.height - 26}
                        width={((room as any).department.length * 6) + 20}
                        height={18}
                        fill="rgba(99,102,241,0.25)"
                        cornerRadius={9}
                    />
                    <Text
                        text={(room as any).department}
                        fontSize={9}
                        fill="#a5b4fc"
                        x={16}
                        y={room.height - 22}
                    />
                </>
            )}

            {/* Capacity */}
            <Text
                text={`👥 ${(room as any).capacity || room.settings?.capacity || '?'}`}
                fontSize={10}
                fill="#475569"
                x={room.width - 45}
                y={10}
            />

            {/* Resize handles */}
            {handles.map(pos => {
                const offset = getHandleOffset(pos, room.width, room.height);
                return (
                    <Rect
                        key={pos}
                        x={offset.x}
                        y={offset.y}
                        width={HANDLE_SIZE}
                        height={HANDLE_SIZE}
                        fill="#6366f1"
                        stroke="#4338ca"
                        strokeWidth={1}
                        cornerRadius={2}
                        draggable
                        onDragEnd={(e) => {
                            e.cancelBubble = true;
                            handleResizeDragEnd(pos, e);
                        }}
                        hitStrokeWidth={14}
                    />
                );
            })}

            {/* Dimension labels */}
            {isSelected && (
                <>
                    <Text
                        text={`${room.width}px`}
                        fontSize={10}
                        fill="#818cf8"
                        x={room.width / 2 - 15}
                        y={room.height + 8}
                        fontStyle="bold"
                    />
                    <Text
                        text={`${room.height}px`}
                        fontSize={10}
                        fill="#818cf8"
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
        // Notify the sidebar to load properties
        window.dispatchEvent(new CustomEvent('builder-select-room', { detail: { roomId: id } }));
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
