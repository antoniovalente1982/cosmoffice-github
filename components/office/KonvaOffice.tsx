'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Circle, Text, Group, Line } from 'react-konva';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { usePresence } from '../../hooks/usePresence';
import { useSpatialAudio } from '../../hooks/useSpatialAudio';
import { UserAvatar } from './UserAvatar';

// Pathfinding - simple A* implementation
interface Node {
    x: number;
    y: number;
    g: number;
    h: number;
    f: number;
    parent?: Node;
}

function heuristic(a: Node, b: Node): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getNeighbors(node: Node, gridSize: number = 20): Node[] {
    const neighbors: Node[] = [];
    const directions = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    
    for (const [dx, dy] of directions) {
        neighbors.push({
            x: node.x + dx * gridSize,
            y: node.y + dy * gridSize,
            g: 0, h: 0, f: 0
        });
    }
    return neighbors;
}

function findPath(start: { x: number, y: number }, end: { x: number, y: number }, rooms: any[]): { x: number, y: number }[] {
    const gridSize = 20;
    const startNode: Node = { x: Math.round(start.x / gridSize) * gridSize, y: Math.round(start.y / gridSize) * gridSize, g: 0, h: 0, f: 0 };
    const endNode: Node = { x: Math.round(end.x / gridSize) * gridSize, y: Math.round(end.y / gridSize) * gridSize, g: 0, h: 0, f: 0 };
    
    const openSet: Node[] = [startNode];
    const closedSet = new Set<string>();
    
    while (openSet.length > 0) {
        // Get node with lowest f score
        let current = openSet[0];
        let currentIndex = 0;
        for (let i = 1; i < openSet.length; i++) {
            if (openSet[i].f < current.f) {
                current = openSet[i];
                currentIndex = i;
            }
        }
        
        openSet.splice(currentIndex, 1);
        closedSet.add(`${current.x},${current.y}`);
        
        if (Math.abs(current.x - endNode.x) < gridSize && Math.abs(current.y - endNode.y) < gridSize) {
            // Reconstruct path
            const path: { x: number, y: number }[] = [];
            let node: Node | undefined = current;
            while (node) {
                path.unshift({ x: node.x, y: node.y });
                node = node.parent;
            }
            return path.length > 0 ? path : [end];
        }
        
        for (const neighbor of getNeighbors(current, gridSize)) {
            if (closedSet.has(`${neighbor.x},${neighbor.y}`)) continue;
            
            // Check collision with rooms (can't walk through room walls, only through doors)
            // For now, allow walking anywhere - we'll improve this later
            
            const tentativeG = current.g + gridSize;
            const existingNode = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);
            
            if (!existingNode || tentativeG < existingNode.g) {
                neighbor.g = tentativeG;
                neighbor.h = heuristic(neighbor, endNode);
                neighbor.f = neighbor.g + neighbor.h;
                neighbor.parent = current;
                
                if (!existingNode) {
                    openSet.push(neighbor);
                }
            }
        }
    }
    
    // No path found, go direct
    return [end];
}

export function KonvaOffice() {
    const {
        myPosition, setMyPosition, peers, rooms,
        zoom, setZoom, setMyRoom,
        isMicEnabled, isVideoEnabled, isSpeaking, localStream,
        myProfile
    } = useOfficeStore();
    const stageRef = useRef<any>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
    const [targetPos, setTargetPos] = useState<{ x: number, y: number } | null>(null);
    const [path, setPath] = useState<{ x: number, y: number }[]>([]);
    const pathIndexRef = useRef(0);
    const animationRef = useRef<number | null>(null);

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

    // Movement animation with smooth interpolation
    useEffect(() => {
        if (path.length === 0 || pathIndexRef.current >= path.length) {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            return;
        }

        const speed = 8; // pixels per frame - adjust for faster/slower movement
        let currentPos = { ...myPosition };

        const animate = () => {
            if (pathIndexRef.current >= path.length) {
                setPath([]);
                setTargetPos(null);
                return;
            }

            const target = path[pathIndexRef.current];
            const dx = target.x - currentPos.x;
            const dy = target.y - currentPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < speed) {
                // Reached this waypoint, move to next
                currentPos = { ...target };
                pathIndexRef.current++;
            } else {
                // Move towards target
                const ratio = speed / distance;
                currentPos.x += dx * ratio;
                currentPos.y += dy * ratio;
            }

            setMyPosition({ ...currentPos });
            
            // Check room collision
            let currentRoomId = undefined;
            rooms.forEach(room => {
                if (
                    currentPos.x >= room.x &&
                    currentPos.x <= room.x + room.width &&
                    currentPos.y >= room.y &&
                    currentPos.y <= room.y + room.height
                ) {
                    currentRoomId = room.id;
                }
            });
            setMyRoom(currentRoomId);

            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [path, rooms, setMyPosition, setMyRoom]);

    const handleStageClick = useCallback((e: any) => {
        const stage = stageRef.current;
        if (!stage) return;

        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        // Convert screen coordinates to world coordinates
        const worldX = (pointer.x - stage.x()) / zoom;
        const worldY = (pointer.y - stage.y()) / zoom;

        // Find path to target
        const newPath = findPath(myPosition, { x: worldX, y: worldY }, rooms);
        setPath(newPath);
        setTargetPos({ x: worldX, y: worldY });
        pathIndexRef.current = 0;
    }, [myPosition, rooms, zoom]);

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
                        onClick={handleStageClick}
                        draggable
                    >
                        <Layer>
                            {/* Background Grid */}
                            {Array.from({ length: 30 }).map((_, i) =>
                                Array.from({ length: 30 }).map((_, j) => (
                                    <Circle
                                        key={`dot-${i}-${j}`}
                                        x={i * 100}
                                        y={j * 100}
                                        radius={1}
                                        fill="#334155"
                                        opacity={0.3}
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

                            {/* Path visualization */}
                            {path.length > 1 && (
                                <Line
                                    points={path.flatMap(p => [p.x, p.y])}
                                    stroke="#6366f1"
                                    strokeWidth={3}
                                    opacity={0.5}
                                    dash={[10, 5]}
                                />
                            )}

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
                    <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-4 py-2 rounded-lg text-xs text-slate-400 pointer-events-none">
                        Clicca dove vuoi andare • Trascina per muovere la visuale • Scroll per zoomare
                    </div>

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
