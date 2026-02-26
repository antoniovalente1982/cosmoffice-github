'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useOfficeStore } from '../../stores/useOfficeStore';
import { createClient } from '../../utils/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, X, Box, Users, Save, Palette, PenTool, Focus, PaintBucket
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
        isBuilderMode, rooms, selectedRoomId, roomTemplates,
        activeSpaceId, stagePos, zoom, addRoom, setSelectedRoom, removeRoom,
        setRooms, toggleBuilderMode,
    } = useOfficeStore();

    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

    // Edit state for right panel
    const [editName, setEditName] = useState('');
    const [editDepartment, setEditDepartment] = useState('');
    const [editColor, setEditColor] = useState('#3b82f6');

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

    function loadRoomProperties(roomId: string) {
        const room = useOfficeStore.getState().rooms.find(r => r.id === roomId);
        if (room) {
            setEditName(room.name || '');
            setEditDepartment(getRoomDepartment(room) || '');
            setEditColor(getRoomColor(room));
        }
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
        const optimisticRoom: any = {
            id: tId, space_id: activeSpaceId, name: template.name, type: template.type,
            x: center.x - template.width / 2, y: center.y - template.height / 2,
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
        };

        const { data, error } = await supabase.from('rooms').insert(dbPayload).select().single();
        if (error) {
            console.error('Room insert error:', error);
            setToast({ msg: `❌ Errore DB: ${error.message}`, type: 'err' });
        } else if (data) {
            const currentRooms = useOfficeStore.getState().rooms;
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

        // Ensure we delete dependent records first in case ON DELETE CASCADE is missing
        await supabase.from('room_connections').delete().or(`room_a_id.eq.${selectedRoomId},room_b_id.eq.${selectedRoomId}`);

        const { error } = await supabase.from('rooms').delete().eq('id', selectedRoomId);
        if (error) {
            console.error("Error deleting room from DB:", error);
            setToast({ msg: `❌ Errore DB: ${error.message}`, type: 'err' });
            // Ideally we'd rollback here, but for now at least we show the error
        }
    }, [selectedRoomId, supabase, removeRoom, setSelectedRoom]);

    const handleSaveProperties = useCallback(async () => {
        if (!selectedRoomId) return;
        setSaving(true);
        const newSettings = {
            color: editColor,
            department: editDepartment || null,
        };
        const currentRooms = useOfficeStore.getState().rooms;
        setRooms(currentRooms.map(r => r.id === selectedRoomId
            ? { ...r, name: editName, settings: { ...r.settings, ...newSettings }, color: editColor, department: editDepartment || null }
            : r
        ));

        const dbUpdates: any = { name: editName, settings: newSettings };
        const { error } = await supabase.from('rooms').update(dbUpdates).eq('id', selectedRoomId);
        if (error) { setToast({ msg: `❌ ${error.message}`, type: 'err' }); }
        else { setToast({ msg: '✅ Proprietà salvate!', type: 'ok' }); }
        setSaving(false);
    }, [selectedRoomId, editName, editDepartment, editColor, supabase, setRooms]);

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
                        className="pointer-events-auto absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border"
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

            {/* RIGHT CONTEXTUAL PANEL - ROOM PROPERTIES & ADD TEMPLATES */}
            <AnimatePresence>
                <motion.div
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: -24, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    className="pointer-events-auto absolute top-24 right-0 w-80 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh]"
                    style={{
                        background: 'rgba(10, 15, 30, 0.75)',
                        backdropFilter: 'blur(40px)',
                        WebkitBackdropFilter: 'blur(40px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRight: 'none'
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

                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5"><Users className="w-3 h-3" /> Capacità Massima</div>
                                            {/* Dynamic Calculation matching ModernRoom */}
                                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-bold">
                                                {Math.max(1, Math.floor((selectedRoom.width * selectedRoom.height) / (128 * 128)))}
                                            </span>
                                        </label>
                                        <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                            La capienza viene calcolata automaticamente in base alle dimensioni della stanza per garantire lo spazio vitale necessario ad ogni utente.
                                        </p>
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
                            {/* Glass Header for Room Templates */}
                            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between"
                                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)' }}>
                                <div className="flex items-center gap-2">
                                    <Plus className="w-4 h-4 text-cyan-400" />
                                    <h3 className="text-sm font-bold text-white tracking-wide">Aggiungi Stanza</h3>
                                </div>
                            </div>

                            {/* Templates Catalog */}
                            <div className="p-4 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                                <p className="text-xs text-slate-400 mb-2 leading-relaxed">
                                    Scegli uno dei modelli preimpostati per aggiungerlo rapidamente al centro della mappa. Cliccaci poi sopra per modificarne dimensioni e colori.
                                </p>
                                {roomTemplates.map((template, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleAddRoom(template)}
                                        className="w-full flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all transform hover:scale-[1.02] text-left group"
                                    >
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-lg border border-white/10" style={{ backgroundColor: template.color }}>
                                            {template.icon}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{template.name}</h4>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                {template.width}x{template.height}px
                                            </p>
                                        </div>
                                        <Plus className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </motion.div>
            </AnimatePresence>

        </div>
    );
}

export default OfficeBuilder;
