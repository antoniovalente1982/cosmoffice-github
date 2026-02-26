'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Circle, Line } from 'react-konva';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { usePresence } from '../../hooks/usePresence';
import { useSpatialAudio } from '../../hooks/useSpatialAudio';
import { UserAvatar } from './UserAvatar';
import { MiniMap } from './MiniMap';
import { RoomEditor } from './RoomEditor';
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

export function KonvaOffice() {
    const {
        myPosition, setMyPosition, peers, rooms,
        zoom, setZoom, setStagePos, setMyRoom,
        isMicEnabled, isVideoEnabled, isSpeaking, localStream,
        myProfile, isBuilderMode
    } = useOfficeStore();
    const stageRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hasInitializedRef = useRef(false);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const { stagePos } = useOfficeStore();

    // Avatar drag state
    const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);
    const isDraggingAvatarRef = useRef(false);
    const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0, zoom: 1 });

    // Animated background particles
    const particles = useParticles(40);

    // Initialize presence and spatial audio
    usePresence();
    useSpatialAudio();

    // Solar system rotation based on current time (360 degrees = 24 hours)
    const [solarRotation, setSolarRotation] = useState(0);

    useEffect(() => {
        const updateRotation = () => {
            const now = new Date();
            const hours = now.getHours();
            const mins = now.getMinutes();
            const secs = now.getSeconds();
            const fractionOfDay = ((hours * 60 * 60) + (mins * 60) + secs) / (24 * 60 * 60);
            setSolarRotation(fractionOfDay * 360);
        };
        updateRotation();
        const interval = setInterval(updateRotation, 30000); // UI update every 30s
        return () => clearInterval(interval);
    }, []);

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

    // Global mouse handlers for avatar drag
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingAvatarRef.current) return;

            const { mouseX, mouseY, posX, posY, zoom: startZoom } = dragStartRef.current;
            const newX = posX + (e.clientX - mouseX) / startZoom;
            const newY = posY + (e.clientY - mouseY) / startZoom;

            setMyPosition({ x: newX, y: newY });
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (!isDraggingAvatarRef.current) return;
            isDraggingAvatarRef.current = false;
            setIsDraggingAvatar(false);

            // Re-enable stage panning
            if (stageRef.current) {
                stageRef.current.draggable(true);
            }

            // Final room check
            const { mouseX, mouseY, posX, posY, zoom: startZoom } = dragStartRef.current;
            const finalX = posX + (e.clientX - mouseX) / startZoom;
            const finalY = posY + (e.clientY - mouseY) / startZoom;
            let currentRoomId: string | undefined = undefined;
            rooms.forEach(room => {
                if (
                    finalX >= room.x && finalX <= room.x + room.width &&
                    finalY >= room.y && finalY <= room.y + room.height
                ) {
                    currentRoomId = room.id;
                }
            });
            setMyRoom(currentRoomId);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [rooms, setMyPosition, setMyRoom]);

    // Handler: start dragging the avatar
    const handleAvatarMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        isDraggingAvatarRef.current = true;
        setIsDraggingAvatar(true);
        dragStartRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            posX: myPosition.x,
            posY: myPosition.y,
            zoom,
        };

        // Disable stage panning while dragging the avatar
        if (stageRef.current) {
            stageRef.current.draggable(false);
        }
    }, [myPosition, zoom]);

    // Stage click: only used in builder mode to deselect rooms
    const handleStageClick = useCallback(() => {
        if (isBuilderMode) {
            useOfficeStore.getState().setSelectedRoom(null);
        }
    }, [isBuilderMode]);

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

            {/* Solar System Background Layer */}
            <div className="absolute left-1/2 top-1/2 pointer-events-none z-0 overflow-hidden"
                style={{ width: '200vw', height: '200vw', transform: 'translate(-50%, -50%)' }}>
                <div
                    className="absolute inset-0 transition-transform duration-[1000s] ease-linear"
                    style={{ transform: `rotate(${solarRotation}deg)` }}
                >
                    {/* The Sun (Center) */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-100 shadow-[0_0_150px_40px_rgba(251,191,36,0.3)] animate-pulse-glow" />

                    {/* Inner Orbit (Cyan Planet) */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-white/5" />
                    <div className="absolute left-1/2 top-[calc(50%-250px)] -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-300 to-blue-600 shadow-[0_0_30px_rgba(6,182,212,0.6)]" />

                    {/* Middle Orbit (Purple Gas Giant) */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full border border-white/5" />
                    <div className="absolute left-[calc(50%+450px)] top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-600 shadow-[0_0_40px_rgba(192,132,252,0.5)]">
                        {/* Ring around planet */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[20%] rounded-[50%] border-2 border-pink-300/30 transform rotate-12" />
                    </div>

                    {/* Outer Orbit (Emerald Planet) */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1400px] h-[1400px] rounded-full border border-white/5" />
                    <div className="absolute left-[calc(50%-700px)] top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-emerald-300 to-teal-700 shadow-[0_0_35px_rgba(16,185,129,0.4)]" />
                </div>
            </div>

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

                                    if (dist > 800) return null;

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
                                Trascina il tuo avatar per muoverti • Trascina la mappa • Scroll per zoomare
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
                                zoom={zoom}
                            />
                        ))}

                        {/* Me - draggable */}
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
                            zoom={zoom}
                            onMouseDown={handleAvatarMouseDown}
                            isDragging={isDraggingAvatar}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
