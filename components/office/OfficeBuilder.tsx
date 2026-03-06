'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { createClient } from '../../utils/supabase/client';
import { OFFICE_PRESETS } from './MiniMap';
import { OFFICE_TEMPLATES, OfficeTemplate } from '../../lib/officeTemplates';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, X, Box, Users, Save, Palette, PenTool, Focus, PaintBucket, Edit2,
    LayoutTemplate, ArrowLeft, Loader2, AlertTriangle, Circle as CircleIcon, Square, Link2, Unlink
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
        isBuilderMode, rooms, selectedRoomId, roomTemplates, roomConnections,
        activeSpaceId, stagePos, zoom, addRoom, setSelectedRoom, removeRoom,
        setRooms, setRoomConnections, toggleBuilderMode,
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
        if (room.name === editName && currentColor === editColor && currentDept === editDepartment && (room.shape || 'rect') === editShape) return;

        setRooms(currentRooms.map(r => r.id === selectedRoomId
            ? {
                ...r,
                name: editName,
                shape: editShape,
                settings: { ...r.settings, color: editColor, department: editDepartment || null },
                color: editColor,
                department: editDepartment || null
            }
            : r
        ));
    }, [editName, editColor, editDepartment, editShape, selectedRoomId, setRooms]);

    function loadRoomProperties(roomId: string) {
        isLoadingPropsRef.current = true;
        const room = useWorkspaceStore.getState().rooms.find(r => r.id === roomId);
        if (room) {
            setEditName(room.name || '');
            setEditDepartment(getRoomDepartment(room) || '');
            setEditColor(getRoomColor(room));
            setEditShape(room.shape || 'rect');
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
        };
        const { error } = await supabase.from('spaces').update({ layout_data }).eq('id', activeSpaceId);
        if (error) { setToast({ msg: `❌ Errore DB: ${error.message}`, type: 'err' }); }
        else { setToast({ msg: '✅ Ambiente salvato!', type: 'ok' }); }
        setSaving(false);
    }, [activeSpaceId, supabase]);

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
    const handleCreateConnection = useCallback(async () => {
        if (!connectFromId || !connectToId || connectFromId === connectToId || !activeSpaceId) return;

        // Check not already connected
        const exists = roomConnections.some(c =>
            (c.room_a_id === connectFromId && c.room_b_id === connectToId) ||
            (c.room_a_id === connectToId && c.room_b_id === connectFromId)
        );
        if (exists) { setToast({ msg: '⚠️ Connessione già esistente', type: 'err' }); return; }

        const payload = {
            space_id: activeSpaceId,
            room_a_id: connectFromId,
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
                            Design Mode
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

                            {!showTemplates ? (
                                <>
                                    <div className="grid grid-cols-2 gap-3 w-full">
                                        <button
                                            onClick={() => handleAddRoom(roomTemplates[0])}
                                            className="w-full flex flex-col items-center justify-center gap-3 p-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all transform hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(34,211,238,0.15)] group relative overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="relative w-10 h-10 flex items-center justify-center rounded-full bg-cyan-500/20 group-hover:bg-cyan-500/30 transition-colors">
                                                <Plus className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
                                            </div>
                                            <span className="relative text-[11px] font-bold text-cyan-50 tracking-wide text-center">Nuova Stanza</span>
                                        </button>

                                        <button
                                            onClick={() => setShowRoomsList(!showRoomsList)}
                                            className={`w-full flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border transition-all transform hover:-translate-y-1 group relative overflow-hidden ${showRoomsList ? 'bg-purple-500/20 border-purple-500/50' : 'bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 hover:border-purple-500/50'}`}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="relative w-10 h-10 flex items-center justify-center rounded-full bg-purple-500/20 group-hover:bg-purple-500/30 transition-colors">
                                                <PenTool className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                                            </div>
                                            <span className="relative text-[11px] font-bold text-purple-50 tracking-wide text-center">Modifica Stanza</span>
                                        </button>
                                    </div>

                                    {/* Template button — full width below */}
                                    <button
                                        onClick={() => { setShowTemplates(true); setShowRoomsList(false); }}
                                        className="w-full mt-3 flex items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 hover:from-amber-500/20 hover:to-orange-500/20 hover:border-amber-500/50 transition-all transform hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(245,158,11,0.15)] group relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-amber-400/5 to-orange-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <LayoutTemplate className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                                        <span className="text-xs font-bold text-amber-50 tracking-wide">Applica Template Ufficio</span>
                                    </button>

                                    {/* Connection button */}
                                    <button
                                        onClick={() => { setShowConnections(!showConnections); setShowRoomsList(false); }}
                                        className={`w-full mt-2 flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all transform hover:-translate-y-0.5 group relative overflow-hidden ${showConnections ? 'bg-indigo-500/20 border-indigo-500/50' : 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/30 hover:from-indigo-500/20 hover:to-purple-500/20 hover:border-indigo-500/50'}`}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/5 to-purple-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <Link2 className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                                        <span className="text-xs font-bold text-indigo-50 tracking-wide">Connessioni Mind Map</span>
                                    </button>

                                    {/* Connections Panel */}
                                    {showConnections && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="w-full mt-3 space-y-3 bg-white/[0.03] rounded-2xl border border-indigo-500/20 p-4"
                                        >
                                            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Nuova Connessione</p>

                                            {/* From Room */}
                                            <select
                                                value={connectFromId}
                                                onChange={e => setConnectFromId(e.target.value)}
                                                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500/50"
                                            >
                                                <option value="" className="bg-slate-900">Da stanza...</option>
                                                {rooms.map(r => (
                                                    <option key={r.id} value={r.id} className="bg-slate-900">{r.name}</option>
                                                ))}
                                            </select>

                                            {/* To Room */}
                                            <select
                                                value={connectToId}
                                                onChange={e => setConnectToId(e.target.value)}
                                                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500/50"
                                            >
                                                <option value="" className="bg-slate-900">A stanza...</option>
                                                {rooms.filter(r => r.id !== connectFromId).map(r => (
                                                    <option key={r.id} value={r.id} className="bg-slate-900">{r.name}</option>
                                                ))}
                                            </select>

                                            {/* Label */}
                                            <input
                                                value={connectLabel}
                                                onChange={e => setConnectLabel(e.target.value)}
                                                placeholder="Etichetta (es: Marketing)"
                                                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                                            />

                                            {/* Color */}
                                            <div className="flex gap-1.5">
                                                {['#6366f1', '#8b5cf6', '#3b82f6', '#14b8a6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'].map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setConnectColor(c)}
                                                        className={`w-6 h-6 rounded-full transition-all ${connectColor === c ? 'ring-2 ring-white/60 scale-110' : 'hover:scale-110'}`}
                                                        style={{ backgroundColor: c }}
                                                    />
                                                ))}
                                            </div>

                                            {/* Create button */}
                                            <button
                                                onClick={handleCreateConnection}
                                                disabled={!connectFromId || !connectToId}
                                                className="w-full py-2.5 rounded-xl bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-xs font-bold hover:bg-indigo-500/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                <Link2 className="w-3.5 h-3.5" /> Crea Connessione
                                            </button>

                                            {/* Existing connections */}
                                            {roomConnections.length > 0 && (
                                                <div className="space-y-2 mt-3">
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Connessioni Attive</p>
                                                    {roomConnections.map(conn => {
                                                        const roomA = rooms.find(r => r.id === conn.room_a_id);
                                                        const roomB = rooms.find(r => r.id === conn.room_b_id);
                                                        return (
                                                            <div key={conn.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                                                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: conn.color || '#6366f1' }} />
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="text-[10px] text-slate-300 truncate block">
                                                                        {roomA?.name || '?'} → {roomB?.name || '?'}
                                                                    </span>
                                                                    {conn.label && (
                                                                        <span className="text-[9px] text-indigo-400 font-bold uppercase">{conn.label}</span>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    onClick={() => handleDeleteConnection(conn.id)}
                                                                    className="flex-shrink-0 p-1 rounded-lg hover:bg-red-500/20 text-slate-600 hover:text-red-400 transition-colors"
                                                                >
                                                                    <Unlink className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </>
                            ) : (
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

                            {showRoomsList && !showTemplates && (
                                <div className="w-full mt-4 space-y-2">
                                    <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">Seleziona una stanza da modificare</p>
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
                                        <p className="text-sm text-slate-500 text-center py-4">Nessuna stanza presente.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

        </div>
    );
}

export default OfficeBuilder;
