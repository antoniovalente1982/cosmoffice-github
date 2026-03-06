'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { createClient } from '../../utils/supabase/client';

const GRID_SIZE = 20;
const HANDLE_SIZE = 12;
const MIN_ROOM_W = 80;
const MIN_ROOM_H = 60;

function snapToGrid(value: number): number {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// ─── Room Color (consistent with PixiOffice) ─────────
import { getRoomColor } from './OfficeBuilder';
import { getRoomEdge } from './PixiRoomLayer';

interface EditableRoomProps {
    room: any;
    isSelected: boolean;
    onSelect: (id: string) => void;
    zoom: number;
    stagePos: { x: number; y: number };
}

function EditableRoom({ room, isSelected, onSelect, zoom, stagePos }: EditableRoomProps) {
    const supabase = createClient();
    const { updateRoomPosition, updateRoomSize, officeWidth, officeHeight } = useWorkspaceStore();
    const [isDragging, setIsDragging] = useState(false);
    const [resizing, setResizing] = useState<string | null>(null);
    const dragRef = useRef({ startX: 0, startY: 0, roomX: 0, roomY: 0, roomW: 0, roomH: 0 });
    const roomIdRef = useRef(room.id);
    roomIdRef.current = room.id;

    const color = getRoomColor(room);

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
    }, [room.id, room.x, room.y, room.width, room.height, onSelect]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMove = (e: MouseEvent) => {
            const { startX, startY, roomX, roomY, roomW } = dragRef.current;
            const dx = (e.clientX - startX) / zoom;
            const dy = (e.clientY - startY) / zoom;
            // No snap during drag — smooth movement
            let newX = Math.round(roomX + dx);
            let newY = Math.round(roomY + dy);
            const maxW = officeWidth || 4000;
            const maxH = officeHeight || 4000;
            newX = Math.max(0, Math.min(newX, maxW - roomW));
            newY = Math.max(0, Math.min(newY, maxH - dragRef.current.roomH));
            updateRoomPosition(roomIdRef.current, newX, newY);
        };

        const handleUp = async (e: MouseEvent) => {
            setIsDragging(false);
            const { startX, startY, roomX, roomY, roomW } = dragRef.current;
            const dx = (e.clientX - startX) / zoom;
            const dy = (e.clientY - startY) / zoom;
            // Snap only on release
            let newX = snapToGrid(roomX + dx);
            let newY = snapToGrid(roomY + dy);
            const maxW = officeWidth || 4000;
            const maxH = officeHeight || 4000;
            newX = Math.max(0, Math.min(newX, maxW - roomW));
            newY = Math.max(0, Math.min(newY, maxH - dragRef.current.roomH));
            updateRoomPosition(roomIdRef.current, newX, newY);
            if (!roomIdRef.current.startsWith('temp_')) {
                await supabase.from('rooms').update({ x: newX, y: newY }).eq('id', roomIdRef.current);
            }
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
        // Only depend on isDragging — refs handle the rest
    }, [isDragging, zoom, updateRoomPosition, officeWidth, officeHeight, supabase]);

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
    }, [room.id, room.x, room.y, room.width, room.height, onSelect]);

    useEffect(() => {
        if (!resizing) return;

        const handleMove = (e: MouseEvent) => {
            const { startX, startY, roomX, roomY, roomW, roomH } = dragRef.current;
            const dx = (e.clientX - startX) / zoom;
            const dy = (e.clientY - startY) / zoom;
            let newX = roomX, newY = roomY, newW = roomW, newH = roomH;

            if (resizing.includes('right')) newW = Math.round(Math.max(MIN_ROOM_W, roomW + dx));
            if (resizing.includes('bottom')) newH = Math.round(Math.max(MIN_ROOM_H, roomH + dy));
            if (resizing.includes('left')) {
                const d = Math.round(dx);
                newX = Math.max(0, roomX + d);
                newW = Math.max(MIN_ROOM_W, roomW - d);
            }
            if (resizing.includes('top')) {
                const d = Math.round(dy);
                newY = Math.max(0, roomY + d);
                newH = Math.max(MIN_ROOM_H, roomH - d);
            }

            if (newX + newW > (officeWidth || 4000)) newW = (officeWidth || 4000) - newX;
            if (newY + newH > (officeHeight || 4000)) newH = (officeHeight || 4000) - newY;

            updateRoomPosition(roomIdRef.current, newX, newY);
            updateRoomSize(roomIdRef.current, newW, newH);
        };

        const handleUp = async () => {
            setResizing(null);
            // Snap to grid on release
            const state = useWorkspaceStore.getState();
            const r = state.rooms.find((rm: any) => rm.id === roomIdRef.current);
            if (r) {
                const snappedX = snapToGrid(r.x);
                const snappedY = snapToGrid(r.y);
                const snappedW = snapToGrid(r.width);
                const snappedH = snapToGrid(r.height);
                updateRoomPosition(roomIdRef.current, snappedX, snappedY);
                updateRoomSize(roomIdRef.current, snappedW, snappedH);
                if (!roomIdRef.current.startsWith('temp_')) {
                    await supabase.from('rooms').update({
                        x: snappedX, y: snappedY, width: snappedW, height: snappedH,
                    }).eq('id', roomIdRef.current);
                }
            }
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
        // Only depend on resizing — refs handle the rest
    }, [resizing, zoom, updateRoomPosition, updateRoomSize, officeWidth, officeHeight, supabase]);

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
                data-room-editor="true"
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
                    data-room-editor="true"
                />
            ))}
        </>
    );
}

interface RoomEditorProps {
    rooms: any[];
}

export function RoomEditor({ rooms }: RoomEditorProps) {
    const { selectedRoomId, selectedRoomIds, setSelectedRoom, setSelectedRoomIds, zoom, stagePos } = useWorkspaceStore();
    const supabase = createClient();
    const containerRef = useRef<HTMLDivElement>(null);

    // Marquee selection state (container-relative coordinates)
    const [marquee, setMarquee] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
    const marqueeRef = useRef<{ startX: number; startY: number; containerLeft: number; containerTop: number } | null>(null);

    const handleSelect = useCallback((id: string) => {
        setSelectedRoom(id);
        setSelectedRoomIds(new Set<string>());
        window.dispatchEvent(new CustomEvent('builder-select-room', { detail: { roomId: id } }));
    }, [setSelectedRoom, setSelectedRoomIds]);

    // Marquee: start on background mousedown
    const handleBgMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).dataset.roomEditor) return;
        e.preventDefault();
        const rect = containerRef.current?.getBoundingClientRect();
        const offsetX = rect ? rect.left : 0;
        const offsetY = rect ? rect.top : 0;
        const relX = e.clientX - offsetX;
        const relY = e.clientY - offsetY;
        marqueeRef.current = { startX: relX, startY: relY, containerLeft: offsetX, containerTop: offsetY };
        setMarquee({ startX: relX, startY: relY, endX: relX, endY: relY });
        setSelectedRoom(null);
        setSelectedRoomIds(new Set<string>());
    }, [setSelectedRoom, setSelectedRoomIds]);

    useEffect(() => {
        if (!marqueeRef.current) return;

        const handleMove = (e: MouseEvent) => {
            if (!marqueeRef.current) return;
            const relX = e.clientX - marqueeRef.current.containerLeft;
            const relY = e.clientY - marqueeRef.current.containerTop;
            setMarquee({
                startX: marqueeRef.current.startX,
                startY: marqueeRef.current.startY,
                endX: relX,
                endY: relY,
            });
        };

        const handleUp = (e: MouseEvent) => {
            if (!marqueeRef.current) return;
            const { startX, startY, containerLeft, containerTop } = marqueeRef.current;
            const endX = e.clientX - containerLeft;
            const endY = e.clientY - containerTop;

            const selLeft = Math.min(startX, endX);
            const selRight = Math.max(startX, endX);
            const selTop = Math.min(startY, endY);
            const selBottom = Math.max(startY, endY);

            if (Math.abs(endX - startX) > 5 || Math.abs(endY - startY) > 5) {
                const selected = new Set<string>();
                const state = useWorkspaceStore.getState();
                for (const room of rooms) {
                    const roomScreenX = room.x * state.zoom + state.stagePos.x;
                    const roomScreenY = room.y * state.zoom + state.stagePos.y;
                    const roomScreenW = room.width * state.zoom;
                    const roomScreenH = room.height * state.zoom;

                    if (
                        roomScreenX + roomScreenW > selLeft &&
                        roomScreenX < selRight &&
                        roomScreenY + roomScreenH > selTop &&
                        roomScreenY < selBottom
                    ) {
                        selected.add(room.id);
                    }
                }
                setSelectedRoomIds(selected);
            }

            marqueeRef.current = null;
            setMarquee(null);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [marquee, rooms, setSelectedRoomIds]);

    // Compute marquee rect for rendering (container-relative)
    const marqueeRect = marquee ? {
        left: Math.min(marquee.startX, marquee.endX),
        top: Math.min(marquee.startY, marquee.endY),
        width: Math.abs(marquee.endX - marquee.startX),
        height: Math.abs(marquee.endY - marquee.startY),
    } : null;

    // ─── Multi-select actions ────────────────────────────
    const selectedRooms = rooms.filter(r => selectedRoomIds.has(r.id));

    const handleDeleteSelected = useCallback(async () => {
        const state = useWorkspaceStore.getState();
        const ids = Array.from(state.selectedRoomIds);
        if (ids.length === 0) return;
        for (const id of ids) {
            if (!id.startsWith('temp_')) {
                await supabase.from('rooms').delete().eq('id', id);
            }
        }
        state.setRooms(state.rooms.filter((r: any) => !state.selectedRoomIds.has(r.id)));
        state.setSelectedRoomIds(new Set<string>());
    }, [supabase]);

    const handleDuplicateSelected = useCallback(async () => {
        const state = useWorkspaceStore.getState();
        const ids = Array.from(state.selectedRoomIds);
        if (ids.length === 0) return;
        const newRooms: any[] = [];
        for (const id of ids) {
            const room = state.rooms.find((r: any) => r.id === id);
            if (!room) continue;
            const { data } = await supabase.from('rooms').insert({
                space_id: room.space_id,
                name: room.name + ' (copia)',
                type: room.type,
                x: room.x + 40,
                y: room.y + 40,
                width: room.width,
                height: room.height,
                color: (room as any).color ?? room.settings?.color,
                shape: room.shape,
                settings: room.settings,
            }).select().single();
            if (data) newRooms.push(data);
        }
        if (newRooms.length > 0) {
            state.setRooms([...state.rooms, ...newRooms]);
        }
    }, [supabase]);

    const handleAlignLeft = useCallback(async () => {
        const state = useWorkspaceStore.getState();
        if (selectedRooms.length < 2) return;
        const minX = Math.min(...selectedRooms.map(r => r.x));
        for (const room of selectedRooms) {
            state.updateRoomPosition(room.id, minX, room.y);
            if (!room.id.startsWith('temp_')) {
                await supabase.from('rooms').update({ x: minX }).eq('id', room.id);
            }
        }
    }, [selectedRooms, supabase]);

    const handleAlignTop = useCallback(async () => {
        const state = useWorkspaceStore.getState();
        if (selectedRooms.length < 2) return;
        const minY = Math.min(...selectedRooms.map(r => r.y));
        for (const room of selectedRooms) {
            state.updateRoomPosition(room.id, room.x, minY);
            if (!room.id.startsWith('temp_')) {
                await supabase.from('rooms').update({ y: minY }).eq('id', room.id);
            }
        }
    }, [selectedRooms, supabase]);

    const handleDistributeH = useCallback(async () => {
        const state = useWorkspaceStore.getState();
        if (selectedRooms.length < 3) return;
        const sorted = [...selectedRooms].sort((a, b) => a.x - b.x);
        const first = sorted[0].x;
        const last = sorted[sorted.length - 1].x;
        const gap = (last - first) / (sorted.length - 1);
        for (let i = 0; i < sorted.length; i++) {
            const newX = Math.round(first + gap * i);
            state.updateRoomPosition(sorted[i].id, newX, sorted[i].y);
            if (!sorted[i].id.startsWith('temp_')) {
                await supabase.from('rooms').update({ x: newX }).eq('id', sorted[i].id);
            }
        }
    }, [selectedRooms, supabase]);

    const handleDistributeV = useCallback(async () => {
        const state = useWorkspaceStore.getState();
        if (selectedRooms.length < 3) return;
        const sorted = [...selectedRooms].sort((a, b) => a.y - b.y);
        const first = sorted[0].y;
        const last = sorted[sorted.length - 1].y;
        const gap = (last - first) / (sorted.length - 1);
        for (let i = 0; i < sorted.length; i++) {
            const newY = Math.round(first + gap * i);
            state.updateRoomPosition(sorted[i].id, sorted[i].x, newY);
            if (!sorted[i].id.startsWith('temp_')) {
                await supabase.from('rooms').update({ y: newY }).eq('id', sorted[i].id);
            }
        }
    }, [selectedRooms, supabase]);

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 z-[4]"
            style={{ pointerEvents: 'auto', cursor: 'crosshair' }}
            onMouseDown={handleBgMouseDown}
        >
            {rooms.map(room => (
                <EditableRoom
                    key={room.id}
                    room={room}
                    isSelected={selectedRoomId === room.id || selectedRoomIds.has(room.id)}
                    onSelect={handleSelect}
                    zoom={zoom}
                    stagePos={stagePos}
                />
            ))}

            {/* Marquee selection rectangle (container-relative) */}
            {marqueeRect && marqueeRect.width > 2 && (
                <div
                    style={{
                        position: 'absolute',
                        left: marqueeRect.left,
                        top: marqueeRect.top,
                        width: marqueeRect.width,
                        height: marqueeRect.height,
                        border: '2px dashed rgba(34, 211, 238, 0.8)',
                        background: 'rgba(34, 211, 238, 0.08)',
                        borderRadius: 4,
                        pointerEvents: 'none',
                        zIndex: 100,
                    }}
                />
            )}

            {/* Multi-select action toolbar */}
            {selectedRoomIds.size > 0 && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 32,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 200,
                        pointerEvents: 'auto',
                    }}
                >
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl shadow-2xl border border-white/10"
                        style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(20px)' }}>
                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mr-2">
                            {selectedRoomIds.size} sel.
                        </span>

                        <button onClick={handleDeleteSelected}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold text-red-300 bg-red-500/10 border border-red-500/20 hover:bg-red-500/25 hover:border-red-500/40 transition-all"
                            title="Elimina selezionate"
                        >🗑️ Elimina</button>

                        <button onClick={handleDuplicateSelected}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/25 hover:border-emerald-500/40 transition-all"
                            title="Duplica selezionate"
                        >📋 Duplica</button>

                        <div className="w-px h-5 bg-white/10 mx-1" />

                        <button onClick={handleAlignLeft}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/25 hover:border-indigo-500/40 transition-all"
                            title="Allinea a sinistra"
                        >⬅️ Allinea SX</button>

                        <button onClick={handleAlignTop}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/25 hover:border-indigo-500/40 transition-all"
                            title="Allinea in alto"
                        >⬆️ Allinea Top</button>

                        <div className="w-px h-5 bg-white/10 mx-1" />

                        <button onClick={handleDistributeH}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/25 hover:border-amber-500/40 transition-all"
                            title="Distribuisci orizzontalmente"
                        >↔️ Distrib. H</button>

                        <button onClick={handleDistributeV}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/25 hover:border-amber-500/40 transition-all"
                            title="Distribuisci verticalmente"
                        >↕️ Distrib. V</button>
                    </div>
                </div>
            )}

            {/* Connection endpoint drag handles */}
            <ConnectionEndpointHandles rooms={rooms} zoom={zoom} stagePos={stagePos} />
        </div>
    );
}

// ─── Draggable connection endpoints ─────────────────────
function ConnectionEndpointHandles({ rooms, zoom, stagePos }: { rooms: any[]; zoom: number; stagePos: { x: number; y: number } }) {
    const supabase = createClient();
    const roomConnections = useWorkspaceStore(s => s.roomConnections);
    const setRoomConnections = useWorkspaceStore(s => s.setRoomConnections);
    const [dragging, setDragging] = useState<{ connId: string; side: 'a' | 'b'; cursorX: number; cursorY: number } | null>(null);

    const handleEndpointDown = useCallback((connId: string, side: 'a' | 'b', e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setDragging({ connId, side, cursorX: e.clientX, cursorY: e.clientY });
    }, []);

    const handleDeleteConn = useCallback(async (connId: string) => {
        await supabase.from('room_connections').delete().eq('id', connId);
        const state = useWorkspaceStore.getState();
        setRoomConnections(state.roomConnections.filter((c: any) => c.id !== connId));
    }, [supabase, setRoomConnections]);

    useEffect(() => {
        if (!dragging) return;

        const handleMove = (e: MouseEvent) => {
            setDragging(prev => prev ? { ...prev, cursorX: e.clientX, cursorY: e.clientY } : null);
        };

        const handleUp = async (e: MouseEvent) => {
            if (!dragging) return;
            const { connId, side } = dragging;

            // Convert screen coords to world coords
            const state = useWorkspaceStore.getState();
            const worldX = (e.clientX - state.stagePos.x) / state.zoom;
            const worldY = (e.clientY - state.stagePos.y) / state.zoom;

            // Find which room the cursor is over
            let targetRoom: any = null;
            for (const room of rooms) {
                if (
                    worldX >= room.x && worldX <= room.x + room.width &&
                    worldY >= room.y && worldY <= room.y + room.height
                ) {
                    targetRoom = room;
                    break;
                }
            }

            if (targetRoom) {
                const conn = state.roomConnections.find((c: any) => c.id === connId);
                if (conn) {
                    const currentRoomId = side === 'a' ? conn.room_a_id : conn.room_b_id;
                    const otherRoomId = side === 'a' ? conn.room_b_id : conn.room_a_id;

                    // Only update if target is different and not the same as other side
                    if (targetRoom.id !== currentRoomId && targetRoom.id !== otherRoomId) {
                        const updateField = side === 'a' ? 'room_a_id' : 'room_b_id';
                        await supabase.from('room_connections').update({ [updateField]: targetRoom.id }).eq('id', connId);

                        // Update local state
                        const updated = state.roomConnections.map((c: any) =>
                            c.id === connId ? { ...c, [updateField]: targetRoom.id } : c
                        );
                        setRoomConnections(updated);
                    }
                }
            }

            setDragging(null);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [dragging, rooms, supabase, setRoomConnections]);

    return (
        <>
            {roomConnections.map((conn: any) => {
                const roomA = rooms.find((r: any) => r.id === conn.room_a_id);
                const roomB = rooms.find((r: any) => r.id === conn.room_b_id);
                if (!roomA || !roomB) return null;

                const cxA = roomA.x + roomA.width / 2;
                const cyA = roomA.y + roomA.height / 2;
                const cxB = roomB.x + roomB.width / 2;
                const cyB = roomB.y + roomB.height / 2;

                const edgeA = getRoomEdge(roomA, cxB, cyB);
                const edgeB = getRoomEdge(roomB, cxA, cyA);

                const screenAx = edgeA.x * zoom + stagePos.x;
                const screenAy = edgeA.y * zoom + stagePos.y;
                const screenBx = edgeB.x * zoom + stagePos.x;
                const screenBy = edgeB.y * zoom + stagePos.y;

                const handleSize = 16;

                return (
                    <React.Fragment key={conn.id}>
                        {/* Endpoint A handle */}
                        <div
                            data-room-editor="true"
                            style={{
                                position: 'absolute',
                                left: screenAx - handleSize / 2,
                                top: screenAy - handleSize / 2,
                                width: handleSize,
                                height: handleSize,
                                borderRadius: '50%',
                                background: 'rgba(52, 211, 153, 0.9)',
                                border: '2px solid rgba(255,255,255,0.9)',
                                cursor: 'grab',
                                zIndex: 30,
                                pointerEvents: 'auto',
                                boxShadow: '0 0 12px rgba(52,211,153,0.6)',
                            }}
                            onMouseDown={(e) => handleEndpointDown(conn.id, 'a', e)}
                        />
                        {/* Endpoint B handle */}
                        <div
                            data-room-editor="true"
                            style={{
                                position: 'absolute',
                                left: screenBx - handleSize / 2,
                                top: screenBy - handleSize / 2,
                                width: handleSize,
                                height: handleSize,
                                borderRadius: '50%',
                                background: 'rgba(52, 211, 153, 0.9)',
                                border: '2px solid rgba(255,255,255,0.9)',
                                cursor: 'grab',
                                zIndex: 30,
                                pointerEvents: 'auto',
                                boxShadow: '0 0 12px rgba(52,211,153,0.6)',
                            }}
                            onMouseDown={(e) => handleEndpointDown(conn.id, 'b', e)}
                        />

                        {/* Delete connection button at midpoint */}
                        <div
                            data-room-editor="true"
                            onClick={(e) => { e.stopPropagation(); handleDeleteConn(conn.id); }}
                            style={{
                                position: 'absolute',
                                left: (screenAx + screenBx) / 2 - 10,
                                top: (screenAy + screenBy) / 2 - 10,
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                background: 'rgba(239, 68, 68, 0.9)',
                                border: '2px solid rgba(255,255,255,0.9)',
                                cursor: 'pointer',
                                zIndex: 35,
                                pointerEvents: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 0 10px rgba(239,68,68,0.6)',
                                fontSize: 11,
                                fontWeight: 'bold',
                                color: 'white',
                                lineHeight: 1,
                            }}
                            title="Elimina connessione"
                        >✕</div>
                    </React.Fragment>
                );
            })}

            {/* Drag preview line */}
            {dragging && (() => {
                const conn = roomConnections.find((c: any) => c.id === dragging.connId);
                if (!conn) return null;
                const otherRoomId = dragging.side === 'a' ? conn.room_b_id : conn.room_a_id;
                const otherRoom = rooms.find((r: any) => r.id === otherRoomId);
                if (!otherRoom) return null;

                const otherCx = otherRoom.x * zoom + stagePos.x + (otherRoom.width * zoom) / 2;
                const otherCy = otherRoom.y * zoom + stagePos.y + (otherRoom.height * zoom) / 2;

                return (
                    <svg
                        style={{ position: 'fixed', inset: 0, zIndex: 50, pointerEvents: 'none' }}
                        width="100%" height="100%"
                    >
                        <line
                            x1={otherCx} y1={otherCy}
                            x2={dragging.cursorX} y2={dragging.cursorY}
                            stroke="rgba(52, 211, 153, 0.8)"
                            strokeWidth={3}
                            strokeDasharray="8 4"
                        />
                        <circle cx={dragging.cursorX} cy={dragging.cursorY} r={8} fill="rgba(52, 211, 153, 0.9)" stroke="white" strokeWidth={2} />
                    </svg>
                );
            })()}
        </>
    );
}
