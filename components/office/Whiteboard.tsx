'use client';

import React, { useRef, useEffect, useCallback, useState, memo } from 'react';
import {
    X, Maximize2, Minimize2, Trash2, AlertTriangle,
    Undo2, Redo2, Eraser, Pen, Download,
    DoorOpen, Globe, Lock,
} from 'lucide-react';
import { useWhiteboardStore, WHITEBOARD_COLORS, WHITEBOARD_WIDTHS, WhiteboardStroke } from '../../stores/whiteboardStore';
import { useWhiteboard } from '../../hooks/useWhiteboard';
import { useAvatarStore } from '../../stores/avatarStore';

// ============================================
// Whiteboard — Holographic collaborative board
// Canvas drawing with multi-color markers
// Room-scoped + Office-wide channels
// ============================================

interface WhiteboardProps {
    workspaceId: string | null;
    userId: string;
    userName: string;
    isAdmin: boolean;
}

function WhiteboardInner({ workspaceId, userId, userName, isAdmin }: WhiteboardProps) {
    const {
        isOpen, isFullscreen, selectedColor, selectedWidth, selectedTool,
        activeChannel, remoteCursors,
        toggleWhiteboard, closeWhiteboard, toggleFullscreen,
        setColor, setWidth, setTool, setActiveChannel,
        undo: storeUndo, redo: storeRedo,
        roomStrokes, officeStrokes,
    } = useWhiteboardStore();

    const myRoomId = useAvatarStore(s => s.myRoomId);

    const { strokes, sendStroke, sendCursor, clearAllStrokes, isLoading } = useWhiteboard({
        workspaceId,
        roomId: myRoomId || null,
        userId,
        userName,
    });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const currentPointsRef = useRef<number[]>([]);
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const cursorThrottleRef = useRef(0);

    const isRoomChannel = activeChannel === 'room';
    const canDraw = isRoomChannel ? !!myRoomId : true;

    // ─── Render all strokes to canvas ─────────────────────────
    const renderCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        // Clear
        ctx.clearRect(0, 0, rect.width, rect.height);

        // Draw grid
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.08)';
        ctx.lineWidth = 1;
        for (let x = 0; x < rect.width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, rect.height);
            ctx.stroke();
        }
        for (let y = 0; y < rect.height; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(rect.width, y);
            ctx.stroke();
        }

        // Draw strokes
        const currentStrokes = isRoomChannel ? roomStrokes : officeStrokes;
        currentStrokes.forEach((stroke) => {
            if (stroke.points.length < 4) return;

            ctx.beginPath();
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            if (stroke.tool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.strokeStyle = 'rgba(0,0,0,1)';
                ctx.lineWidth = stroke.width * 4;
            } else {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = stroke.color;
                ctx.lineWidth = stroke.width;
                // Glow effect
                ctx.shadowBlur = stroke.width * 2;
                ctx.shadowColor = stroke.color;
            }

            ctx.moveTo(stroke.points[0], stroke.points[1]);
            for (let i = 2; i < stroke.points.length; i += 2) {
                ctx.lineTo(stroke.points[i], stroke.points[i + 1]);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        });

        ctx.globalCompositeOperation = 'source-over';

        // Draw remote cursors
        remoteCursors.forEach((cursor) => {
            if (Date.now() - cursor.lastUpdate > 10000) return; // stale cursor
            ctx.beginPath();
            ctx.arc(cursor.x, cursor.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = cursor.color;
            ctx.fill();
            ctx.shadowBlur = 10;
            ctx.shadowColor = cursor.color;
            ctx.beginPath();
            ctx.arc(cursor.x, cursor.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Name label
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.fillStyle = cursor.color;
            ctx.textAlign = 'center';
            ctx.fillText(cursor.userName, cursor.x, cursor.y - 12);
        });
    }, [roomStrokes, officeStrokes, isRoomChannel, remoteCursors]);

    // Re-render whenever strokes or cursors change
    useEffect(() => {
        if (!isOpen) return;
        renderCanvas();
    }, [isOpen, roomStrokes, officeStrokes, remoteCursors, renderCanvas]);

    // Resize observer
    useEffect(() => {
        if (!isOpen) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const observer = new ResizeObserver(() => renderCanvas());
        observer.observe(canvas.parentElement!);
        return () => observer.disconnect();
    }, [isOpen, renderCanvas]);

    // ─── Drawing handlers ─────────────────────────────────────
    const getCanvasPos = useCallback((e: React.MouseEvent | MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!canDraw) return;
        e.preventDefault();

        isDrawingRef.current = true;
        const pos = getCanvasPos(e);
        currentPointsRef.current = [pos.x, pos.y];
        lastPosRef.current = pos;
    }, [canDraw, getCanvasPos]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const pos = getCanvasPos(e);

        // Send cursor position (throttled to 60ms)
        const now = Date.now();
        if (now - cursorThrottleRef.current > 60) {
            cursorThrottleRef.current = now;
            sendCursor(pos.x, pos.y, selectedColor);
        }

        if (!isDrawingRef.current || !lastPosRef.current) return;

        currentPointsRef.current.push(pos.x, pos.y);
        lastPosRef.current = pos;

        // Live preview — draw current stroke directly
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.scale(dpr, dpr);

        ctx.beginPath();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        if (selectedTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.lineWidth = selectedWidth * 4;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = selectedColor;
            ctx.lineWidth = selectedWidth;
            ctx.shadowBlur = selectedWidth * 2;
            ctx.shadowColor = selectedColor;
        }

        const pts = currentPointsRef.current;
        if (pts.length >= 4) {
            ctx.moveTo(pts[pts.length - 4], pts[pts.length - 3]);
            ctx.lineTo(pts[pts.length - 2], pts[pts.length - 1]);
            ctx.stroke();
        }

        ctx.restore();
    }, [getCanvasPos, selectedColor, selectedWidth, selectedTool, sendCursor]);

    const handleMouseUp = useCallback(() => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;

        const points = [...currentPointsRef.current];
        if (points.length < 4) {
            currentPointsRef.current = [];
            return;
        }

        const stroke: WhiteboardStroke = {
            id: `wb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            userId,
            userName,
            color: selectedColor,
            width: selectedWidth,
            points,
            tool: selectedTool,
            timestamp: new Date().toISOString(),
        };

        sendStroke(stroke);
        currentPointsRef.current = [];
        lastPosRef.current = null;
    }, [userId, userName, selectedColor, selectedWidth, selectedTool, sendStroke]);

    const handleMouseLeave = useCallback(() => {
        if (isDrawingRef.current) handleMouseUp();
    }, [handleMouseUp]);

    // ─── Undo/Redo ────────────────────────────────────────────
    const handleUndo = useCallback(() => { storeUndo(); }, [storeUndo]);
    const handleRedo = useCallback(() => { storeRedo(); }, [storeRedo]);

    // ─── Export as PNG ────────────────────────────────────────
    const handleExport = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `whiteboard-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }, []);

    // ─── Confirm clear dialog ─────────────────────────────────
    const [confirmClear, setConfirmClear] = useState(false);
    const handleConfirmClear = useCallback(() => {
        clearAllStrokes();
        setConfirmClear(false);
    }, [clearAllStrokes]);

    // ─── Keyboard shortcuts ───────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) handleRedo(); else handleUndo();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, handleUndo, handleRedo]);

    if (!isOpen) return null;

    const fullscreenClasses = isFullscreen
        ? 'fixed inset-4 z-[300] max-w-none max-h-none w-auto'
        : 'fixed bottom-32 left-6 z-[199] w-[560px] max-h-[520px]';

    return (
        <>
            <div
                className={`${fullscreenClasses} rounded-2xl flex flex-col overflow-hidden shadow-2xl`}
                style={{
                    background: 'rgba(8, 12, 24, 0.92)',
                    backdropFilter: 'blur(40px)',
                    WebkitBackdropFilter: 'blur(40px)',
                    border: '1px solid rgba(34, 211, 238, 0.15)',
                    boxShadow: `
                        0 0 30px rgba(34, 211, 238, 0.08),
                        0 0 60px rgba(99, 102, 241, 0.05),
                        inset 0 1px 0 rgba(255, 255, 255, 0.05)
                    `,
                    animation: 'wbSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                }}
            >
                {/* ─── Header ─────────────────────────────────── */}
                <div
                    className="px-4 py-3 flex items-center justify-between border-b border-cyan-500/10 flex-shrink-0"
                    style={{ background: 'linear-gradient(180deg, rgba(34, 211, 238, 0.06) 0%, transparent 100%)' }}
                >
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)' }}>
                            <Pen className="w-3 h-3 text-white" />
                        </div>
                        <h3 className="text-sm font-bold text-white tracking-wide">Lavagna</h3>
                        <div className="flex items-center gap-1 ml-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                            <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">Live</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {isAdmin && (isRoomChannel ? roomStrokes : officeStrokes).length > 0 && (
                            <button
                                onClick={() => setConfirmClear(true)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-red-400/80 hover:text-red-300 hover:bg-red-500/10 transition-all"
                                title="Pulisci lavagna"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        )}
                        <button
                            onClick={handleExport}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all"
                            title="Esporta PNG"
                        >
                            <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={toggleFullscreen}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all"
                            title={isFullscreen ? 'Riduci' : 'Fullscreen'}
                        >
                            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                        </button>
                        <button
                            onClick={closeWhiteboard}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* ─── Channel Tabs ────────────────────────────── */}
                <div className="flex border-b border-white/5 px-2 flex-shrink-0">
                    <button
                        onClick={() => setActiveChannel('room')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all relative ${isRoomChannel
                            ? 'text-cyan-300'
                            : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        <DoorOpen className="w-3.5 h-3.5" />
                        Stanza
                        {isRoomChannel && (
                            <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-gradient-to-r from-cyan-400 to-blue-400" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveChannel('office')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all relative ${!isRoomChannel
                            ? 'text-cyan-300'
                            : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        <Globe className="w-3.5 h-3.5" />
                        Ufficio
                        {!isRoomChannel && (
                            <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-gradient-to-r from-cyan-400 to-blue-400" />
                        )}
                    </button>
                </div>

                {/* ─── Canvas Area ─────────────────────────────── */}
                <div className="flex-1 relative overflow-hidden" style={{ minHeight: isFullscreen ? 0 : 300 }}>
                    {isRoomChannel && !myRoomId ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <Pen className="w-7 h-7 text-slate-600" />
                            </div>
                            <p className="text-sm text-slate-400 font-medium">Entra in una stanza</p>
                            <p className="text-xs text-slate-600 mt-1">Trascina il tuo avatar in una stanza per disegnare</p>
                        </div>
                    ) : (
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 w-full h-full"
                            style={{
                                cursor: selectedTool === 'eraser'
                                    ? 'cell'
                                    : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Ccircle cx='10' cy='10' r='${Math.max(selectedWidth, 2)}' fill='${encodeURIComponent(selectedColor)}' opacity='0.8'/%3E%3Ccircle cx='10' cy='10' r='${Math.max(selectedWidth, 2) + 1}' fill='none' stroke='white' stroke-width='0.5' opacity='0.5'/%3E%3C/svg%3E") 10 10, crosshair`,
                            }}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseLeave}
                        />
                    )}

                    {/* Board corner decorations */}
                    <div className="absolute top-0 left-0 w-8 h-8 pointer-events-none">
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-500/40 to-transparent" />
                        <div className="absolute top-0 left-0 h-full w-[2px] bg-gradient-to-b from-cyan-500/40 to-transparent" />
                    </div>
                    <div className="absolute top-0 right-0 w-8 h-8 pointer-events-none">
                        <div className="absolute top-0 right-0 w-full h-[2px] bg-gradient-to-l from-indigo-500/40 to-transparent" />
                        <div className="absolute top-0 right-0 h-full w-[2px] bg-gradient-to-b from-indigo-500/40 to-transparent" />
                    </div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 pointer-events-none">
                        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-500/40 to-transparent" />
                        <div className="absolute bottom-0 left-0 h-full w-[2px] bg-gradient-to-t from-cyan-500/40 to-transparent" />
                    </div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none">
                        <div className="absolute bottom-0 right-0 w-full h-[2px] bg-gradient-to-l from-indigo-500/40 to-transparent" />
                        <div className="absolute bottom-0 right-0 h-full w-[2px] bg-gradient-to-t from-indigo-500/40 to-transparent" />
                    </div>

                    {/* Loading overlay */}
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                </div>

                {/* ─── Toolbar ─────────────────────────────────── */}
                <div className="px-3 py-2.5 border-t border-white/5 flex-shrink-0 bg-black/30">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Tool selector */}
                        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/5">
                            <button
                                onClick={() => setTool('pen')}
                                className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${selectedTool === 'pen'
                                    ? 'bg-cyan-500/20 text-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.3)]'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                    }`}
                                title="Penna"
                            >
                                <Pen className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setTool('eraser')}
                                className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${selectedTool === 'eraser'
                                    ? 'bg-amber-500/20 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                    }`}
                                title="Gomma"
                            >
                                <Eraser className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="w-px h-6 bg-white/10" />

                        {/* Color picker */}
                        <div className="flex items-center gap-1">
                            {WHITEBOARD_COLORS.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => setColor(color)}
                                    className={`w-6 h-6 rounded-full transition-all ${selectedColor === color
                                        ? 'ring-2 ring-white/50 ring-offset-1 ring-offset-transparent scale-110'
                                        : 'hover:scale-110 opacity-70 hover:opacity-100'
                                        }`}
                                    style={{
                                        backgroundColor: color,
                                        boxShadow: selectedColor === color ? `0 0 12px ${color}` : 'none',
                                    }}
                                    title={color}
                                />
                            ))}
                        </div>

                        {/* Divider */}
                        <div className="w-px h-6 bg-white/10" />

                        {/* Width picker */}
                        <div className="flex items-center gap-1">
                            {WHITEBOARD_WIDTHS.map((w) => (
                                <button
                                    key={w}
                                    onClick={() => setWidth(w)}
                                    className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${selectedWidth === w
                                        ? 'bg-white/10 text-white'
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                        }`}
                                    title={`Spessore ${w}px`}
                                >
                                    <div
                                        className="rounded-full"
                                        style={{
                                            width: Math.max(w * 1.5, 4),
                                            height: Math.max(w * 1.5, 4),
                                            backgroundColor: selectedColor,
                                            boxShadow: selectedWidth === w ? `0 0 8px ${selectedColor}` : 'none',
                                        }}
                                    />
                                </button>
                            ))}
                        </div>

                        {/* Divider */}
                        <div className="w-px h-6 bg-white/10" />

                        {/* Undo/Redo */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleUndo}
                                className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
                                title="Annulla (Cmd+Z)"
                            >
                                <Undo2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={handleRedo}
                                className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
                                title="Ripristina (Cmd+Shift+Z)"
                            >
                                <Redo2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ─── Confirm Clear Dialog ─────────────────────── */}
                {confirmClear && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
                        <div className="bg-slate-900 border border-white/10 rounded-xl p-5 max-w-[280px] shadow-2xl">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                                <h4 className="text-sm font-bold text-white">Conferma</h4>
                            </div>
                            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                                {isRoomChannel
                                    ? 'Cancellare tutto il contenuto della lavagna di questa stanza? L\'azione è irreversibile.'
                                    : 'Cancellare tutto il contenuto della lavagna dell\'ufficio? L\'azione è irreversibile.'
                                }
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setConfirmClear(false)}
                                    className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
                                >
                                    Annulla
                                </button>
                                <button
                                    onClick={handleConfirmClear}
                                    className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-red-500/80 text-white hover:bg-red-500 transition-colors"
                                >
                                    Cancella tutto
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Animation keyframes */}
            <style jsx global>{`
                @keyframes wbSlideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>
        </>
    );
}

export const Whiteboard = memo(WhiteboardInner);
