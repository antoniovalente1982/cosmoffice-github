'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { createClient } from '../../utils/supabase/client';
import { OFFICE_PRESETS } from './MiniMap';
import { OFFICE_TEMPLATES, OfficeTemplate } from '../../lib/officeTemplates';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, X, Box, Users, Save, Palette, PenTool, Focus, PaintBucket, Edit2,
    LayoutTemplate, ArrowLeft, Loader2, AlertTriangle, Circle as CircleIcon, Square, Link2, Unlink, Map, GitBranch
} from 'lucide-react';



const COLOR_PRESETS = [
    '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#f97316', '#14b8a6', '#6366f1',
];

function snapToGrid(value: number, gridSize: number = 20): number {
    return Math.round(value / gridSize) * gridSize;
}
function tempId(): string {
    return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getRoomColor(room: any): string {
    return room?.settings?.color || room?.color || '#3b82f6';
}
export function getRoomDepartment(room: any): string | null {
    return room?.settings?.department || room?.department || null;
}

export function OfficeBuilder() {
    const supabase = createClient();
    const {
        isBuilderMode, rooms, selectedRoomId, roomTemplates, roomConnections, layoutMode,
        activeSpaceId, stagePos, zoom, addRoom, setSelectedRoom, removeRoom,
        setRooms, setRoomConnections, toggleBuilderMode, setLayoutMode,
    } = useWorkspaceStore();

    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

    // Edit state for right panel
    const [editName, setEditName] = useState('');
    const [editDepartment, setEditDepartment] = useState('');
    const [editColor, setEditColor] = useState('#3b82f6');
    const [builderTab, setBuilderTab] = useState<'rooms' | 'environment'>('rooms');
    const [showRoomsList, setShowRoomsList] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [applyingTemplate, setApplyingTemplate] = useState(false);
    const [confirmTemplate, setConfirmTemplate] = useState<OfficeTemplate | null>(null);
    const [editShape, setEditShape] = useState<'rect' | 'circle'>('rect');
    const [editLevel, setEditLevel] = useState(0);

    // Connection creation state
    const [showConnections, setShowConnections] = useState(false);
    const [connectFromId, setConnectFromId] = useState<string>('');
    const [connectToId, setConnectToId] = useState<string>('');
    const [connectLabel, setConnectLabel] = useState('');
    const [connectColor, setConnectColor] = useState('#6366f1');

    const selectedRoom = rooms.find(r => r.id === selectedRoomId);

    useEffect(() => {
        if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
    }, [toast]);

    useEffect(() => {
        const handler = (e: Event) => {
            const { roomId } = (e as CustomEvent).detail;
            loadRoomProperties(roomId);
        };
        window.addEventListener('builder-select-room', handler);
        return () => window.removeEventListener('builder-select-room', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rooms]);

    // Update edit state perfectly whenever selection changes
    useEffect(() => {
        if (selectedRoomId) {
            loadRoomProperties(selectedRoomId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRoomId]);

    // ─── Live preview: instantly update room in store when editing ───
    const isLoadingPropsRef = useRef(false);
    useEffect(() => {
        if (!selectedRoomId || isLoadingPropsRef.current) return;
        const currentRooms = useWorkspaceStore.getState().rooms;
        const room = currentRooms.find(r => r.id === selectedRoomId);
        if (!room) return;

        // Only update if something actually changed
        const currentColor = getRoomColor(room);
        const currentDept = getRoomDepartment(room) || '';
        if (room.name === editName && currentColor === editColor && currentDept === editDepartment && (room.shape || 'rect') === editShape && (room.settings?.level ?? 0) === editLevel) return;

        setRooms(currentRooms.map(r => r.id === selectedRoomId
            ? {
                ...r,
                name: editName,
                shape: editShape,
                settings: { ...r.settings, color: editColor, department: editDepartment || null, level: editLevel },
                color: editColor,
                department: editDepartment || null
            }
            : r
        ));
    }, [editName, editColor, editDepartment, editShape, editLevel, selectedRoomId, setRooms]);

    function loadRoomProperties(roomId: string) {
        isLoadingPropsRef.current = true;
        const room = useWorkspaceStore.getState().rooms.find(r => r.id === roomId);
        if (room) {
            setEditName(room.name || '');
            setEditDepartment(getRoomDepartment(room) || '');
            setEditColor(getRoomColor(room));
            setEditShape(room.shape || 'rect');
            setEditLevel(room.settings?.level ?? 0);
        }
        // Defer flag reset to avoid live-preview triggering on load
        requestAnimationFrame(() => { isLoadingPropsRef.current = false; });
    }

    function getViewportCenter() {
        const worldX = (window.innerWidth / 2 - stagePos.x) / zoom;
        const worldY = (window.innerHeight / 2 - stagePos.y) / zoom;
        return { x: snapToGrid(worldX), y: snapToGrid(worldY) };
    }

    const handleAddRoom = useCallback(async (template: typeof roomTemplates[0]) => {
        if (!activeSpaceId) { setToast({ msg: '❌ Nessuno spazio attivo', type: 'err' }); return; }
        const center = getViewportCenter();
        const tId = tempId();
        const roomSettings = {
            capacity: template.capacity,
            color: template.color,
            department: template.department || null,
        };
        const state = useWorkspaceStore.getState();
        const maxW = state.officeWidth || 4000;
        const maxH = state.officeHeight || 4000;

        let spawnX = center.x - template.width / 2;
        let spawnY = center.y - template.height / 2;

        // Clamp to prevent creating room outside bounds
        spawnX = Math.max(0, Math.min(spawnX, maxW - template.width));
        spawnY = Math.max(0, Math.min(spawnY, maxH - template.height));

        const optimisticRoom: any = {
            id: tId, space_id: activeSpaceId, name: template.name, type: template.type,
            x: spawnX, y: spawnY,
            width: template.width, height: template.height,
            capacity: template.capacity,
            settings: roomSettings,
            color: template.color,
            department: template.department || null,
        };
        addRoom(optimisticRoom);
        setSelectedRoom(tId);

        const dbPayload: any = {
            space_id: activeSpaceId,
            name: template.name,
            type: template.type,
            x: optimisticRoom.x,
            y: optimisticRoom.y,
            width: template.width,
            height: template.height,
            capacity: template.capacity,
            settings: roomSettings,
            shape: 'rect',
        };

        const { data, error } = await supabase.from('rooms').insert(dbPayload).select().single();
        if (error) {
            console.error('Room insert error:', error);
            setToast({ msg: `❌ Errore DB: ${error.message}`, type: 'err' });
        } else if (data) {
            const currentRooms = useWorkspaceStore.getState().rooms;
            setRooms(currentRooms.map(r => r.id === tId ? { ...r, ...data, color: template.color, department: template.department || null } : r));
            setSelectedRoom(data.id);
            setToast({ msg: `✅ ${template.name} creata!`, type: 'ok' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSpaceId, supabase, addRoom, setSelectedRoom, setRooms, stagePos, zoom]);

    const handleDeleteRoom = useCallback(async () => {
        if (!selectedRoomId) return;
        if (!confirm('Eliminare questa stanza e tutti i suoi arredi?')) return;

        // Optimistic delete
        removeRoom(selectedRoomId);
        setSelectedRoom(null); // Clear selection as well to avoid zombie references
        setToast({ msg: '🗑️ Stanza eliminata', type: 'ok' });

        // Clean up all related data before deleting the room
        await Promise.all([
            supabase.from('room_connections').delete().or(`room_a_id.eq.${selectedRoomId},room_b_id.eq.${selectedRoomId}`),
            supabase.from('furniture').delete().eq('room_id', selectedRoomId),
            supabase.from('room_participants').delete().eq('room_id', selectedRoomId),
        ]);

        const { error } = await supabase.from('rooms').delete().eq('id', selectedRoomId);
        if (error) {
            console.error("Error deleting room from DB:", error);
            setToast({ msg: `❌ Errore DB: ${error.message}`, type: 'err' });
        }
    }, [selectedRoomId, supabase, removeRoom, setSelectedRoom]);

    const handleSaveProperties = useCallback(async () => {
        if (!selectedRoomId) return;
        setSaving(true);
        const newSettings = {
            ...useWorkspaceStore.getState().rooms.find(r => r.id === selectedRoomId)?.settings,
            color: editColor,
            department: editDepartment || null,
            level: editLevel,
        };

        const dbUpdates: any = { name: editName, settings: newSettings, shape: editShape };
        const { error } = await supabase.from('rooms').update(dbUpdates).eq('id', selectedRoomId);
        if (error) { setToast({ msg: `❌ ${error.message}`, type: 'err' }); }
        else { setToast({ msg: '✅ Salvato!', type: 'ok' }); }
        setSaving(false);
    }, [selectedRoomId, editName, editDepartment, editColor, supabase]);

    const handleSaveEnvironment = useCallback(async () => {
        if (!activeSpaceId) return;
        setSaving(true);
        const state = useWorkspaceStore.getState();
        const layout_data = {
            officeWidth: state.officeWidth,
            officeHeight: state.officeHeight,
            bgOpacity: state.bgOpacity,
            landingPadX: state.landingPad.x,
            landingPadY: state.landingPad.y,
            landingPadScale: state.landingPadScale,
            layoutMode: state.layoutMode,
        };
        const { error } = await supabase.from('spaces').update({ layout_data }).eq('id', activeSpaceId);
        if (error) { setToast({ msg: `❌ Errore DB: ${error.message}`, type: 'err' }); }
        else { setToast({ msg: '✅ Ambiente salvato!', type: 'ok' }); }
        setSaving(false);
    }, [activeSpaceId, supabase]);

    // ─── Hierarchical auto-arrange ────────────────────────
    const handleAutoArrangeHierarchy = useCallback(async () => {
        if (!activeSpaceId || rooms.length === 0) return;
        setSaving(true);

        const state = useWorkspaceStore.getState();
        const oW = state.officeWidth || 4000;

        // Group rooms by level
        const byLevel: Record<number, any[]> = {};
        for (const r of rooms) {
            const lvl = r.settings?.level ?? 0;
            if (!byLevel[lvl]) byLevel[lvl] = [];
            byLevel[lvl].push(r);
        }

        const sortedLevels = Object.keys(byLevel).map(Number).sort((a: number, b: number) => a - b);
        const rowHeight = 400; // vertical spacing between levels
        const colGap = 50;     // horizontal gap between rooms
        const startY = 200;    // top margin

        const updatedRooms: any[] = [];
        sortedLevels.forEach((level: number, rowIdx: number) => {
            const roomsInLevel = byLevel[level];
            const totalWidth = roomsInLevel.reduce((s: number, r: any) => s + r.width + colGap, -colGap);
            let startX = (oW - totalWidth) / 2; // center horizontally

            roomsInLevel.forEach((room: any) => {
                const newY = startY + rowIdx * rowHeight;
                updatedRooms.push({ ...room, x: Math.round(startX), y: Math.round(newY) });
                startX += room.width + colGap;
            });
        });

        // Update in DB
        for (const r of updatedRooms) {
            await supabase.from('rooms').update({ x: r.x, y: r.y }).eq('id', r.id);
        }
        setRooms(updatedRooms);
        setToast({ msg: `✅ Organizzate ${updatedRooms.length} stanze in ${sortedLevels.length} livelli`, type: 'ok' });
        setSaving(false);
    }, [activeSpaceId, rooms, supabase, setRooms]);

    const handleResizeOfficeWidth = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newWidth = parseInt(e.target.value);
        const state = useWorkspaceStore.getState();

        // Verifica costrizioni stanze
        const outOfBounds = state.rooms.some(r => r.x + r.width > newWidth);
        if (outOfBounds) {
            setToast({ msg: '❌ Riduci/Sposta le stanze prima di stringere l\'ufficio!', type: 'err' });
            return;
        }

        state.setOfficeDimensions(newWidth, state.officeHeight || 4000);
    };

    const handleResizeOfficeHeight = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newHeight = parseInt(e.target.value);
        const state = useWorkspaceStore.getState();

        // Verifica costrizioni stanze
        const outOfBounds = state.rooms.some(r => r.y + r.height > newHeight);
        if (outOfBounds) {
            setToast({ msg: '❌ Riduci/Sposta le stanze prima di rimpicciolire l\'ufficio!', type: 'err' });
            return;
        }

        state.setOfficeDimensions(state.officeWidth || 4000, newHeight);
    };

    // ─── Apply Office Template ───────────────────────────────
    const handleApplyTemplate = useCallback(async (template: OfficeTemplate) => {
        if (!activeSpaceId) { setToast({ msg: '❌ Nessuno spazio attivo', type: 'err' }); return; }
        setApplyingTemplate(true);
        setConfirmTemplate(null);

        try {
            // 1. Delete all existing rooms and their related data
            const existingRooms = useWorkspaceStore.getState().rooms;
            for (const room of existingRooms) {
                await Promise.all([
                    supabase.from('room_connections').delete().or(`room_a_id.eq.${room.id},room_b_id.eq.${room.id}`),
                    supabase.from('furniture').delete().eq('room_id', room.id),
                    supabase.from('room_participants').delete().eq('room_id', room.id),
                ]);
                await supabase.from('rooms').delete().eq('id', room.id);
            }
            setRooms([]);

            // 2. Resize office
            useWorkspaceStore.getState().setOfficeDimensions(template.officeWidth, template.officeHeight);
            await supabase.from('spaces').update({
                layout_data: { officeWidth: template.officeWidth, officeHeight: template.officeHeight, bgOpacity: useWorkspaceStore.getState().bgOpacity, landingPadX: useWorkspaceStore.getState().landingPad.x, landingPadY: useWorkspaceStore.getState().landingPad.y }
            }).eq('id', activeSpaceId);

            // 3. Create all template rooms
            const newRooms: any[] = [];
            for (const tRoom of template.rooms) {
                const roomSettings = {
                    capacity: tRoom.capacity,
                    color: tRoom.color,
                    department: tRoom.department || null,
                };
                const dbPayload = {
                    space_id: activeSpaceId,
                    name: tRoom.name,
                    type: tRoom.type,
                    x: tRoom.x,
                    y: tRoom.y,
                    width: tRoom.width,
                    height: tRoom.height,
                    capacity: tRoom.capacity,
                    settings: roomSettings,
                };
                const { data, error } = await supabase.from('rooms').insert(dbPayload).select().single();
                if (error) {
                    console.error('Template room insert error:', error);
                } else if (data) {
                    newRooms.push({ ...data, color: tRoom.color, department: tRoom.department || null });
                }
            }

            setRooms(newRooms);
            setShowTemplates(false);
            setToast({ msg: `✅ Template "${template.name}" applicato! (${newRooms.length} stanze create)`, type: 'ok' });
        } catch (err: any) {
            console.error('Apply template error:', err);
            setToast({ msg: `❌ Errore: ${err?.message || 'Sconosciuto'}`, type: 'err' });
        } finally {
            setApplyingTemplate(false);
        }
    }, [activeSpaceId, supabase, setRooms]);

    // ─── Connection CRUD ────────────────────────────────────
    const handleCreateConnection = useCallback(async (fromIdOverride?: string) => {
        const fromId = fromIdOverride || connectFromId;
        if (!fromId || !connectToId || fromId === connectToId || !activeSpaceId) return;

        // Check not already connected
        const exists = roomConnections.some(c =>
            (c.room_a_id === fromId && c.room_b_id === connectToId) ||
            (c.room_a_id === connectToId && c.room_b_id === fromId)
        );
        if (exists) { setToast({ msg: '⚠️ Connessione già esistente', type: 'err' }); return; }

        const payload = {
            space_id: activeSpaceId,
            room_a_id: fromId,
            room_b_id: connectToId,
            type: 'link' as const,
            label: connectLabel || null,
            color: connectColor,
            x_a: 0, y_a: 0, x_b: 0, y_b: 0,
            is_locked: false,
            settings: {},
        };

        const { data, error } = await supabase.from('room_connections').insert(payload).select().single();
        if (error) { setToast({ msg: `❌ ${error.message}`, type: 'err' }); return; }
        if (data) {
            setRoomConnections([...roomConnections, data]);
            setConnectFromId('');
            setConnectToId('');
            setConnectLabel('');
            setToast({ msg: '✅ Connessione creata!', type: 'ok' });
        }
    }, [connectFromId, connectToId, connectLabel, connectColor, activeSpaceId, roomConnections, supabase, setRoomConnections]);

    const handleDeleteConnection = useCallback(async (connId: string) => {
        const { error } = await supabase.from('room_connections').delete().eq('id', connId);
        if (error) { setToast({ msg: `❌ ${error.message}`, type: 'err' }); return; }
        setRoomConnections(roomConnections.filter(c => c.id !== connId));
        setToast({ msg: '🗑️ Connessione eliminata', type: 'ok' });
    }, [roomConnections, supabase, setRoomConnections]);

    if (!isBuilderMode) return null;

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[100]">

            {/* TOAST NOTIFICATIONS */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ y: -50, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -50, opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className="pointer-events-auto absolute top-24 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border z-[120]"
                        style={{
                            background: 'rgba(15, 23, 42, 0.85)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderColor: toast.type === 'ok' ? 'rgba(52, 211, 153, 0.4)' : 'rgba(248, 113, 113, 0.4)',
                            color: toast.type === 'ok' ? '#34d399' : '#f87171'
                        }}
                    >
                        <span className="text-sm font-semibold tracking-wide">{toast.msg}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* TOP FLOATING PILL - BUILDER MODE ACTIVE */}
            <motion.div
                initial={{ y: -100, x: '-50%' }}
                animate={{ y: 24, x: '-50%' }}
                className="pointer-events-auto absolute top-0 left-1/2 -translate-x-1/2"
            >
                <div className="relative group flex items-center h-12 rounded-full p-1 shadow-[0_0_40px_rgba(0,212,255,0.15)]"
                    style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>

                    {/* Animated gradient border effect via pseudo element */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 opacity-50 block group-hover:opacity-100 transition-opacity -z-10 blur-md pointer-events-none" />

                    <div className="flex items-center gap-3 px-4 h-full">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-400">
                            Space Builder
                        </span>
                    </div>

                    <button
                        onClick={toggleBuilderMode}
                        className="flex items-center justify-center w-10 h-10 ml-2 rounded-full bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-all transform hover:scale-105 active:scale-95"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </motion.div>

            <div
                className="pointer-events-auto absolute top-24 right-0 w-80 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh]"
                style={{
                    background: 'rgba(10, 15, 30, 0.75)',
                    backdropFilter: 'blur(40px)',
                    WebkitBackdropFilter: 'blur(40px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRight: 'none',
                    animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                }}
            >
                {selectedRoom ? (
                    <>
                        {/* Glass Header for Properties */}
                        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between"
                            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)' }}>
                            <div className="flex items-center gap-2">
                                <Box className="w-4 h-4 text-cyan-400" />
                                <h3 className="text-sm font-bold text-white tracking-wide">Proprietà Stanza</h3>
                            </div>
                            <button onClick={() => setSelectedRoom(null)} className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/20 flex items-center justify-center transition-colors">
                                <X className="w-3 h-3 text-slate-300" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                            {/* Identifier Group */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Identificativo</label>
                                    <div className="relative">
                                        <PenTool className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            value={editName} onChange={(e) => setEditName(e.target.value)}
                                            className="w-full bg-black/20 border border-white/5 rounded-xl block py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-medium"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Reparto</label>
                                    <div className="relative">
                                        <Focus className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            value={editDepartment} onChange={(e) => setEditDepartment(e.target.value)} placeholder="Marketing, Dev..."
                                            className="w-full bg-black/20 border border-white/5 rounded-xl block py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                            {/* Shape */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <Box className="w-3 h-3" /> Forma Stanza
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setEditShape('rect')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all border ${editShape === 'rect'
                                                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                                                : 'bg-white/[0.03] border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                                        >
                                            <Square className="w-4 h-4" /> Rettangolo
                                        </button>
                                        <button
                                            onClick={() => setEditShape('circle')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all border ${editShape === 'circle'
                                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                                : 'bg-white/[0.03] border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                                        >
                                            <CircleIcon className="w-4 h-4" /> Cerchio
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                            {/* Hierarchical Level — always visible */}
                            {(
                                <>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <GitBranch className="w-3 h-3" /> Livello Gerarchico
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setEditLevel(Math.max(0, editLevel - 1))}
                                                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center text-sm font-bold"
                                            >−</button>
                                            <div className="flex-1 text-center">
                                                <span className="text-xl font-bold text-amber-300">{editLevel}</span>
                                                <p className="text-[9px] text-slate-500 mt-0.5">
                                                    {editLevel === 0 ? 'CEO / Top' : editLevel === 1 ? 'Directors' : editLevel === 2 ? 'Managers' : `Livello ${editLevel}`}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setEditLevel(editLevel + 1)}
                                                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center text-sm font-bold"
                                            >+</button>
                                        </div>
                                    </div>

                                    {/* Auto-arrange button inside level selector */}
                                    <button
                                        onClick={handleAutoArrangeHierarchy}
                                        disabled={saving}
                                        className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 hover:from-amber-500/20 hover:to-yellow-500/20 hover:border-amber-500/50 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(245,158,11,0.15)] group disabled:opacity-40"
                                    >
                                        <GitBranch className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                                        <span className="text-[11px] font-bold text-amber-50 tracking-wide">
                                            {saving ? 'Organizzando...' : 'Auto-Organizza Organigramma'}
                                        </span>
                                    </button>

                                    <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                </>
                            )}

                            {/* Appearance */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <PaintBucket className="w-3 h-3" /> Colore Principale
                                    </label>
                                    <div className="grid grid-cols-5 gap-2.5">
                                        {COLOR_PRESETS.map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setEditColor(c)}
                                                className="relative w-full aspect-square rounded-full transition-all group"
                                            >
                                                {/* Color core */}
                                                <div className={`absolute inset-0 rounded-full ${editColor === c ? 'scale-75' : 'scale-100 group-hover:scale-90'} shadow-inner transition-transform`} style={{ backgroundColor: c }} />
                                                {/* Selected outer ring */}
                                                {editColor === c && (
                                                    <div className="absolute inset-0 rounded-full border-2 opacity-80" style={{ borderColor: c, boxShadow: `0 0 10px ${c}40` }} />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                            {/* Room Connections Section */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Link2 className="w-3 h-3" /> Connessioni
                                </label>
                                {/* This room's connections */}
                                {roomConnections.filter((c: any) => c.room_a_id === selectedRoom.id || c.room_b_id === selectedRoom.id).map((conn: any) => {
                                    const other = conn.room_a_id === selectedRoom.id
                                        ? rooms.find(r => r.id === conn.room_b_id)
                                        : rooms.find(r => r.id === conn.room_a_id);
                                    return (
                                        <div key={conn.id} className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: conn.color || '#6366f1' }} />
                                            <span className="text-[10px] text-slate-300 flex-1 truncate">→ {other?.name || '?'}</span>
                                            {conn.label && <span className="text-[9px] text-indigo-400 font-bold">{conn.label}</span>}
                                            <button onClick={() => handleDeleteConnection(conn.id)} className="p-0.5 rounded hover:bg-red-500/20 text-slate-600 hover:text-red-400 transition-colors">
                                                <Unlink className="w-3 h-3" />
                                            </button>
                                        </div>
                                    );
                                })}
                                {/* Quick-add connection from this room */}
                                <div className="flex gap-1.5">
                                    <select
                                        value={connectToId}
                                        onChange={e => setConnectToId(e.target.value)}
                                        className="flex-1 px-2 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-white text-[10px] focus:outline-none focus:border-indigo-500/50"
                                    >
                                        <option value="" className="bg-slate-900">Collega a...</option>
                                        {rooms.filter(r => r.id !== selectedRoom.id).map(r => (
                                            <option key={r.id} value={r.id} className="bg-slate-900">{r.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => handleCreateConnection(selectedRoom.id)}
                                        disabled={!connectToId}
                                        className="px-3 py-1.5 rounded-lg bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-[10px] font-bold hover:bg-indigo-500/40 transition-all disabled:opacity-30"
                                    >
                                        <Link2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Action Footer */}
                        <div className="p-4 grid grid-cols-2 gap-2 border-t border-white/5 bg-black/20">
                            <button
                                onClick={handleDeleteRoom}
                                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Rimuovi
                            </button>
                            <button
                                onClick={handleSaveProperties} disabled={saving}
                                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-black bg-cyan-400 hover:bg-cyan-300 transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)] disabled:opacity-50"
                            >
                                <Save className="w-3.5 h-3.5" /> {saving ? '...' : 'Applica'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="p-4 flex-1 flex flex-col justify-start items-center h-full min-h-[160px] relative overflow-y-auto custom-scrollbar">
                            {/* Confirmation dialog for template */}
                            {confirmTemplate && (
                                <div className="w-full mb-4 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                                        <span className="text-sm font-bold text-amber-300">Attenzione</span>
                                    </div>
                                    <p className="text-xs text-slate-300 mb-3">Tutte le stanze esistenti verranno sostituite con il template <strong className="text-white">"{confirmTemplate.name}"</strong>. Questa azione non è reversibile.</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setConfirmTemplate(null)}
                                            className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-300 bg-white/5 hover:bg-white/10 transition-colors"
                                        >Annulla</button>
                                        <button
                                            onClick={() => handleApplyTemplate(confirmTemplate)}
                                            disabled={applyingTemplate}
                                            className="flex-1 py-2 rounded-xl text-xs font-bold text-black bg-amber-400 hover:bg-amber-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                        >
                                            {applyingTemplate ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                            Conferma
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!showTemplates ? (<>
                                {/* Template button — on top */}
                                <button
                                    onClick={() => { setShowTemplates(true); }}
                                    className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 hover:from-amber-500/20 hover:to-orange-500/20 hover:border-amber-500/50 transition-all transform hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(245,158,11,0.15)] group"
                                >
                                    <LayoutTemplate className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs font-bold text-amber-50 tracking-wide">Applica Template Ufficio</span>
                                </button>

                                {/* Nuova Stanza button */}
                                <button
                                    onClick={() => handleAddRoom(roomTemplates[0])}
                                    className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all transform hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(34,211,238,0.15)] group"
                                >
                                    <Plus className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs font-bold text-cyan-50 tracking-wide">Nuova Stanza</span>
                                </button>

                                {/* Divider */}
                                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                                {/* Modifica Stanza — room list always open */}
                                <div className="w-full space-y-2">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Modifica Stanza</p>
                                    {rooms.map(room => (
                                        <button
                                            key={room.id}
                                            onClick={() => setSelectedRoom(room.id)}
                                            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 border border-white/5 hover:border-white/10 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getRoomColor(room) }} />
                                                <span className="text-sm text-slate-200 font-medium">{room.name}</span>
                                            </div>
                                            <Edit2 className="w-4 h-4 text-slate-500" />
                                        </button>
                                    ))}
                                    {rooms.length === 0 && (
                                        <p className="text-sm text-slate-500 text-center py-4">Nessuna stanza. Crea la prima o usa un template!</p>
                                    )}
                                </div>

                                {/* Connections summary */}
                                {roomConnections.length > 0 && (
                                    <div className="w-full space-y-2">
                                        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Connessioni ({roomConnections.length})</p>
                                        {roomConnections.map((conn: any) => {
                                            const roomA = rooms.find(r => r.id === conn.room_a_id);
                                            const roomB = rooms.find(r => r.id === conn.room_b_id);
                                            return (
                                                <div key={conn.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: conn.color || '#6366f1' }} />
                                                    <span className="text-[10px] text-slate-300 flex-1 truncate">{roomA?.name || '?'} → {roomB?.name || '?'}</span>
                                                    <button onClick={() => handleDeleteConnection(conn.id)} className="p-1 rounded-lg hover:bg-red-500/20 text-slate-600 hover:text-red-400 transition-colors">
                                                        <Unlink className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>) : (
                                /* Templates List */
                                <div className="w-full">
                                    <button
                                        onClick={() => setShowTemplates(false)}
                                        className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-4"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5" />
                                        <span className="font-medium">Torna indietro</span>
                                    </button>

                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Scegli un template</p>

                                    <div className="space-y-3">
                                        {OFFICE_TEMPLATES.map((template) => (
                                            <button
                                                key={template.id}
                                                onClick={() => setConfirmTemplate(template)}
                                                disabled={applyingTemplate}
                                                className="w-full text-left p-4 rounded-2xl border border-white/5 hover:border-white/15 bg-white/[0.02] hover:bg-white/[0.05] transition-all group disabled:opacity-50"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <span className="text-2xl flex-shrink-0 mt-0.5">{template.icon}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-bold text-white group-hover:text-cyan-200 transition-colors">{template.name}</h4>
                                                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{template.description}</p>
                                                        <div className="flex items-center gap-3 mt-2">
                                                            <span className="text-[10px] font-medium text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
                                                                {template.rooms.length} stanze
                                                            </span>
                                                            <span className="text-[10px] font-medium text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
                                                                {template.officeWidth}×{template.officeHeight}
                                                            </span>
                                                        </div>

                                                        {/* Mini room color preview */}
                                                        <div className="flex gap-1 mt-2">
                                                            {template.rooms.map((r, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="w-3 h-3 rounded-sm opacity-70 group-hover:opacity-100 transition-opacity"
                                                                    style={{ backgroundColor: r.color }}
                                                                    title={r.name}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </>
                )}
            </div>

        </div >
    );
}

export default OfficeBuilder;
