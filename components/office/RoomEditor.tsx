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

    const roomColor = room?.settings?.color || (room as any).color || '#3b82f6';
    const deptLabel = room?.settings?.department || (room as any).department;
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

    const handles = isSelected ? ['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left'] : [];
    const accentColor = isSelected ? '#818cf8' : roomColor;

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
            {/* Selection dashed ring */}
            {isSelected && (
                <Rect
                    x={-6} y={-6}
                    width={room.width + 12} height={room.height + 12}
                    fill="transparent"
                    stroke="#818cf8" strokeWidth={2}
                    cornerRadius={18} dash={[10, 5]}
                    shadowColor="#6366f1" shadowBlur={30} shadowOpacity={0.5}
                />
            )}

            {/* ═══ LAYER 1: AMBIENT GLOW ═══ */}
            <Rect
                x={-20} y={-20}
                width={room.width + 40} height={room.height + 40}
                fill="transparent"
                shadowColor={accentColor}
                shadowBlur={isSelected ? 65 : 50}
                shadowOpacity={isSelected ? 0.6 : 0.45}
                cornerRadius={24}
            />

            {/* ═══ LAYER 2: DARK BASE ═══ */}
            <Rect
                width={room.width} height={room.height}
                fill="#0f172a" opacity={0.85}
                cornerRadius={14}
            />

            {/* ═══ LAYER 3: VIVID COLOR FILL ═══ */}
            <Rect
                width={room.width} height={room.height}
                fill={roomColor}
                opacity={isSelected ? 0.5 : 0.4}
                cornerRadius={14}
            />

            {/* ═══ LAYER 4: BORDER ═══ */}
            <Rect
                width={room.width} height={room.height}
                fill="transparent"
                stroke={accentColor}
                strokeWidth={isSelected ? 3 : 2.5}
                cornerRadius={14}
                opacity={0.85}
            />

            {/* ═══ HEADER BAR ═══ */}
            <Rect
                x={0} y={0}
                width={room.width} height={8}
                fill={accentColor}
                cornerRadius={[14, 14, 0, 0]}
            />

            {/* ═══ INNER HIGHLIGHT ═══ */}
            <Rect x={8} y={12} width={room.width - 16} height={2} fill="white" opacity={0.15} cornerRadius={1} />
            <Rect x={8} y={16} width={room.width * 0.35} height={1} fill="white" opacity={0.08} cornerRadius={1} />

            {/* ═══ BOTTOM ACCENT ═══ */}
            <Rect
                x={0} y={room.height - 3}
                width={room.width} height={3}
                fill={accentColor} opacity={0.6}
                cornerRadius={[0, 0, 14, 14]}
            />

            {/* Builder grid when selected */}
            {isSelected && Array.from({ length: Math.floor(room.width / GRID_SIZE) }).map((_, i) => (
                <Rect key={`vl-${i}`} x={(i + 1) * GRID_SIZE} y={8} width={0.5} height={room.height - 11} fill="#818cf8" opacity={0.08} />
            ))}
            {isSelected && Array.from({ length: Math.floor(room.height / GRID_SIZE) }).map((_, i) => (
                <Rect key={`hl-${i}`} x={0} y={(i + 1) * GRID_SIZE} width={room.width} height={0.5} fill="#818cf8" opacity={0.08} />
            ))}

            {/* Floor pattern when not selected */}
            {!isSelected && Array.from({ length: Math.floor(room.width / 40) }).map((_, gi) => (
                <Rect key={`fg-v-${gi}`} x={(gi + 1) * 40} y={8} width={1} height={room.height - 11} fill={roomColor} opacity={0.06} />
            ))}
            {!isSelected && Array.from({ length: Math.floor(room.height / 40) }).map((_, gi) => (
                <Rect key={`fg-h-${gi}`} x={0} y={(gi + 1) * 40} width={room.width} height={1} fill={roomColor} opacity={0.06} />
            ))}

            {/* Corner dots */}
            <Circle x={6} y={6} radius={3} fill={accentColor} opacity={0.8} />
            <Circle x={room.width - 6} y={6} radius={3} fill={accentColor} opacity={0.8} />
            <Circle x={6} y={room.height - 6} radius={3} fill={accentColor} opacity={0.5} />
            <Circle x={room.width - 6} y={room.height - 6} radius={3} fill={accentColor} opacity={0.5} />

            {/* Room name pill */}
            <Rect
                x={0} y={-36}
                width={Math.max((room.name?.length || 4) * 9 + 32, 100)}
                height={30}
                fill={isSelected ? '#6366f1' : roomColor}
                cornerRadius={15}
                shadowColor={isSelected ? '#6366f1' : roomColor}
                shadowBlur={20} shadowOpacity={0.5}
            />
            <Text
                text={room.name || 'Stanza'}
                fontSize={13} fill="#ffffff"
                x={16} y={-28}
                fontStyle="bold"
                fontFamily="Inter, system-ui, sans-serif"
            />

            {/* Department badge */}
            {deptLabel && (
                <>
                    <Rect x={room.width - deptLabel.length * 7 - 26} y={-34} width={deptLabel.length * 7 + 22} height={26} fill="rgba(255,255,255,0.18)" cornerRadius={13} />
                    <Text text={deptLabel} fontSize={10} fill="#ffffff" x={room.width - deptLabel.length * 7 - 15} y={-27} fontFamily="Inter, system-ui, sans-serif" fontStyle="700" />
                </>
            )}

            {/* Capacity badge */}
            {cap && (
                <>
                    <Circle x={room.width - 22} y={room.height - 22} radius={18}
                        fill="transparent" shadowColor={roomColor} shadowBlur={15} shadowOpacity={0.4} />
                    <Circle x={room.width - 22} y={room.height - 22} radius={16}
                        fill={roomColor} opacity={0.5} />
                    <Circle x={room.width - 22} y={room.height - 22} radius={16}
                        fill="transparent" stroke={roomColor} strokeWidth={2} opacity={0.9} />
                    <Text text={`${cap}`} fontSize={12} fill="#ffffff"
                        x={room.width - 22 - (String(cap).length * 4)} y={room.height - 28}
                        fontStyle="bold" fontFamily="Inter, system-ui, sans-serif" />
                </>
            )}

            {/* Edge dots with glow */}
            <Circle x={room.width / 2} y={0} radius={4.5} fill={accentColor} opacity={0.85}
                shadowColor={accentColor} shadowBlur={8} shadowOpacity={0.6} />
            <Circle x={room.width / 2} y={room.height} radius={4.5} fill={accentColor} opacity={0.85}
                shadowColor={accentColor} shadowBlur={8} shadowOpacity={0.6} />
            <Circle x={0} y={room.height / 2} radius={4.5} fill={accentColor} opacity={0.85}
                shadowColor={accentColor} shadowBlur={8} shadowOpacity={0.6} />
            <Circle x={room.width} y={room.height / 2} radius={4.5} fill={accentColor} opacity={0.85}
                shadowColor={accentColor} shadowBlur={8} shadowOpacity={0.6} />

            {/* Resize handles */}
            {handles.map(pos => {
                const offset = getHandleOffset(pos, room.width, room.height);
                return (
                    <Group key={pos}>
                        <Circle x={offset.x + HANDLE_SIZE / 2} y={offset.y + HANDLE_SIZE / 2} radius={HANDLE_SIZE} fill="#6366f1" opacity={0.15} />
                        <Rect
                            x={offset.x} y={offset.y} width={HANDLE_SIZE} height={HANDLE_SIZE}
                            fill="#818cf8" stroke="#4f46e5" strokeWidth={1} cornerRadius={3}
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
