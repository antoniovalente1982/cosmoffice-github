'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Bug, Send, Loader2, CheckCircle,
    AlertTriangle, Monitor, Zap, Layout, MessageSquare,
} from 'lucide-react';
import { useT } from '../../lib/i18n';

interface BugReportFormProps {
    workspaceId: string | null;
    isOpen: boolean;
    onClose: () => void;
    embedded?: boolean;
}

export default function BugReportForm({ workspaceId, isOpen, onClose, embedded = false }: BugReportFormProps) {
    const { t } = useT();
    const [category, setCategory] = useState('general');
    const [severity, setSeverity] = useState('medium');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const CATEGORIES = [
        { value: 'general', label: t('bugReport.catGeneral'), icon: Bug, color: 'text-cyan-400' },
        { value: 'ui', label: t('bugReport.catUI'), icon: Layout, color: 'text-purple-400' },
        { value: 'audio_video', label: t('bugReport.catAV'), icon: Monitor, color: 'text-amber-400' },
        { value: 'performance', label: t('bugReport.catPerf'), icon: Zap, color: 'text-emerald-400' },
        { value: 'chat', label: t('bugReport.catChat'), icon: MessageSquare, color: 'text-blue-400' },
    ];

    const SEVERITIES = [
        { value: 'low', label: t('bugReport.sevLow'), color: 'text-slate-400 bg-slate-500/15 border-slate-500/20' },
        { value: 'medium', label: t('bugReport.sevMedium'), color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/20' },
        { value: 'high', label: t('bugReport.sevHigh'), color: 'text-amber-400 bg-amber-500/15 border-amber-500/20' },
        { value: 'critical', label: t('bugReport.sevCritical'), color: 'text-red-400 bg-red-500/15 border-red-500/20' },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) return;

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/bug-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspace_id: workspaceId,
                    title: title.trim(),
                    description: description.trim(),
                    severity,
                    category,
                }),
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => {
                    setSuccess(false);
                    setTitle('');
                    setDescription('');
                    setCategory('general');
                    setSeverity('medium');
                    onClose();
                }, 2000);
            } else {
                const data = await res.json();
                setError(data.error || t('bugReport.sendError'));
            }
        } catch {
            setError(t('bugReport.networkError'));
        }
        setLoading(false);
    };

    if (!isOpen) return null;

    const formContent = (
        <>
            {success ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15, stiffness: 200 }}>
                        <CheckCircle className="w-16 h-16 text-emerald-400 mb-4" />
                    </motion.div>
                    <p className="text-lg font-bold text-white">{t('bugReport.sent')}</p>
                    <p className="text-sm text-slate-500 mt-1">{t('bugReport.sentDesc')}</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
                    <div className="p-6 space-y-4 flex-1">
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t('bugReport.category')}</label>
                            <div className="grid grid-cols-2 gap-2">
                                {CATEGORIES.map((cat) => {
                                    const Icon = cat.icon;
                                    const isSelected = category === cat.value;
                                    return (
                                        <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border ${isSelected
                                                ? 'bg-white/10 text-white border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.05)]'
                                                : 'text-slate-500 border-white/5 hover:bg-white/5 hover:text-slate-300'}`}>
                                            <Icon className={`w-3.5 h-3.5 ${isSelected ? cat.color : ''}`} />
                                            {cat.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t('bugReport.severity')}</label>
                            <div className="flex gap-2">
                                {SEVERITIES.map((s) => (
                                    <button key={s.value} type="button" onClick={() => setSeverity(s.value)}
                                        className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${severity === s.value ? s.color : 'text-slate-600 border-white/5 hover:bg-white/5'}`}>
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t('bugReport.titleLabel')}</label>
                            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('bugReport.titlePlaceholder')} required
                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-red-500/30 transition-colors" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">{t('bugReport.description')}</label>
                            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('bugReport.descPlaceholder')} required rows={4}
                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-red-500/30 transition-colors resize-none" />
                        </div>
                        {error && (
                            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                                <p className="text-xs text-red-300">{error}</p>
                            </div>
                        )}
                    </div>
                    <div className="px-6 py-4 border-t border-white/5 shrink-0">
                        <button type="submit" disabled={loading || !title.trim() || !description.trim()}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-400 hover:to-amber-400 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" />{t('bugReport.submit')}</>}
                        </button>
                    </div>
                </form>
            )}
        </>
    );

    if (embedded) {
        return <div className="flex flex-col h-full overflow-hidden">{formContent}</div>;
    }

    return (
        <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ duration: 0.2, ease: 'easeOut' }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-lg max-h-[90vh] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col bg-[#0c1222]">
                    <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-amber-500/20 flex items-center justify-center">
                                <Bug className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">{t('bugReport.title')}</h2>
                                <p className="text-xs text-slate-500">{t('bugReport.subtitle')}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    {formContent}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
