'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Circle, Text, Group, Line } from 'react-konva';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { usePresence } from '../../hooks/usePresence';
import { useSpatialAudio } from '../../hooks/useSpatialAudio';
import { UserAvatar } from './UserAvatar';
import { MiniMap } from './MiniMap';
import { RoomEditor } from './RoomEditor';
import { FurnitureLayer } from './FurnitureLayer';

// Simple pathfinding
interface Node {
    x: number;
    y: number;
}

function findPath(start: { x: number, y: number }, end: { x: number, y: number }): { x: number, y: number }[] {
    // Simple direct path with waypoints for smooth movement
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) / 20;
    const path: { x: number, y: number }[] = [];

    for (let i = 1; i <= steps; i++) {
        path.push({
            x: start.x + (dx * i) / steps,
            y: start.y + (dy * i) / steps
        });
    }

    if (path.length === 0) return [end];
    return path;
}

export function KonvaOffice() {
    const {
        myPosition, setMyPosition, peers, rooms,
        zoom, setZoom, setStagePos, setMyRoom,
        isMicEnabled, isVideoEnabled, isSpeaking, localStream,
        myProfile, isBuilderMode, furnitureItems
    } = useOfficeStore();
    const stageRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hasInitializedRef = useRef(false);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const { stagePos } = useOfficeStore();
    const [targetPos, setTargetPos] = useState<{ x: number, y: number } | null>(null);
    const pathRef = useRef<{ x: number, y: number }[]>([]);
    const animationRef = useRef<number | null>(null);
    const isMovingRef = useRef(false);

    // Initialize presence and spatial audio
    usePresence();
    useSpatialAudio();

    // Use ResizeObserver to measure the actual container size
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions({ width, height });
            }
        });
        observer.observe(container);

        return () => observer.disconnect();
    }, []);

    // Center stage on user position at first render
    useEffect(() => {
        if (dimensions.width > 0 && dimensions.height > 0 && !hasInitializedRef.current) {
            const newPos = {
                x: dimensions.width / 2 - myPosition.x * zoom,
                y: dimensions.height / 2 - myPosition.y * zoom,
            };
            setStagePos(newPos);
            hasInitializedRef.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dimensions.width, dimensions.height]);

    // Smooth movement animation
    useEffect(() => {
        if (pathRef.current.length === 0) {
            isMovingRef.current = false;
            return;
        }

        isMovingRef.current = true;
        const speed = 6;

        const animate = () => {
            if (pathRef.current.length === 0) {
                isMovingRef.current = false;
                setTargetPos(null);
                return;
            }

            const current = pathRef.current[0];
            const dx = current.x - myPosition.x;
            const dy = current.y - myPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < speed) {
                // Reached waypoint
                const newPos = { ...current };
                pathRef.current.shift();
                setMyPosition(newPos);

                // Check room
                let currentRoomId = undefined;
                rooms.forEach(room => {
                    if (
                        newPos.x >= room.x &&
                        newPos.x <= room.x + room.width &&
                        newPos.y >= room.y &&
                        newPos.y <= room.y + room.height
                    ) {
                        currentRoomId = room.id;
                    }
                });
                setMyRoom(currentRoomId);
            } else {
                // Move towards waypoint
                const newPos = {
                    x: myPosition.x + (dx / distance) * speed,
                    y: myPosition.y + (dy / distance) * speed
                };
                setMyPosition(newPos);

                // Check room
                let currentRoomId = undefined;
                rooms.forEach(room => {
                    if (
                        newPos.x >= room.x &&
                        newPos.x <= room.x + room.width &&
                        newPos.y >= room.y &&
                        newPos.y <= room.y + room.height
                    ) {
                        currentRoomId = room.id;
                    }
                });
                setMyRoom(currentRoomId);
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myPosition.x, myPosition.y, pathRef.current?.length]);

    const handleStageClick = useCallback((e: any) => {
        // Prevent default to avoid any bubbling issues
        e.evt.preventDefault();
        e.evt.stopPropagation();

        const stage = stageRef.current;
        if (!stage || isMovingRef.current) return;

        // In builder mode, clicking empty space deselects the room
        if (isBuilderMode) {
            useOfficeStore.getState().setSelectedRoom(null);
            return;
        }

        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        // Convert to world coordinates
        const worldX = (pointer.x - stage.x()) / zoom;
        const worldY = (pointer.y - stage.y()) / zoom;

        // Set target and calculate path
        setTargetPos({ x: worldX, y: worldY });
        pathRef.current = findPath(myPosition, { x: worldX, y: worldY });
    }, [myPosition, zoom, isBuilderMode]);

    const handleWheel = (e: any) => {
        e.evt.preventDefault();
        const scaleBy = 1.1;
        const stage = stageRef.current;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
        stage.scale({ x: newScale, y: newScale });

        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        stage.position(newPos);
        setZoom(newScale);
        setStagePos(newPos);
    };

    const handleDragMove = (e: any) => {
        const newPos = { x: e.target.x(), y: e.target.y() };
        setStagePos(newPos);
    };

    const getScreenPos = (pos: { x: number, y: number }) => ({
        x: pos.x * zoom + stagePos.x,
        y: pos.y * zoom + stagePos.y
    });

    // Helper: zoom the Konva stage around the center of the viewport
    const zoomAroundCenter = useCallback((newScale: number) => {
        const stage = stageRef.current;
        if (!stage || !containerRef.current) return;

        const { clientWidth, clientHeight } = containerRef.current;
        const centerX = clientWidth / 2;
        const centerY = clientHeight / 2;

        const oldScale = stage.scaleX();
        const mousePointTo = {
            x: (centerX - stage.x()) / oldScale,
            y: (centerY - stage.y()) / oldScale,
        };

        const clampedScale = Math.max(0.3, Math.min(3, newScale));
        stage.scale({ x: clampedScale, y: clampedScale });

        const newPos = {
            x: centerX - mousePointTo.x * clampedScale,
            y: centerY - mousePointTo.y * clampedScale,
        };
        stage.position(newPos);
        setZoom(clampedScale);
        setStagePos(newPos);
    }, [setZoom, setStagePos]);

    // Handle all MiniMap events
    useEffect(() => {
        const handleCenterOnMe = () => {
            if (containerRef.current && stageRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                const currentZoom = stageRef.current.scaleX();
                const newPos = {
                    x: clientWidth / 2 - myPosition.x * currentZoom,
                    y: clientHeight / 2 - myPosition.y * currentZoom,
                };
                stageRef.current.position(newPos);
                setStagePos(newPos);
            }
        };

        const handleZoomIn = () => {
            const stage = stageRef.current;
            if (!stage) return;
            zoomAroundCenter(stage.scaleX() * 1.15);
        };

        const handleZoomOut = () => {
            const stage = stageRef.current;
            if (!stage) return;
            zoomAroundCenter(stage.scaleX() / 1.15);
        };

        const handleZoomReset = () => {
            zoomAroundCenter(1);
        };

        const handleNavigate = (e: Event) => {
            const { x, y } = (e as CustomEvent).detail;
            if (containerRef.current && stageRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                const currentZoom = stageRef.current.scaleX();
                const newPos = {
                    x: clientWidth / 2 - x * currentZoom,
                    y: clientHeight / 2 - y * currentZoom,
                };
                stageRef.current.position(newPos);
                setStagePos(newPos);
            }
        };

        window.addEventListener('center-on-me', handleCenterOnMe);
        window.addEventListener('minimap-zoom-in', handleZoomIn);
        window.addEventListener('minimap-zoom-out', handleZoomOut);
        window.addEventListener('minimap-zoom-reset', handleZoomReset);
        window.addEventListener('minimap-navigate', handleNavigate);
        return () => {
            window.removeEventListener('center-on-me', handleCenterOnMe);
            window.removeEventListener('minimap-zoom-in', handleZoomIn);
            window.removeEventListener('minimap-zoom-out', handleZoomOut);
            window.removeEventListener('minimap-zoom-reset', handleZoomReset);
            window.removeEventListener('minimap-navigate', handleNavigate);
        };
    }, [myPosition, zoomAroundCenter, setStagePos]);

    return (
        <div ref={containerRef} className="w-full h-full bg-[#080e1e] overflow-hidden relative">
            {/* Mini Map */}
            <MiniMap />

            {dimensions.width > 0 && dimensions.height > 0 && (
                <>
                    <Stage
                        width={dimensions.width}
                        height={dimensions.height}
                        ref={stageRef}
                        onWheel={handleWheel}
                        onDragMove={handleDragMove}
                        onClick={handleStageClick}
                        draggable
                    >
                        <Layer>
                            {/* Background Grid — subtle dot matrix */}
                            {Array.from({ length: 40 }).map((_, i) =>
                                Array.from({ length: 40 }).map((_, j) => (
                                    <Circle
                                        key={`dot-${i}-${j}`}
                                        x={i * 80}
                                        y={j * 80}
                                        radius={1.2}
                                        fill="#1e293b"
                                        opacity={0.5}
                                    />
                                ))
                            )}
                            {/* Axis crosshair lines */}
                            <Rect x={0} y={-0.5} width={3200} height={1} fill="#1e293b" opacity={0.3} />
                            <Rect x={-0.5} y={0} width={1} height={3200} fill="#1e293b" opacity={0.3} />

                            {/* Rooms */}
                            {isBuilderMode ? (
                                <RoomEditor rooms={rooms} />
                            ) : (
                                <>
                                    {rooms.map((room: any) => {
                                        const roomColor = room?.settings?.color || (room as any).color || '#3b82f6';
                                        const deptLabel = room?.settings?.department || (room as any).department;
                                        const cap = (room as any).capacity || room.settings?.capacity;

                                        return (
                                            <Group key={room.id} x={room.x} y={room.y}>

                                                {/* ═══ LAYER 1: HUGE AMBIENT GLOW ═══ */}
                                                <Rect
                                                    x={-20} y={-20}
                                                    width={room.width + 40} height={room.height + 40}
                                                    fill="transparent"
                                                    shadowColor={roomColor}
                                                    shadowBlur={60}
                                                    shadowOpacity={0.55}
                                                    cornerRadius={24}
                                                />

                                                {/* ═══ LAYER 2: DARK BASE (depth) ═══ */}
                                                <Rect
                                                    width={room.width} height={room.height}
                                                    fill="#0f172a"
                                                    opacity={0.85}
                                                    cornerRadius={14}
                                                />

                                                {/* ═══ LAYER 3: VIVID COLOR FILL ═══ */}
                                                <Rect
                                                    width={room.width} height={room.height}
                                                    fill={roomColor}
                                                    opacity={0.4}
                                                    cornerRadius={14}
                                                />

                                                {/* ═══ LAYER 4: BRIGHT BORDER ═══ */}
                                                <Rect
                                                    width={room.width} height={room.height}
                                                    fill="transparent"
                                                    stroke={roomColor}
                                                    strokeWidth={2.5}
                                                    cornerRadius={14}
                                                    opacity={0.85}
                                                />

                                                {/* ═══ HEADER BAR — 8px tall vivid stripe ═══ */}
                                                <Rect
                                                    x={0} y={0}
                                                    width={room.width} height={8}
                                                    fill={roomColor}
                                                    cornerRadius={[14, 14, 0, 0]}
                                                />

                                                {/* ═══ INNER HIGHLIGHT — horizontal band ═══ */}
                                                <Rect
                                                    x={8} y={12}
                                                    width={room.width - 16} height={2}
                                                    fill="white" opacity={0.15}
                                                    cornerRadius={1}
                                                />
                                                <Rect
                                                    x={8} y={16}
                                                    width={room.width * 0.35} height={1}
                                                    fill="white" opacity={0.08}
                                                    cornerRadius={1}
                                                />

                                                {/* ═══ BOTTOM ACCENT — color reflection ═══ */}
                                                <Rect
                                                    x={0} y={room.height - 3}
                                                    width={room.width} height={3}
                                                    fill={roomColor} opacity={0.6}
                                                    cornerRadius={[0, 0, 14, 14]}
                                                />

                                                {/* ═══ INNER GRID PATTERN ═══ */}
                                                {Array.from({ length: Math.floor(room.width / 40) }).map((_, gi) => (
                                                    <Rect key={`gv-${gi}`} x={(gi + 1) * 40} y={8} width={1} height={room.height - 11} fill={roomColor} opacity={0.06} />
                                                ))}
                                                {Array.from({ length: Math.floor(room.height / 40) }).map((_, gi) => (
                                                    <Rect key={`gh-${gi}`} x={0} y={(gi + 1) * 40} width={room.width} height={1} fill={roomColor} opacity={0.06} />
                                                ))}

                                                {/* ═══ CORNER GLOW DOTS ═══ */}
                                                <Circle x={6} y={6} radius={3} fill={roomColor} opacity={0.8} />
                                                <Circle x={room.width - 6} y={6} radius={3} fill={roomColor} opacity={0.8} />
                                                <Circle x={6} y={room.height - 6} radius={3} fill={roomColor} opacity={0.5} />
                                                <Circle x={room.width - 6} y={room.height - 6} radius={3} fill={roomColor} opacity={0.5} />

                                                {/* ═══ ROOM NAME — BOLD FLOATING PILL ═══ */}
                                                <Rect
                                                    x={0} y={-36}
                                                    width={Math.max((room.name?.length || 4) * 9 + 32, 100)}
                                                    height={30}
                                                    fill={roomColor}
                                                    cornerRadius={15}
                                                    shadowColor={roomColor}
                                                    shadowBlur={20}
                                                    shadowOpacity={0.5}
                                                />
                                                <Text
                                                    text={room.name || 'Room'}
                                                    fontSize={13}
                                                    fill="#ffffff"
                                                    x={16} y={-28}
                                                    fontStyle="bold"
                                                    fontFamily="Inter, system-ui, sans-serif"
                                                />

                                                {/* ═══ DEPARTMENT BADGE ═══ */}
                                                {deptLabel && (
                                                    <>
                                                        <Rect
                                                            x={room.width - deptLabel.length * 7 - 26} y={-34}
                                                            width={deptLabel.length * 7 + 22} height={26}
                                                            fill="rgba(255,255,255,0.18)" cornerRadius={13}
                                                        />
                                                        <Text
                                                            text={deptLabel} fontSize={10} fill="#ffffff"
                                                            x={room.width - deptLabel.length * 7 - 15} y={-27}
                                                            fontFamily="Inter, system-ui, sans-serif" fontStyle="700"
                                                        />
                                                    </>
                                                )}

                                                {/* ═══ CAPACITY BADGE — solid circle ═══ */}
                                                {cap && (
                                                    <>
                                                        {/* Glow behind */}
                                                        <Circle x={room.width - 22} y={room.height - 22} radius={18}
                                                            fill="transparent" shadowColor={roomColor} shadowBlur={15} shadowOpacity={0.4} />
                                                        {/* Solid bg */}
                                                        <Circle x={room.width - 22} y={room.height - 22} radius={16}
                                                            fill={roomColor} opacity={0.5} />
                                                        {/* Ring */}
                                                        <Circle x={room.width - 22} y={room.height - 22} radius={16}
                                                            fill="transparent" stroke={roomColor} strokeWidth={2} opacity={0.9} />
                                                        {/* Number */}
                                                        <Text
                                                            text={`${cap}`} fontSize={12} fill="#ffffff"
                                                            x={room.width - 22 - (String(cap).length * 4)} y={room.height - 28}
                                                            fontStyle="bold" fontFamily="Inter, system-ui, sans-serif"
                                                        />
                                                    </>
                                                )}

                                                {/* ═══ EDGE CONNECTION DOTS ═══ */}
                                                <Circle x={room.width / 2} y={0} radius={4.5} fill={roomColor} opacity={0.85}
                                                    shadowColor={roomColor} shadowBlur={8} shadowOpacity={0.6} />
                                                <Circle x={room.width / 2} y={room.height} radius={4.5} fill={roomColor} opacity={0.85}
                                                    shadowColor={roomColor} shadowBlur={8} shadowOpacity={0.6} />
                                                <Circle x={0} y={room.height / 2} radius={4.5} fill={roomColor} opacity={0.85}
                                                    shadowColor={roomColor} shadowBlur={8} shadowOpacity={0.6} />
                                                <Circle x={room.width} y={room.height / 2} radius={4.5} fill={roomColor} opacity={0.85}
                                                    shadowColor={roomColor} shadowBlur={8} shadowOpacity={0.6} />
                                            </Group>
                                        );
                                    })}
                                </>
                            )}

                            {/* Furniture Layer - always visible */}
                            <FurnitureLayer />

                            {/* Target indicator */}
                            {targetPos && (
                                <>
                                    <Circle
                                        x={targetPos.x}
                                        y={targetPos.y}
                                        radius={15}
                                        fill="transparent"
                                        stroke="#6366f1"
                                        strokeWidth={2}
                                        dash={[5, 5]}
                                    />
                                    <Circle
                                        x={targetPos.x}
                                        y={targetPos.y}
                                        radius={5}
                                        fill="#6366f1"
                                    />
                                </>
                            )}
                        </Layer>
                    </Stage>

                    {/* Instructions */}
                    <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-4 py-2 rounded-lg text-xs text-slate-400 pointer-events-none z-10">
                        Clicca dove vuoi andare • Trascina per muovere la visuale • Scroll per zoomare
                    </div>

                    {/* Avatars Overlay */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {/* Peers */}
                        {Object.values(peers).map((peer: any) => (
                            <UserAvatar
                                key={peer.id}
                                id={peer.id}
                                fullName={peer.full_name}
                                avatarUrl={peer.avatar_url}
                                status={peer.status}
                                position={getScreenPos(peer.position)}
                                audioEnabled={peer.audioEnabled}
                                videoEnabled={peer.videoEnabled}
                                isSpeaking={peer.isSpeaking}
                            />
                        ))}

                        {/* Me */}
                        <UserAvatar
                            id="me"
                            isMe
                            fullName={myProfile?.full_name || 'You'}
                            avatarUrl={myProfile?.avatar_url}
                            status="online"
                            position={getScreenPos(myPosition)}
                            audioEnabled={isMicEnabled}
                            videoEnabled={isVideoEnabled}
                            isSpeaking={isSpeaking}
                            stream={localStream}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
