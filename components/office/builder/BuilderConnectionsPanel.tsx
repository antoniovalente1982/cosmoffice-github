'use client';

import React from 'react';
import { Link2, Unlink } from 'lucide-react';

interface Room {
    id: string;
    name: string;
    [key: string]: any;
}

interface RoomConnection {
    id: string;
    room_a_id: string;
    room_b_id: string;
    color?: string;
    label?: string;
    [key: string]: any;
}

interface BuilderConnectionsPanelProps {
    rooms: Room[];
    roomConnections: RoomConnection[];
    connectFromId: string;
    setConnectFromId: (id: string) => void;
    connectToId: string;
    setConnectToId: (id: string) => void;
    connectColor: string;
    setConnectColor: (color: string) => void;
    connectLabel: string;
    setConnectLabel: (label: string) => void;
    onCreateConnection: () => void;
    onDeleteConnection: (connId: string) => void;
}

const CONNECTION_COLORS = ['#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

export function BuilderConnectionsPanel({
    rooms,
    roomConnections,
    connectFromId,
    setConnectFromId,
    connectToId,
    setConnectToId,
    connectColor,
    setConnectColor,
    connectLabel,
    setConnectLabel,
    onCreateConnection,
    onDeleteConnection,
}: BuilderConnectionsPanelProps) {
    return (
        <div className="w-full space-y-3 mt-4 mb-2">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
            <div className="flex items-center gap-2 mb-1">
                <Link2 className="w-3.5 h-3.5 text-indigo-400" />
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Rami</p>
                <span className="text-[10px] text-slate-500 font-medium ml-auto">{roomConnections.length}</span>
            </div>

            {/* Quick-create connection */}
            {rooms.length >= 2 && (
                <div className="space-y-2.5 p-3 rounded-xl bg-indigo-500/[0.06] border border-indigo-500/20">
                    {/* From → To dropdowns */}
                    <div className="flex gap-2 items-center">
                        <select
                            value={connectFromId}
                            onChange={e => setConnectFromId(e.target.value)}
                            className="flex-1 px-2.5 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-[11px] font-medium focus:outline-none focus:border-indigo-500/50 transition-colors"
                        >
                            <option value="" className="bg-slate-900">Da...</option>
                            {rooms.map(r => (
                                <option key={r.id} value={r.id} className="bg-slate-900">{r.name}</option>
                            ))}
                        </select>
                        <span className="text-indigo-400 text-xs font-bold">→</span>
                        <select
                            value={connectToId}
                            onChange={e => setConnectToId(e.target.value)}
                            className="flex-1 px-2.5 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-[11px] font-medium focus:outline-none focus:border-indigo-500/50 transition-colors"
                        >
                            <option value="" className="bg-slate-900">A...</option>
                            {rooms.filter(r => r.id !== connectFromId).map(r => (
                                <option key={r.id} value={r.id} className="bg-slate-900">{r.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Color picker */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mr-1">Colore</span>
                        {CONNECTION_COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => setConnectColor(c)}
                                className={`w-5 h-5 rounded-full transition-all ${connectColor === c ? 'ring-2 ring-white/60 scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>

                    {/* Label + Create */}
                    <div className="flex gap-2">
                        <input
                            value={connectLabel}
                            onChange={e => setConnectLabel(e.target.value)}
                            placeholder="Etichetta (opz.)"
                            className="flex-1 px-2.5 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-[11px] placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                        />
                        <button
                            onClick={onCreateConnection}
                            disabled={!connectFromId || !connectToId}
                            className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-[11px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(99,102,241,0.3)] hover:shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                        >
                            Collega
                        </button>
                    </div>
                </div>
            )}

            {/* Active connections list */}
            {roomConnections.map((conn) => {
                const roomA = rooms.find(r => r.id === conn.room_a_id);
                const roomB = rooms.find(r => r.id === conn.room_b_id);
                return (
                    <div key={conn.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-800/40 border border-white/5 hover:border-indigo-500/20 transition-all">
                        <div className="w-3 h-3 rounded-full flex-shrink-0 shadow-[0_0_6px_rgba(255,255,255,0.15)]" style={{ backgroundColor: conn.color || '#6366f1' }} />
                        <span className="text-[11px] text-slate-200 flex-1 truncate font-medium">
                            {roomA?.name || '?'} → {roomB?.name || '?'}
                        </span>
                        {conn.label && <span className="text-[9px] text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded">{conn.label}</span>}
                        <button onClick={() => onDeleteConnection(conn.id)} className="p-1 rounded-lg hover:bg-red-500/20 text-slate-600 hover:text-red-400 transition-colors">
                            <Unlink className="w-3.5 h-3.5" />
                        </button>
                    </div>
                );
            })}
            {roomConnections.length === 0 && rooms.length >= 2 && (
                <p className="text-[11px] text-slate-500 text-center py-2 italic">Nessun ramo. Collega le stanze!</p>
            )}
        </div>
    );
}
