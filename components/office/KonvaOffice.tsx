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
import { ModernRoom } from './ModernRoom';

// Animated background particles
function useParticles(count: number) {
    const [particles, setParticles] = useState<Array<{ x: number; y: number; vx: number; vy: number; size: number; opacity: number }>>([]);

    useEffect(() => {
        const initParticles = Array.from({ length: count }, () => ({
            x: Math.random() * 3000,
            y: Math.random() * 3000,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            size: Math.random() * 2 + 0.5,
            opacity: Math.random() * 0.5 + 0.2,
        }));
        setParticles(initParticles);

        let frameId: number;
        const animate = () => {
            setParticles(prev => prev.map(p => ({
                ...p,
                x: (p.x + p.vx + 3000) % 3000,
                y: (p.y + p.vy + 3000) % 3000,
            })));
            frameId = requestAnimationFrame(animate);
        };
        frameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameId);
    }, [count]);

    return particles;
}

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

    // Animated background particles
    const particles = useParticles(40);

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
        <div ref={containerRef} className="w-full h-full overflow-hidden relative"
            style={{
                background: `
                     radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.12) 0%, transparent 40%),
                     radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.12) 0%, transparent 40%),
                     radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.08) 0%, transparent 60%),
                     linear-gradient(135deg, #050a15 0%, #0a0f1e 50%, #030712 100%)
                 `
            }}
        >
            {/* Animated grid overlay */}
            <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '60px 60px'
                }}
            />

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
                            {/* Animated background particles */}
                            {particles.map((p, i) => (
                                <Circle
                                    key={`p-${i}`}
                                    x={p.x}
                                    y={p.y}
                                    radius={p.size}
                                    fill="#6366f1"
                                    opacity={p.opacity}
                                    shadowColor="#00d4ff"
                                    shadowBlur={p.size * 2}
                                />
                            ))}

                            {/* Fluid Bezier Connections between rooms */}
                            {rooms.map((room, i) =>
                                rooms.slice(i + 1).map((otherRoom, j) => {
                                    const cx1 = room.x + room.width / 2;
                                    const cy1 = room.y + room.height / 2;
                                    const cx2 = otherRoom.x + otherRoom.width / 2;
                                    const cy2 = otherRoom.y + otherRoom.height / 2;
                                    const dist = Math.sqrt((cx2 - cx1) ** 2 + (cy2 - cy1) ** 2);

                                    if (dist > 800) return null; // Only connect relatively close rooms

                                    return (
                                        <Line
                                            key={`conn-${i}-${j}`}
                                            points={[cx1, cy1, cx2, cy2]}
                                            stroke="#6366f1"
                                            strokeWidth={1}
                                            opacity={0.15 * (1 - dist / 800)}
                                            dash={[15, 15]}
                                            tension={0.5}
                                        />
                                    );
                                })
                            )}

                            {/* Rooms */}
                            {isBuilderMode ? (
                                <RoomEditor rooms={rooms} />
                            ) : (
                                <>
                                    {rooms.map((room: any) => (
                                        <ModernRoom
                                            key={room.id}
                                            room={room}
                                            animated={true}
                                        />
                                    ))}
                                </>
                            )}

                            {/* Furniture Layer - always visible */}
                            <FurnitureLayer />

                            {/* Target indicator - Modern Radar Ping */}
                            {targetPos && (
                                <Group x={targetPos.x} y={targetPos.y}>
                                    {/* Outer dashed ring */}
                                    <Circle
                                        radius={25} fill="transparent"
                                        stroke="#00d4ff" strokeWidth={1.5}
                                        dash={[6, 4]} opacity={0.7}
                                    />
                                    {/* Inner glowing ring */}
                                    <Circle
                                        radius={10} fill="transparent"
                                        stroke="#6366f1" strokeWidth={2}
                                        shadowColor="#00d4ff" shadowBlur={15}
                                        opacity={0.9}
                                    />
                                    {/* Center pulse dot */}
                                    <Circle radius={4} fill="#00d4ff" shadowColor="#00d4ff" shadowBlur={10} />
                                </Group>
                            )}
                        </Layer>
                    </Stage>

                    {/* Modern Instructions Overlay */}
                    <div className="absolute top-4 left-4 pointer-events-none z-10">
                        <div className="px-4 py-2.5 rounded-xl border border-white/10 shadow-2xl flex items-center gap-3"
                            style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(20px)' }}>
                            <div className="flex items-center gap-2 border-r border-white/10 pr-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live</span>
                            </div>
                            <p className="text-xs font-medium text-slate-300">
                                Clicca per muoverti • Trascina la mappa • Scroll per zoomare
                            </p>
                        </div>
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
