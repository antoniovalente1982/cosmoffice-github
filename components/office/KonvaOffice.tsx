'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Circle, Text, Group } from 'react-konva';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { usePresence } from '../../hooks/usePresence';
import { useSpatialAudio } from '../../hooks/useSpatialAudio';
import { UserAvatar } from './UserAvatar';

export function KonvaOffice() {
    const {
        myPosition, setMyPosition, peers, rooms,
        zoom, setZoom, setMyRoom,
        isMicEnabled, isVideoEnabled, isSpeaking, localStream
    } = useOfficeStore();
    const stageRef = useRef<any>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

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

        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // Handle movement (keys omitted for space, assuming same as before)
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
        setStagePos(newPos);
    };

    const handleDragMove = (e: any) => {
        setStagePos({ x: e.target.x(), y: e.target.y() });
    };

    // Helper to calculate screen position of an avatar
    const getScreenPos = (pos: { x: number, y: number }) => ({
        x: pos.x * zoom + stagePos.x,
        y: pos.y * zoom + stagePos.y
    });

    return (
        <div className="w-full h-full bg-[#0f172a] overflow-hidden relative">
            {dimensions.width > 0 && dimensions.height > 0 && (
                <>
                    <Stage
                        width={dimensions.width}
                        height={dimensions.height}
                        ref={stageRef}
                        onWheel={handleWheel}
                        onDragMove={handleDragMove}
                        draggable
                    >
                        <Layer>
                            {/* Background Grid */}
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
                            {rooms.map((room: any) => (
                                <Group key={room.id} x={room.x} y={room.y}>
                                    <Rect
                                        width={room.width}
                                        height={room.height}
                                        fill={
                                            room.type === 'meeting' ? '#1e3a8a' :
                                                room.type === 'focus' ? '#312e81' :
                                                    room.type === 'break' ? '#065f46' :
                                                        '#1e293b'
                                        }
                                        opacity={0.3}
                                        cornerRadius={12}
                                        stroke="#334155"
                                        strokeWidth={1}
                                    />
                                    <Text text={room.name || ''} fontSize={14} fill="#94a3b8" x={10} y={-20} fontStyle="bold" />
                                </Group>
                            ))}
                        </Layer>
                    </Stage>

                    {/* Avatars Overlay (HTML) */}
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
                            fullName="You"
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
