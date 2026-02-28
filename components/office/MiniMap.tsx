'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Map, Target, ZoomIn, ZoomOut, ChevronUp, Users, Maximize2 } from 'lucide-react';
import { useOfficeStore } from '../../stores/useOfficeStore';

// ─── Office size presets ──────────────────────────────────────────
export const OFFICE_PRESETS = [
    { id: 'starter', label: 'Starter', capacity: '1–10', width: 2000, height: 1500, icon: '🏠' },
    { id: 'team', label: 'Team', capacity: '10–50', width: 4000, height: 3000, icon: '🏢' },
    { id: 'business', label: 'Business', capacity: '50–200', width: 6000, height: 4500, icon: '🏗️' },
    { id: 'enterprise', label: 'Enterprise', capacity: '200+', width: 10000, height: 7500, icon: '🌐' },
] as const;

export function getPresetForSize(w: number, h: number) {
    const area = w * h;
    if (area <= 2000 * 1500) return OFFICE_PRESETS[0];
    if (area <= 4000 * 3000) return OFFICE_PRESETS[1];
    if (area <= 6000 * 4500) return OFFICE_PRESETS[2];
    return OFFICE_PRESETS[3];
}

interface MiniMapProps {
    officeWidth?: number;
    officeHeight?: number;
}

export function MiniMap({ officeWidth = 3000, officeHeight = 3000 }: MiniMapProps) {
    const { myPosition, peers, rooms, zoom, stagePos } = useOfficeStore();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [hoveredPeer, setHoveredPeer] = useState<string | null>(null);
    const [isDraggingViewport, setIsDraggingViewport] = useState(false);
    const dragStartRef = useRef({ mouseX: 0, mouseY: 0, vpX: 0, vpY: 0 });
    const svgRef = useRef<SVGSVGElement>(null);

    // Mini-map dimensions
    const mapWidth = 220;
    const mapHeight = 150;

    // Calculate scale to fit office in mini-map
    const scaleX = mapWidth / officeWidth;
    const scaleY = mapHeight / officeHeight;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (mapWidth - officeWidth * scale) / 2;
    const offsetY = (mapHeight - officeHeight * scale) / 2;

    const tx = (x: number) => offsetX + x * scale;
    const ty = (y: number) => offsetY + y * scale;

    // Viewport rectangle
    const cw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const ch = typeof window !== 'undefined' ? window.innerHeight - 64 : 600;
    const vpX = tx(-stagePos.x / zoom);
    const vpY = ty(-stagePos.y / zoom);
    const vpW = (cw / zoom) * scale;
    const vpH = (ch / zoom) * scale;

    // Count peers per room
    const peerCountByRoom: Record<string, number> = {};
    Object.values(peers).forEach((p: any) => {
        if (p.roomId) peerCountByRoom[p.roomId] = (peerCountByRoom[p.roomId] || 0) + 1;
    });

    const totalOnline = Object.keys(peers).length + 1; // +1 for me
    const currentPreset = getPresetForSize(officeWidth, officeHeight);

    // ─── Event handlers ──────────────────────────────────────
    const navigateTo = useCallback((worldX: number, worldY: number) => {
        const clampedX = Math.max(0, Math.min(officeWidth, worldX));
        const clampedY = Math.max(0, Math.min(officeHeight, worldY));
        window.dispatchEvent(new CustomEvent('minimap-navigate', {
            detail: { x: clampedX, y: clampedY }
        }));
    }, [officeWidth, officeHeight]);

    const handleMinimapClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (isDraggingViewport) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const worldX = (e.clientX - rect.left - offsetX) / scale;
        const worldY = (e.clientY - rect.top - offsetY) / scale;
        navigateTo(worldX, worldY);
    }, [isDraggingViewport, offsetX, offsetY, scale, navigateTo]);

    // Viewport drag on minimap
    const handleViewportDragStart = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsDraggingViewport(true);
        dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, vpX, vpY };

        const handleMove = (me: MouseEvent) => {
            const dx = me.clientX - dragStartRef.current.mouseX;
            const dy = me.clientY - dragStartRef.current.mouseY;
            const worldX = (dragStartRef.current.vpX + dx - offsetX) / scale + (cw / zoom / 2);
            const worldY = (dragStartRef.current.vpY + dy - offsetY) / scale + (ch / zoom / 2);
            navigateTo(worldX, worldY);
        };
        const handleUp = () => {
            setIsDraggingViewport(false);
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
    }, [vpX, vpY, offsetX, offsetY, scale, zoom, cw, ch, navigateTo]);

    const handleZoomIn = () => window.dispatchEvent(new CustomEvent('minimap-zoom-in'));
    const handleZoomOut = () => window.dispatchEvent(new CustomEvent('minimap-zoom-out'));
    const handleResetZoom = () => window.dispatchEvent(new CustomEvent('minimap-zoom-reset'));
    const handleCenterOnMe = () => window.dispatchEvent(new CustomEvent('center-on-me'));

    // Room color by type
    const roomFill = (type: string) => {
        switch (type) {
            case 'meeting': return '#3b82f6';
            case 'focus': return '#8b5cf6';
            case 'break': return '#10b981';
            case 'open': return '#6366f1';
            case 'reception': return '#06b6d4';
            default: return '#475569';
        }
    };

    return (
        <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2">
            <div
                className="overflow-hidden transition-all duration-300"
                style={{
                    background: 'rgba(10, 15, 30, 0.92)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03) inset',
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2.5"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2">
                        <button
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                            title={isCollapsed ? 'Espandi mappa' : 'Comprimi mappa'}
                            onClick={() => setIsCollapsed(!isCollapsed)}
                        >
                            {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <Map className="w-4 h-4" />}
                        </button>
                        <div className="flex items-center gap-1.5">
                            <Users className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] font-bold text-emerald-400">{totalOnline}</span>
                        </div>
                        <span className="text-[9px] text-slate-500 font-medium">{currentPreset.icon} {currentPreset.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                            title="Centra su di me"
                            onClick={handleCenterOnMe}
                        >
                            <Target className="w-3.5 h-3.5" />
                        </button>
                        <button
                            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                            title="Fit all"
                            onClick={handleResetZoom}
                        >
                            <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Map Canvas */}
                {!isCollapsed && (
                    <>
                        <div
                            className="relative"
                            style={{
                                width: mapWidth,
                                height: mapHeight,
                                cursor: isDraggingViewport ? 'grabbing' : 'crosshair',
                                background: 'radial-gradient(circle at 50% 50%, rgba(99,102,241,0.06), transparent 70%)',
                            }}
                        >
                            <svg
                                ref={svgRef}
                                width={mapWidth}
                                height={mapHeight}
                                className="absolute inset-0"
                                onClick={handleMinimapClick}
                            >
                                {/* Office boundary */}
                                <rect
                                    x={offsetX} y={offsetY}
                                    width={officeWidth * scale} height={officeHeight * scale}
                                    fill="none" stroke="rgba(100,116,139,0.2)" strokeWidth={1}
                                    rx={3}
                                />

                                {/* Rooms with labels */}
                                {rooms.map((room: any) => {
                                    const rx = tx(room.x);
                                    const ry = ty(room.y);
                                    const rw = room.width * scale;
                                    const rh = room.height * scale;
                                    const count = peerCountByRoom[room.id] || 0;
                                    return (
                                        <g key={room.id}>
                                            <rect
                                                x={rx} y={ry} width={rw} height={rh}
                                                fill={roomFill(room.type)} opacity={0.25}
                                                rx={3 * scale} stroke={roomFill(room.type)}
                                                strokeWidth={0.8} strokeOpacity={0.5}
                                            />
                                            {/* Room name (only if big enough) */}
                                            {rw > 20 && rh > 12 && (
                                                <text
                                                    x={rx + rw / 2} y={ry + rh / 2}
                                                    textAnchor="middle" dominantBaseline="central"
                                                    fontSize={Math.min(8, rw / 6)}
                                                    fill="rgba(255,255,255,0.5)"
                                                    fontWeight="600"
                                                >
                                                    {room.name?.slice(0, 8)}
                                                </text>
                                            )}
                                            {/* Peer count badge */}
                                            {count > 0 && (
                                                <>
                                                    <circle
                                                        cx={rx + rw - 4} cy={ry + 4} r={5}
                                                        fill="#10b981" stroke="rgba(10,15,30,0.9)" strokeWidth={1}
                                                    />
                                                    <text
                                                        x={rx + rw - 4} y={ry + 4.5}
                                                        textAnchor="middle" dominantBaseline="central"
                                                        fontSize={5} fill="white" fontWeight="700"
                                                    >
                                                        {count}
                                                    </text>
                                                </>
                                            )}
                                        </g>
                                    );
                                })}

                                {/* Viewport indicator (draggable) */}
                                <rect
                                    x={vpX} y={vpY} width={vpW} height={vpH}
                                    fill="rgba(99,102,241,0.08)"
                                    stroke="rgba(99,102,241,0.5)" strokeWidth={1.2}
                                    rx={2}
                                    style={{ cursor: 'grab' }}
                                    onMouseDown={handleViewportDragStart as any}
                                />

                                {/* Peer positions with hover tooltip */}
                                {Object.values(peers).map((peer: any) => (
                                    <g key={peer.id}
                                        onMouseEnter={() => setHoveredPeer(peer.id)}
                                        onMouseLeave={() => setHoveredPeer(null)}
                                        style={{ cursor: 'pointer' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigateTo(peer.position.x, peer.position.y);
                                        }}
                                    >
                                        <circle
                                            cx={tx(peer.position.x)} cy={ty(peer.position.y)}
                                            r={hoveredPeer === peer.id ? 5 : 3}
                                            fill={peer.status === 'online' ? '#10b981' : peer.status === 'away' ? '#f59e0b' : '#ef4444'}
                                            opacity={0.9}
                                            style={{ transition: 'r 0.15s, opacity 0.15s' }}
                                        />
                                        {/* Hover tooltip */}
                                        {hoveredPeer === peer.id && (
                                            <>
                                                <rect
                                                    x={tx(peer.position.x) - 30} y={ty(peer.position.y) - 16}
                                                    width={60} height={12} rx={3}
                                                    fill="rgba(0,0,0,0.85)"
                                                />
                                                <text
                                                    x={tx(peer.position.x)} y={ty(peer.position.y) - 9}
                                                    textAnchor="middle" dominantBaseline="central"
                                                    fontSize={7} fill="white" fontWeight="500"
                                                >
                                                    {peer.full_name?.slice(0, 12) || 'User'}
                                                </text>
                                            </>
                                        )}
                                    </g>
                                ))}
                            </svg>

                            {/* My position — pulsing blue dot */}
                            <div
                                className="absolute pointer-events-none"
                                style={{
                                    left: tx(myPosition.x),
                                    top: ty(myPosition.y),
                                    transform: 'translate(-50%, -50%)',
                                }}
                            >
                                <div className="relative">
                                    <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                                        style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                                    <div className="absolute -inset-1 rounded-full bg-blue-500/30 animate-ping" style={{ animationDuration: '2s' }} />
                                </div>
                            </div>
                        </div>

                        {/* Zoom controls */}
                        <div className="flex items-center justify-between px-3 py-2"
                            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <button onClick={handleZoomOut}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                                title="Zoom out">
                                <ZoomOut className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={handleResetZoom}
                                className="text-[10px] font-mono font-bold text-slate-400 hover:text-white transition-colors px-2"
                                title="Reset zoom">
                                {Math.round(zoom * 100)}%
                            </button>
                            <button onClick={handleZoomIn}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                                title="Zoom in">
                                <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
