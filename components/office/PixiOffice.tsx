'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Application, Container, Graphics, Text, TextStyle, FederatedPointerEvent } from 'pixi.js';
import { useAvatarStore } from '../../stores/avatarStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useDailyStore } from '../../stores/dailyStore';
import { usePresence } from '../../hooks/usePresence';
import { useSpatialAudio } from '../../hooks/useSpatialAudio';
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

    // Border — thick and glowing
    body.roundRect(room.x, room.y, room.width, room.height, 16);
    body.stroke({ color: colorNum, width: isHovered ? 3.5 : 3, alpha: isHovered ? 0.9 : 0.6 });


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

    // ─── Pill label — shows department (white) or type (colored) ─────
    const pillText = department ? department.toUpperCase() : typeLabel;
    const pillIsDepart = !!department;

    const typePillBg = new Graphics();
    const typePillW = pillText.length * 6.5 + 14;
    typePillBg.roundRect(room.x + 16, room.y + 38, typePillW, 18, 9);
    typePillBg.fill({ color: pillIsDepart ? 0x1e293b : colorNum, alpha: pillIsDepart ? 0.6 : 0.18 });
    typePillBg.stroke({ color: pillIsDepart ? 0x475569 : colorNum, width: 0.8, alpha: pillIsDepart ? 0.5 : 0.35 });
    container.addChild(typePillBg);

    const typeStyle = new TextStyle({
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 9,
        fontWeight: '700',
        fill: pillIsDepart ? 0xf1f5f9 : hexColor(color),
        letterSpacing: 1.2,
    });
    const typeLabelText = new Text({ text: pillText, style: typeStyle });
    typeLabelText.position.set(room.x + 23, room.y + 42);
    container.addChild(typeLabelText);

    // ─── Bottom status line (bigger) ──────────────────────────
    if (occupants > 0) {
        // Dot
        const statusDot = new Graphics();
        statusDot.circle(room.x + 16, room.y + room.height - 18, 4);
        statusDot.fill({ color: 0x34d399, alpha: 1 });
        container.addChild(statusDot);

        const statusStyle = new TextStyle({
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 12,
            fontWeight: '700',
            fill: 0x34d399,
            letterSpacing: 0.3,
        });
        const status = new Text({ text: `${occupants} online`, style: statusStyle });
        status.position.set(room.x + 26, room.y + room.height - 26);
        container.addChild(status);
    }
}

// ─── Draw Spaceship Landing Pad ──────────────────────────────────
function drawSpaceship(container: Container, x: number, y: number, frameCount: number = 0, padScale: number = 1) {
    container.removeChildren();
    const s = padScale;

    const beamAlpha = 0.12 + Math.sin(frameCount * 0.05) * 0.06;

    // Light beam cone (triangle from ship to ground)
    const beam = new Graphics();
    beam.moveTo(x - 6 * s, y + 10 * s);
    beam.lineTo(x + 6 * s, y + 10 * s);
    beam.lineTo(x + 40 * s, y + 70 * s);
    beam.lineTo(x - 40 * s, y + 70 * s);
    beam.closePath();
    beam.fill({ color: 0x06b6d4, alpha: beamAlpha });

    // Outer glow circle on ground
    beam.circle(x, y + 70 * s, 45 * s);
    beam.fill({ color: 0x06b6d4, alpha: beamAlpha * 0.5 });
    beam.circle(x, y + 70 * s, 30 * s);
    beam.fill({ color: 0x22d3ee, alpha: beamAlpha * 0.7 });
    container.addChild(beam);

    // Ship body (triangle/capsule shape)
    const ship = new Graphics();
    // Main hull
    ship.moveTo(x, y - 18 * s);
    ship.lineTo(x + 16 * s, y + 8 * s);
    ship.lineTo(x + 8 * s, y + 14 * s);
    ship.lineTo(x - 8 * s, y + 14 * s);
    ship.lineTo(x - 16 * s, y + 8 * s);
    ship.closePath();
    ship.fill({ color: 0x1e293b, alpha: 0.95 });
    ship.stroke({ color: 0x06b6d4, width: 2, alpha: 0.8 });

    // Cockpit window
    ship.circle(x, y - 2 * s, 5 * s);
    ship.fill({ color: 0x22d3ee, alpha: 0.7 });

    // Engine glow
    ship.circle(x - 6 * s, y + 12 * s, 3 * s);
    ship.fill({ color: 0x06b6d4, alpha: 0.6 + Math.sin(frameCount * 0.1) * 0.3 });
    ship.circle(x + 6 * s, y + 12 * s, 3 * s);
    ship.fill({ color: 0x06b6d4, alpha: 0.6 + Math.sin(frameCount * 0.1 + 1) * 0.3 });

    container.addChild(ship);

    // Label
    const labelStyle = new TextStyle({
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: Math.max(7, 8 * s),
        fontWeight: '700',
        fill: 0x06b6d4,
        letterSpacing: 2,
    });
    const label = new Text({ text: 'LANDING ZONE', style: labelStyle });
    label.anchor.set(0.5, 0);
    label.position.set(x, y + 78 * s);
    container.addChild(label);
}

// ─── Main Component ──────────────────────────────────────────────
export function PixiOffice() {
    // Avatar store (positions, peers, profile)
    const myPosition = useAvatarStore(s => s.myPosition);
    const setMyPosition = useAvatarStore(s => s.setMyPosition);
    const peers = useAvatarStore(s => s.peers);
    const myProfile = useAvatarStore(s => s.myProfile);
    const myRole = useAvatarStore(s => s.myRole);
    const myStatus = useAvatarStore(s => s.myStatus);
    const setMyRoom = useAvatarStore(s => s.setMyRoom);

    // Workspace store (rooms, view, builder)
    const rooms = useWorkspaceStore(s => s.rooms);
    const zoom = useWorkspaceStore(s => s.zoom);
    const setZoom = useWorkspaceStore(s => s.setZoom);
    const setStagePos = useWorkspaceStore(s => s.setStagePos);
    const isBuilderMode = useWorkspaceStore(s => s.isBuilderMode);
    const bgOpacity = useWorkspaceStore(s => s.bgOpacity);
    const stagePos = useWorkspaceStore(s => s.stagePos);
    const officeWidth = useWorkspaceStore(s => s.officeWidth);
    const officeHeight = useWorkspaceStore(s => s.officeHeight);
    const isPerformanceMode = useWorkspaceStore(s => s.isPerformanceMode);
    const landingPad = useWorkspaceStore(s => s.landingPad);
    const setLandingPad = useWorkspaceStore(s => s.setLandingPad);
    const landingPadScale = useWorkspaceStore(s => s.landingPadScale);
    const setLandingPadScale = useWorkspaceStore(s => s.setLandingPadScale);

    // Daily store (media state)
    const isMicEnabled = useDailyStore(s => s.isAudioOn);
    const isVideoEnabled = useDailyStore(s => s.isVideoOn);
    const isSpeaking = useDailyStore(s => s.isSpeaking);
    const localStream = useDailyStore(s => s.localStream);
    const isRemoteAudioEnabled = useDailyStore(s => s.isRemoteAudioEnabled);

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

    // Landing pad dragging state (builder mode only)
    const [isDraggingPad, setIsDraggingPad] = useState(false);
    const padDragStartRef = useRef({ mouseX: 0, mouseY: 0, padX: 0, padY: 0 });

    // Refs for current zoom/stagePos (avoid stale closures)
    const zoomRef = useRef(zoom);
    const stagePosRef = useRef(stagePos);
    zoomRef.current = zoom;
    stagePosRef.current = stagePos;



    // Initialize presence, spatial audio, and Daily.co WebRTC
    usePresence();
    useSpatialAudio();

    // DailyManager is mounted in page.tsx — no hook call needed here

    // PixiJS refs for layers
    const worldRef = useRef<Container | null>(null);
    const particleGfxRef = useRef<Graphics | null>(null);
    const roomContainersRef = useRef<Map<string, Container>>(new Map());
    const connectionGfxRef = useRef<Graphics | null>(null);
    const platformGfxRef = useRef<Graphics | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    const roomLayerRef = useRef<Container | null>(null);
    const spaceshipRef = useRef<Container | null>(null);
    const spaceshipFrameRef = useRef(0);
    const [appReady, setAppReady] = useState(false);

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

            // Room layer — always on top of platform/particles/connections
            const roomLayer = new Container();
            roomLayer.label = 'rooms';
            world.addChild(roomLayer);
            roomLayerRef.current = roomLayer;

            // Spaceship landing pad layer
            const spaceshipContainer = new Container();
            spaceshipContainer.label = 'spaceship';
            world.addChild(spaceshipContainer);
            spaceshipRef.current = spaceshipContainer;

            // Draw initial spaceship
            const padPos = useWorkspaceStore.getState().landingPad;
            drawSpaceship(spaceshipContainer, padPos.x, padPos.y, 0, useWorkspaceStore.getState().landingPadScale);

            // Initialize particles
            const oW = useWorkspaceStore.getState().officeWidth || 4000;
            const oH = useWorkspaceStore.getState().officeHeight || 4000;
            particlesRef.current = createParticles(60, oW, oH);

            // ─── Draw platform ONCE (static — never changes at 60fps) ───
            if (platformGfxRef.current) {
                const pg = platformGfxRef.current;
                const bw = oW;
                const bh = oH;
                pg.roundRect(0, 0, bw, bh, 120);
                pg.fill({ color: 0x06b6d4, alpha: 0.02 });
                pg.roundRect(40, 40, bw - 80, bh - 80, 80);
                pg.fill({ color: 0x0a0f1e, alpha: 0.75 });
                pg.roundRect(40, 40, bw - 80, bh - 80, 80);
                pg.stroke({ color: 0x06b6d4, width: 1, alpha: 0.15 });
            }

            // ─── Render loop (OPTIMIZED — only transform + throttled particles) ───
            let frameCount = 0;
            app.ticker.add(() => {
                const curZoom = zoomRef.current;
                const curPos = stagePosRef.current;

                // Update world transform (lightweight — just setting position/scale)
                if (worldRef.current) {
                    worldRef.current.position.set(curPos.x, curPos.y);
                    worldRef.current.scale.set(curZoom);
                }

                // ─── Update particles at ~15fps (every 4 frames) ────
                frameCount++;
                if (frameCount % 4 === 0 && particleGfxRef.current) {
                    const pg = particleGfxRef.current;
                    pg.clear();

                    const isPerf = useWorkspaceStore.getState().isPerformanceMode;
                    if (!isPerf) {
                        particlesRef.current.forEach(p => {
                            p.x = (p.x + p.vx * 4 + oW) % oW;
                            p.y = (p.y + p.vy * 4 + oH) % oH;
                            pg.circle(p.x, p.y, p.size);
                            pg.fill({ color: 0x6366f1, alpha: p.alpha });
                        });
                    }
                }

                // ─── Update spaceship beam animation at ~15fps ────
                if (frameCount % 4 === 0 && spaceshipRef.current) {
                    spaceshipFrameRef.current = frameCount;
                    const padPos = useWorkspaceStore.getState().landingPad;
                    drawSpaceship(spaceshipRef.current, padPos.x, padPos.y, frameCount, useWorkspaceStore.getState().landingPadScale);
                }

                // Room connections are now drawn in the rooms useEffect (static)
            });
        };

        initApp().then(() => setAppReady(true));

        return () => {
            if (appRef.current) {
                appRef.current.destroy(true);
                appRef.current = null;
            }
        };
    }, []);

    // ─── Draw rooms when they change ─────────────────────
    // (decoupled from peers — occupant counts update via separate interval)
    const peersByRoomRef = useRef<Record<string, number>>({});

    // Update occupant counts every 2 seconds (not on every presence update)
    useEffect(() => {
        if (!appReady) return;
        const updateOccupants = () => {
            const avatarState = useAvatarStore.getState();
            const counts: Record<string, number> = {};
            Object.values(avatarState.peers).forEach((p: any) => {
                if (p.roomId) counts[p.roomId] = (counts[p.roomId] || 0) + 1;
            });
            if (avatarState.myRoomId) counts[avatarState.myRoomId] = (counts[avatarState.myRoomId] || 0) + 1;

            // Only redraw if counts actually changed
            const prev = peersByRoomRef.current;
            const changed = Object.keys({ ...prev, ...counts }).some(
                k => (prev[k] || 0) !== (counts[k] || 0)
            );
            if (changed) {
                peersByRoomRef.current = counts;
                // Trigger room redraw with new counts
                const layer = roomLayerRef.current;
                const existingContainers = roomContainersRef.current;
                if (layer) {
                    useWorkspaceStore.getState().rooms.forEach((room: any) => {
                        const rc = existingContainers.get(room.id);
                        if (rc) {
                            const isHovered = false; // Hover is handled by the main draw
                            drawRoom(rc, room, isHovered, counts[room.id] || 0);
                        }
                    });
                }
            }
        };
        updateOccupants(); // Initial
        const interval = setInterval(updateOccupants, 2000);
        return () => clearInterval(interval);
    }, [appReady]);

    useEffect(() => {
        if (!roomLayerRef.current || !appReady) return;

        const layer = roomLayerRef.current;
        const existingContainers = roomContainersRef.current;

        // Remove old room containers that are no longer in the list
        const currentIds = new Set(rooms.map((r: any) => r.id));
        existingContainers.forEach((container, id) => {
            if (!currentIds.has(id)) {
                layer.removeChild(container);
                container.destroy({ children: true });
                existingContainers.delete(id);
            }
        });

        // Create/update room containers (using cached occupant counts)
        const peersByRoom = peersByRoomRef.current;
        rooms.forEach((room: any) => {
            let rc = existingContainers.get(room.id);
            if (!rc) {
                rc = new Container();
                rc.label = `room-${room.id}`;
                rc.eventMode = 'static';
                rc.cursor = 'pointer';
                layer.addChild(rc);
                existingContainers.set(room.id, rc);
            }
            const isHovered = hoveredRoomId === room.id;
            const occupants = peersByRoom[room.id] || 0;
            drawRoom(rc, room, isHovered, occupants);
        });

        // ─── Draw room connections (static — only when rooms change) ───
        if (connectionGfxRef.current) {
            const cg = connectionGfxRef.current;
            cg.clear();
            const isPerf = useWorkspaceStore.getState().isPerformanceMode;
            if (!isPerf) {
                for (let i = 0; i < rooms.length; i++) {
                    for (let j = i + 1; j < rooms.length; j++) {
                        const r1 = rooms[i];
                        const r2 = rooms[j];
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
    }, [rooms, hoveredRoomId, appReady]);

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
            // Don't pan if interacting with room editor (drag/resize in builder mode)
            if ((e.target as HTMLElement).closest('[data-room-editor]')) return;

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

                const bounds = useWorkspaceStore.getState();
                const bw = bounds.officeWidth || 4000;
                const bh = bounds.officeHeight || 4000;
                const r = 24;

                const newX = Math.max(r, Math.min(rawX, bw - r));
                const newY = Math.max(r, Math.min(rawY, bh - r));
                setMyPosition({ x: newX, y: newY });
                // Broadcast position via PartyKit
                const sendFn = (window as any).__sendAvatarPosition;
                if (sendFn) sendFn(newX, newY, useAvatarStore.getState().myRoomId);
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
                const currentRooms = useWorkspaceStore.getState().rooms;
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
                useWorkspaceStore.getState().rooms.forEach((room: any) => {
                    if (finalX >= room.x && finalX <= room.x + room.width &&
                        finalY >= room.y && finalY <= room.y + room.height) {
                        found = room.id;
                    }
                });
                setMyRoom(found);
                // Broadcast room change via PartyKit
                if (found) {
                    const joinFn = (window as any).__sendJoinRoom;
                    if (joinFn) joinFn(found);
                }
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
    const LOD_DISTANCE = 2000;  // world-units: beyond this, use simple dot

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
            useWorkspaceStore.getState().setSelectedRoom(null);
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
                    <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.8)]" />
                        <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">
                            {Object.keys(peers).length + 1} Online
                        </span>
                    </div>
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
                    // Look up video stream from dailyStore participants
                    const dailyParticipants = useDailyStore.getState().participants;
                    let peerStream: MediaStream | null = peer.stream || null;
                    if (!peerStream) {
                        // Find the daily participant with matching supabaseId
                        const dailyEntry = Object.values(dailyParticipants).find(
                            (dp: any) => dp.supabaseId === peer.id
                        ) as any;
                        if (dailyEntry?.videoStream) peerStream = dailyEntry.videoStream;
                    }
                    return (
                        <UserAvatar
                            key={peer.id}
                            id={peer.id}
                            fullName={peer.full_name}
                            avatarUrl={peer.avatar_url}
                            status={peer.status}
                            role={peer.role || undefined}
                            position={screenPos}
                            audioEnabled={peer.audioEnabled}
                            videoEnabled={peer.videoEnabled}
                            remoteAudioEnabled={peer.remoteAudioEnabled}
                            isSpeaking={peer.isSpeaking}
                            stream={peerStream}
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
                    remoteAudioEnabled={isRemoteAudioEnabled}
                    isSpeaking={isSpeaking}
                    stream={localStream}
                    zoom={zoom}
                    onMouseDown={handleAvatarMouseDown}
                    isDragging={isDraggingAvatar}
                />
            </div>

            {/* Builder mode: HTML overlay with drag/resize handles */}
            {isBuilderMode && <RoomEditor rooms={rooms} />}

            {/* Draggable spaceship overlay (builder mode only) */}
            {isBuilderMode && (() => {
                const padScreen = getScreenPos(landingPad);
                const ps = landingPadScale;
                const overlayW = 80 * ps * zoom;
                const overlayH = 110 * ps * zoom;
                return (
                    <div
                        data-landing-pad
                        style={{
                            position: 'absolute',
                            left: padScreen.x - overlayW / 2,
                            top: padScreen.y - 25 * ps * zoom,
                            width: overlayW,
                            height: overlayH,
                            cursor: isDraggingPad ? 'grabbing' : 'grab',
                            zIndex: 150,
                            borderRadius: 12,
                            border: '2px dashed rgba(6, 182, 212, 0.5)',
                            background: 'rgba(6, 182, 212, 0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingBottom: 4,
                            pointerEvents: 'auto',
                        }}
                        onMouseDown={(e) => {
                            // Don't start drag if clicking on resize buttons
                            if ((e.target as HTMLElement).closest('[data-pad-resize]')) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingPad(true);
                            padDragStartRef.current = {
                                mouseX: e.clientX,
                                mouseY: e.clientY,
                                padX: landingPad.x,
                                padY: landingPad.y,
                            };

                            const handleMove = (ev: MouseEvent) => {
                                const dx = (ev.clientX - padDragStartRef.current.mouseX) / zoom;
                                const dy = (ev.clientY - padDragStartRef.current.mouseY) / zoom;
                                const bw = useWorkspaceStore.getState().officeWidth || 4000;
                                const bh = useWorkspaceStore.getState().officeHeight || 4000;
                                const newX = Math.max(50, Math.min(padDragStartRef.current.padX + dx, bw - 50));
                                const newY = Math.max(50, Math.min(padDragStartRef.current.padY + dy, bh - 50));
                                setLandingPad({ x: newX, y: newY });
                            };
                            const handleUp = () => {
                                setIsDraggingPad(false);
                                window.removeEventListener('mousemove', handleMove);
                                window.removeEventListener('mouseup', handleUp);
                            };
                            window.addEventListener('mousemove', handleMove);
                            window.addEventListener('mouseup', handleUp);
                        }}
                    >
                        {/* Resize buttons */}
                        <div data-pad-resize style={{
                            display: 'flex',
                            gap: 4,
                            marginBottom: 'auto',
                            marginTop: 4,
                        }}>
                            <button
                                data-pad-resize
                                onClick={(e) => { e.stopPropagation(); setLandingPadScale(landingPadScale - 0.25); }}
                                style={{
                                    width: 22, height: 22,
                                    borderRadius: '50%',
                                    border: '1px solid rgba(6, 182, 212, 0.5)',
                                    background: 'rgba(6, 182, 212, 0.15)',
                                    color: '#06b6d4',
                                    fontSize: 14, fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    lineHeight: 1,
                                }}
                            >−</button>
                            <button
                                data-pad-resize
                                onClick={(e) => { e.stopPropagation(); setLandingPadScale(landingPadScale + 0.25); }}
                                style={{
                                    width: 22, height: 22,
                                    borderRadius: '50%',
                                    border: '1px solid rgba(6, 182, 212, 0.5)',
                                    background: 'rgba(6, 182, 212, 0.15)',
                                    color: '#06b6d4',
                                    fontSize: 14, fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    lineHeight: 1,
                                }}
                            >+</button>
                        </div>
                        <span style={{
                            fontSize: 9 * Math.max(zoom, 0.6),
                            fontWeight: 700,
                            color: 'rgba(6, 182, 212, 0.8)',
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            userSelect: 'none',
                        }}>
                            Trascina
                        </span>
                    </div>
                );
            })()}
        </div>
    );
}
