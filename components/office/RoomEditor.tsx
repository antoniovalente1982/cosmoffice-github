'use client';

import React, { useCallback, useState } from 'react';
import { Group, Rect, Text, Circle } from 'react-konva';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { createClient } from '../../utils/supabase/client';
import { ModernRoom } from './ModernRoom';

const GRID_SIZE = 20;
const HANDLE_SIZE = 10;
const MIN_ROOM_W = 80;
const MIN_ROOM_H = 60;

function snapToGrid(value: number): number {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

interface EditableRoomProps {
    room: any;
    isSelected: boolean;
    onSelect: (id: string) => void;
}

function EditableRoom({ room, isSelected, onSelect }: EditableRoomProps) {
    const supabase = createClient();
    const { updateRoomPosition, updateRoomSize, officeWidth, officeHeight } = useOfficeStore();
    const [isDragging, setIsDragging] = useState(false);

    const roomColor = room?.settings?.color || (room as any).color || '#3b82f6';
    const deptLabel = room?.settings?.department || (room as any).department;
    const cap = (room as any).capacity || room.settings?.capacity;

    const handleDragEnd = useCallback(async (e: any) => {
        setIsDragging(false);
        // Force bounds clamping for new room moves
        let newX = snapToGrid(e.target.x());
        let newY = snapToGrid(e.target.y());

        newX = Math.max(0, Math.min(newX, (officeWidth || 4000) - room.width));
        newY = Math.max(0, Math.min(newY, (officeHeight || 4000) - room.height));

        e.target.position({ x: newX, y: newY });
        updateRoomPosition(room.id, newX, newY);
        if (!room.id.startsWith('temp_')) {
            await supabase.from('rooms').update({ x: newX, y: newY }).eq('id', room.id);
        }
    }, [room, supabase, updateRoomPosition, officeWidth, officeHeight]);

    const handleResizeDragEnd = useCallback(async (handlePos: string, e: any) => {
        const handleX = e.target.x();
        const handleY = e.target.y();
        let newX = room.x, newY = room.y, newW = room.width, newH = room.height;
        if (handlePos.includes('right')) newW = snapToGrid(Math.max(MIN_ROOM_W, handleX));
        if (handlePos.includes('bottom')) newH = snapToGrid(Math.max(MIN_ROOM_H, handleY));
        if (handlePos.includes('left')) { const d = snapToGrid(handleX); newX = Math.max(0, room.x + d); newW = Math.max(MIN_ROOM_W, room.width - d); }
        if (handlePos.includes('top')) { const d = snapToGrid(handleY); newY = Math.max(0, room.y + d); newH = Math.max(MIN_ROOM_H, room.height - d); }

        // Prevent exceeding bounds
        if (newX + newW > (officeWidth || 4000)) newW = (officeWidth || 4000) - newX;
        if (newY + newH > (officeHeight || 4000)) newH = (officeHeight || 4000) - newY;

        e.target.position(getHandleOffset(handlePos, newW, newH));
        updateRoomPosition(room.id, newX, newY);
        updateRoomSize(room.id, newW, newH);
        if (!room.id.startsWith('temp_')) {
            await supabase.from('rooms').update({ x: newX, y: newY, width: newW, height: newH }).eq('id', room.id);
        }
    }, [room, supabase, updateRoomPosition, updateRoomSize, officeWidth, officeHeight]);

    function getHandleOffset(pos: string, w: number, h: number) {
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

    const handles = isSelected ? ['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left'] : [];
    const accentColor = isSelected ? '#818cf8' : roomColor;

    return (
        <Group
            x={room.x}
            y={room.y}
            draggable={true}
            onDragStart={(e) => {
                setIsDragging(true);
                onSelect(room.id);
            }}
            onDragEnd={handleDragEnd}
            onClick={(e) => { e.cancelBubble = true; onSelect(room.id); }}
            onTap={(e) => { e.cancelBubble = true; onSelect(room.id); }}
        >
            {/* Main Room Rendering using the consistent ModernRoom component */}
            <ModernRoom
                room={{ ...room, x: 0, y: 0 }}
                isSelected={isSelected}
                animated={true}
            />

            {/* Builder grid when selected */}
            {isSelected && Array.from({ length: Math.floor(room.width / GRID_SIZE) }).map((_, i) => (
                <Rect key={`vl-${i}`} x={(i + 1) * GRID_SIZE} y={8} width={0.5} height={room.height - 11} fill="#00d4ff" opacity={0.15} />
            ))}
            {isSelected && Array.from({ length: Math.floor(room.height / GRID_SIZE) }).map((_, i) => (
                <Rect key={`hl-${i}`} x={0} y={(i + 1) * GRID_SIZE} width={room.width} height={0.5} fill="#00d4ff" opacity={0.15} />
            ))}

            {/* Resize handles */}
            {handles.map(pos => {
                const offset = getHandleOffset(pos, room.width, room.height);
                return (
                    <Group key={pos}>
                        <Circle x={offset.x + HANDLE_SIZE / 2} y={offset.y + HANDLE_SIZE / 2} radius={HANDLE_SIZE} fill="#00d4ff" opacity={0.2} />
                        <Rect
                            x={offset.x} y={offset.y} width={HANDLE_SIZE} height={HANDLE_SIZE}
                            fill="#00d4ff" stroke="#00b4d8" strokeWidth={1} cornerRadius={3}
                            shadowColor="#00d4ff" shadowBlur={10} shadowOpacity={0.8}
                            draggable
                            onDragEnd={(e) => { e.cancelBubble = true; handleResizeDragEnd(pos, e); }}
                            hitStrokeWidth={16}
                        />
                    </Group>
                );
            })}

            {/* Dimension labels — ONLY when selected in builder */}
            {isSelected && (
                <>
                    <Rect x={room.width / 2 - 22} y={room.height + 8} width={44} height={16} fill="rgba(99,102,241,0.4)" cornerRadius={8} />
                    <Text text={`${room.width}px`} fontSize={9} fill="#c7d2fe" x={room.width / 2 - 16} y={room.height + 12} fontStyle="bold" fontFamily="Inter, system-ui, sans-serif" />
                    <Rect x={room.width + 8} y={room.height / 2 - 8} width={44} height={16} fill="rgba(99,102,241,0.4)" cornerRadius={8} />
                    <Text text={`${room.height}px`} fontSize={9} fill="#c7d2fe" x={room.width + 14} y={room.height / 2 - 4} fontStyle="bold" fontFamily="Inter, system-ui, sans-serif" />
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
        window.dispatchEvent(new CustomEvent('builder-select-room', { detail: { roomId: id } }));
    }, [setSelectedRoom]);

    return (
        <>
            {rooms.map(room => (
                <EditableRoom key={room.id} room={room} isSelected={selectedRoomId === room.id} onSelect={handleSelect} />
            ))}
        </>
    );
}
