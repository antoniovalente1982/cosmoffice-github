'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '../../utils/supabase/client';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { generateSmartLayout, type WizardConfig } from '../../lib/officeGenerator';
import {
    Sparkles, Users, Building2, CalendarDays, Brain,
    ChevronRight, ChevronLeft, Loader2, Rocket, X
} from 'lucide-react';

const DEPARTMENT_OPTIONS = [
    { id: 'Marketing', label: 'Marketing', icon: '📊', color: '#a855f7' },
    { id: 'Sales', label: 'Sales', icon: '📞', color: '#ef4444' },
    { id: 'Dev', label: 'Sviluppo', icon: '💻', color: '#3b82f6' },
    { id: 'Design', label: 'Design', icon: '🎨', color: '#f97316' },
    { id: 'HR', label: 'HR', icon: '🤝', color: '#14b8a6' },
    { id: 'Finance', label: 'Finance', icon: '💰', color: '#10b981' },
    { id: 'Support', label: 'Support', icon: '🎧', color: '#06b6d4' },
    { id: 'Management', label: 'Management', icon: '👔', color: '#f59e0b' },
    { id: 'Coaching', label: 'Coaching', icon: '🎯', color: '#f59e0b' },
    { id: 'Operations', label: 'Operations', icon: '⚙️', color: '#6366f1' },
    { id: 'Content', label: 'Content', icon: '✍️', color: '#ec4899' },
    { id: 'Legal', label: 'Legal', icon: '⚖️', color: '#8b5cf6' },
];

interface AISetupWizardProps {
    spaceId: string;
    onComplete: () => void;
    onDismiss: () => void;
}

export function AISetupWizard({ spaceId, onComplete, onDismiss }: AISetupWizardProps) {
    const [step, setStep] = useState(0);
    const [teamSize, setTeamSize] = useState(10);
    const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
    const [meetingFreq, setMeetingFreq] = useState<'rarely' | 'weekly' | 'daily'>('weekly');
    const [workStyle, setWorkStyle] = useState<'focus' | 'collaborative' | 'mixed'>('mixed');
    const [generating, setGenerating] = useState(false);

    const supabase = createClient();
    const setRooms = useWorkspaceStore(s => s.setRooms);
    const setOfficeDimensions = useWorkspaceStore(s => s.setOfficeDimensions);

    const toggleDept = (id: string) => {
        setSelectedDepts(prev =>
            prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
        );
    };

    const handleGenerate = useCallback(async () => {
        setGenerating(true);

        const config: WizardConfig = {
            teamSize,
            departments: selectedDepts.length > 0 ? selectedDepts : ['Management'],
            meetingFrequency: meetingFreq,
            workStyle,
        };

        const layout = generateSmartLayout(config);

        try {
            // Update office dimensions
            setOfficeDimensions(layout.officeWidth, layout.officeHeight);
            await supabase.from('spaces').update({
                layout_data: {
                    officeWidth: layout.officeWidth,
                    officeHeight: layout.officeHeight,
                    bgOpacity: 0.8,
                    landingPadX: 200,
                    landingPadY: 200,
                    layoutMode: 'free',
                }
            }).eq('id', spaceId);

            // Create all rooms
            const createdRooms: any[] = [];
            for (const tRoom of layout.rooms) {
                const dbPayload = {
                    space_id: spaceId,
                    name: tRoom.name,
                    type: tRoom.type,
                    x: tRoom.x,
                    y: tRoom.y,
                    width: tRoom.width,
                    height: tRoom.height,
                    capacity: tRoom.capacity,
                    settings: {
                        capacity: tRoom.capacity,
                        color: tRoom.color,
                        department: tRoom.department || null,
                    },
                    shape: 'rect',
                };
                const { data, error } = await supabase.from('rooms').insert(dbPayload).select().single();
                if (!error && data) {
                    createdRooms.push({ ...data, color: tRoom.color, department: tRoom.department || null });
                }
            }

            setRooms(createdRooms);
            onComplete();
        } catch (err: any) {
            console.error('[AISetupWizard] Error:', err);
        } finally {
            setGenerating(false);
        }
    }, [teamSize, selectedDepts, meetingFreq, workStyle, spaceId, supabase, setRooms, setOfficeDimensions, onComplete]);

    const steps = [
        // Step 0: Team Size
        <div key="team" className="space-y-6">
            <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                    <Users className="w-7 h-7 text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Quante persone nel team?</h3>
                <p className="text-sm text-slate-400 mt-1">Dimensioneremo le stanze in base al numero</p>
            </div>
            <div className="space-y-4">
                <div className="text-center">
                    <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                        {teamSize}
                    </span>
                    <span className="text-sm text-slate-500 ml-2">persone</span>
                </div>
                <input
                    type="range" min="3" max="100" value={teamSize}
                    onChange={e => setTeamSize(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #06b6d4 ${teamSize}%, rgba(255,255,255,0.1) ${teamSize}%)`,
                    }}
                />
                <div className="flex justify-between text-[10px] text-slate-600 font-medium">
                    <span>3</span>
                    <span>25</span>
                    <span>50</span>
                    <span>75</span>
                    <span>100</span>
                </div>
            </div>
        </div>,

        // Step 1: Departments
        <div key="depts" className="space-y-6">
            <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                    <Building2 className="w-7 h-7 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Quali dipartimenti hai?</h3>
                <p className="text-sm text-slate-400 mt-1">Ogni dipartimento avrà la sua stanza dedicata</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {DEPARTMENT_OPTIONS.map(dept => {
                    const isSelected = selectedDepts.includes(dept.id);
                    return (
                        <button key={dept.id} onClick={() => toggleDept(dept.id)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                                isSelected
                                    ? 'border-white/20 bg-white/10 text-white shadow-lg'
                                    : 'border-white/5 bg-white/[0.02] text-slate-400 hover:bg-white/5 hover:text-white'
                            }`}
                            style={isSelected ? { borderColor: dept.color + '40', background: dept.color + '15' } : {}}
                        >
                            <span className="text-base">{dept.icon}</span>
                            {dept.label}
                        </button>
                    );
                })}
            </div>
            {selectedDepts.length === 0 && (
                <p className="text-[11px] text-amber-400/60 text-center">Seleziona almeno un dipartimento</p>
            )}
        </div>,

        // Step 2: Meeting Frequency
        <div key="meetings" className="space-y-6">
            <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                    <CalendarDays className="w-7 h-7 text-emerald-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Quanto spesso fate meeting?</h3>
                <p className="text-sm text-slate-400 mt-1">Più meeting = più sale riunioni</p>
            </div>
            <div className="space-y-2">
                {([
                    { id: 'rarely', label: 'Raramente', desc: 'Pochi meeting, lavoro autonomo', icon: '🧘' },
                    { id: 'weekly', label: 'Settimanale', desc: 'Meeting regolari ogni settimana', icon: '📅' },
                    { id: 'daily', label: 'Quotidiano', desc: 'Daily standup, sync frequenti', icon: '🔥' },
                ] as const).map(opt => (
                    <button key={opt.id} onClick={() => setMeetingFreq(opt.id)}
                        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all border ${
                            meetingFreq === opt.id
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-white'
                                : 'border-white/5 bg-white/[0.02] text-slate-400 hover:bg-white/5'
                        }`}
                    >
                        <span className="text-2xl">{opt.icon}</span>
                        <div>
                            <p className="text-sm font-bold">{opt.label}</p>
                            <p className="text-[11px] text-slate-500">{opt.desc}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>,

        // Step 3: Work Style
        <div key="style" className="space-y-6">
            <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                    <Brain className="w-7 h-7 text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Che stile di lavoro?</h3>
                <p className="text-sm text-slate-400 mt-1">Determinerà il bilanciamento tra focus zone e open space</p>
            </div>
            <div className="space-y-2">
                {([
                    { id: 'focus', label: 'Focus Individuale', desc: 'Tante zone silenziose, poche interruzioni', icon: '🎯' },
                    { id: 'collaborative', label: 'Collaborativo', desc: 'Open space grandi, lavoro di team', icon: '🤝' },
                    { id: 'mixed', label: 'Misto', desc: 'Equilibrio tra focus e collaborazione', icon: '⚡' },
                ] as const).map(opt => (
                    <button key={opt.id} onClick={() => setWorkStyle(opt.id)}
                        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all border ${
                            workStyle === opt.id
                                ? 'border-amber-500/30 bg-amber-500/10 text-white'
                                : 'border-white/5 bg-white/[0.02] text-slate-400 hover:bg-white/5'
                        }`}
                    >
                        <span className="text-2xl">{opt.icon}</span>
                        <div>
                            <p className="text-sm font-bold">{opt.label}</p>
                            <p className="text-[11px] text-slate-500">{opt.desc}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>,
    ];

    const canProceed = step === 1 ? selectedDepts.length > 0 : true;
    const isLastStep = step === steps.length - 1;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}>

            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="relative w-full max-w-lg mx-4 rounded-3xl overflow-hidden"
                style={{
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 0 80px rgba(99,102,241,0.15), 0 25px 60px rgba(0,0,0,0.5)',
                }}
            >
                {/* Glass header */}
                <div className="px-6 pt-5 pb-4 border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-white">AI Setup Wizard</h2>
                                <p className="text-[10px] text-slate-500">Crea il tuo ufficio perfetto in pochi click</p>
                            </div>
                        </div>
                        <button onClick={onDismiss} className="p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-all">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Progress dots */}
                    <div className="flex items-center gap-2 mt-4">
                        {steps.map((_, i) => (
                            <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                                style={{
                                    background: i <= step
                                        ? 'linear-gradient(to right, #6366f1, #a855f7)'
                                        : 'rgba(255,255,255,0.06)',
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Step content */}
                <div className="px-6 py-6 min-h-[320px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            {steps[step]}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer nav */}
                <div className="px-6 pb-5 pt-2 border-t border-white/5 flex items-center justify-between gap-3">
                    <button
                        onClick={() => setStep(s => s - 1)}
                        disabled={step === 0}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Indietro
                    </button>

                    {isLastStep ? (
                        <button
                            onClick={handleGenerate}
                            disabled={generating}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
                                boxShadow: '0 0 20px rgba(99,102,241,0.4), 0 4px 15px rgba(0,0,0,0.3)',
                            }}
                        >
                            {generating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Generazione...
                                </>
                            ) : (
                                <>
                                    <Rocket className="w-4 h-4" />
                                    Genera Ufficio
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={() => setStep(s => s + 1)}
                            disabled={!canProceed}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            Avanti
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
