'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Application, Container, Graphics, Text, TextStyle, FederatedPointerEvent } from 'pixi.js';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { usePresence } from '../../hooks/usePresence';
import { useSpatialAudio } from '../../hooks/useSpatialAudio';
import { useDaily } from '../../hooks/useDaily';
import { UserAvatar } from './UserAvatar';
import { MiniMap } from './MiniMap';
import { RoomEditor } from './RoomEditor';
import { getRoomColor } from './OfficeBuilder';

// ─── Helpers ──────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

function hexColor(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
}

// Room color palette (same as OfficeBuilder)
const ROOM_COLORS: Record<string, string> = {
    reception: '#3b82f6',
    open: '#6366f1',
    meeting: '#8b5cf6',
    focus: '#06b6d4',
    break: '#10b981',
    default: '#6366f1',
};

// Room type labels (clean, no emoji)
const ROOM_TYPE_LABELS: Record<string, string> = {
    reception: 'RECEPTION',
    open: 'OPEN SPACE',
    meeting: 'MEETING',
    focus: 'FOCUS',
    break: 'BREAK',
    default: 'ROOM',
};

// ─── Particle System (GPU) ───────────────────────────────────────
interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
}

function createParticles(count: number, w: number, h: number): Particle[] {
    return Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.2,
    }));
}

// ─── Draw functions ──────────────────────────────────────────────
function drawRoundedRect(g: Graphics, x: number, y: number, w: number, h: number, r: number, fill: number, alpha: number) {
    g.roundRect(x, y, w, h, r);
    g.fill({ color: fill, alpha });
}

function drawRoom(container: Container, room: any, isHovered: boolean, occupants: number = 0) {
    // Clear old children
    container.removeChildren();

    const color = getRoomColor(room);
    const colorNum = hexColor(color);
    const capacity = room.settings?.capacity || room.capacity || Math.max(1, Math.floor((room.width * room.height) / (128 * 128)));
    const department = room.settings?.department || room.department || null;
    const typeLabel = ROOM_TYPE_LABELS[room.type] || ROOM_TYPE_LABELS.default;

    // ─── Background layers ───────────────────────────────────
    const body = new Graphics();

    // Outer soft glow
    body.roundRect(room.x - 8, room.y - 8, room.width + 16, room.height + 16, 24);
    body.fill({ color: colorNum, alpha: isHovered ? 0.20 : 0.10 });

    // Mid glow
    body.roundRect(room.x - 3, room.y - 3, room.width + 6, room.height + 6, 19);
    body.fill({ color: colorNum, alpha: isHovered ? 0.14 : 0.07 });

    // Main card background — dark glass
    body.roundRect(room.x, room.y, room.width, room.height, 16);
    body.fill({ color: 0x0c1222, alpha: 0.94 });

    // Color tint overlay
    body.roundRect(room.x, room.y, room.width, room.height, 16);
    body.fill({ color: colorNum, alpha: isHovered ? 0.08 : 0.04 });

    // Border — crisp and glowing
    body.roundRect(room.x, room.y, room.width, room.height, 16);
    body.stroke({ color: colorNum, width: isHovered ? 2 : 1.5, alpha: isHovered ? 0.85 : 0.55 });

    // Top accent bar — thin gradient strip
    body.roundRect(room.x + 2, room.y + 2, room.width - 4, 3, 8);
    body.fill({ color: colorNum, alpha: isHovered ? 0.9 : 0.65 });

    // Bottom subtle line
    body.rect(room.x + 16, room.y + room.height - 28, room.width - 32, 1);
    body.fill({ color: 0xffffff, alpha: 0.04 });

    container.addChild(body);

    // ─── Room name — large, bold, modern ─────────────────────
    const nameStyle = new TextStyle({
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 15,
        fontWeight: '700',
        fill: 0xf8fafc,
        letterSpacing: 0.3,
    });
    const nameText = new Text({ text: room.name, style: nameStyle });
    nameText.position.set(room.x + 16, room.y + 16);
    container.addChild(nameText);

    // ─── Type label — pill style ─────────────────────────────
    const typePillBg = new Graphics();
    const typePillW = typeLabel.length * 6.5 + 14;
    typePillBg.roundRect(room.x + 16, room.y + 38, typePillW, 18, 9);
    typePillBg.fill({ color: colorNum, alpha: 0.18 });
    typePillBg.stroke({ color: colorNum, width: 0.8, alpha: 0.35 });
    container.addChild(typePillBg);

    const typeStyle = new TextStyle({
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 9,
        fontWeight: '700',
        fill: hexColor(color),
        letterSpacing: 1.2,
    });
    const typeLabelText = new Text({ text: typeLabel, style: typeStyle });
    typeLabelText.position.set(room.x + 23, room.y + 42);
    container.addChild(typeLabelText);

    // ─── Department label (if present) ───────────────────────
    if (department) {
        const deptStyle = new TextStyle({
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 10,
            fontWeight: '500',
            fill: 0x94a3b8,
            fontStyle: 'italic',
        });
        const deptText = new Text({ text: department, style: deptStyle });
        deptText.position.set(room.x + 16 + typePillW + 8, room.y + 42);
        container.addChild(deptText);
    }

    // ─── Occupancy badge (top-right) ─────────────────────────
    const badgeW = 52;
    const badgeH = 22;
    const badgeX = room.x + room.width - badgeW - 12;
    const badgeY = room.y + 12;

    const badgeBg = new Graphics();
    badgeBg.roundRect(badgeX, badgeY, badgeW, badgeH, 11);
    if (occupants > 0) {
        // Active — colored pill
        badgeBg.fill({ color: colorNum, alpha: 0.25 });
        badgeBg.stroke({ color: colorNum, width: 1, alpha: 0.5 });
    } else {
        // Empty — muted pill
        badgeBg.fill({ color: 0x334155, alpha: 0.4 });
        badgeBg.stroke({ color: 0x475569, width: 0.8, alpha: 0.3 });
    }
    container.addChild(badgeBg);

    // Dot indicator inside badge
    const dotGfx = new Graphics();
    dotGfx.circle(badgeX + 10, badgeY + badgeH / 2, 3);
    dotGfx.fill({ color: occupants > 0 ? 0x34d399 : 0x475569, alpha: occupants > 0 ? 1 : 0.6 });
    container.addChild(dotGfx);

    // Occupancy text
    const occStyle = new TextStyle({
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 10,
        fontWeight: '700',
        fill: occupants > 0 ? 0xf1f5f9 : 0x64748b,
    });
    const occText = new Text({ text: `${occupants}/${capacity}`, style: occStyle });
    occText.position.set(badgeX + 18, badgeY + 5);
    container.addChild(occText);

    // ─── Bottom status line ──────────────────────────────────
    const statusStyle = new TextStyle({
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 9,
        fontWeight: '600',
        fill: occupants > 0 ? 0x34d399 : 0x475569,
        letterSpacing: 0.5,
    });
    const statusText = occupants > 0 ? `${occupants} online` : 'Vuota';
    const status = new Text({ text: statusText, style: statusStyle });
    status.position.set(room.x + 16, room.y + room.height - 22);
    container.addChild(status);
}

// ─── Main Component ──────────────────────────────────────────────
export function PixiOffice() {
    const {
        myPosition, setMyPosition, peers, rooms,
        zoom, setZoom, setStagePos, setMyRoom,
        isMicEnabled, isVideoEnabled, isSpeaking, localStream,
        myProfile, myRole, isBuilderMode, bgOpacity, stagePos, officeWidth, officeHeight,
        isPerformanceMode, myStatus
    } = useOfficeStore();

    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const appRef = useRef<Application | null>(null);
    const hasInitializedRef = useRef(false);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

    // Avatar dragging state
    const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);
    const isDraggingAvatarRef = useRef(false);
    const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0, zoom: 1 });

    // Panning state
    const isPanningRef = useRef(false);
    const panStartRef = useRef({ mouseX: 0, mouseY: 0, stagePosX: 0, stagePosY: 0 });

    // Refs for current zoom/stagePos (avoid stale closures)
    const zoomRef = useRef(zoom);
    const stagePosRef = useRef(stagePos);
    zoomRef.current = zoom;
    stagePosRef.current = stagePos;



    // Initialize presence, spatial audio, and Daily.co WebRTC
    usePresence();
    useSpatialAudio();

    const { activeSpaceId } = useOfficeStore();
    useDaily(activeSpaceId || null);

    // PixiJS refs for layers
    const worldRef = useRef<Container | null>(null);
    const particleGfxRef = useRef<Graphics | null>(null);
    const roomContainersRef = useRef<Map<string, Container>>(new Map());
    const connectionGfxRef = useRef<Graphics | null>(null);
    const platformGfxRef = useRef<Graphics | null>(null);
    const particlesRef = useRef<Particle[]>([]);

    const officeBounds = useMemo(() => ({
        x: 0, y: 0,
        width: officeWidth || 4000,
        height: officeHeight || 4000,
    }), [officeWidth, officeHeight]);

    // ─── Stage clamping ──────────────────────────────────────
    const clampStagePosition = useCallback((pos: { x: number; y: number }, scale: number) => {
        if (!dimensions.width || !dimensions.height) return pos;
        const w = officeWidth || 4000;
        const h = officeHeight || 4000;
        const boundMinX = dimensions.width - w * scale;
        const boundMinY = dimensions.height - h * scale;
        const clampedX = boundMinX > 0 ? boundMinX / 2 : Math.max(Math.min(pos.x, 0), boundMinX);
        const clampedY = boundMinY > 0 ? boundMinY / 2 : Math.max(Math.min(pos.y, 0), boundMinY);
        return { x: clampedX, y: clampedY };
    }, [dimensions, officeWidth, officeHeight]);

    // ─── Initialize PixiJS Application ───────────────────────
    useEffect(() => {
        if (!canvasRef.current || appRef.current) return;

        const app = new Application();
        const initApp = async () => {
            await app.init({
                canvas: canvasRef.current!,
                background: 0x050a15,
                antialias: true,
                resolution: Math.min(window.devicePixelRatio, 2),
                autoDensity: true,
                resizeTo: containerRef.current!,
            });

            appRef.current = app;

            // Create world container (this gets transformed for pan/zoom)
            const world = new Container();
            world.label = 'world';
            app.stage.addChild(world);
            worldRef.current = world;

            // Platform layer
            const platform = new Graphics();
            world.addChild(platform);
            platformGfxRef.current = platform;

            // Particle layer
            const particleGfx = new Graphics();
            world.addChild(particleGfx);
            particleGfxRef.current = particleGfx;

            // Connection layer
            const connectionGfx = new Graphics();
            world.addChild(connectionGfx);
            connectionGfxRef.current = connectionGfx;

            // Initialize particles
            const oW = useOfficeStore.getState().officeWidth || 4000;
            const oH = useOfficeStore.getState().officeHeight || 4000;
            particlesRef.current = createParticles(60, oW, oH);

            // ─── Render loop ─────────────────────────────────
            app.ticker.add(() => {
                const state = useOfficeStore.getState();
                const curZoom = zoomRef.current;
                const curPos = stagePosRef.current;

                // Update world transform
                if (worldRef.current) {
                    worldRef.current.position.set(curPos.x, curPos.y);
                    worldRef.current.scale.set(curZoom);
                }

                // ─── Draw platform ───────────────────────────
                if (platformGfxRef.current) {
                    const pg = platformGfxRef.current;
                    pg.clear();

                    const bw = state.officeWidth || 4000;
                    const bh = state.officeHeight || 4000;

                    // Outer glow
                    pg.roundRect(0, 0, bw, bh, 120);
                    pg.fill({ color: 0x06b6d4, alpha: 0.02 });

                    // Inner dark area
                    pg.roundRect(40, 40, bw - 80, bh - 80, 80);
                    pg.fill({ color: 0x0a0f1e, alpha: 0.75 });

                    // Dashed border (simplified — solid thin line)
                    pg.roundRect(40, 40, bw - 80, bh - 80, 80);
                    pg.stroke({ color: 0x06b6d4, width: 1, alpha: 0.15 });
                }

                // ─── Update particles ────────────────────────
                if (particleGfxRef.current) {
                    const pg = particleGfxRef.current;
                    pg.clear();

                    if (!state.isPerformanceMode) {
                        const bw = state.officeWidth || 4000;
                        const bh = state.officeHeight || 4000;

                        particlesRef.current.forEach(p => {
                            p.x = (p.x + p.vx + bw) % bw;
                            p.y = (p.y + p.vy + bh) % bh;

                            pg.circle(p.x, p.y, p.size);
                            pg.fill({ color: 0x6366f1, alpha: p.alpha });
                        });
                    }
                }

                // ─── Draw room connections ───────────────────
                if (connectionGfxRef.current) {
                    const cg = connectionGfxRef.current;
                    cg.clear();

                    if (!state.isPerformanceMode) {
                        const rms = state.rooms;
                        for (let i = 0; i < rms.length; i++) {
                            for (let j = i + 1; j < rms.length; j++) {
                                const r1 = rms[i];
                                const r2 = rms[j];
                                const cx1 = r1.x + r1.width / 2;
                                const cy1 = r1.y + r1.height / 2;
                                const cx2 = r2.x + r2.width / 2;
                                const cy2 = r2.y + r2.height / 2;
                                const dist = Math.sqrt((cx2 - cx1) ** 2 + (cy2 - cy1) ** 2);

                                if (dist > 800) continue;

                                const alpha = 0.15 * (1 - dist / 800);
                                cg.moveTo(cx1, cy1);
                                cg.lineTo(cx2, cy2);
                                cg.stroke({ color: 0x6366f1, width: 1, alpha });
                            }
                        }
                    }
                }
            });
        };

        initApp();

        return () => {
            if (appRef.current) {
                appRef.current.destroy(true);
                appRef.current = null;
            }
        };
    }, []);

    // ─── Draw rooms when they change ─────────────────────────
    useEffect(() => {
        if (!worldRef.current) return;

        const world = worldRef.current;
        const existingContainers = roomContainersRef.current;

        // Remove old room containers that are no longer in the list
        const currentIds = new Set(rooms.map((r: any) => r.id));
        existingContainers.forEach((container, id) => {
            if (!currentIds.has(id)) {
                world.removeChild(container);
                container.destroy({ children: true });
                existingContainers.delete(id);
            }
        });

        // Count occupants per room
        const state = useOfficeStore.getState();
        const peersByRoom: Record<string, number> = {};
        Object.values(state.peers).forEach((p: any) => {
            if (p.roomId) peersByRoom[p.roomId] = (peersByRoom[p.roomId] || 0) + 1;
        });
        // Count myself too
        if (state.myRoomId) peersByRoom[state.myRoomId] = (peersByRoom[state.myRoomId] || 0) + 1;

        // Create/update room containers
        rooms.forEach((room: any) => {
            let rc = existingContainers.get(room.id);
            if (!rc) {
                rc = new Container();
                rc.label = `room-${room.id}`;
                rc.eventMode = 'static';
                rc.cursor = 'pointer';
                world.addChild(rc);
                existingContainers.set(room.id, rc);
            }
            const isHovered = hoveredRoomId === room.id;
            const occupants = peersByRoom[room.id] || 0;
            drawRoom(rc, room, isHovered, occupants);
        });
    }, [rooms, hoveredRoomId, peers]);

    // ─── Resize observer ─────────────────────────────────────
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

    // ─── Center on first render ──────────────────────────────
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



    // ─── Mouse handlers: panning & avatar drag ───────────────
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleMouseDown = (e: MouseEvent) => {
            // Don't pan if dragging avatar (handled separately)
            if (isDraggingAvatarRef.current) return;
            if ((e.target as HTMLElement).closest('[data-avatar]')) return;

            isPanningRef.current = true;
            panStartRef.current = {
                mouseX: e.clientX,
                mouseY: e.clientY,
                stagePosX: stagePosRef.current.x,
                stagePosY: stagePosRef.current.y,
            };
            container.style.cursor = 'grabbing';
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (isDraggingAvatarRef.current) {
                const { mouseX, mouseY, posX, posY, zoom: startZoom } = dragStartRef.current;
                const rawX = posX + (e.clientX - mouseX) / startZoom;
                const rawY = posY + (e.clientY - mouseY) / startZoom;

                const bounds = useOfficeStore.getState();
                const bw = bounds.officeWidth || 4000;
                const bh = bounds.officeHeight || 4000;
                const r = 24;

                const newX = Math.max(r, Math.min(rawX, bw - r));
                const newY = Math.max(r, Math.min(rawY, bh - r));
                setMyPosition({ x: newX, y: newY });
                return;
            }

            if (isPanningRef.current) {
                const dx = e.clientX - panStartRef.current.mouseX;
                const dy = e.clientY - panStartRef.current.mouseY;
                const rawPos = {
                    x: panStartRef.current.stagePosX + dx,
                    y: panStartRef.current.stagePosY + dy,
                };
                const clamped = clampStagePosition(rawPos, zoomRef.current);
                setStagePos(clamped);
            }

            // Room hover detection — convert screen coords to world coords
            if (!isPanningRef.current && !isDraggingAvatarRef.current && container) {
                const rect = container.getBoundingClientRect();
                const curZoom = zoomRef.current;
                const curStagePos = stagePosRef.current;
                const worldX = (e.clientX - rect.left - curStagePos.x) / curZoom;
                const worldY = (e.clientY - rect.top - curStagePos.y) / curZoom;

                let foundRoom: string | null = null;
                const currentRooms = useOfficeStore.getState().rooms;
                for (const room of currentRooms) {
                    if (worldX >= room.x && worldX <= room.x + room.width &&
                        worldY >= room.y && worldY <= room.y + room.height) {
                        foundRoom = room.id;
                        break;
                    }
                }
                setHoveredRoomId(foundRoom);
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (isDraggingAvatarRef.current) {
                isDraggingAvatarRef.current = false;
                setIsDraggingAvatar(false);

                // Check room entry
                const { mouseX, mouseY, posX, posY, zoom: startZoom } = dragStartRef.current;
                const finalX = posX + (e.clientX - mouseX) / startZoom;
                const finalY = posY + (e.clientY - mouseY) / startZoom;
                let found: string | undefined;
                useOfficeStore.getState().rooms.forEach((room: any) => {
                    if (finalX >= room.x && finalX <= room.x + room.width &&
                        finalY >= room.y && finalY <= room.y + room.height) {
                        found = room.id;
                    }
                });
                setMyRoom(found);
            }

            if (isPanningRef.current) {
                isPanningRef.current = false;
                if (container) container.style.cursor = 'grab';
            }
        };

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const scaleBy = 1.1;
            const oldScale = zoomRef.current;
            const rect = container.getBoundingClientRect();
            const pointerX = e.clientX - rect.left;
            const pointerY = e.clientY - rect.top;

            const mousePointTo = {
                x: (pointerX - stagePosRef.current.x) / oldScale,
                y: (pointerY - stagePosRef.current.y) / oldScale,
            };

            const newScale = e.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

            const dw = dimensions.width || container.clientWidth;
            const dh = dimensions.height || container.clientHeight;
            const minScaleX = dw / (officeWidth || 4000);
            const minScaleY = dh / (officeHeight || 4000);
            const minScale = Math.max(minScaleX, minScaleY);

            const clampedScale = Math.max(minScale, Math.min(3, newScale));
            const newPos = clampStagePosition({
                x: pointerX - mousePointTo.x * clampedScale,
                y: pointerY - mousePointTo.y * clampedScale,
            }, clampedScale);

            setZoom(clampedScale);
            setStagePos(newPos);
        };

        container.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        container.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            container.removeEventListener('wheel', handleWheel);
        };
    }, [dimensions, officeWidth, officeHeight, clampStagePosition, setMyPosition, setMyRoom, setZoom, setStagePos]);

    // ─── Avatar drag start handler ───────────────────────────
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
    }, [myPosition, zoom]);

    // ─── Zoom around center helper ───────────────────────────
    const zoomAroundCenter = useCallback((newScale: number) => {
        const container = containerRef.current;
        if (!container) return;
        const { clientWidth, clientHeight } = container;
        const centerX = clientWidth / 2;
        const centerY = clientHeight / 2;
        const oldScale = zoomRef.current;
        const mousePointTo = {
            x: (centerX - stagePosRef.current.x) / oldScale,
            y: (centerY - stagePosRef.current.y) / oldScale,
        };

        const dw = dimensions.width || clientWidth;
        const dh = dimensions.height || clientHeight;
        const minScaleX = dw / (officeWidth || 4000);
        const minScaleY = dh / (officeHeight || 4000);
        const minScale = Math.max(minScaleX, minScaleY);
        const clampedScale = Math.max(minScale, Math.min(3, newScale));

        const newPos = clampStagePosition({
            x: centerX - mousePointTo.x * clampedScale,
            y: centerY - mousePointTo.y * clampedScale,
        }, clampedScale);
        setZoom(clampedScale);
        setStagePos(newPos);
    }, [dimensions, officeWidth, officeHeight, clampStagePosition, setZoom, setStagePos]);

    // ─── MiniMap event handlers ──────────────────────────────
    useEffect(() => {
        const handleCenterOnMe = () => {
            if (!containerRef.current) return;
            const { clientWidth, clientHeight } = containerRef.current;
            const currentZoom = zoomRef.current;
            const newPos = {
                x: clientWidth / 2 - myPosition.x * currentZoom,
                y: clientHeight / 2 - myPosition.y * currentZoom,
            };
            const clamped = clampStagePosition(newPos, currentZoom);
            setStagePos(clamped);
        };

        const handleZoomIn = () => zoomAroundCenter(zoomRef.current * 1.15);
        const handleZoomOut = () => zoomAroundCenter(zoomRef.current / 1.15);
        const handleZoomReset = () => zoomAroundCenter(1);

        const handleNavigate = (e: Event) => {
            const { x, y } = (e as CustomEvent).detail;
            if (!containerRef.current) return;
            const { clientWidth, clientHeight } = containerRef.current;
            const currentZoom = zoomRef.current;
            const newPos = {
                x: clientWidth / 2 - x * currentZoom,
                y: clientHeight / 2 - y * currentZoom,
            };
            const clamped = clampStagePosition(newPos, currentZoom);
            setStagePos(clamped);
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
    }, [myPosition, zoomAroundCenter, clampStagePosition, setStagePos]);

    // ─── Screen position mapping ─────────────────────────────
    const getScreenPos = useCallback((pos: { x: number; y: number }) => ({
        x: pos.x * zoom + stagePos.x,
        y: pos.y * zoom + stagePos.y,
    }), [zoom, stagePos]);

    // ─── Viewport culling: only render visible avatars ───────
    const AVATAR_MARGIN = 100; // px buffer outside viewport
    const LOD_DISTANCE = 800;  // world-units: beyond this, use simple dot

    const isInViewport = useCallback((screenPos: { x: number; y: number }) => {
        return (
            screenPos.x > -AVATAR_MARGIN &&
            screenPos.x < dimensions.width + AVATAR_MARGIN &&
            screenPos.y > -AVATAR_MARGIN &&
            screenPos.y < dimensions.height + AVATAR_MARGIN
        );
    }, [dimensions]);

    const getDistanceFromMe = useCallback((peerPos: { x: number; y: number }) => {
        const dx = myPosition.x - peerPos.x;
        const dy = myPosition.y - peerPos.y;
        return Math.sqrt(dx * dx + dy * dy);
    }, [myPosition]);

    // ─── Stage click for builder mode ────────────────────────
    const handleStageClick = useCallback(() => {
        if (isBuilderMode) {
            useOfficeStore.getState().setSelectedRoom(null);
        }
    }, [isBuilderMode]);

    return (
        <div
            ref={containerRef}
            className={`w-full h-full overflow-hidden relative ${isPerformanceMode ? 'low-power-mode' : ''}`}
            style={{
                cursor: isDraggingAvatar ? 'grabbing' : 'grab',
                background: `
                    radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.12) 0%, transparent 40%),
                    radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.12) 0%, transparent 40%),
                    radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.08) 0%, transparent 60%),
                    linear-gradient(135deg, #050a15 0%, #0a0f1e 50%, #030712 100%)
                `,
            }}
        >
            {/* Animated grid overlay */}
            {!isPerformanceMode && (
                <div
                    className="absolute inset-0 pointer-events-none opacity-20"
                    style={{
                        backgroundImage: `
                            linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px)
                        `,
                        backgroundSize: '60px 60px',
                    }}
                />
            )}



            {/* Mini Map */}
            <MiniMap />

            {/* PixiJS WebGL Canvas */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 z-[1]"
                onClick={handleStageClick}
                style={{ touchAction: 'none' }}
            />

            {/* HUD Top-left */}
            <div className="absolute top-4 left-4 pointer-events-none z-10">
                <div className="px-4 py-2.5 rounded-xl border border-white/10 shadow-2xl flex items-center gap-3"
                    style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(20px)' }}>
                    <div className="flex items-center gap-2 border-r border-white/10 pr-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">WebGL</span>
                    </div>
                    <p className="text-xs font-medium text-slate-300">
                        Trascina il tuo avatar per muoverti • Trascina la mappa • Scroll per zoomare
                    </p>
                </div>
            </div>

            {/* Avatars Overlay */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-[2]">
                {/* Peers — with viewport culling & LOD */}
                {Object.values(peers).map((peer: any) => {
                    const screenPos = getScreenPos(peer.position);
                    // Viewport culling: skip peers outside visible area
                    if (!isInViewport(screenPos)) return null;
                    const dist = getDistanceFromMe(peer.position);
                    // LOD: distant peers render as a simple colored dot
                    if (dist > LOD_DISTANCE) {
                        return (
                            <div
                                key={peer.id}
                                className="absolute"
                                style={{
                                    left: screenPos.x,
                                    top: screenPos.y,
                                    width: 12 * zoom,
                                    height: 12 * zoom,
                                    marginLeft: -(6 * zoom),
                                    marginTop: -(6 * zoom),
                                    borderRadius: '50%',
                                    backgroundColor: peer.status === 'online' ? '#10b981'
                                        : peer.status === 'away' ? '#f59e0b'
                                            : peer.status === 'busy' ? '#ef4444' : '#64748b',
                                    border: `${1.5 * zoom}px solid rgba(15,23,42,0.8)`,
                                    boxShadow: `0 0 ${6 * zoom}px rgba(16,185,129,0.4)`,
                                    transition: 'left 0.15s, top 0.15s',
                                }}
                                title={peer.full_name}
                            />
                        );
                    }
                    // Full avatar: nearby peers
                    return (
                        <UserAvatar
                            key={peer.id}
                            id={peer.id}
                            fullName={peer.full_name}
                            avatarUrl={peer.avatar_url}
                            status={peer.status}
                            position={screenPos}
                            audioEnabled={peer.audioEnabled}
                            videoEnabled={peer.videoEnabled}
                            isSpeaking={peer.isSpeaking}
                            zoom={zoom}
                        />
                    );
                })}

                {/* Me */}
                <UserAvatar
                    id="me"
                    isMe
                    fullName={myProfile?.display_name || myProfile?.full_name || 'You'}
                    avatarUrl={myProfile?.avatar_url}
                    status={myStatus as any}
                    role={myRole || undefined}
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

            {/* Builder mode: HTML overlay with drag/resize handles */}
            {isBuilderMode && <RoomEditor rooms={rooms} />}
        </div>
    );
}
