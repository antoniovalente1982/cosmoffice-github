'use client';

import React, { useCallback, useState } from 'react';
import { Group, Rect, Text, Circle } from 'react-konva';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { createClient } from '../../utils/supabase/client';

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
    const { updateRoomPosition, updateRoomSize } = useOfficeStore();
    const [isDragging, setIsDragging] = useState(false);

    const roomColor = (room as any).color || '#1e293b';
    const deptLabel = (room as any).department;
    const cap = (room as any).capacity || room.settings?.capacity;

    const handleDragEnd = useCallback(async (e: any) => {
        setIsDragging(false);
        const newX = snapToGrid(e.target.x());
        const newY = snapToGrid(e.target.y());
        e.target.position({ x: newX, y: newY });
        updateRoomPosition(room.id, newX, newY);

        if (!room.id.startsWith('temp_')) {
            await supabase.from('rooms').update({ x: newX, y: newY }).eq('id', room.id);
        }
    }, [room.id, supabase, updateRoomPosition]);

    const handleResizeDragEnd = useCallback(async (handlePos: string, e: any) => {
        const handleX = e.target.x();
        const handleY = e.target.y();
        let newX = room.x, newY = room.y, newW = room.width, newH = room.height;

        if (handlePos.includes('right')) newW = snapToGrid(Math.max(MIN_ROOM_W, handleX));
        if (handlePos.includes('bottom')) newH = snapToGrid(Math.max(MIN_ROOM_H, handleY));
        if (handlePos.includes('left')) { const d = snapToGrid(handleX); newX = room.x + d; newW = Math.max(MIN_ROOM_W, room.width - d); }
        if (handlePos.includes('top')) { const d = snapToGrid(handleY); newY = room.y + d; newH = Math.max(MIN_ROOM_H, room.height - d); }

        e.target.position(getHandleOffset(handlePos, newW, newH));
        updateRoomPosition(room.id, newX, newY);
        updateRoomSize(room.id, newW, newH);

        if (!room.id.startsWith('temp_')) {
            await supabase.from('rooms').update({ x: newX, y: newY, width: newW, height: newH }).eq('id', room.id);
        }
    }, [room, supabase, updateRoomPosition, updateRoomSize]);

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
            onClick={(e) => { e.cancelBubble = true; onSelect(room.id); }}
            onTap={(e) => { e.cancelBubble = true; onSelect(room.id); }}
        >
            {/* Selection glow ring */}
            {isSelected && (
                <Rect
                    x={-5}
                    y={-5}
                    width={room.width + 10}
                    height={room.height + 10}
                    fill="transparent"
                    stroke="#818cf8"
                    strokeWidth={2}
                    cornerRadius={16}
                    dash={[10, 5]}
                    shadowColor="#6366f1"
                    shadowBlur={25}
                    shadowOpacity={0.5}
                />
            )}

            {/* Ambient glow */}
            <Rect
                x={-6}
                y={-6}
                width={room.width + 12}
                height={room.height + 12}
                fill="transparent"
                shadowColor={isSelected ? '#6366f1' : roomColor}
                shadowBlur={isSelected ? 35 : 20}
                shadowOpacity={isSelected ? 0.4 : 0.2}
                cornerRadius={16}
            />

            {/* Room body — layered for glass effect */}
            <Rect
                width={room.width}
                height={room.height}
                fill={roomColor}
                opacity={isSelected ? 0.3 : 0.18}
                cornerRadius={14}
            />
            <Rect
                width={room.width}
                height={room.height}
                fill="transparent"
                stroke={isSelected ? '#818cf8' : roomColor}
                strokeWidth={isSelected ? 2 : 1.5}
                cornerRadius={14}
                opacity={isSelected ? 0.8 : 0.5}
            />

            {/* Inner highlight */}
            <Rect
                x={1}
                y={1}
                width={room.width - 2}
                height={2}
                fill="white"
                opacity={0.05}
                cornerRadius={[14, 14, 0, 0]}
            />

            {/* Floor grid inside when selected */}
            {isSelected && Array.from({ length: Math.floor(room.width / GRID_SIZE) }).map((_, i) => (
                <Rect key={`vl-${i}`} x={(i + 1) * GRID_SIZE} y={0} width={0.5} height={room.height} fill="#6366f1" opacity={0.08} />
            ))}
            {isSelected && Array.from({ length: Math.floor(room.height / GRID_SIZE) }).map((_, i) => (
                <Rect key={`hl-${i}`} x={0} y={(i + 1) * GRID_SIZE} width={room.width} height={0.5} fill="#6366f1" opacity={0.08} />
            ))}

            {/* Subtle floor pattern (normal mode matches KonvaOffice render) */}
            {!isSelected && Array.from({ length: Math.floor(room.width / 40) }).map((_, gi) => (
                <Rect key={`fg-v-${gi}`} x={(gi + 1) * 40} y={0} width={0.5} height={room.height} fill="white" opacity={0.02} />
            ))}
            {!isSelected && Array.from({ length: Math.floor(room.height / 40) }).map((_, gi) => (
                <Rect key={`fg-h-${gi}`} x={0} y={(gi + 1) * 40} width={room.width} height={0.5} fill="white" opacity={0.02} />
            ))}

            {/* Room name pill */}
            <Rect
                x={0}
                y={-30}
                width={Math.max((room.name?.length || 5) * 8 + 24, 80)}
                height={24}
                fill={isSelected ? '#6366f1' : roomColor}
                opacity={isSelected ? 0.8 : 0.6}
                cornerRadius={12}
            />
            <Text
                text={room.name || 'Stanza'}
                fontSize={11}
                fill="#e2e8f0"
                x={12}
                y={-24}
                fontStyle="bold"
                fontFamily="Inter, system-ui, sans-serif"
            />

            {/* Department badge */}
            {deptLabel && (
                <>
                    <Rect
                        x={room.width - deptLabel.length * 6 - 24}
                        y={-30}
                        width={deptLabel.length * 6 + 20}
                        height={20}
                        fill="rgba(99,102,241,0.3)"
                        cornerRadius={10}
                    />
                    <Text
                        text={deptLabel}
                        fontSize={9}
                        fill="#a5b4fc"
                        x={room.width - deptLabel.length * 6 - 14}
                        y={-25}
                        fontFamily="Inter, system-ui, sans-serif"
                    />
                </>
            )}

            {/* Capacity badge */}
            {cap && (
                <>
                    <Rect x={room.width - 42} y={room.height - 22} width={36} height={16} fill="rgba(255,255,255,0.06)" cornerRadius={8} />
                    <Text text={`👥 ${cap}`} fontSize={9} fill="#64748b" x={room.width - 38} y={room.height - 19} />
                </>
            )}

            {/* Connection dots */}
            <Circle x={room.width / 2} y={0} radius={3} fill={isSelected ? '#818cf8' : roomColor} opacity={0.5} />
            <Circle x={room.width / 2} y={room.height} radius={3} fill={isSelected ? '#818cf8' : roomColor} opacity={0.5} />
            <Circle x={0} y={room.height / 2} radius={3} fill={isSelected ? '#818cf8' : roomColor} opacity={0.5} />
            <Circle x={room.width} y={room.height / 2} radius={3} fill={isSelected ? '#818cf8' : roomColor} opacity={0.5} />

            {/* Resize handles */}
            {handles.map(pos => {
                const offset = getHandleOffset(pos, room.width, room.height);
                return (
                    <Group key={pos}>
                        {/* Handle glow */}
                        <Circle
                            x={offset.x + HANDLE_SIZE / 2}
                            y={offset.y + HANDLE_SIZE / 2}
                            radius={HANDLE_SIZE}
                            fill="#6366f1"
                            opacity={0.15}
                        />
                        <Rect
                            x={offset.x}
                            y={offset.y}
                            width={HANDLE_SIZE}
                            height={HANDLE_SIZE}
                            fill="#818cf8"
                            stroke="#4f46e5"
                            strokeWidth={1}
                            cornerRadius={3}
                            draggable
                            onDragEnd={(e) => { e.cancelBubble = true; handleResizeDragEnd(pos, e); }}
                            hitStrokeWidth={16}
                        />
                    </Group>
                );
            })}

            {/* Dimension labels */}
            {isSelected && (
                <>
                    <Rect x={room.width / 2 - 22} y={room.height + 6} width={44} height={16} fill="rgba(99,102,241,0.3)" cornerRadius={8} />
                    <Text text={`${room.width}px`} fontSize={9} fill="#a5b4fc" x={room.width / 2 - 16} y={room.height + 10} fontStyle="bold" />
                    <Rect x={room.width + 6} y={room.height / 2 - 8} width={44} height={16} fill="rgba(99,102,241,0.3)" cornerRadius={8} />
                    <Text text={`${room.height}px`} fontSize={9} fill="#a5b4fc" x={room.width + 12} y={room.height / 2 - 4} fontStyle="bold" />
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
