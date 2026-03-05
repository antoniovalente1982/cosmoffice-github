'use client';

import React, { useRef, useEffect, useCallback, useState, memo } from 'react';
import {
    X, Maximize2, Minimize2, Trash2, AlertTriangle,
    Undo2, Redo2, Eraser, Pen, Camera,
    DoorOpen, Globe, Square, Circle as CircleIcon,
    ArrowRight, Minus, MousePointer2,
    Flashlight, Droplets,
} from 'lucide-react';
import {
    useWhiteboardStore, WHITEBOARD_COLORS, WHITEBOARD_WIDTHS,
    WHITEBOARD_FILL_COLORS, WhiteboardStroke, WhiteboardTool, isShapeTool,
} from '../../stores/whiteboardStore';
import { useWhiteboard } from '../../hooks/useWhiteboard';
import { useAvatarStore } from '../../stores/avatarStore';

// ============================================
// Whiteboard — Holographic collaborative board
// Canvas: pen, eraser, shapes, laser, selection
// ============================================

interface WhiteboardProps {
    workspaceId: string | null;
    userId: string;
    userName: string;
    isAdmin: boolean;
}

// Shape hit-test helpers
function hitRect(pt: number[], x: number, y: number, margin = 6): boolean {
    const [x1, y1, x2, y2] = pt;
    const minX = Math.min(x1, x2) - margin, maxX = Math.max(x1, x2) + margin;
    const minY = Math.min(y1, y2) - margin, maxY = Math.max(y1, y2) + margin;
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

function hitCircle(pt: number[], x: number, y: number, margin = 6): boolean {
    const [cx, cy, ex, ey] = pt;
    const rx = Math.abs(ex - cx), ry = Math.abs(ey - cy);
    const dx = (x - cx) / (rx + margin), dy = (y - cy) / (ry + margin);
    return dx * dx + dy * dy <= 1;
}

function hitLine(pt: number[], x: number, y: number, margin = 8): boolean {
    const [x1, y1, x2, y2] = pt;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len === 0) return Math.hypot(x - x1, y - y1) < margin;
    const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / (len * len)));
    const px = x1 + t * (x2 - x1), py = y1 + t * (y2 - y1);
    return Math.hypot(x - px, y - py) < margin;
}

// Resize handle positions (4 corners)
function getResizeHandles(pt: number[]): { x: number; y: number; corner: string }[] {
    if (pt.length < 4) return [];
    const [x1, y1, x2, y2] = pt;
    return [
        { x: x1, y: y1, corner: 'nw' },
        { x: x2, y: y1, corner: 'ne' },
        { x: x2, y: y2, corner: 'se' },
        { x: x1, y: y2, corner: 'sw' },
    ];
}

function hitHandle(handles: ReturnType<typeof getResizeHandles>, x: number, y: number): string | null {
    for (const h of handles) {
        if (Math.hypot(x - h.x, y - h.y) < 8) return h.corner;
    }
    return null;
}

// Tool icon mapping
const TOOL_CONFIG: Record<string, { icon: any; label: string; group: 'draw' | 'shape' }> = {
    pen: { icon: Pen, label: 'Penna', group: 'draw' },
    eraser: { icon: Eraser, label: 'Gomma', group: 'draw' },
    select: { icon: MousePointer2, label: 'Seleziona', group: 'draw' },
    laser: { icon: Flashlight, label: 'Laser', group: 'draw' },
    rect: { icon: Square, label: 'Rettangolo', group: 'shape' },
    circle: { icon: CircleIcon, label: 'Cerchio', group: 'shape' },
    line: { icon: Minus, label: 'Linea', group: 'shape' },
    arrow: { icon: ArrowRight, label: 'Freccia', group: 'shape' },
};

function WhiteboardInner({ workspaceId, userId, userName, isAdmin }: WhiteboardProps) {
    const {
        isOpen, isFullscreen, selectedColor, selectedFillColor, selectedWidth, selectedTool,
        activeChannel, remoteCursors, activeDrawers, selectedStrokeId,
        toggleWhiteboard, closeWhiteboard, toggleFullscreen,
        setColor, setFillColor, setWidth, setTool, setActiveChannel,
        setSelectedStrokeId,
        undo: storeUndo, redo: storeRedo,
        roomStrokes, officeStrokes,
    } = useWhiteboardStore();

    const myRoomId = useAvatarStore(s => s.myRoomId);
    const prevRoomIdRef2 = useRef(myRoomId);

    // Auto-close whiteboard when leaving a room
    useEffect(() => {
        if (prevRoomIdRef2.current && prevRoomIdRef2.current !== myRoomId) {
            // User left a room — close whiteboard
            closeWhiteboard();
        }
        prevRoomIdRef2.current = myRoomId;
    }, [myRoomId, closeWhiteboard]);

    const { strokes, sendStroke, sendCursor, sendActivity, sendStrokeUpdate, clearAllStrokes, isLoading } = useWhiteboard({
        workspaceId,
        roomId: myRoomId || null,
        userId,
        userName,
    });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const currentPointsRef = useRef<number[]>([]);
    const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
    const shapePreviewRef = useRef<number[] | null>(null);
    const resizingRef = useRef<{ strokeId: string; corner: string; original: number[] } | null>(null);
    const cursorThrottleRef = useRef(0);
    const activityThrottleRef = useRef(0);
    const laserStrokesRef = useRef<{ stroke: WhiteboardStroke; addedAt: number }[]>([]);
    const laserAnimRef = useRef<number | null>(null);
    const [showFillPicker, setShowFillPicker] = useState(false);

    const isRoomChannel = activeChannel === 'room';
    const canDraw = isRoomChannel ? !!myRoomId : true;
    const currentStrokes = isRoomChannel ? roomStrokes : officeStrokes;

    // ─── Broadcast activity (throttled to 3s) ─────────────────
    const broadcastActivity = useCallback(() => {
        const now = Date.now();
        if (now - activityThrottleRef.current < 3000) return;
        activityThrottleRef.current = now;
        sendActivity('drawing', selectedColor);
    }, [sendActivity, selectedColor]);

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
        ctx.clearRect(0, 0, rect.width, rect.height);

        // Grid
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.06)';
        ctx.lineWidth = 1;
        for (let x = 0; x < rect.width; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, rect.height); ctx.stroke();
        }
        for (let y = 0; y < rect.height; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(rect.width, y); ctx.stroke();
        }

        // Draw all strokes
        const allStrokes = [...currentStrokes, ...laserStrokesRef.current.map(l => l.stroke)];
        allStrokes.forEach((stroke) => {
            if (stroke.points.length < 2) return;
            const isLaser = stroke.tool === 'laser';
            const laserEntry = isLaser ? laserStrokesRef.current.find(l => l.stroke.id === stroke.id) : null;
            const laserAlpha = laserEntry ? Math.max(0, 1 - (Date.now() - laserEntry.addedAt) / 2000) : 1;

            ctx.save();
            ctx.globalAlpha = isLaser ? laserAlpha : 1;

            if (stroke.tool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.strokeStyle = 'rgba(0,0,0,1)';
                ctx.lineWidth = stroke.width * 4;
                ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(stroke.points[0], stroke.points[1]);
                for (let i = 2; i < stroke.points.length; i += 2) {
                    ctx.lineTo(stroke.points[i], stroke.points[i + 1]);
                }
                ctx.stroke();
            } else if (stroke.tool === 'pen' || stroke.tool === 'laser') {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = stroke.color;
                ctx.lineWidth = isLaser ? stroke.width * 0.7 : stroke.width;
                ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                ctx.shadowBlur = isLaser ? stroke.width * 4 : stroke.width * 2;
                ctx.shadowColor = stroke.color;
                ctx.beginPath();
                ctx.moveTo(stroke.points[0], stroke.points[1]);
                for (let i = 2; i < stroke.points.length; i += 2) {
                    ctx.lineTo(stroke.points[i], stroke.points[i + 1]);
                }
                ctx.stroke();
            } else if (stroke.tool === 'rect' && stroke.points.length >= 4) {
                const [x1, y1, x2, y2] = stroke.points;
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = stroke.color;
                ctx.lineWidth = stroke.width;
                ctx.shadowBlur = stroke.width * 2;
                ctx.shadowColor = stroke.color;
                if (stroke.fillColor) {
                    ctx.fillStyle = stroke.fillColor;
                    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
                }
                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            } else if (stroke.tool === 'circle' && stroke.points.length >= 4) {
                const [cx, cy, ex, ey] = stroke.points;
                const rx = Math.abs(ex - cx), ry = Math.abs(ey - cy);
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = stroke.color;
                ctx.lineWidth = stroke.width;
                ctx.shadowBlur = stroke.width * 2;
                ctx.shadowColor = stroke.color;
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                if (stroke.fillColor) {
                    ctx.fillStyle = stroke.fillColor;
                    ctx.fill();
                }
                ctx.stroke();
            } else if ((stroke.tool === 'line' || stroke.tool === 'arrow') && stroke.points.length >= 4) {
                const [x1, y1, x2, y2] = stroke.points;
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = stroke.color;
                ctx.lineWidth = stroke.width;
                ctx.lineCap = 'round';
                ctx.shadowBlur = stroke.width * 2;
                ctx.shadowColor = stroke.color;
                ctx.beginPath();
                ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
                ctx.stroke();
                // Arrow head
                if (stroke.tool === 'arrow') {
                    const angle = Math.atan2(y2 - y1, x2 - x1);
                    const headLen = Math.max(12, stroke.width * 3);
                    ctx.beginPath();
                    ctx.moveTo(x2, y2);
                    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
                    ctx.moveTo(x2, y2);
                    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
                    ctx.stroke();
                }
            }

            ctx.restore();
        });

        // Shape preview (while dragging)
        if (shapePreviewRef.current && shapeStartRef.current) {
            const [x2, y2] = shapePreviewRef.current;
            const { x: x1, y: y1 } = shapeStartRef.current;
            ctx.save();
            ctx.globalAlpha = 0.6;
            ctx.strokeStyle = selectedColor;
            ctx.lineWidth = selectedWidth;
            ctx.shadowBlur = selectedWidth * 2;
            ctx.shadowColor = selectedColor;
            ctx.setLineDash([8, 4]);

            if (selectedTool === 'rect') {
                if (selectedFillColor) { ctx.fillStyle = selectedFillColor; ctx.fillRect(x1, y1, x2 - x1, y2 - y1); }
                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            } else if (selectedTool === 'circle') {
                const rx = Math.abs(x2 - x1), ry = Math.abs(y2 - y1);
                ctx.beginPath();
                ctx.ellipse(x1, y1, rx, ry, 0, 0, Math.PI * 2);
                if (selectedFillColor) { ctx.fillStyle = selectedFillColor; ctx.fill(); }
                ctx.stroke();
            } else if (selectedTool === 'line') {
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            } else if (selectedTool === 'arrow') {
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
                const angle = Math.atan2(y2 - y1, x2 - x1);
                const headLen = Math.max(12, selectedWidth * 3);
                ctx.beginPath();
                ctx.moveTo(x2, y2);
                ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(x2, y2);
                ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
                ctx.stroke();
            }
            ctx.restore();
        }

        ctx.globalCompositeOperation = 'source-over';

        // Selection handles
        if (selectedStrokeId) {
            const sel = currentStrokes.find(s => s.id === selectedStrokeId);
            if (sel && isShapeTool(sel.tool)) {
                const handles = getResizeHandles(sel.points);
                handles.forEach(h => {
                    ctx.beginPath();
                    ctx.arc(h.x, h.y, 5, 0, Math.PI * 2);
                    ctx.fillStyle = '#22d3ee';
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = '#22d3ee';
                    ctx.beginPath();
                    ctx.arc(h.x, h.y, 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                });
                // Dashed selection border
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
                ctx.lineWidth = 1;
                const [sx1, sy1, sx2, sy2] = sel.points;
                ctx.strokeRect(Math.min(sx1, sx2) - 4, Math.min(sy1, sy2) - 4,
                    Math.abs(sx2 - sx1) + 8, Math.abs(sy2 - sy1) + 8);
                ctx.setLineDash([]);
            }
        }

        // Remote cursors
        remoteCursors.forEach((cursor) => {
            if (Date.now() - cursor.lastUpdate > 10000) return;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cursor.x, cursor.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = cursor.color;
            ctx.shadowBlur = 12;
            ctx.shadowColor = cursor.color;
            ctx.fill();
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.fillStyle = cursor.color;
            ctx.textAlign = 'center';
            ctx.fillText(cursor.userName, cursor.x, cursor.y - 12);
            ctx.restore();
        });
    }, [currentStrokes, remoteCursors, selectedStrokeId, selectedColor, selectedFillColor, selectedWidth, selectedTool]);

    // Re-render
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

    // Laser animation loop
    useEffect(() => {
        if (!isOpen) return;
        const animate = () => {
            const now = Date.now();
            const active = laserStrokesRef.current.filter(l => now - l.addedAt < 2000);
            if (active.length !== laserStrokesRef.current.length) {
                laserStrokesRef.current = active;
                renderCanvas();
            } else if (active.length > 0) {
                renderCanvas();
            }
            laserAnimRef.current = requestAnimationFrame(animate);
        };
        laserAnimRef.current = requestAnimationFrame(animate);
        return () => { if (laserAnimRef.current) cancelAnimationFrame(laserAnimRef.current); };
    }, [isOpen, renderCanvas]);

    // ─── Canvas coordinates ───────────────────────────────────
    const getPos = useCallback((e: React.MouseEvent | MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }, []);

    // ─── Mouse down ───────────────────────────────────────────
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!canDraw) return;
        e.preventDefault();
        const pos = getPos(e);

        // SELECT mode: try to select a shape or start resizing
        if (selectedTool === 'select') {
            // Check if clicking on a resize handle of selected shape
            if (selectedStrokeId) {
                const sel = currentStrokes.find(s => s.id === selectedStrokeId);
                if (sel && isShapeTool(sel.tool)) {
                    const handles = getResizeHandles(sel.points);
                    const corner = hitHandle(handles, pos.x, pos.y);
                    if (corner) {
                        resizingRef.current = { strokeId: sel.id, corner, original: [...sel.points] };
                        return;
                    }
                }
            }

            // Try to select a shape (reverse order = top-most first)
            let found = false;
            for (let i = currentStrokes.length - 1; i >= 0; i--) {
                const s = currentStrokes[i];
                if (!isShapeTool(s.tool) || s.points.length < 4) continue;
                let hit = false;
                if (s.tool === 'rect') hit = hitRect(s.points, pos.x, pos.y);
                else if (s.tool === 'circle') hit = hitCircle(s.points, pos.x, pos.y);
                else if (s.tool === 'line' || s.tool === 'arrow') hit = hitLine(s.points, pos.x, pos.y);
                if (hit) {
                    setSelectedStrokeId(s.id);
                    found = true;
                    break;
                }
            }
            if (!found) setSelectedStrokeId(null);
            renderCanvas();
            return;
        }

        // SHAPE tools: start shape
        if (isShapeTool(selectedTool)) {
            shapeStartRef.current = pos;
            shapePreviewRef.current = null;
            isDrawingRef.current = true;
            return;
        }

        // PEN / ERASER / LASER
        isDrawingRef.current = true;
        currentPointsRef.current = [pos.x, pos.y];
        broadcastActivity();
    }, [canDraw, selectedTool, selectedStrokeId, currentStrokes, getPos, setSelectedStrokeId, renderCanvas, broadcastActivity]);

    // ─── Mouse move ───────────────────────────────────────────
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const pos = getPos(e);

        // Cursor broadcast
        const now = Date.now();
        if (now - cursorThrottleRef.current > 60) {
            cursorThrottleRef.current = now;
            sendCursor(pos.x, pos.y, selectedColor);
        }

        // Resizing a shape
        if (resizingRef.current) {
            const { strokeId, corner, original } = resizingRef.current;
            const newPts = [...original];
            if (corner === 'nw') { newPts[0] = pos.x; newPts[1] = pos.y; }
            else if (corner === 'ne') { newPts[2] = pos.x; newPts[1] = pos.y; }
            else if (corner === 'se') { newPts[2] = pos.x; newPts[3] = pos.y; }
            else if (corner === 'sw') { newPts[0] = pos.x; newPts[3] = pos.y; }

            const isRoom = useWhiteboardStore.getState().activeChannel === 'room';
            if (isRoom) useWhiteboardStore.getState().updateStroke(strokeId, { points: newPts });
            else useWhiteboardStore.getState().updateOfficeStroke(strokeId, { points: newPts });
            renderCanvas();
            return;
        }

        if (!isDrawingRef.current) return;

        // Shape preview
        if (isShapeTool(selectedTool) && shapeStartRef.current) {
            shapePreviewRef.current = [pos.x, pos.y];
            renderCanvas();
            return;
        }

        // Pen / eraser / laser
        currentPointsRef.current.push(pos.x, pos.y);

        // Live preview
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.beginPath(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';

        if (selectedTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.lineWidth = selectedWidth * 4;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = selectedColor;
            ctx.lineWidth = selectedTool === 'laser' ? selectedWidth * 0.7 : selectedWidth;
            ctx.shadowBlur = selectedTool === 'laser' ? selectedWidth * 4 : selectedWidth * 2;
            ctx.shadowColor = selectedColor;
        }

        const pts = currentPointsRef.current;
        if (pts.length >= 4) {
            ctx.moveTo(pts[pts.length - 4], pts[pts.length - 3]);
            ctx.lineTo(pts[pts.length - 2], pts[pts.length - 1]);
            ctx.stroke();
        }
        ctx.restore();
    }, [getPos, selectedColor, selectedWidth, selectedTool, sendCursor, renderCanvas]);

    // ─── Mouse up ─────────────────────────────────────────────
    const handleMouseUp = useCallback(() => {
        // Finish resizing
        if (resizingRef.current) {
            const { strokeId } = resizingRef.current;
            const sel = currentStrokes.find(s => s.id === strokeId);
            if (sel) {
                sendStrokeUpdate(strokeId, { points: sel.points });
            }
            resizingRef.current = null;
            return;
        }

        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;

        // Shape finalization
        if (isShapeTool(selectedTool) && shapeStartRef.current) {
            const start = shapeStartRef.current;
            const preview = shapePreviewRef.current;
            shapeStartRef.current = null;
            shapePreviewRef.current = null;

            if (!preview) return;
            const [x2, y2] = preview;
            if (Math.abs(x2 - start.x) < 5 && Math.abs(y2 - start.y) < 5) return;

            const stroke: WhiteboardStroke = {
                id: `wb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                userId, userName,
                color: selectedColor,
                fillColor: selectedFillColor,
                width: selectedWidth,
                points: [start.x, start.y, x2, y2],
                tool: selectedTool,
                timestamp: new Date().toISOString(),
            };
            sendStroke(stroke);
            setSelectedStrokeId(stroke.id);
            renderCanvas();
            return;
        }

        // Pen / eraser / laser finalization
        const points = [...currentPointsRef.current];
        currentPointsRef.current = [];
        if (points.length < 4) return;

        const stroke: WhiteboardStroke = {
            id: `wb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            userId, userName,
            color: selectedColor,
            width: selectedWidth,
            points,
            tool: selectedTool === 'laser' ? 'laser' : selectedTool as any,
            timestamp: new Date().toISOString(),
        };

        if (selectedTool === 'laser') {
            // Laser: add to temporary list, don't persist
            laserStrokesRef.current.push({ stroke, addedAt: Date.now() });
            // Broadcast via PartyKit but don't save to DB
            const socket = (window as any).__partykitSocket;
            const isRoom = useWhiteboardStore.getState().activeChannel === 'room';
            if (socket?.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'wb_stroke', scope: isRoom ? 'room' : 'office',
                    roomId: isRoom ? myRoomId : null, stroke,
                }));
            }
        } else {
            sendStroke(stroke);
        }
    }, [userId, userName, selectedColor, selectedFillColor, selectedWidth, selectedTool,
        currentStrokes, sendStroke, sendStrokeUpdate, setSelectedStrokeId, renderCanvas, myRoomId]);

    const handleMouseLeave = useCallback(() => {
        if (isDrawingRef.current) handleMouseUp();
    }, [handleMouseUp]);

    // ─── Undo/Redo ────────────────────────────────────────────
    const handleUndo = useCallback(() => { storeUndo(); }, [storeUndo]);
    const handleRedo = useCallback(() => { storeRedo(); }, [storeRedo]);

    // ─── Screenshot → opens in new tab as viewable image ──────
    const handleExport = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Create a temp canvas with solid dark background
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        const ctx = exportCanvas.getContext('2d');
        if (!ctx) return;

        // Draw dark background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        // Draw subtle grid
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.08)';
        ctx.lineWidth = 1;
        const dpr = window.devicePixelRatio || 1;
        for (let x = 0; x < exportCanvas.width; x += 40 * dpr) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, exportCanvas.height); ctx.stroke();
        }
        for (let y = 0; y < exportCanvas.height; y += 40 * dpr) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(exportCanvas.width, y); ctx.stroke();
        }

        // Draw the whiteboard content on top
        ctx.drawImage(canvas, 0, 0);

        // Add watermark
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.textAlign = 'right';
        ctx.fillText('Cosmoffice Whiteboard', exportCanvas.width / dpr - 12, exportCanvas.height / dpr - 10);
        ctx.restore();

        // Auto-download as PNG file
        exportCanvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cosmoffice-whiteboard-${new Date().toISOString().slice(0, 10)}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png');
    }, []);

    // ─── Clear dialog ─────────────────────────────────────────
    const [confirmClear, setConfirmClear] = useState(false);
    const handleConfirmClear = useCallback(() => {
        clearAllStrokes(); setConfirmClear(false);
    }, [clearAllStrokes]);

    // ─── Keyboard shortcuts ───────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) handleRedo(); else handleUndo();
            }
            if (e.key === 'Escape') setSelectedStrokeId(null);
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedStrokeId) {
                    const isRoom = useWhiteboardStore.getState().activeChannel === 'room';
                    if (isRoom) useWhiteboardStore.getState().removeStroke(selectedStrokeId);
                    else useWhiteboardStore.getState().removeOfficeStroke(selectedStrokeId);
                    setSelectedStrokeId(null);
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, handleUndo, handleRedo, selectedStrokeId, setSelectedStrokeId]);

    // ─── Broadcast "opened" activity on mount ─────────────────
    useEffect(() => {
        if (isOpen) sendActivity('opened', selectedColor);
    }, [isOpen]);

    if (!isOpen) return null;

    const fullscreenClasses = isFullscreen
        ? 'fixed inset-4 z-[300] max-w-none max-h-none w-auto'
        : 'fixed bottom-32 left-6 z-[199] w-[640px] max-h-[600px]';

    const activeDrawersList = Array.from(activeDrawers.values());

    return (
        <>
            <div
                className={`${fullscreenClasses} rounded-2xl flex flex-col overflow-hidden shadow-2xl`}
                style={{
                    background: 'rgba(8, 12, 24, 0.94)',
                    backdropFilter: 'blur(40px)',
                    WebkitBackdropFilter: 'blur(40px)',
                    border: '1px solid rgba(34, 211, 238, 0.15)',
                    boxShadow: `0 0 30px rgba(34,211,238,0.08), 0 0 60px rgba(99,102,241,0.05), inset 0 1px 0 rgba(255,255,255,0.05)`,
                    animation: 'wbSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                }}
            >
                {/* ─── Header ─────────────────────────────────── */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-cyan-500/10 flex-shrink-0"
                    style={{ background: 'linear-gradient(180deg, rgba(34,211,238,0.06) 0%, transparent 100%)' }}>
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

                    {/* Active drawers notification */}
                    {activeDrawersList.length > 0 && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 mr-2 animate-pulse">
                            <div className="flex -space-x-1.5">
                                {activeDrawersList.slice(0, 3).map((d) => (
                                    <div key={d.userId} className="w-4 h-4 rounded-full border border-black/40"
                                        style={{ backgroundColor: d.color }} />
                                ))}
                            </div>
                            <span className="text-[9px] font-semibold text-cyan-300 max-w-[100px] truncate">
                                {activeDrawersList.length === 1
                                    ? `${activeDrawersList[0].userName} sta disegnando...`
                                    : `${activeDrawersList.length} stanno disegnando...`}
                            </span>
                        </div>
                    )}

                    <div className="flex items-center gap-1.5">
                        {isAdmin && currentStrokes.length > 0 && (
                            <button onClick={() => setConfirmClear(true)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-red-400/80 hover:text-red-300 hover:bg-red-500/10 transition-all"
                                title="Pulisci lavagna"><Trash2 className="w-3 h-3" /></button>
                        )}
                        <button onClick={handleExport}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all"
                            title="Screenshot lavagna"><Camera className="w-3.5 h-3.5" /></button>
                        <button onClick={toggleFullscreen}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all"
                            title={isFullscreen ? 'Riduci' : 'Fullscreen'}>
                            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={closeWhiteboard}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                            <X className="w-4 h-4" /></button>
                    </div>
                </div>

                {/* ─── Channel Tabs ────────────────────────────── */}
                <div className="flex border-b border-white/5 px-2 flex-shrink-0">
                    <button onClick={() => setActiveChannel('room')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all relative ${isRoomChannel ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-300'}`}>
                        <DoorOpen className="w-3.5 h-3.5" />Stanza
                        {isRoomChannel && <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-gradient-to-r from-cyan-400 to-blue-400" />}
                    </button>
                    <button onClick={() => setActiveChannel('office')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all relative ${!isRoomChannel ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-300'}`}>
                        <Globe className="w-3.5 h-3.5" />Ufficio
                        {!isRoomChannel && <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-gradient-to-r from-cyan-400 to-blue-400" />}
                    </button>
                </div>

                {/* ─── Canvas Area ─────────────────────────────── */}
                <div className="flex-1 relative overflow-hidden" style={{ minHeight: isFullscreen ? 0 : 340 }}>
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
                                cursor: selectedTool === 'eraser' ? 'cell'
                                    : selectedTool === 'select' ? (resizingRef.current ? 'nwse-resize' : 'default')
                                        : selectedTool === 'laser' ? 'crosshair'
                                            : isShapeTool(selectedTool) ? 'crosshair'
                                                : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Ccircle cx='10' cy='10' r='${Math.max(selectedWidth, 2)}' fill='${encodeURIComponent(selectedColor)}' opacity='0.8'/%3E%3C/svg%3E") 10 10, crosshair`,
                            }}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseLeave}
                        />
                    )}

                    {/* Corner decorations */}
                    {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
                        <div key={i} className={`absolute ${pos} w-8 h-8 pointer-events-none`}>
                            <div className={`absolute ${pos.includes('top') ? 'top-0' : 'bottom-0'} ${pos.includes('left') ? 'left-0' : 'right-0'} w-full h-[2px] bg-gradient-to-${pos.includes('left') ? 'r' : 'l'} ${i % 2 === 0 ? 'from-cyan-500/40' : 'from-indigo-500/40'} to-transparent`} />
                            <div className={`absolute ${pos.includes('top') ? 'top-0' : 'bottom-0'} ${pos.includes('left') ? 'left-0' : 'right-0'} h-full w-[2px] bg-gradient-to-${pos.includes('top') ? 'b' : 't'} ${i % 2 === 0 ? 'from-cyan-500/40' : 'from-indigo-500/40'} to-transparent`} />
                        </div>
                    ))}

                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                </div>

                {/* ─── Toolbar ─────────────────────────────────── */}
                <div className="px-3 py-2 border-t border-white/5 flex-shrink-0 bg-black/30">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Drawing tools */}
                        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.03] border border-white/5">
                            {(['select', 'pen', 'eraser', 'laser'] as WhiteboardTool[]).map((tool) => {
                                const cfg = TOOL_CONFIG[tool];
                                const Icon = cfg.icon;
                                const isActive = selectedTool === tool;
                                const activeColor = tool === 'eraser' ? 'amber' : tool === 'laser' ? 'rose' : 'cyan';
                                return (
                                    <button key={tool} onClick={() => setTool(tool)}
                                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${isActive
                                            ? `bg-${activeColor}-500/20 text-${activeColor}-300 shadow-[0_0_8px_rgba(34,211,238,0.3)]`
                                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                                        title={cfg.label}
                                        style={isActive ? { backgroundColor: `rgba(${tool === 'eraser' ? '245,158,11' : tool === 'laser' ? '244,63,94' : '34,211,238'}, 0.15)`, color: tool === 'eraser' ? '#fbbf24' : tool === 'laser' ? '#fb7185' : '#67e8f9' } : {}}>
                                        <Icon className="w-3.5 h-3.5" />
                                    </button>
                                );
                            })}
                        </div>

                        <div className="w-px h-6 bg-white/10" />

                        {/* Shape tools */}
                        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.03] border border-white/5">
                            {(['rect', 'circle', 'line', 'arrow'] as WhiteboardTool[]).map((tool) => {
                                const cfg = TOOL_CONFIG[tool];
                                const Icon = cfg.icon;
                                const isActive = selectedTool === tool;
                                return (
                                    <button key={tool} onClick={() => setTool(tool)}
                                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${isActive
                                            ? 'text-indigo-300'
                                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                                        title={cfg.label}
                                        style={isActive ? { backgroundColor: 'rgba(99,102,241,0.15)', color: '#a5b4fc' } : {}}>
                                        <Icon className="w-3.5 h-3.5" />
                                    </button>
                                );
                            })}
                        </div>

                        <div className="w-px h-6 bg-white/10" />

                        {/* Colors */}
                        <div className="flex items-center gap-0.5">
                            {WHITEBOARD_COLORS.map((color) => (
                                <button key={color} onClick={() => setColor(color)}
                                    className={`w-5 h-5 rounded-full transition-all ${selectedColor === color ? 'ring-2 ring-white/50 ring-offset-1 ring-offset-transparent scale-110' : 'hover:scale-110 opacity-60 hover:opacity-100'}`}
                                    style={{ backgroundColor: color, boxShadow: selectedColor === color ? `0 0 10px ${color}` : 'none' }} />
                            ))}
                        </div>

                        <div className="w-px h-6 bg-white/10" />

                        {/* Fill color (only for shapes) */}
                        {isShapeTool(selectedTool) && (
                            <>
                                <div className="relative">
                                    <button onClick={() => setShowFillPicker(!showFillPicker)}
                                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${selectedFillColor ? 'text-indigo-300' : 'text-slate-500 hover:text-slate-300'} hover:bg-white/5`}
                                        title="Colore riempimento"
                                        style={selectedFillColor ? { backgroundColor: 'rgba(99,102,241,0.1)' } : {}}>
                                        <Droplets className="w-3.5 h-3.5" />
                                    </button>
                                    {showFillPicker && (
                                        <div className="absolute bottom-full left-0 mb-2 p-2 rounded-lg bg-slate-900 border border-white/10 shadow-xl flex flex-wrap gap-1 w-[120px] z-50">
                                            {WHITEBOARD_FILL_COLORS.map((fill, i) => (
                                                <button key={i} onClick={() => { setFillColor(fill); setShowFillPicker(false); }}
                                                    className={`w-6 h-6 rounded-md border transition-all ${selectedFillColor === fill ? 'ring-2 ring-cyan-400 scale-110' : 'hover:scale-110'}`}
                                                    style={{
                                                        backgroundColor: fill || 'transparent',
                                                        borderColor: fill ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
                                                        backgroundImage: !fill ? 'linear-gradient(135deg, transparent 40%, red 40%, red 60%, transparent 60%)' : 'none',
                                                    }}
                                                    title={fill ? 'Riempimento' : 'Nessun riempimento'} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="w-px h-6 bg-white/10" />
                            </>
                        )}

                        {/* Widths */}
                        <div className="flex items-center gap-0.5">
                            {WHITEBOARD_WIDTHS.map((w) => (
                                <button key={w} onClick={() => setWidth(w)}
                                    className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${selectedWidth === w ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                                    title={`${w}px`}>
                                    <div className="rounded-full"
                                        style={{ width: Math.max(w * 1.5, 4), height: Math.max(w * 1.5, 4), backgroundColor: selectedColor, boxShadow: selectedWidth === w ? `0 0 6px ${selectedColor}` : 'none' }} />
                                </button>
                            ))}
                        </div>

                        <div className="w-px h-6 bg-white/10" />

                        {/* Undo/Redo */}
                        <div className="flex items-center gap-0.5">
                            <button onClick={handleUndo} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all" title="Annulla (⌘Z)">
                                <Undo2 className="w-3.5 h-3.5" /></button>
                            <button onClick={handleRedo} className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all" title="Ripristina (⌘⇧Z)">
                                <Redo2 className="w-3.5 h-3.5" /></button>
                        </div>
                    </div>
                </div>

                {/* ─── Confirm Clear ───────────────────────────── */}
                {confirmClear && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
                        <div className="bg-slate-900 border border-white/10 rounded-xl p-5 max-w-[280px] shadow-2xl">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                                <h4 className="text-sm font-bold text-white">Conferma</h4>
                            </div>
                            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                                Cancellare tutto il contenuto della lavagna {isRoomChannel ? 'di questa stanza' : "dell'ufficio"}? L&apos;azione è irreversibile.
                            </p>
                            <div className="flex gap-2">
                                <button onClick={() => setConfirmClear(false)}
                                    className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-slate-300 hover:bg-white/10 transition-colors">Annulla</button>
                                <button onClick={handleConfirmClear}
                                    className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-red-500/80 text-white hover:bg-red-500 transition-colors">Cancella tutto</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx global>{`
                @keyframes wbSlideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </>
    );
}

export const Whiteboard = memo(WhiteboardInner);
