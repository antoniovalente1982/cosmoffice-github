'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { createClient } from '../../utils/supabase/client';

const GRID_SIZE = 20;
const HANDLE_SIZE = 12;
const MIN_ROOM_W = 80;
const MIN_ROOM_H = 60;

function snapToGrid(value: number): number {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// ─── Room Color Palette (consistent with PixiOffice) ─────────
const ROOM_COLORS: Record<string, string> = {
    reception: '#3b82f6',
    open: '#6366f1',
    meeting: '#8b5cf6',
    focus: '#06b6d4',
    break: '#10b981',
    default: '#6366f1',
};

interface EditableRoomProps {
    room: any;
    isSelected: boolean;
    onSelect: (id: string) => void;
    zoom: number;
    stagePos: { x: number; y: number };
}

function EditableRoom({ room, isSelected, onSelect, zoom, stagePos }: EditableRoomProps) {
    const supabase = createClient();
    const { updateRoomPosition, updateRoomSize, officeWidth, officeHeight } = useOfficeStore();
    const [isDragging, setIsDragging] = useState(false);
    const [resizing, setResizing] = useState<string | null>(null);
    const dragRef = useRef({ startX: 0, startY: 0, roomX: 0, roomY: 0, roomW: 0, roomH: 0 });

    const color = room?.settings?.color || ROOM_COLORS[room.type] || ROOM_COLORS.default;

    // World → screen coordinate
    const screenX = room.x * zoom + stagePos.x;
    const screenY = room.y * zoom + stagePos.y;
    const screenW = room.width * zoom;
    const screenH = room.height * zoom;

    // ─── Drag handling ────────────────────────────────────
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onSelect(room.id);
        setIsDragging(true);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            roomX: room.x,
            roomY: room.y,
            roomW: room.width,
            roomH: room.height,
        };
    }, [room, onSelect]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMove = (e: MouseEvent) => {
            const { startX, startY, roomX, roomY } = dragRef.current;
            const dx = (e.clientX - startX) / zoom;
            const dy = (e.clientY - startY) / zoom;
            let newX = snapToGrid(roomX + dx);
            let newY = snapToGrid(roomY + dy);
            newX = Math.max(0, Math.min(newX, (officeWidth || 4000) - room.width));
            newY = Math.max(0, Math.min(newY, (officeHeight || 4000) - room.height));
            updateRoomPosition(room.id, newX, newY);
        };

        const handleUp = async (e: MouseEvent) => {
            setIsDragging(false);
            const { startX, startY, roomX, roomY } = dragRef.current;
            const dx = (e.clientX - startX) / zoom;
            const dy = (e.clientY - startY) / zoom;
            let newX = snapToGrid(roomX + dx);
            let newY = snapToGrid(roomY + dy);
            newX = Math.max(0, Math.min(newX, (officeWidth || 4000) - room.width));
            newY = Math.max(0, Math.min(newY, (officeHeight || 4000) - room.height));
            updateRoomPosition(room.id, newX, newY);
            if (!room.id.startsWith('temp_')) {
                await supabase.from('rooms').update({ x: newX, y: newY }).eq('id', room.id);
            }
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [isDragging, room, zoom, updateRoomPosition, officeWidth, officeHeight, supabase]);

    // ─── Resize handling ──────────────────────────────────
    const handleResizeStart = useCallback((pos: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setResizing(pos);
        onSelect(room.id);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            roomX: room.x,
            roomY: room.y,
            roomW: room.width,
            roomH: room.height,
        };
    }, [room, onSelect]);

    useEffect(() => {
        if (!resizing) return;

        const handleMove = (e: MouseEvent) => {
            const { startX, startY, roomX, roomY, roomW, roomH } = dragRef.current;
            const dx = (e.clientX - startX) / zoom;
            const dy = (e.clientY - startY) / zoom;
            let newX = roomX, newY = roomY, newW = roomW, newH = roomH;

            if (resizing.includes('right')) newW = snapToGrid(Math.max(MIN_ROOM_W, roomW + dx));
            if (resizing.includes('bottom')) newH = snapToGrid(Math.max(MIN_ROOM_H, roomH + dy));
            if (resizing.includes('left')) {
                const d = snapToGrid(dx);
                newX = Math.max(0, roomX + d);
                newW = Math.max(MIN_ROOM_W, roomW - d);
            }
            if (resizing.includes('top')) {
                const d = snapToGrid(dy);
                newY = Math.max(0, roomY + d);
                newH = Math.max(MIN_ROOM_H, roomH - d);
            }

            if (newX + newW > (officeWidth || 4000)) newW = (officeWidth || 4000) - newX;
            if (newY + newH > (officeHeight || 4000)) newH = (officeHeight || 4000) - newY;

            updateRoomPosition(room.id, newX, newY);
            updateRoomSize(room.id, newW, newH);
        };

        const handleUp = async () => {
            setResizing(null);
            const state = useOfficeStore.getState();
            const r = state.rooms.find((rm: any) => rm.id === room.id);
            if (r && !room.id.startsWith('temp_')) {
                await supabase.from('rooms').update({
                    x: r.x, y: r.y, width: r.width, height: r.height,
                }).eq('id', room.id);
            }
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [resizing, room, zoom, updateRoomPosition, updateRoomSize, officeWidth, officeHeight, supabase]);

    // Handle positions (relative to room's screen coords)
    const handles = isSelected ? [
        { pos: 'top-left', x: 0, y: 0, cursor: 'nwse-resize' },
        { pos: 'top', x: screenW / 2, y: 0, cursor: 'ns-resize' },
        { pos: 'top-right', x: screenW, y: 0, cursor: 'nesw-resize' },
        { pos: 'right', x: screenW, y: screenH / 2, cursor: 'ew-resize' },
        { pos: 'bottom-right', x: screenW, y: screenH, cursor: 'nwse-resize' },
        { pos: 'bottom', x: screenW / 2, y: screenH, cursor: 'ns-resize' },
        { pos: 'bottom-left', x: 0, y: screenH, cursor: 'nesw-resize' },
        { pos: 'left', x: 0, y: screenH / 2, cursor: 'ew-resize' },
    ] : [];

    return (
        <>
            {/* Clickable/draggable room overlay */}
            <div
                style={{
                    position: 'absolute',
                    left: screenX,
                    top: screenY,
                    width: screenW,
                    height: screenH,
                    border: `2px solid ${isSelected ? '#818cf8' : color}`,
                    borderRadius: 16 * zoom,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    background: isSelected ? 'rgba(99,102,241,0.08)' : 'transparent',
                    transition: isDragging ? 'none' : 'border-color 0.2s',
                    zIndex: isSelected ? 10 : 5,
                    pointerEvents: 'auto',
                }}
                onMouseDown={handleMouseDown}
            >
                {/* Grid overlay when selected */}
                {isSelected && (
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundImage: `
                                linear-gradient(rgba(0, 212, 255, 0.12) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(0, 212, 255, 0.12) 1px, transparent 1px)
                            `,
                            backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
                            borderRadius: 16 * zoom,
                        }}
                    />
                )}

                {/* Dimension labels */}
                {isSelected && (
                    <>
                        <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none"
                            style={{ bottom: -(24 * zoom) }}>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{ background: 'rgba(99,102,241,0.4)', color: '#c7d2fe', fontSize: 9 * zoom }}>
                                {room.width}px
                            </span>
                        </div>
                        <div className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ left: screenW + 8 * zoom }}>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{ background: 'rgba(99,102,241,0.4)', color: '#c7d2fe', fontSize: 9 * zoom }}>
                                {room.height}px
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* Resize handles */}
            {handles.map(({ pos, x, y, cursor }) => (
                <div
                    key={pos}
                    style={{
                        position: 'absolute',
                        left: screenX + x - HANDLE_SIZE / 2,
                        top: screenY + y - HANDLE_SIZE / 2,
                        width: HANDLE_SIZE,
                        height: HANDLE_SIZE,
                        cursor,
                        borderRadius: 3,
                        background: '#00d4ff',
                        border: '1px solid #00b4d8',
                        boxShadow: '0 0 10px rgba(0,212,255,0.8)',
                        zIndex: 20,
                        pointerEvents: 'auto',
                    }}
                    onMouseDown={(e) => handleResizeStart(pos, e)}
                />
            ))}
        </>
    );
}

interface RoomEditorProps {
    rooms: any[];
}

export function RoomEditor({ rooms }: RoomEditorProps) {
    const { selectedRoomId, setSelectedRoom, zoom, stagePos } = useOfficeStore();

    const handleSelect = useCallback((id: string) => {
        setSelectedRoom(id);
        window.dispatchEvent(new CustomEvent('builder-select-room', { detail: { roomId: id } }));
    }, [setSelectedRoom]);

    return (
        <div className="absolute inset-0 z-[4]" style={{ pointerEvents: 'none' }}>
            {rooms.map(room => (
                <EditableRoom
                    key={room.id}
                    room={room}
                    isSelected={selectedRoomId === room.id}
                    onSelect={handleSelect}
                    zoom={zoom}
                    stagePos={stagePos}
                />
            ))}
        </div>
    );
}
