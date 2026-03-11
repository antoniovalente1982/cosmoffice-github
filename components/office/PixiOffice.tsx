'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { useAvatarStore } from '../../stores/avatarStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useDailyStore } from '../../stores/dailyStore';
import { usePresence } from '../../hooks/usePresence';
import { useProximityAndRooms } from '../../hooks/useProximityAndRooms';
import { KnockNotification } from './KnockNotification';
import { ProximityAura, type AuraVisualState } from './ProximityAura';
import { AISetupWizard } from './AISetupWizard';
import { UserAvatar } from './UserAvatar';
import { MiniMap } from './MiniMap';
import { RoomEditor } from './RoomEditor';
import { createClient } from '../../utils/supabase/client';
import { useCallStore } from '../../stores/callStore';
import { playCallRingSound } from '../../utils/sounds';
import { useT } from '../../lib/i18n';

// ─── Extracted modules ──────────────────────────────────────────
import { drawSpaceship } from './PixiSpaceship';
import { drawRoom, drawRoomConnections } from './PixiRoomLayer';
import { createParticles, updateParticles, type Particle } from './PixiParticles';
import { getThemeConfig, type OfficeThemeConfig } from '../../lib/officeThemes';

// ─── Helpers ──────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

// ─── Corporate lobby landing pad (alternative to Spaceship) ─────
import { Graphics as PixiGraphics, Text as PixiText, TextStyle as PixiTextStyle } from 'pixi.js';

function drawCorporateLobby(container: Container, x: number, y: number, scale: number = 1) {
    container.removeChildren();
    const s = scale;
    const g = new PixiGraphics();

    // ── Outer glow ring ─────────────────────────────────────
    g.circle(x, y, 145 * s);
    g.fill({ color: 0x3b82f6, alpha: 0.08 });

    // ── Floor ───────────────────────────────────────────────
    g.roundRect(x - 120 * s, y - 90 * s, 240 * s, 180 * s, 16 * s);
    g.fill({ color: 0x1e293b, alpha: 0.95 });
    g.roundRect(x - 120 * s, y - 90 * s, 240 * s, 180 * s, 16 * s);
    g.stroke({ color: 0x3b82f6, width: 1.5, alpha: 0.3 });

    // Inner floor accent
    g.roundRect(x - 108 * s, y - 78 * s, 216 * s, 156 * s, 12 * s);
    g.fill({ color: 0x0f172a, alpha: 0.4 });
    g.roundRect(x - 108 * s, y - 78 * s, 216 * s, 156 * s, 12 * s);
    g.stroke({ color: 0x475569, width: 0.5, alpha: 0.3 });

    // ── Desk ────────────────────────────────────────────────
    g.roundRect(x - 50 * s, y - 25 * s, 100 * s, 32 * s, 6 * s);
    g.fill({ color: 0x44403c, alpha: 1 });
    g.roundRect(x - 48 * s, y - 23 * s, 96 * s, 28 * s, 4 * s);
    g.fill({ color: 0x57534e, alpha: 0.9 });

    // Gold accent strip
    g.roundRect(x - 46 * s, y + 3 * s, 92 * s, 2 * s, 1 * s);
    g.fill({ color: 0xd97706, alpha: 0.6 });

    // Monitor (ultrawide)
    g.roundRect(x - 22 * s, y - 20 * s, 44 * s, 18 * s, 2.5 * s);
    g.fill({ color: 0x1e1e1e, alpha: 1 });
    g.roundRect(x - 20 * s, y - 18 * s, 40 * s, 14 * s, 2 * s);
    g.fill({ color: 0x2563eb, alpha: 0.3 }); // bright screen glow
    // Monitor stand
    g.roundRect(x - 5 * s, y - 2 * s, 10 * s, 4 * s, 1 * s);
    g.fill({ color: 0x44403c, alpha: 1 });

    // Keyboard
    g.roundRect(x - 14 * s, y + 4 * s, 28 * s, 7 * s, 2 * s);
    g.fill({ color: 0x374151, alpha: 0.9 });

    // ── Chair behind desk ───────────────────────────────────
    g.circle(x, y - 38 * s, 11 * s);
    g.fill({ color: 0x374151, alpha: 0.9 });
    g.circle(x, y - 38 * s, 7 * s);
    g.fill({ color: 0x4b5563, alpha: 0.8 });

    // ── Visitor chairs ──────────────────────────────────────
    g.roundRect(x - 38 * s, y + 32 * s, 18 * s, 16 * s, 6 * s);
    g.fill({ color: 0x374151, alpha: 0.85 });
    g.roundRect(x - 36 * s, y + 34 * s, 14 * s, 12 * s, 4 * s);
    g.fill({ color: 0x4b5563, alpha: 0.7 });

    g.roundRect(x + 20 * s, y + 32 * s, 18 * s, 16 * s, 6 * s);
    g.fill({ color: 0x374151, alpha: 0.85 });
    g.roundRect(x + 22 * s, y + 34 * s, 14 * s, 12 * s, 4 * s);
    g.fill({ color: 0x4b5563, alpha: 0.7 });

    // Side table
    g.circle(x, y + 40 * s, 6 * s);
    g.fill({ color: 0x44403c, alpha: 0.85 });
    g.circle(x, y + 40 * s, 6 * s);
    g.stroke({ color: 0x78716c, width: 1, alpha: 0.5 });

    // ── Plants ──────────────────────────────────────────────
    // Left
    g.roundRect(x - 104 * s, y + 35 * s, 14 * s, 12 * s, 3 * s);
    g.fill({ color: 0x78350f, alpha: 0.8 }); // pot
    g.circle(x - 97 * s, y + 28 * s, 12 * s);
    g.fill({ color: 0x15803d, alpha: 0.7 });
    g.circle(x - 94 * s, y + 22 * s, 9 * s);
    g.fill({ color: 0x22c55e, alpha: 0.5 });

    // Right
    g.roundRect(x + 90 * s, y + 35 * s, 14 * s, 12 * s, 3 * s);
    g.fill({ color: 0x78350f, alpha: 0.8 });
    g.circle(x + 97 * s, y + 28 * s, 12 * s);
    g.fill({ color: 0x15803d, alpha: 0.7 });
    g.circle(x + 100 * s, y + 22 * s, 9 * s);
    g.fill({ color: 0x22c55e, alpha: 0.5 });

    // ── Entry floor light ───────────────────────────────────
    g.roundRect(x - 35 * s, y + 82 * s, 70 * s, 2.5 * s, 1 * s);
    g.fill({ color: 0x3b82f6, alpha: 0.4 });

    container.addChild(g);

    // ── RECEPTION text — below the lobby (zoom-adaptive) ──
    const receptionFontSize = Math.max(16, 16 * s * Math.max(1, 1.2 / Math.max(s, 0.2)));
    const titleStyle = new PixiTextStyle({
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: receptionFontSize,
        fontWeight: '700',
        fill: 0xffffff,
        letterSpacing: 2,
        dropShadow: { color: 0x000000, alpha: 0.5, blur: 4, distance: 0 },
    });
    const title = new PixiText({ text: 'RECEPTION', style: titleStyle, resolution: 2 });
    title.anchor.set(0.5, 0);
    title.position.set(x, y + 92 * s);
    container.addChild(title);

    // Decorative line above text
    const line = new PixiGraphics();
    line.roundRect(x - 35 * s, y + 88 * s, 70 * s, 1 * s, 0);
    line.fill({ color: 0x3b82f6, alpha: 0.4 });
    container.addChild(line);
}
// ─── Main Component ──────────────────────────────────────────────
export function PixiOffice() {
    const supabase = createClient();
    // Avatar store (positions, peers, profile)
    const myPosition = useAvatarStore(s => s.myPosition);
    const setMyPosition = useAvatarStore(s => s.setMyPosition);
    const peers = useAvatarStore(s => s.peers);
    const myProfile = useAvatarStore(s => s.myProfile);
    const myRole = useAvatarStore(s => s.myRole);
    const myStatus = useAvatarStore(s => s.myStatus);
    const setMyRoom = useAvatarStore(s => s.setMyRoom);
    const { t } = useT();

    // Workspace store (rooms, view, builder)
    const rooms = useWorkspaceStore(s => s.rooms);
    const roomConnections = useWorkspaceStore(s => s.roomConnections);
    const zoom = useWorkspaceStore(s => s.zoom);
    const setZoom = useWorkspaceStore(s => s.setZoom);
    const setStagePos = useWorkspaceStore(s => s.setStagePos);
    const isBuilderMode = useWorkspaceStore(s => s.isBuilderMode);
    const bgOpacity = useWorkspaceStore(s => s.bgOpacity);
    const stagePos = useWorkspaceStore(s => s.stagePos);
    const officeWidth = useWorkspaceStore(s => s.officeWidth);
    const officeHeight = useWorkspaceStore(s => s.officeHeight);
    const layoutMode = useWorkspaceStore(s => s.layoutMode);
    const isPerformanceMode = useWorkspaceStore(s => s.isPerformanceMode);
    const landingPad = useWorkspaceStore(s => s.landingPad);
    const setLandingPad = useWorkspaceStore(s => s.setLandingPad);
    const landingPadScale = useWorkspaceStore(s => s.landingPadScale);
    const setLandingPadScale = useWorkspaceStore(s => s.setLandingPadScale);
    const theme = useWorkspaceStore(s => s.theme);
    const themeConfig = useMemo(() => getThemeConfig(theme), [theme]);

    // ─── Sync low-power-mode class on body for global CSS rules ──
    useEffect(() => {
        if (isPerformanceMode) {
            document.body.classList.add('low-power-mode');
        } else {
            document.body.classList.remove('low-power-mode');
        }
        return () => document.body.classList.remove('low-power-mode');
    }, [isPerformanceMode]);

    // ─── Auto-save landing pad to Supabase ───────────────────
    const saveLandingPadToDb = useCallback(async () => {
        const state = useWorkspaceStore.getState();
        if (!state.activeSpaceId) return;
        const { data: space } = await supabase
            .from('spaces')
            .select('layout_data')
            .eq('id', state.activeSpaceId)
            .single();
        const existing = (space?.layout_data as any) || {};
        const layout_data = {
            ...existing,
            landingPadX: state.landingPad.x,
            landingPadY: state.landingPad.y,
            landingPadScale: state.landingPadScale,
        };
        await supabase.from('spaces').update({ layout_data }).eq('id', state.activeSpaceId);
    }, [supabase]);

    // Daily store (media state)
    const isMicEnabled = useDailyStore(s => s.isAudioOn);
    const isVideoEnabled = useDailyStore(s => s.isVideoOn);
    const isSpeaking = useDailyStore(s => s.isSpeaking);
    const localStream = useDailyStore(s => s.localStream);
    const isRemoteAudioEnabled = useDailyStore(s => s.isRemoteAudioEnabled);

    const activeSpaceId = useWorkspaceStore(s => s.activeSpaceId);
    const [showWizard, setShowWizard] = useState(false);
    const [wizardDismissed, setWizardDismissed] = useState(false);

    // Show AI Setup Wizard for empty workspaces
    useEffect(() => {
        if (rooms.length === 0 && activeSpaceId && !wizardDismissed && (myRole === 'owner' || myRole === 'admin')) {
            const timer = setTimeout(() => setShowWizard(true), 1500);
            return () => clearTimeout(timer);
        } else {
            setShowWizard(false);
        }
    }, [rooms.length, activeSpaceId, wizardDismissed, myRole]);

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

    // Landing pad drag effect
    useEffect(() => {
        if (!isDraggingPad) return;
        const handleMove = (ev: MouseEvent) => {
            const z = useWorkspaceStore.getState().zoom || 1;
            const dx = (ev.clientX - padDragStartRef.current.mouseX) / z;
            const dy = (ev.clientY - padDragStartRef.current.mouseY) / z;
            const bw = useWorkspaceStore.getState().officeWidth || 4000;
            const bh = useWorkspaceStore.getState().officeHeight || 4000;
            const newX = Math.max(50, Math.min(padDragStartRef.current.padX + dx, bw - 50));
            const newY = Math.max(50, Math.min(padDragStartRef.current.padY + dy, bh - 50));
            setLandingPad({ x: newX, y: newY });
        };
        const handleUp = () => {
            setIsDraggingPad(false);
            saveLandingPadToDb();
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [isDraggingPad, setLandingPad, saveLandingPadToDb]);

    // Refs for current zoom/stagePos (avoid stale closures)
    const zoomRef = useRef(zoom);
    const stagePosRef = useRef(stagePos);
    zoomRef.current = zoom;
    stagePosRef.current = stagePos;

    // Initialize presence, proximity/rooms engine
    usePresence();
    useProximityAndRooms();

    // PixiJS refs for layers
    const worldRef = useRef<Container | null>(null);
    const particleGfxRef = useRef<Graphics | null>(null);
    const roomContainersRef = useRef<Map<string, Container>>(new Map());
    const connectionGfxRef = useRef<Graphics | null>(null);
    const connectionLabelContainerRef = useRef<Container | null>(null);
    const platformGfxRef = useRef<Graphics | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    const roomLayerRef = useRef<Container | null>(null);
    const spaceshipRef = useRef<Container | null>(null);
    const spaceshipFrameRef = useRef(0);
    const auraRef = useRef<ProximityAura | null>(null);
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
        const oW = useWorkspaceStore.getState().officeWidth || 4000;
        const oH = useWorkspaceStore.getState().officeHeight || 4000;

        const initApp = async () => {
            await app.init({
                canvas: canvasRef.current!,
                background: themeConfig.canvasBg,
                antialias: true,
                resolution: window.devicePixelRatio || 2,
                autoDensity: true,
                resizeTo: containerRef.current!,
            });

            appRef.current = app;

            // Create world container
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

            // Connection labels layer (above connection lines)
            const connectionLabels = new Container();
            connectionLabels.label = 'connection-labels';
            world.addChild(connectionLabels);
            connectionLabelContainerRef.current = connectionLabels;

            // Room layer
            const roomLayer = new Container();
            roomLayer.label = 'rooms';
            world.addChild(roomLayer);
            roomLayerRef.current = roomLayer;

            // Proximity aura layer
            const aura = new ProximityAura();
            world.addChildAt(aura.graphics, world.getChildIndex(roomLayer));
            auraRef.current = aura;

            // Spaceship / Corporate landing pad layer
            const spaceshipContainer = new Container();
            spaceshipContainer.label = 'spaceship';
            world.addChild(spaceshipContainer);
            spaceshipRef.current = spaceshipContainer;

            // Draw initial landing pad (spaceship or corporate lobby)
            const padPos = useWorkspaceStore.getState().landingPad;
            const currentTheme = getThemeConfig(useWorkspaceStore.getState().theme);
            if (currentTheme.showSpaceship) {
                drawSpaceship(spaceshipContainer, padPos.x, padPos.y, 0, useWorkspaceStore.getState().landingPadScale);
            } else {
                drawCorporateLobby(spaceshipContainer, padPos.x, padPos.y, useWorkspaceStore.getState().landingPadScale);
            }

            // Initialize particles
            particlesRef.current = createParticles(40, oW, oH);

            // Draw platform ONCE (static) — only in free mode
            if (platformGfxRef.current) {
                const pg = platformGfxRef.current;
                const currentMode = useWorkspaceStore.getState().layoutMode;
                const tc = getThemeConfig(useWorkspaceStore.getState().theme);
                if (currentMode === 'free') {
                    pg.roundRect(0, 0, oW, oH, 120);
                    pg.fill({ color: tc.platformFill, alpha: tc.platformFillAlpha });
                    pg.roundRect(40, 40, oW - 80, oH - 80, 80);
                    pg.fill({ color: tc.platformInnerFill, alpha: tc.platformInnerAlpha });
                    pg.roundRect(40, 40, oW - 80, oH - 80, 80);
                    pg.stroke({ color: tc.platformBorder, width: 1, alpha: tc.platformBorderAlpha });
                }
            }

            // ─── Render loop ─────────────────────────────────────
            let frameCount = 0;
            app.ticker.maxFPS = 30; // Cap at 30fps — more than enough for office
            app.ticker.add(() => {
                const curZoom = zoomRef.current;
                const curPos = stagePosRef.current;

                // Update world transform (every frame for smooth panning)
                if (worldRef.current) {
                    worldRef.current.position.set(curPos.x, curPos.y);
                    worldRef.current.scale.set(curZoom);
                }

                frameCount++;

                // Particles + Landing Pad at ~4fps (every 8th frame at 30fps)
                if (frameCount % 8 === 0) {
                    if (particleGfxRef.current) {
                        const tc = getThemeConfig(useWorkspaceStore.getState().theme);
                        if (tc.showParticles) {
                            updateParticles(particleGfxRef.current, particlesRef.current, oW, oH, useWorkspaceStore.getState().isPerformanceMode, tc.particleColors, tc.particleAlpha);
                        } else {
                            particleGfxRef.current.clear();
                        }
                    }
                    if (spaceshipRef.current) {
                        spaceshipFrameRef.current = frameCount;
                        const padPos = useWorkspaceStore.getState().landingPad;
                        const tc = getThemeConfig(useWorkspaceStore.getState().theme);
                        if (tc.showSpaceship) {
                            drawSpaceship(spaceshipRef.current, padPos.x, padPos.y, frameCount, useWorkspaceStore.getState().landingPadScale);
                        } else {
                            drawCorporateLobby(spaceshipRef.current, padPos.x, padPos.y, useWorkspaceStore.getState().landingPadScale);
                        }
                    }
                }

                // Proximity aura — EVERY frame (cheap: only position/alpha/scale, no redraw)
                if (auraRef.current) {
                    try {
                        const avatarState = useAvatarStore.getState();
                        const dailyState = useDailyStore.getState();
                        const wsState = useWorkspaceStore.getState();
                        const myPos = avatarState.myPosition;

                        let auraState: AuraVisualState = 'idle';
                        if (avatarState.myDnd) auraState = 'dnd';
                        else if (avatarState.myRoomId) auraState = 'none';
                        else if (dailyState.activeContext === 'proximity') auraState = 'active';

                        // Only rebuild room rects when state check runs (cheap object creation)
                        const roomRects = (wsState.rooms || []).map((r: any) => ({
                            x: r.x, y: r.y, width: r.width, height: r.height,
                        }));

                        auraRef.current.setState(auraState);
                        auraRef.current.update(app.ticker.deltaMS, myPos.x, myPos.y, roomRects);
                    } catch (e) {
                        console.warn('[Aura] Error in aura update:', e);
                    }
                }
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

    // ─── Track last-drawn zoom for threshold-based redraw ───
    const lastDrawnZoomRef = useRef(1);

    // ─── Draw rooms when they change ─────────────────────
    const peersByRoomRef = useRef<Record<string, number>>({});

    // Update occupant counts every 2 seconds
    useEffect(() => {
        if (!appReady) return;
        const updateOccupants = () => {
            const avatarState = useAvatarStore.getState();
            const counts: Record<string, number> = {};
            Object.values(avatarState.peers).forEach((p: any) => {
                // Skip ghost peers with invalid positions
                if (p.position?.x === -9999 && p.position?.y === -9999) return;
                if (!p.position || (p.position.x < -9000 && p.position.y < -9000)) return;
                if (p.roomId) counts[p.roomId] = (counts[p.roomId] || 0) + 1;
            });
            if (avatarState.myRoomId) counts[avatarState.myRoomId] = (counts[avatarState.myRoomId] || 0) + 1;

            const prev = peersByRoomRef.current;
            const changed = Object.keys({ ...prev, ...counts }).some(
                k => (prev[k] || 0) !== (counts[k] || 0)
            );
            if (changed) {
                peersByRoomRef.current = counts;
                const existingContainers = roomContainersRef.current;
                const tc = getThemeConfig(useWorkspaceStore.getState().theme);
                useWorkspaceStore.getState().rooms.forEach((room: any) => {
                    const rc = existingContainers.get(room.id);
                    if (rc) drawRoom(rc, room, false, counts[room.id] || 0, tc, useWorkspaceStore.getState().zoom);
                });
            }
        };
        updateOccupants();
        const interval = setInterval(updateOccupants, 2000);
        return () => clearInterval(interval);
    }, [appReady]);

    useEffect(() => {
        if (!roomLayerRef.current || !appReady) return;

        const layer = roomLayerRef.current;
        const existingContainers = roomContainersRef.current;

        // Remove old room containers
        const currentIds = new Set(rooms.map((r: any) => r.id));
        existingContainers.forEach((container, id) => {
            if (!currentIds.has(id)) {
                layer.removeChild(container);
                container.destroy({ children: true });
                existingContainers.delete(id);
            }
        });

        // Create/update room containers
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
            drawRoom(rc, room, isHovered, peersByRoom[room.id] || 0, themeConfig, zoom);
        });

        // Track the zoom we last drew at
        lastDrawnZoomRef.current = zoom;

        // Draw room connections
        if (connectionGfxRef.current) {
            drawRoomConnections(
                connectionGfxRef.current,
                rooms,
                useWorkspaceStore.getState().isPerformanceMode,
                roomConnections,
                connectionLabelContainerRef.current || undefined,
                layoutMode,
                useWorkspaceStore.getState().isBuilderMode
            );
        }
    }, [rooms, roomConnections, hoveredRoomId, appReady, layoutMode, zoom]);

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
            if (isDraggingAvatarRef.current) return;
            if ((e.target as HTMLElement).closest('[data-avatar]')) return;
            if ((e.target as HTMLElement).closest('[data-room-editor]')) return;
            if ((e.target as HTMLElement).closest('[data-landing-pad]')) return;

            isPanningRef.current = true;
            panStartRef.current = {
                mouseX: e.clientX, mouseY: e.clientY,
                stagePosX: stagePosRef.current.x, stagePosY: stagePosRef.current.y,
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

            // Room hover detection
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
                useAvatarStore.getState().setDragging(false);
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
                const currentRoom = useAvatarStore.getState().myRoomId;
                setMyRoom(found);
                if (found && found !== currentRoom) {
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
        useAvatarStore.getState().setDragging(true);
        dragStartRef.current = {
            mouseX: e.clientX, mouseY: e.clientY,
            posX: myPosition.x, posY: myPosition.y, zoom,
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
            setStagePos(clampStagePosition(newPos, currentZoom));
        };
        const handleZoomIn = () => zoomAroundCenter(zoomRef.current * 1.15);
        const handleZoomOut = () => zoomAroundCenter(zoomRef.current / 1.15);
        const handleZoomReset = () => zoomAroundCenter(1);
        const handleNavigate = (e: Event) => {
            const { x, y } = (e as CustomEvent).detail;
            if (!containerRef.current) return;
            const { clientWidth, clientHeight } = containerRef.current;
            const currentZoom = zoomRef.current;
            const newPos = { x: clientWidth / 2 - x * currentZoom, y: clientHeight / 2 - y * currentZoom };
            setStagePos(clampStagePosition(newPos, currentZoom));
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

    // ─── Click-to-call on peer avatar ────────────────────────
    const handlePeerClick = useCallback((peerId: string, peerName: string) => {
        const myProfileData = useAvatarStore.getState().myProfile;
        const myId = useAvatarStore.getState().myProfile?.id;
        const socket = (window as any).__partykitSocket;

        if (!socket || socket.readyState !== WebSocket.OPEN || !myProfileData || !myId) return;

        // Don't call if already in a call
        const { outgoingCall, incomingCall } = useCallStore.getState();
        if (outgoingCall || incomingCall) return;

        const callId = crypto.randomUUID();
        socket.send(JSON.stringify({
            type: 'call_request',
            id: callId,
            fromUserId: myId,
            fromName: myProfileData.display_name || myProfileData.full_name || 'User',
            fromAvatarUrl: myProfileData.avatar_url || null,
            toUserId: peerId,
        }));
        // Caller hears the ring immediately
        playCallRingSound();
        useCallStore.getState().setOutgoingCall({
            id: callId,
            fromUserId: myId,
            fromName: myProfileData.display_name || myProfileData.full_name || 'User',
            toUserId: peerId,
            toName: peerName,
            timestamp: Date.now(),
            status: 'pending',
        });
        // Auto-timeout after 30s
        setTimeout(() => {
            const current = useCallStore.getState().outgoingCall;
            if (current?.id === callId) {
                useCallStore.getState().setOutgoingCall(null);
                useCallStore.getState().setCallResponse({ type: 'timeout', fromName: peerName });
            }
        }, 30000);
    }, []);

    // ─── Viewport culling ────────────────────────────────────
    const AVATAR_MARGIN = 100;
    const LOD_DISTANCE = 2000;

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
                background: themeConfig.bgGradientCSS,
            }}
        >
            {/* Animated grid overlay */}
            {!isPerformanceMode && (
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        opacity: themeConfig.gridOpacity,
                        backgroundImage: themeConfig.gridCSS,
                        backgroundSize: themeConfig.id === 'corporate' ? '20px 20px' : '60px 60px',
                    }}
                />
            )}

            {/* Mini Map */}
            <MiniMap />

            {/* AI Setup Wizard — shown for empty workspaces */}
            {showWizard && activeSpaceId && (
                <AISetupWizard
                    spaceId={activeSpaceId}
                    onComplete={() => { setShowWizard(false); setWizardDismissed(true); }}
                    onDismiss={() => { setShowWizard(false); setWizardDismissed(true); }}
                />
            )}

            {/* Knock-to-enter notifications */}
            <KnockNotification />

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
                    style={{ background: 'rgba(15, 23, 42, 0.9)' }}>
                    <div className="flex items-center gap-2 border-r border-white/10 pr-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${themeConfig.id === 'corporate' ? 'bg-blue-500' : 'bg-cyan-400'} shadow-[0_0_6px_${themeConfig.id === 'corporate' ? 'rgba(59,130,246,0.8)' : 'rgba(34,211,238,0.8)'}]`} />
                        <span className={`text-[10px] font-bold ${themeConfig.hudBadgeColor} uppercase tracking-widest`}>{themeConfig.hudBadgeText}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-300">
                        {t('office.hudInstructions')}
                    </p>
                    <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.8)]" />
                        <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">
                            {Object.values(peers).filter((p: any) => p.position && p.position.x > -9000).length + 1} {t('office.hudOnline')}
                        </span>
                    </div>
                </div>
            </div>

            {/* Avatars Overlay */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-[2]">
                {/* Peers — with viewport culling & LOD */}
                {Object.values(peers).map((peer: any) => {
                    // Skip peers that haven't broadcast their position yet (sentinel = -9999)
                    if (!peer.position || (peer.position.x < -9000 && peer.position.y < -9000)) return null;
                    const screenPos = getScreenPos(peer.position);
                    if (!isInViewport(screenPos)) return null;
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
                            zoom={zoom}
                            onClick={() => handlePeerClick(peer.id, peer.full_name || 'User')}
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
                const overlayW = 100;
                const overlayH = 110;
                const ow = officeWidth || 4000;
                const oh = officeHeight || 4000;

                const presetPositions = [
                    { label: '⊕ Centro', x: ow / 2, y: oh / 2 },
                    { label: '⬆ Alto Centro', x: ow / 2, y: 150 },
                ];

                return (
                    <>
                        {/* Toolbar above spaceship */}
                        <div
                            data-landing-pad
                            style={{
                                position: 'absolute',
                                left: padScreen.x - 90,
                                top: padScreen.y - 30 * landingPadScale * zoom - 74,
                                width: 180,
                                zIndex: 160, pointerEvents: 'auto',
                                background: 'rgba(10, 15, 30, 0.97)',
                                borderRadius: 10, border: '1px solid rgba(6, 182, 212, 0.4)',
                                padding: '6px 8px',
                                display: 'flex', flexDirection: 'column', gap: 5,
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                            }}
                        >
                            {/* Position preset row */}
                            <div style={{ display: 'flex', gap: 4 }}>
                                {presetPositions.map((preset) => (
                                    <button
                                        key={preset.label}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setLandingPad({ x: preset.x, y: preset.y });
                                            setTimeout(saveLandingPadToDb, 100);
                                        }}
                                        style={{
                                            flex: 1, height: 22, borderRadius: 5,
                                            border: '1px solid rgba(6, 182, 212, 0.3)',
                                            background: 'rgba(6, 182, 212, 0.1)',
                                            color: '#06b6d4', fontSize: 9, fontWeight: 700,
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            letterSpacing: 0.5,
                                        }}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                            {/* Scale controls row */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setLandingPadScale(landingPadScale - 0.25); setTimeout(saveLandingPadToDb, 100); }}
                                    style={{
                                        width: 22, height: 22, borderRadius: 5,
                                        border: '1px solid rgba(6, 182, 212, 0.5)',
                                        background: 'rgba(6, 182, 212, 0.15)',
                                        color: '#06b6d4', fontSize: 14, fontWeight: 700,
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                                    }}
                                >−</button>
                                <span style={{
                                    fontSize: 10, fontWeight: 700, color: '#22d3ee',
                                    minWidth: 36, textAlign: 'center', userSelect: 'none',
                                }}>{Math.round(landingPadScale * 100)}%</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setLandingPadScale(landingPadScale + 0.25); setTimeout(saveLandingPadToDb, 100); }}
                                    style={{
                                        width: 22, height: 22, borderRadius: 5,
                                        border: '1px solid rgba(6, 182, 212, 0.5)',
                                        background: 'rgba(6, 182, 212, 0.15)',
                                        color: '#06b6d4', fontSize: 14, fontWeight: 700,
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                                    }}
                                >+</button>
                            </div>
                            {/* Coordinates info */}
                            <div style={{
                                fontSize: 8, color: 'rgba(6, 182, 212, 0.5)', textAlign: 'center',
                                fontWeight: 600, letterSpacing: 0.5,
                            }}>
                                X:{Math.round(landingPad.x)} Y:{Math.round(landingPad.y)}
                            </div>
                        </div>
                        {/* Drag area */}
                        <div
                            data-landing-pad
                            style={{
                                position: 'absolute',
                                left: padScreen.x - overlayW / 2,
                                top: padScreen.y - 25 * landingPadScale * zoom,
                                width: overlayW, height: overlayH,
                                cursor: isDraggingPad ? 'grabbing' : 'grab',
                                zIndex: 150, borderRadius: 12,
                                border: '2px dashed rgba(6, 182, 212, 0.5)',
                                background: 'rgba(6, 182, 212, 0.05)',
                                display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 6,
                                pointerEvents: 'auto',
                            }}
                            onMouseDown={(e) => {
                                e.preventDefault(); e.stopPropagation();
                                setIsDraggingPad(true);
                                padDragStartRef.current = {
                                    mouseX: e.clientX, mouseY: e.clientY,
                                    padX: landingPad.x, padY: landingPad.y,
                                };
                            }}
                        >
                            <span style={{
                                fontSize: 9, fontWeight: 700, color: 'rgba(6, 182, 212, 0.8)',
                                letterSpacing: 1, textTransform: 'uppercase', userSelect: 'none',
                            }}>
                                ✦ Landing Zone
                            </span>
                        </div>
                    </>
                );
            })()}
        </div>
    );
}
