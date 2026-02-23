'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Circle, Text, Group } from 'react-konva';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { usePresence } from '../../hooks/usePresence';
import { useSpatialAudio } from '../../hooks/useSpatialAudio';

export function KonvaOffice() {
    const { myPosition, setMyPosition, peers, rooms, zoom, setZoom, setMyRoom } = useOfficeStore();
    const stageRef = useRef<any>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [animPhase, setAnimPhase] = useState(0);

    // Initialize presence and spatial audio
    usePresence();
    useSpatialAudio();

    useEffect(() => {
        const updateDimensions = () => {
            setDimensions({
                width: window.innerWidth - 320, // Sidebar width
                height: window.innerHeight - 64, // Header height
            });
        };
        updateDimensions();
        window.addEventListener('resize', updateDimensions);

        // Animation loop for avatars
        let frame: number;
        const animate = () => {
            setAnimPhase(p => (p + 0.1) % (Math.PI * 2));
            frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', updateDimensions);
            cancelAnimationFrame(frame);
        };
    }, []);

    // Handle movement
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const step = 30;
            const newPos = { ...myPosition };

            switch (e.key) {
                case 'ArrowUp': case 'w': case 'W': newPos.y -= step; break;
                case 'ArrowDown': case 's': case 'S': newPos.y += step; break;
                case 'ArrowLeft': case 'a': case 'A': newPos.x -= step; break;
                case 'ArrowRight': case 'd': case 'D': newPos.x += step; break;
                default: return;
            }

            // Check room collision
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

            setMyPosition(newPos);
            setMyRoom(currentRoomId);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [myPosition, rooms, setMyPosition, setMyRoom]);

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
    };

    return (
        <div className="w-full h-full bg-[#0f172a] overflow-hidden">
            {dimensions.width > 0 && dimensions.height > 0 && (
                <Stage
                    width={dimensions.width}
                    height={dimensions.height}
                    ref={stageRef}
                    onWheel={handleWheel}
                    draggable
                >
                    <Layer>
                        {/* Background Grid (Dots) */}
                        {Array.from({ length: 20 }).map((_, i) =>
                            Array.from({ length: 20 }).map((_, j) => (
                                <Circle
                                    key={`dot-${i}-${j}`}
                                    x={i * 100}
                                    y={j * 100}
                                    radius={1}
                                    fill="#334155"
                                    opacity={0.5}
                                />
                            ))
                        )}

                        {/* Rooms */}
                        {rooms.map((room) => (
                            <Group key={room.id} x={room.x} y={room.y}>
                                <Rect
                                    width={room.width}
                                    height={room.height}
                                    fill={room.color}
                                    opacity={0.3}
                                    cornerRadius={12}
                                    stroke="#334155"
                                    strokeWidth={1}
                                />
                                <Text
                                    text={room.name || ''}
                                    fontSize={14}
                                    fill="#94a3b8"
                                    x={10}
                                    y={-20}
                                    fontStyle="bold"
                                />
                            </Group>
                        ))}

                        {/* Peers */}
                        {Object.values(peers).map((peer) => {
                            const distance = Math.sqrt(
                                Math.pow(myPosition.x - peer.position.x, 2) +
                                Math.pow(myPosition.y - peer.position.y, 2)
                            );
                            const isClose = distance < 400;
                            const bounce = Math.sin(animPhase) * 3;

                            return (
                                <Group
                                    key={peer.id}
                                    x={peer.position.x}
                                    y={peer.position.y + bounce}
                                    opacity={isClose ? 1 : 0.5}
                                >
                                    <Circle
                                        radius={20}
                                        fill={isClose ? "#475569" : "#1e293b"}
                                        stroke={isClose ? "#334155" : "#0f172a"}
                                        strokeWidth={2}
                                        shadowBlur={isClose ? 10 : 0}
                                        shadowOpacity={0.5}
                                    />
                                    <Text
                                        text={peer.full_name?.[0] || peer.email?.[0] || '?'}
                                        x={-5}
                                        y={-5}
                                        fill={isClose ? "white" : "#475569"}
                                        fontStyle="bold"
                                    />
                                    {isClose && (
                                        <Text
                                            text={peer.full_name || peer.email || ''}
                                            x={-30}
                                            y={25}
                                            fill="#94a3b8"
                                            fontSize={10}
                                        />
                                    )}
                                </Group>
                            );
                        })}

                        {/* Me */}
                        <Group x={myPosition.x} y={myPosition.y + Math.sin(animPhase + 0.5) * 3}>
                            <Circle
                                radius={22}
                                fill="#6366f1"
                                stroke="#4f46e5"
                                strokeWidth={3}
                                shadowBlur={15}
                                shadowColor="#6366f1"
                                shadowOpacity={0.5}
                            />
                            <Text
                                text="ME"
                                x={-8}
                                y={-5}
                                fill="white"
                                fontStyle="bold"
                            />
                        </Group>
                    </Layer>
                </Stage>
            )}
        </div>
    );
}
