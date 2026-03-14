'use client';

import React from 'react';
import { ArrowLeft, Loader2, AlertTriangle, LayoutTemplate } from 'lucide-react';
import { OFFICE_TEMPLATES, OfficeTemplate } from '../../../lib/officeTemplates';

interface BuilderTemplatesPickerProps {
    applyingTemplate: boolean;
    confirmTemplate: OfficeTemplate | null;
    setConfirmTemplate: (t: OfficeTemplate | null) => void;
    onApplyTemplate: (t: OfficeTemplate) => void;
    onBack: () => void;
}

export function BuilderTemplatesPicker({
    applyingTemplate,
    confirmTemplate,
    setConfirmTemplate,
    onApplyTemplate,
    onBack,
}: BuilderTemplatesPickerProps) {
    return (
        <div className="w-full">
            {/* Confirmation dialog */}
            {confirmTemplate && (
                <div className="w-full mb-4 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-bold text-amber-300">Attenzione</span>
                    </div>
                    <p className="text-xs text-slate-300 mb-3">Tutte le stanze esistenti verranno sostituite con il template <strong className="text-white">&quot;{confirmTemplate.name}&quot;</strong>. Questa azione non è reversibile.</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setConfirmTemplate(null)}
                            className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-300 bg-white/5 hover:bg-white/10 transition-colors"
                        >Annulla</button>
                        <button
                            onClick={() => onApplyTemplate(confirmTemplate)}
                            disabled={applyingTemplate}
                            className="flex-1 py-2 rounded-xl text-xs font-bold text-black bg-amber-400 hover:bg-amber-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                            {applyingTemplate ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            Conferma
                        </button>
                    </div>
                </div>
            )}

            <button
                onClick={onBack}
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
    );
}
