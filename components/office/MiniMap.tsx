'use client';

import React from 'react';
import { Map, Target, ZoomIn, ZoomOut } from 'lucide-react';
import { useOfficeStore } from '../../stores/useOfficeStore';

interface MiniMapProps {
    officeWidth?: number;
    officeHeight?: number;
}

export function MiniMap({ officeWidth = 3000, officeHeight = 3000 }: MiniMapProps) {
    const { myPosition, peers, rooms, zoom, setZoom, stagePos } = useOfficeStore();
    
    // Mini-map dimensions
    const mapWidth = 180;
    const mapHeight = 120;
    
    // Calculate scale to fit office in mini-map
    const scaleX = mapWidth / officeWidth;
    const scaleY = mapHeight / officeHeight;
    const scale = Math.min(scaleX, scaleY);
    
    // Calculate offset to center the map
    const offsetX = (mapWidth - officeWidth * scale) / 2;
    const offsetY = (mapHeight - officeHeight * scale) / 2;
    
    // Transform position to mini-map coordinates
    const transformX = (x: number) => offsetX + x * scale;
    const transformY = (y: number) => offsetY + y * scale;
    
    // Calculate viewport rectangle (what's currently visible)
    const containerWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const containerHeight = typeof window !== 'undefined' ? window.innerHeight - 64 : 600;
    
    const viewportX = transformX(-stagePos.x / zoom);
    const viewportY = transformY(-stagePos.y / zoom);
    const viewportWidth = (containerWidth / zoom) * scale;
    const viewportHeight = (containerHeight / zoom) * scale;

    const handleZoomIn = () => {
        setZoom(Math.min(2, zoom + 0.1));
    };

    const handleZoomOut = () => {
        setZoom(Math.max(0.5, zoom - 0.1));
    };

    const handleResetZoom = () => {
        setZoom(1);
    };

    return (
        <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2">
            {/* Main mini-map card */}
            <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-xl overflow-hidden">
                {/* Header with icons */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                        <button 
                            className="p-1.5 rounded-lg bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                            title="Mappa"
                        >
                            <Map className="w-4 h-4" />
                        </button>
                        <button 
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                            title="Centra sulla mia posizione"
                            onClick={() => {
                                // This will be handled by the parent component
                                window.dispatchEvent(new CustomEvent('center-on-me'));
                            }}
                        >
                            <Target className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                
                {/* Map canvas */}
                <div 
                    className="relative bg-slate-800/50"
                    style={{ width: mapWidth, height: mapHeight }}
                >
                    <svg 
                        width={mapWidth} 
                        height={mapHeight}
                        className="absolute inset-0"
                    >
                        {/* Background grid dots */}
                        {Array.from({ length: 10 }).map((_, i) =>
                            Array.from({ length: 10 }).map((_, j) => (
                                <circle
                                    key={`grid-${i}-${j}`}
                                    cx={offsetX + (i * officeWidth / 10) * scale}
                                    cy={offsetY + (j * officeHeight / 10) * scale}
                                    r={0.5}
                                    fill="#475569"
                                    opacity={0.3}
                                />
                            ))
                        )}
                        
                        {/* Rooms */}
                        {rooms.map((room) => (
                            <rect
                                key={room.id}
                                x={transformX(room.x)}
                                y={transformY(room.y)}
                                width={room.width * scale}
                                height={room.height * scale}
                                fill={
                                    room.type === 'meeting' ? '#1e3a8a' :
                                    room.type === 'focus' ? '#312e81' :
                                    room.type === 'break' ? '#065f46' :
                                    '#1e293b'
                                }
                                opacity={0.6}
                                rx={4 * scale}
                                stroke="#334155"
                                strokeWidth={0.5}
                            />
                        ))}
                        
                        {/* Viewport indicator (what's currently visible) */}
                        <rect
                            x={viewportX}
                            y={viewportY}
                            width={viewportWidth}
                            height={viewportHeight}
                            fill="none"
                            stroke="#64748b"
                            strokeWidth={1}
                            strokeDasharray="2,2"
                            opacity={0.5}
                        />
                        
                        {/* Peer positions */}
                        {Object.values(peers).map((peer) => (
                            <circle
                                key={peer.id}
                                cx={transformX(peer.position.x)}
                                cy={transformY(peer.position.y)}
                                r={3}
                                fill="#10b981"
                                opacity={0.8}
                            />
                        ))}
                    </svg>
                    
                    {/* User position indicator - blue square with dot (scales with zoom) */}
                    <div
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        style={{
                            left: transformX(myPosition.x),
                            top: transformY(myPosition.y),
                        }}
                    >
                        {/* Outer blue square - scales with zoom */}
                        <div 
                            className="border-2 border-blue-500 bg-blue-500/20 rounded-sm flex items-center justify-center transition-all duration-75"
                            style={{
                                width: `${16 * zoom}px`,
                                height: `${16 * zoom}px`,
                                minWidth: '10px',
                                minHeight: '10px',
                                maxWidth: '32px',
                                maxHeight: '32px',
                            }}
                        >
                            {/* Inner blue dot - scales with zoom */}
                            <div 
                                className="bg-blue-500 rounded-full transition-all duration-75"
                                style={{
                                    width: `${6 * zoom}px`,
                                    height: `${6 * zoom}px`,
                                    minWidth: '3px',
                                    minHeight: '3px',
                                    maxWidth: '12px',
                                    maxHeight: '12px',
                                }}
                            />
                        </div>
                    </div>
                </div>
                
                {/* Zoom controls */}
                <div className="flex items-center justify-between px-2 py-2 border-t border-slate-700/50">
                    <button
                        onClick={handleZoomOut}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                    >
                        <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    
                    <button
                        onClick={handleResetZoom}
                        className="text-xs font-medium text-slate-400 hover:text-white transition-colors px-2"
                        title="Reset zoom"
                    >
                        {Math.round(zoom * 100)}%
                    </button>
                    
                    <button
                        onClick={handleZoomIn}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                    >
                        <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
