'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { createClient } from '../../utils/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus,
    Trash2,
    X,
    Layers,
    PaintBucket,
    Type,
    Users,
    ChevronRight,
    ChevronDown,
    Save,
} from 'lucide-react';
import { Button } from '../ui/button';

// Furniture preset definitions
const FURNITURE_PRESETS = [
    { type: 'desk', label: 'Scrivania', icon: '🖥️', width: 60, height: 30 },
    { type: 'chair', label: 'Sedia', icon: '🪑', width: 20, height: 20 },
    { type: 'sofa', label: 'Divano', icon: '🛋️', width: 70, height: 30 },
    { type: 'plant', label: 'Pianta', icon: '🌿', width: 20, height: 20 },
    { type: 'whiteboard', label: 'Lavagna', icon: '📋', width: 60, height: 10 },
    { type: 'monitor', label: 'Monitor', icon: '🖥️', width: 30, height: 20 },
    { type: 'coffee', label: 'Macchina Caffè', icon: '☕', width: 25, height: 25 },
    { type: 'bookshelf', label: 'Libreria', icon: '📚', width: 50, height: 15 },
    { type: 'lamp', label: 'Lampada', icon: '💡', width: 15, height: 15 },
    { type: 'table', label: 'Tavolo Riunioni', icon: '🪑', width: 80, height: 50 },
];

// Room color presets
const COLOR_PRESETS = [
    '#1e293b', '#1e3a8a', '#312e81', '#065f46', '#7c2d12',
    '#0f766e', '#9333ea', '#b91c1c', '#c2410c', '#155e75'
];

// Snap helper
function snapToGrid(value: number, gridSize: number = 20): number {
    return Math.round(value / gridSize) * gridSize;
}

// Generate temp ID for optimistic updates
function tempId(): string {
    return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function OfficeBuilder() {
    const supabase = createClient();
    const {
        isBuilderMode,
        rooms,
        selectedRoomId,
        roomTemplates,
        furnitureItems,
        activeSpaceId,
        stagePos,
        zoom,
        addRoom,
        setSelectedRoom,
        removeRoom,
        addFurniture,
        removeFurniture,
        setRooms,
        toggleBuilderMode,
    } = useOfficeStore();

    const [expandedSection, setExpandedSection] = useState<'rooms' | 'furniture' | 'properties'>('rooms');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string, type: 'ok' | 'err' } | null>(null);
    const [editName, setEditName] = useState('');
    const [editType, setEditType] = useState('open');
    const [editDepartment, setEditDepartment] = useState('');
    const [editColor, setEditColor] = useState('#1e293b');
    const [editCapacity, setEditCapacity] = useState(10);

    const selectedRoom = rooms.find(r => r.id === selectedRoomId);

    // Toast auto-dismiss
    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 3500);
            return () => clearTimeout(t);
        }
    }, [toast]);

    // Listen for room selection events from RoomEditor (canvas)
    useEffect(() => {
        const handler = (e: Event) => {
            const { roomId } = (e as CustomEvent).detail;
            loadRoomProperties(roomId);
        };
        window.addEventListener('builder-select-room', handler);
        return () => window.removeEventListener('builder-select-room', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rooms]);

    function loadRoomProperties(roomId: string) {
        const room = useOfficeStore.getState().rooms.find(r => r.id === roomId);
        if (room) {
            setSelectedRoom(roomId);
            setEditName(room.name || '');
            setEditType(room.type || 'open');
            setEditDepartment((room as any).department || '');
            setEditColor((room as any).color || '#1e293b');
            setEditCapacity((room as any).capacity || room.settings?.capacity || 10);
            setExpandedSection('properties');
        }
    }

    // Calculate position in the visible viewport center
    function getViewportCenter(): { x: number; y: number } {
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const centerScreenX = viewportW / 2;
        const centerScreenY = viewportH / 2;
        // Convert screen coords to world coords
        const worldX = (centerScreenX - stagePos.x) / zoom;
        const worldY = (centerScreenY - stagePos.y) / zoom;
        return { x: snapToGrid(worldX), y: snapToGrid(worldY) };
    }

    // Add room from template — OPTIMISTIC approach
    const handleAddRoom = useCallback(async (template: typeof roomTemplates[0]) => {
        if (!activeSpaceId) {
            setToast({ msg: '❌ Nessuno spazio attivo', type: 'err' });
            return;
        }

        const center = getViewportCenter();
        const tId = tempId();

        // Step 1: Add to local state immediately (optimistic)
        const optimisticRoom: any = {
            id: tId,
            space_id: activeSpaceId,
            name: template.name,
            type: template.type,
            x: center.x - template.width / 2,
            y: center.y - template.height / 2,
            width: template.width,
            height: template.height,
            is_secret: false,
            capacity: template.capacity,
            settings: { capacity: template.capacity },
            department: template.department || null,
            color: template.color,
        };

        addRoom(optimisticRoom);
        setSelectedRoom(tId);
        setEditName(template.name);
        setEditType(template.type);
        setEditDepartment(template.department || '');
        setEditColor(template.color);
        setEditCapacity(template.capacity);
        setExpandedSection('properties');

        // Step 2: Persist to DB
        const dbPayload: any = {
            space_id: activeSpaceId,
            name: template.name,
            type: template.type,
            x: optimisticRoom.x,
            y: optimisticRoom.y,
            width: template.width,
            height: template.height,
            is_secret: false,
            capacity: template.capacity,
            settings: { capacity: template.capacity },
        };

        const { data, error } = await supabase
            .from('rooms')
            .insert(dbPayload)
            .select()
            .single();

        if (error) {
            console.error('Room insert error:', error);
            setToast({ msg: `❌ Errore DB: ${error.message}`, type: 'err' });
            // Keep it in local state anyway so user can still work
        } else if (data) {
            // Replace temp ID with real ID
            const currentRooms = useOfficeStore.getState().rooms;
            const updated = currentRooms.map(r =>
                r.id === tId ? { ...r, ...data } : r
            );
            setRooms(updated);
            setSelectedRoom(data.id);

            // Try to update department/color columns (they may not exist yet)
            if (template.department || template.color) {
                try {
                    await supabase
                        .from('rooms')
                        .update({
                            department: template.department || null,
                            color: template.color,
                        })
                        .eq('id', data.id);
                } catch (e) {
                    // Columns may not exist — that's OK
                    console.log('department/color columns not available yet');
                }
            }

            setToast({ msg: `✅ ${template.name} creata!`, type: 'ok' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSpaceId, supabase, addRoom, setSelectedRoom, setRooms, stagePos, zoom]);

    // Add furniture to selected room
    const handleAddFurniture = useCallback(async (preset: typeof FURNITURE_PRESETS[0]) => {
        if (!selectedRoomId) {
            setToast({ msg: '⚠️ Seleziona prima una stanza', type: 'err' });
            return;
        }

        const selectedRm = rooms.find(r => r.id === selectedRoomId);
        if (!selectedRm) return;

        const tId = tempId();

        // Optimistic add
        const optimisticItem: any = {
            id: tId,
            room_id: selectedRoomId,
            type: preset.type,
            label: preset.label,
            x: snapToGrid(selectedRm.x + selectedRm.width / 2 - preset.width / 2),
            y: snapToGrid(selectedRm.y + selectedRm.height / 2 - preset.height / 2),
            width: preset.width,
            height: preset.height,
            rotation: 0,
            settings: {},
        };

        addFurniture(optimisticItem);

        // Persist to DB
        const { room_id, ...rest } = optimisticItem;
        const dbPayload = { ...rest, room_id: selectedRoomId };
        delete dbPayload.id; // let DB generate ID

        const { data, error } = await supabase
            .from('furniture')
            .insert(dbPayload)
            .select()
            .single();

        if (error) {
            console.error('Furniture insert error:', error);
            setToast({ msg: `⚠️ Arredo aggiunto localmente (DB: ${error.message})`, type: 'err' });
        } else if (data) {
            // Replace temp item with real data
            const state = useOfficeStore.getState();
            const updatedFurniture = state.furnitureItems.map(f =>
                f.id === tId ? { ...f, ...data } : f
            );
            state.setFurnitureItems(updatedFurniture);
            setToast({ msg: `✅ ${preset.label} aggiunto!`, type: 'ok' });
        }
    }, [selectedRoomId, rooms, supabase, addFurniture]);

    // Delete room
    const handleDeleteRoom = useCallback(async () => {
        if (!selectedRoomId) return;
        if (!confirm('Sei sicuro di voler eliminare questa stanza e tutti i suoi arredi?')) return;

        removeRoom(selectedRoomId);
        setToast({ msg: '🗑️ Stanza eliminata', type: 'ok' });

        // Persist
        const { error } = await supabase.from('rooms').delete().eq('id', selectedRoomId);
        if (error) console.error('Delete room error:', error);
    }, [selectedRoomId, supabase, removeRoom]);

    // Delete furniture
    const handleDeleteFurniture = useCallback(async (furnitureId: string) => {
        removeFurniture(furnitureId);

        const { error } = await supabase.from('furniture').delete().eq('id', furnitureId);
        if (error) console.error('Delete furniture error:', error);
    }, [supabase, removeFurniture]);

    // Save room properties
    const handleSaveProperties = useCallback(async () => {
        if (!selectedRoomId) return;
        setSaving(true);

        // Update local store first
        const currentRooms = useOfficeStore.getState().rooms;
        const localUpdates: any = {
            name: editName,
            type: editType,
            capacity: editCapacity,
            settings: { capacity: editCapacity },
            department: editDepartment || null,
            color: editColor,
        };
        setRooms(currentRooms.map(r =>
            r.id === selectedRoomId ? { ...r, ...localUpdates } : r
        ));

        // Persist to DB
        const dbUpdates: any = {
            name: editName,
            type: editType,
            capacity: editCapacity,
            settings: { capacity: editCapacity },
        };

        const { error } = await supabase
            .from('rooms')
            .update(dbUpdates)
            .eq('id', selectedRoomId);

        if (error) {
            setToast({ msg: `❌ Errore salvataggio: ${error.message}`, type: 'err' });
        } else {
            // Try department/color separately
            try {
                await supabase
                    .from('rooms')
                    .update({ department: editDepartment || null, color: editColor })
                    .eq('id', selectedRoomId);
            } catch (e) {
                // columns may not exist
            }
            setToast({ msg: '✅ Proprietà salvate!', type: 'ok' });
        }

        setSaving(false);
    }, [selectedRoomId, editName, editType, editDepartment, editColor, editCapacity, supabase, setRooms]);

    // Handle room selection from list
    const handleSelectRoom = useCallback((roomId: string) => {
        loadRoomProperties(roomId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rooms]);

    if (!isBuilderMode) return null;

    const roomFurniture = furnitureItems.filter(f => f.room_id === selectedRoomId);

    return (
        <>
            {/* Toast notification */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ y: -40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -40, opacity: 0 }}
                        className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-2.5 rounded-xl text-sm font-medium shadow-2xl border ${toast.type === 'ok'
                                ? 'bg-emerald-500/90 border-emerald-400/50 text-white'
                                : 'bg-red-500/90 border-red-400/50 text-white'
                            }`}
                    >
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Builder Mode Indicator Banner */}
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] bg-amber-500/90 text-black px-5 py-1.5 rounded-full text-sm font-bold shadow-lg flex items-center gap-2"
            >
                🔧 MODALITÀ BUILDER — Clicca le stanze per selezionarle, trascinale per spostarle
            </motion.div>

            {/* Sidebar Panel */}
            <motion.div
                initial={{ x: -320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -320, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute left-4 top-14 bottom-4 w-80 z-[55] flex flex-col gap-0 overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
                style={{ backdropFilter: 'blur(20px)', background: 'rgba(15,23,42,0.95)' }}
            >
                {/* Header */}
                <div className="p-4 border-b border-white/5 bg-gradient-to-r from-primary-500/10 to-pink-500/10 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-primary-400" />
                        <h2 className="text-base font-bold text-white">Office Builder</h2>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 rounded-lg hover:bg-white/10"
                        onClick={toggleBuilderMode}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">

                    {/* Room Templates Section */}
                    <div className="rounded-xl border border-white/5 overflow-hidden">
                        <button
                            className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-colors text-left"
                            onClick={() => setExpandedSection(expandedSection === 'rooms' ? 'properties' : 'rooms')}
                        >
                            <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                                <Plus className="w-4 h-4 text-primary-400" />
                                Aggiungi Stanza
                            </span>
                            {expandedSection === 'rooms'
                                ? <ChevronDown className="w-4 h-4 text-slate-400" />
                                : <ChevronRight className="w-4 h-4 text-slate-400" />
                            }
                        </button>
                        {expandedSection === 'rooms' && (
                            <div className="p-2 grid grid-cols-2 gap-2">
                                {roomTemplates.map((template, i) => (
                                    <button
                                        key={i}
                                        className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/5 hover:bg-primary-500/20 border border-white/5 hover:border-primary-500/30 transition-all group cursor-pointer active:scale-95"
                                        onClick={() => handleAddRoom(template)}
                                    >
                                        <span className="text-2xl group-hover:scale-110 transition-transform">{template.icon}</span>
                                        <span className="text-xs text-slate-300 font-medium text-center leading-tight">{template.name}</span>
                                        {template.department && (
                                            <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{template.department}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Furniture Section */}
                    <div className="rounded-xl border border-white/5 overflow-hidden">
                        <button
                            className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-colors text-left"
                            onClick={() => setExpandedSection(expandedSection === 'furniture' ? 'properties' : 'furniture')}
                        >
                            <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                                🪑 Arredi & Decorazioni
                            </span>
                            {expandedSection === 'furniture'
                                ? <ChevronDown className="w-4 h-4 text-slate-400" />
                                : <ChevronRight className="w-4 h-4 text-slate-400" />
                            }
                        </button>
                        {expandedSection === 'furniture' && (
                            <div className="p-2">
                                {!selectedRoomId && (
                                    <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mb-2">
                                        ⚠️ Seleziona una stanza sulla canvas per aggiungere arredi
                                    </p>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                    {FURNITURE_PRESETS.map((preset, i) => (
                                        <button
                                            key={i}
                                            disabled={!selectedRoomId}
                                            className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 border border-white/5 hover:border-emerald-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-left cursor-pointer active:scale-95"
                                            onClick={() => handleAddFurniture(preset)}
                                        >
                                            <span className="text-lg">{preset.icon}</span>
                                            <span className="text-xs text-slate-300">{preset.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Room furniture list */}
                                {selectedRoomId && roomFurniture.length > 0 && (
                                    <div className="mt-3 space-y-1">
                                        <p className="text-xs text-slate-500 font-medium px-1">Nella stanza:</p>
                                        {roomFurniture.map(f => (
                                            <div key={f.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 text-xs">
                                                <span className="text-slate-300">{f.label || f.type}</span>
                                                <button
                                                    onClick={() => handleDeleteFurniture(f.id)}
                                                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Properties Section */}
                    <div className="rounded-xl border border-white/5 overflow-hidden">
                        <button
                            className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-colors text-left"
                            onClick={() => setExpandedSection(expandedSection === 'properties' ? 'rooms' : 'properties')}
                        >
                            <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                                <PaintBucket className="w-4 h-4 text-amber-400" />
                                Proprietà Stanza
                            </span>
                            {expandedSection === 'properties'
                                ? <ChevronDown className="w-4 h-4 text-slate-400" />
                                : <ChevronRight className="w-4 h-4 text-slate-400" />
                            }
                        </button>
                        {expandedSection === 'properties' && (
                            <div className="p-3">
                                {!selectedRoom ? (
                                    <p className="text-xs text-slate-500 text-center py-4 bg-white/5 rounded-xl border border-dashed border-white/10">
                                        Clicca su una stanza nella canvas per modificarla
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {/* Name */}
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                                <Type className="w-3 h-3" /> Nome
                                            </label>
                                            <input
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary-500/50 text-slate-200"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                            />
                                        </div>

                                        {/* Type */}
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500 font-medium">Tipo</label>
                                            <select
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary-500/50 text-slate-200"
                                                value={editType}
                                                onChange={(e) => setEditType(e.target.value)}
                                            >
                                                <option value="open">Open Area</option>
                                                <option value="meeting">Meeting Room</option>
                                                <option value="focus">Focus Zone</option>
                                                <option value="break">Break Area</option>
                                                <option value="reception">Reception</option>
                                            </select>
                                        </div>

                                        {/* Department */}
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500 font-medium">Reparto</label>
                                            <input
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary-500/50 text-slate-200"
                                                value={editDepartment}
                                                onChange={(e) => setEditDepartment(e.target.value)}
                                                placeholder="es. Engineering, Marketing..."
                                            />
                                        </div>

                                        {/* Color */}
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                                <PaintBucket className="w-3 h-3" /> Colore
                                            </label>
                                            <div className="flex gap-2 flex-wrap">
                                                {COLOR_PRESETS.map(c => (
                                                    <button
                                                        key={c}
                                                        className={`w-7 h-7 rounded-lg border-2 transition-all ${editColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:border-white/30'}`}
                                                        style={{ backgroundColor: c }}
                                                        onClick={() => setEditColor(c)}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Capacity */}
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                                <Users className="w-3 h-3" /> Capacità: {editCapacity}
                                            </label>
                                            <input
                                                type="range"
                                                min="1"
                                                max="50"
                                                value={editCapacity}
                                                onChange={(e) => setEditCapacity(parseInt(e.target.value))}
                                                className="w-full accent-primary-500"
                                            />
                                        </div>

                                        {/* Dimensions display */}
                                        <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/5 rounded-lg p-2">
                                            <span>📐 {selectedRoom.width} × {selectedRoom.height}px</span>
                                            <span>📍 ({selectedRoom.x}, {selectedRoom.y})</span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2 pt-1">
                                            <Button
                                                className="flex-1 gap-1.5 text-sm h-9"
                                                onClick={handleSaveProperties}
                                                disabled={saving}
                                            >
                                                <Save className="w-3.5 h-3.5" />
                                                {saving ? 'Salvataggio...' : 'Salva'}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                className="gap-1.5 text-sm h-9 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                onClick={handleDeleteRoom}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Elimina
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Room list */}
                    <div className="rounded-xl border border-white/5 overflow-hidden">
                        <div className="p-3 bg-white/5">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Stanze ({rooms.length})
                            </span>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                            {rooms.map(room => (
                                <button
                                    key={room.id}
                                    className={`w-full flex items-center gap-2 p-2.5 text-left hover:bg-white/10 transition-colors border-b border-white/5 last:border-0 ${selectedRoomId === room.id ? 'bg-primary-500/15 border-l-2 border-l-primary-500' : ''}`}
                                    onClick={() => handleSelectRoom(room.id)}
                                >
                                    <div
                                        className="w-4 h-4 rounded shrink-0 border border-white/10"
                                        style={{ backgroundColor: (room as any).color || '#1e293b' }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-200 truncate">{room.name}</p>
                                        <p className="text-[10px] text-slate-500">{room.type}{(room as any).department ? ` • ${(room as any).department}` : ''}</p>
                                    </div>
                                </button>
                            ))}
                            {rooms.length === 0 && (
                                <p className="text-xs text-slate-500 text-center py-4 px-3">
                                    Nessuna stanza. Clicca sui template sopra per aggiungerne una!
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-white/5 bg-black/20 shrink-0">
                    <Button
                        className="w-full gap-2 bg-emerald-500/80 hover:bg-emerald-500 text-white text-sm font-semibold"
                        onClick={toggleBuilderMode}
                    >
                        ✅ Finito — Esci dal Builder
                    </Button>
                </div>
            </motion.div>
        </>
    );
}

export default OfficeBuilder;
