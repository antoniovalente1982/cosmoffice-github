'use client';

import React from 'react';
import {
    ArrowLeft, PenTool, Focus, PaintBucket, Box,
    Square, Circle as CircleIcon, GitBranch, Trash2, Save,
} from 'lucide-react';

const COLOR_PRESETS = [
    '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#f97316', '#14b8a6', '#6366f1',
];

interface BuilderRoomPropertiesProps {
    editName: string;
    setEditName: (name: string) => void;
    editDepartment: string;
    setEditDepartment: (dept: string) => void;
    editColor: string;
    setEditColor: (color: string) => void;
    editShape: 'rect' | 'circle';
    setEditShape: (shape: 'rect' | 'circle') => void;
    editLevel: number;
    setEditLevel: (level: number) => void;
    saving: boolean;
    onBack: () => void;
    onDelete: () => void;
    onSave: () => void;
    onAutoArrange: () => void;
}

export function BuilderRoomProperties({
    editName, setEditName,
    editDepartment, setEditDepartment,
    editColor, setEditColor,
    editShape, setEditShape,
    editLevel, setEditLevel,
    saving, onBack, onDelete, onSave, onAutoArrange,
}: BuilderRoomPropertiesProps) {
    return (
        <>
            {/* Glass Header with Back button */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)' }}>
                <button
                    onClick={onBack}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center transition-colors flex-shrink-0"
                    title="Torna alla lista"
                >
                    <ArrowLeft className="w-3.5 h-3.5 text-slate-300" />
                </button>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: editColor }} />
                    <h3 className="text-sm font-bold text-white tracking-wide truncate">{editName || 'Proprietà'}</h3>
                </div>
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

                {/* Hierarchical Level */}
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

                {/* Auto-arrange */}
                <button
                    onClick={onAutoArrange}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 hover:from-amber-500/20 hover:to-yellow-500/20 hover:border-amber-500/50 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(245,158,11,0.15)] group disabled:opacity-40"
                >
                    <GitBranch className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-bold text-amber-50 tracking-wide">
                        {saving ? 'Organizzando...' : 'Auto-Organizza Organigramma'}
                    </span>
                </button>

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
                                    <div className={`absolute inset-0 rounded-full ${editColor === c ? 'scale-75' : 'scale-100 group-hover:scale-90'} shadow-inner transition-transform`} style={{ backgroundColor: c }} />
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
                    onClick={onDelete}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-red-200 bg-red-600/30 hover:bg-red-600/50 transition-colors border border-red-500/40 hover:border-red-500/60"
                >
                    <Trash2 className="w-3.5 h-3.5" /> Rimuovi
                </button>
                <button
                    onClick={onSave} disabled={saving}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-black bg-cyan-400 hover:bg-cyan-300 transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)] disabled:opacity-50"
                >
                    <Save className="w-3.5 h-3.5" /> {saving ? '...' : 'Applica'}
                </button>
            </div>
        </>
    );
}
