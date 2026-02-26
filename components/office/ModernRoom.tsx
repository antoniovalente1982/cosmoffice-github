import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Group, Rect, Circle, Text, Line } from 'react-konva';
import { getRoomColor, getRoomDepartment } from './OfficeBuilder';
import { useOfficeStore } from '../../stores/useOfficeStore';

// Simple spring animation hook for Konva
function useSpring(target: number, damping: number = 0.8, stiffness: number = 0.1) {
    const [value, setValue] = useState(target);
    const velocity = useRef(0);
    const frame = useRef<number>();

    useEffect(() => {
        let active = true;
        const tick = () => {
            if (!active) return;
            const diff = target - value;
            velocity.current += diff * stiffness;
            velocity.current *= damping;
            if (Math.abs(diff) < 0.01 && Math.abs(velocity.current) < 0.01) {
                setValue(target);
            } else {
                setValue(v => v + velocity.current);
                frame.current = requestAnimationFrame(tick);
            }
        };
        frame.current = requestAnimationFrame(tick);
        return () => {
            active = false;
            if (frame.current) cancelAnimationFrame(frame.current);
        };
    }, [target, damping, stiffness, value]);

    return value;
}

export function ModernRoom({ room, animated = true, isSelected = false }: { room: any; animated?: boolean; isSelected?: boolean }) {
    const [isHovered, setIsHovered] = useState(false);
    const roomColor = getRoomColor(room);
    const deptLabel = getRoomDepartment(room);
    const cap = room.settings?.capacity || room.capacity;

    // Dynamic real-time calculation
    // Assume each avatar needs an area of 128x128 pixels (64px avatar + 64px gap)
    const avatarSpaceArea = 128 * 128;
    const roomArea = room.width * room.height;
    // Calculate max capacity. Keep at least 1, and bound it reasonably to physical space
    const dynamicCapacity = Math.max(1, Math.floor(roomArea / avatarSpaceArea));

    // Calculate current number of users in this room (including me if I'm in it)
    const { peers, myPosition, myStatus } = useOfficeStore();
    const currentUsers = useMemo(() => {
        let count = 0;

        // Helper to check if a position is within this room
        const isInside = (x: number, y: number) => {
            return x >= room.x && x <= room.x + room.width &&
                y >= room.y && y <= room.y + room.height;
        };

        // Check peers
        (Object.values(peers) as any[]).forEach(peer => {
            if (peer.status !== 'offline' && isInside(peer.position.x, peer.position.y)) {
                count++;
            }
        });

        // Check self
        if (myStatus !== 'offline' && isInside(myPosition.x, myPosition.y)) {
            count++;
        }

        return count;
    }, [peers, myPosition, myStatus, room.x, room.y, room.width, room.height]);
    // Fluid animations
    const scale = useSpring(isHovered ? 1.02 : 1.0, 0.7, 0.15);
    const glowBlur = useSpring(isHovered ? 60 : 30, 0.8, 0.2);
    const glowOpacity = useSpring(isHovered ? 0.7 : 0.4, 0.8, 0.2);

    // Animated dash offset for selection ring
    const [dashOffset, setDashOffset] = useState(0);
    useEffect(() => {
        if (!animated || !isSelected) return;
        let frame: number;
        const animate = () => {
            setDashOffset(prev => (prev - 1) % 100);
            frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frame);
    }, [animated, isSelected]);

    return (
        <Group
            scaleX={scale} scaleY={scale}
            offsetX={room.width / 2} offsetY={room.height / 2}
            x={room.x + room.width / 2} y={room.y + room.height / 2} // Shift coordinate system center for scaling
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* ═══ LAYER 1: HUGE AMBIENT GLOW ═══ */}
            <Rect
                x={-30} y={-30}
                width={room.width + 60} height={room.height + 60}
                fill="transparent"
                shadowColor={roomColor}
                shadowBlur={glowBlur}
                shadowOpacity={glowOpacity}
                cornerRadius={32}
                listening={false}
            />

            {/* Selection Ring */}
            {isSelected && (
                <Rect
                    x={-8} y={-8}
                    width={room.width + 16} height={room.height + 16}
                    stroke="#00d4ff"
                    strokeWidth={2}
                    dash={[10, 10]}
                    dashOffset={dashOffset}
                    cornerRadius={20}
                    shadowColor="#00d4ff"
                    shadowBlur={10}
                    opacity={0.8}
                />
            )}

            {/* ═══ LAYER 2: DARK GLASS BASE ═══ */}
            <Rect
                width={room.width} height={room.height}
                fill="#050a15"
                opacity={0.85}
                cornerRadius={16}
            />

            {/* ═══ LAYER 3: VIVID LIQUID FILL ═══ */}
            <Rect
                width={room.width} height={room.height}
                fill={roomColor}
                opacity={isHovered ? 0.25 : 0.15}
                cornerRadius={16}
            />

            {/* ═══ CLIPPED INNER ELEMENTS (prevent overflow at corners) ═══ */}
            <Group
                clipFunc={(ctx) => {
                    const r = Math.min(16, room.width / 2, room.height / 2);
                    const w = room.width;
                    const h = room.height;
                    ctx.beginPath();
                    ctx.moveTo(r, 0);
                    ctx.lineTo(w - r, 0);
                    ctx.arcTo(w, 0, w, r, r);
                    ctx.lineTo(w, h - r);
                    ctx.arcTo(w, h, w - r, h, r);
                    ctx.lineTo(r, h);
                    ctx.arcTo(0, h, 0, h - r, r);
                    ctx.lineTo(0, r);
                    ctx.arcTo(0, 0, r, 0, r);
                    ctx.closePath();
                }}
            >
                {/* ═══ HEADER STRIPE ═══ */}
                <Rect
                    x={0} y={0}
                    width={room.width} height={10}
                    fill={roomColor}
                    opacity={0.9}
                    listening={false}
                />

                {/* ═══ INNER SCANLINE / HIGHLIGHT ═══ */}
                <Rect
                    x={2} y={2}
                    width={room.width - 4} height={room.height / 2}
                    fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                    fillLinearGradientEndPoint={{ x: 0, y: room.height / 2 }}
                    fillLinearGradientColorStops={[0, 'rgba(255,255,255,0.1)', 1, 'transparent']}
                    listening={false}
                />
            </Group>

            {/* ═══ LAYER 4: GLASS GLINT BORDER (Drawn on top to cover clipped edges) ═══ */}
            <Rect
                width={room.width} height={room.height}
                fill="transparent"
                stroke={roomColor}
                strokeWidth={isHovered ? 4 : 2.5}
                cornerRadius={16}
                opacity={1}
                shadowColor={roomColor}
                shadowBlur={isHovered ? 20 : 12}
                shadowOpacity={isHovered ? 0.9 : 0.6}
                listening={false}
            />

            {/* ═══ CORNER TARGETS ═══ */}
            <Circle x={8} y={18} radius={2} fill={roomColor} opacity={0.6} listening={false} />
            <Circle x={room.width - 8} y={18} radius={2} fill={roomColor} opacity={0.6} listening={false} />
            <Circle x={8} y={room.height - 8} radius={2} fill={roomColor} opacity={0.4} listening={false} />
            <Circle x={room.width - 8} y={room.height - 8} radius={2} fill={roomColor} opacity={0.4} listening={false} />

            {/* ═══ FLOATING NAME PILL ═══ */}
            <Rect
                x={room.width / 2 - Math.max((room.name?.length || 4) * 8 + 32, 80) / 2} y={-38}
                width={Math.max((room.name?.length || 4) * 8 + 32, 80)}
                height={28}
                fill={roomColor}
                cornerRadius={14}
                shadowColor={roomColor} shadowBlur={15} shadowOpacity={0.6}
            />
            <Text
                text={room.name || 'Room'}
                fontSize={12} fill="#ffffff" fontStyle="bold" fontFamily="Inter, sans-serif"
                x={0} y={-29} width={room.width} align="center"
                listening={false}
            />

            {/* ═══ DEPARTMENT BADGE ═══ */}
            {deptLabel && (
                <>
                    <Rect
                        x={room.width - deptLabel.length * 6 - 24} y={-14}
                        width={deptLabel.length * 6 + 24} height={20}
                        fill="rgba(15,23,42,0.8)" stroke="rgba(255,255,255,0.2)" strokeWidth={1}
                        cornerRadius={10}
                        shadowColor="#000" shadowBlur={4} shadowOpacity={0.5}
                    />
                    <Text
                        text={deptLabel} fontSize={9} fill="#94a3b8" fontStyle="700" fontFamily="Inter, sans-serif"
                        x={room.width - deptLabel.length * 6 - 12} y={-8}
                        listening={false}
                    />
                </>
            )}

            {/* ═══ CAPACITY BADGE (Solid Circle/Pill) ═══ */}
            {dynamicCapacity && (
                (() => {
                    const capText = `${currentUsers}/${dynamicCapacity}`;
                    const capWidth = Math.max(32, capText.length * 8 + 16);
                    return (
                        <Group x={room.width - capWidth - 12} y={room.height - 24 - 12} listening={false}>
                            {/* Background Pill */}
                            <Rect
                                height={24}
                                width={capWidth}
                                cornerRadius={12}
                                fill={currentUsers > dynamicCapacity ? '#ef4444' : roomColor}
                                opacity={currentUsers >= dynamicCapacity ? 0.8 : 0.6}
                            />
                            <Rect
                                height={24}
                                width={capWidth}
                                cornerRadius={12}
                                stroke="rgba(255,255,255,0.3)"
                                strokeWidth={1.5}
                            />
                            {/* Text */}
                            <Text
                                text={capText} fontSize={11} fill="#ffffff" fontStyle="bold" fontFamily="Inter, sans-serif"
                                x={0} y={6} width={capWidth} align="center"
                            />
                        </Group>
                    );
                })()
            )}
        </Group>
    );
}
