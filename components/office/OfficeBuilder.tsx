'use client';

import React, { useState, useCallback } from 'react';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { createClient } from '../../utils/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus,
    Trash2,
    X,
    GripVertical,
    Layers,
    PaintBucket,
    Type,
    Users,
    ChevronRight,
    ChevronDown,
    Armchair,
    Monitor as MonitorIcon,
    Coffee,
    Flower2,
    PanelTop,
    BookOpen,
    Lamp,
    Presentation,
    Save,
    RotateCcw
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

// Snap helper
function snapToGrid(value: number, gridSize: number = 20): number {
    return Math.round(value / gridSize) * gridSize;
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
        addRoom,
        setSelectedRoom,
        updateRoomPosition,
        updateRoomSize,
        removeRoom,
        addFurniture,
        removeFurniture,
        toggleBuilderMode,
    } = useOfficeStore();

    const [expandedSection, setExpandedSection] = useState<'rooms' | 'furniture' | 'properties'>('rooms');
    const [saving, setSaving] = useState(false);
    const [editName, setEditName] = useState('');
    const [editType, setEditType] = useState('');
    const [editDepartment, setEditDepartment] = useState('');
    const [editColor, setEditColor] = useState('');
    const [editCapacity, setEditCapacity] = useState(10);

    const selectedRoom = rooms.find(r => r.id === selectedRoomId);

    // When selecting a room, populate edit fields
    const handleSelectRoom = useCallback((roomId: string) => {
        const room = useOfficeStore.getState().rooms.find(r => r.id === roomId);
        if (room) {
            setSelectedRoom(roomId);
            setEditName(room.name);
            setEditType(room.type);
            setEditDepartment((room as any).department || '');
            setEditColor((room as any).color || '#1e293b');
            setEditCapacity(room.settings?.capacity || 10);
            setExpandedSection('properties');
        }
    }, [setSelectedRoom]);

    // Add room from template
    const handleAddRoom = useCallback(async (template: typeof roomTemplates[0]) => {
        if (!activeSpaceId) return;

        const newRoom = {
            space_id: activeSpaceId,
            name: template.name,
            type: template.type,
            x: snapToGrid(200 + Math.random() * 400),
            y: snapToGrid(200 + Math.random() * 400),
            width: template.width,
            height: template.height,
            is_secret: false,
            capacity: template.capacity,
            settings: { capacity: template.capacity },
            department: template.department || null,
            color: template.color,
        };

        // Save to DB
        const { data, error } = await supabase
            .from('rooms')
            .insert(newRoom)
            .select()
            .single();

        if (!error && data) {
            addRoom(data);
            handleSelectRoom(data.id);
        }
    }, [activeSpaceId, supabase, addRoom, handleSelectRoom]);

    // Add furniture to selected room
    const handleAddFurniture = useCallback(async (preset: typeof FURNITURE_PRESETS[0]) => {
        if (!selectedRoomId) return;

        const selectedRm = rooms.find(r => r.id === selectedRoomId);
        if (!selectedRm) return;

        const newFurniture = {
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

        // Save to DB
        const { data, error } = await supabase
            .from('furniture')
            .insert(newFurniture)
            .select()
            .single();

        if (!error && data) {
            addFurniture(data);
        }
    }, [selectedRoomId, rooms, supabase, addFurniture]);

    // Delete room
    const handleDeleteRoom = useCallback(async () => {
        if (!selectedRoomId) return;
        if (!confirm('Sei sicuro di voler eliminare questa stanza?')) return;

        await supabase.from('rooms').delete().eq('id', selectedRoomId);
        removeRoom(selectedRoomId);
    }, [selectedRoomId, supabase, removeRoom]);

    // Delete furniture
    const handleDeleteFurniture = useCallback(async (furnitureId: string) => {
        await supabase.from('furniture').delete().eq('id', furnitureId);
        removeFurniture(furnitureId);
    }, [supabase, removeFurniture]);

    // Save room properties
    const handleSaveProperties = useCallback(async () => {
        if (!selectedRoomId) return;
        setSaving(true);

        const updates: any = {
            name: editName,
            type: editType,
            settings: { capacity: editCapacity },
        };

        // These columns may exist if migration was run
        try {
            updates.department = editDepartment || null;
            updates.color = editColor;
        } catch (e) {
            // columns may not exist yet
        }

        const { error } = await supabase
            .from('rooms')
            .update(updates)
            .eq('id', selectedRoomId);

        if (!error) {
            // Update local store
            const { rooms: currentRooms, setRooms } = useOfficeStore.getState();
            setRooms(currentRooms.map(r =>
                r.id === selectedRoomId
                    ? { ...r, ...updates }
                    : r
            ));
        }

        setSaving(false);
    }, [selectedRoomId, editName, editType, editDepartment, editColor, editCapacity, supabase]);

    if (!isBuilderMode) return null;

    const roomFurniture = furnitureItems.filter(f => f.room_id === selectedRoomId);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ x: -320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -320, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute left-4 top-4 bottom-4 w-80 z-50 flex flex-col gap-0 overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
                style={{ backdropFilter: 'blur(20px)', background: 'rgba(15,23,42,0.92)' }}
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
                        <AnimatePresence>
                            {expandedSection === 'rooms' && (
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-2 grid grid-cols-2 gap-2">
                                        {roomTemplates.map((template, i) => (
                                            <button
                                                key={i}
                                                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary-500/30 transition-all group"
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
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Furniture Section */}
                    <div className="rounded-xl border border-white/5 overflow-hidden">
                        <button
                            className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-colors text-left"
                            onClick={() => setExpandedSection(expandedSection === 'furniture' ? 'properties' : 'furniture')}
                        >
                            <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                                <Armchair className="w-4 h-4 text-emerald-400" />
                                Arredi & Decorazioni
                            </span>
                            {expandedSection === 'furniture'
                                ? <ChevronDown className="w-4 h-4 text-slate-400" />
                                : <ChevronRight className="w-4 h-4 text-slate-400" />
                            }
                        </button>
                        <AnimatePresence>
                            {expandedSection === 'furniture' && (
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-2">
                                        {!selectedRoomId && (
                                            <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mb-2">
                                                ⚠️ Seleziona una stanza per aggiungere arredi
                                            </p>
                                        )}
                                        <div className="grid grid-cols-2 gap-2">
                                            {FURNITURE_PRESETS.map((preset, i) => (
                                                <button
                                                    key={i}
                                                    disabled={!selectedRoomId}
                                                    className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-left"
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
                                                            className="text-slate-500 hover:text-red-400 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
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
                        <AnimatePresence>
                            {expandedSection === 'properties' && (
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-3">
                                        {!selectedRoom ? (
                                            <p className="text-xs text-slate-500 text-center py-4 bg-white/5 rounded-xl border border-dashed border-white/10">
                                                Clicca su una stanza per modificarla
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
                                                        {['#1e293b', '#1e3a8a', '#312e81', '#065f46', '#7c2d12', '#0f766e', '#9333ea', '#b91c1c', '#c2410c', '#155e75'].map(c => (
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
                                </motion.div>
                            )}
                        </AnimatePresence>
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
                                    className={`w-full flex items-center gap-2 p-2.5 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${selectedRoomId === room.id ? 'bg-primary-500/10 border-l-2 border-l-primary-500' : ''}`}
                                    onClick={() => handleSelectRoom(room.id)}
                                >
                                    <div
                                        className="w-4 h-4 rounded shrink-0"
                                        style={{ backgroundColor: (room as any).color || '#1e293b' }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-200 truncate">{room.name}</p>
                                        <p className="text-[10px] text-slate-500">{room.type}{(room as any).department ? ` • ${(room as any).department}` : ''}</p>
                                    </div>
                                </button>
                            ))}
                            {rooms.length === 0 && (
                                <p className="text-xs text-slate-500 text-center py-4">
                                    Nessuna stanza. Usa i template sopra per aggiungerne una!
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
        </AnimatePresence>
    );
}

export default OfficeBuilder;
