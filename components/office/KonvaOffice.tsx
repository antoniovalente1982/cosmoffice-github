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
                                        const roomColor = (room as any).color || '#3b82f6';
                                        const deptLabel = (room as any).department;
                                        const cap = (room as any).capacity || room.settings?.capacity;

                                        return (
                                            <Group key={room.id} x={room.x} y={room.y}>
                                                {/* Outer glow — vivid colored shadow */}
                                                <Rect
                                                    x={-8}
                                                    y={-8}
                                                    width={room.width + 16}
                                                    height={room.height + 16}
                                                    fill="transparent"
                                                    shadowColor={roomColor}
                                                    shadowBlur={40}
                                                    shadowOpacity={0.35}
                                                    cornerRadius={18}
                                                />

                                                {/* Room body — vivid fill */}
                                                <Rect
                                                    width={room.width}
                                                    height={room.height}
                                                    fill={roomColor}
                                                    opacity={0.22}
                                                    cornerRadius={16}
                                                />
                                                {/* Border — bright and visible */}
                                                <Rect
                                                    width={room.width}
                                                    height={room.height}
                                                    fill="transparent"
                                                    stroke={roomColor}
                                                    strokeWidth={2}
                                                    cornerRadius={16}
                                                    opacity={0.6}
                                                />

                                                {/* Top accent bar — vivid colored strip */}
                                                <Rect
                                                    x={0}
                                                    y={0}
                                                    width={room.width}
                                                    height={4}
                                                    fill={roomColor}
                                                    opacity={0.8}
                                                    cornerRadius={[16, 16, 0, 0]}
                                                />

                                                {/* Glass highlight — top edge shimmer */}
                                                <Rect
                                                    x={10}
                                                    y={6}
                                                    width={room.width * 0.4}
                                                    height={1}
                                                    fill="white"
                                                    opacity={0.1}
                                                    cornerRadius={1}
                                                />

                                                {/* Floor pattern — subtle grid */}
                                                {Array.from({ length: Math.floor(room.width / 50) }).map((_, gi) => (
                                                    <Rect key={`fg-v-${gi}`} x={(gi + 1) * 50} y={4} width={0.5} height={room.height - 4} fill={roomColor} opacity={0.06} />
                                                ))}
                                                {Array.from({ length: Math.floor(room.height / 50) }).map((_, gi) => (
                                                    <Rect key={`fg-h-${gi}`} x={0} y={(gi + 1) * 50} width={room.width} height={0.5} fill={roomColor} opacity={0.06} />
                                                ))}

                                                {/* Corner accents — little bright dots at corners */}
                                                <Circle x={3} y={3} radius={2} fill={roomColor} opacity={0.5} />
                                                <Circle x={room.width - 3} y={3} radius={2} fill={roomColor} opacity={0.5} />
                                                <Circle x={3} y={room.height - 3} radius={2} fill={roomColor} opacity={0.3} />
                                                <Circle x={room.width - 3} y={room.height - 3} radius={2} fill={roomColor} opacity={0.3} />

                                                {/* Room name — floating pill */}
                                                <Rect
                                                    x={0}
                                                    y={-32}
                                                    width={Math.max((room.name?.length || 4) * 7.5 + 28, 80)}
                                                    height={26}
                                                    fill={roomColor}
                                                    opacity={0.85}
                                                    cornerRadius={13}
                                                    shadowColor={roomColor}
                                                    shadowBlur={12}
                                                    shadowOpacity={0.3}
                                                />
                                                <Text
                                                    text={room.name || 'Room'}
                                                    fontSize={11}
                                                    fill="#ffffff"
                                                    x={14}
                                                    y={-25}
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
                                                            height={22}
                                                            fill="rgba(255,255,255,0.12)"
                                                            cornerRadius={11}
                                                        />
                                                        <Text
                                                            text={deptLabel}
                                                            fontSize={9}
                                                            fill="#e2e8f0"
                                                            x={room.width - deptLabel.length * 6 - 14}
                                                            y={-24}
                                                            fontFamily="Inter, system-ui, sans-serif"
                                                            fontStyle="600"
                                                        />
                                                    </>
                                                )}

                                                {/* Capacity — modern circle indicator */}
                                                {cap && (
                                                    <>
                                                        <Circle
                                                            x={room.width - 18}
                                                            y={room.height - 18}
                                                            radius={14}
                                                            fill={roomColor}
                                                            opacity={0.2}
                                                        />
                                                        <Circle
                                                            x={room.width - 18}
                                                            y={room.height - 18}
                                                            radius={14}
                                                            fill="transparent"
                                                            stroke={roomColor}
                                                            strokeWidth={1.5}
                                                            opacity={0.5}
                                                        />
                                                        <Text
                                                            text={`${cap}`}
                                                            fontSize={10}
                                                            fill="#e2e8f0"
                                                            x={room.width - 18 - (String(cap).length * 3.5)}
                                                            y={room.height - 23}
                                                            fontStyle="bold"
                                                            fontFamily="Inter, system-ui, sans-serif"
                                                        />
                                                    </>
                                                )}

                                                {/* Edge glow dots — connection points */}
                                                <Circle x={room.width / 2} y={0} radius={3.5} fill={roomColor} opacity={0.6} />
                                                <Circle x={room.width / 2} y={room.height} radius={3.5} fill={roomColor} opacity={0.6} />
                                                <Circle x={0} y={room.height / 2} radius={3.5} fill={roomColor} opacity={0.6} />
                                                <Circle x={room.width} y={room.height / 2} radius={3.5} fill={roomColor} opacity={0.6} />
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
