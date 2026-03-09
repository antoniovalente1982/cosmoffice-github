'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Calendar, DollarSign, TrendingUp, AlertTriangle, CheckCircle2,
    Clock, Edit3, Check, X, Loader2, ChevronDown, ChevronRight,
    Building2, Filter, ArrowUpDown,
} from 'lucide-react';

const card = 'rounded-2xl border border-white/5 p-5';
const cardBg: React.CSSProperties = { background: 'rgba(15, 23, 42, 0.6)' };
const fmt = (cents: number) => `€${(cents / 100).toFixed(2)}`;

interface ScheduleEntry {
    wsId: string;
    wsName: string;
    ownerName: string;
    ownerId: string;
    amount: number;
    cycle: string;
    dueDate: string;
    month: string;
    status: 'paid' | 'pending' | 'overdue' | 'future';
}

export default function CashflowPage() {
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
    const [editingEntry, setEditingEntry] = useState<string | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [filterOwner, setFilterOwner] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/workspaces?limit=200');
            const data = await res.json();
            setWorkspaces(data.workspaces || []);
            const now = new Date();
            const cm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            setExpandedMonths(new Set([cm]));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    // Build schedule from workspaces
    const schedule = useMemo<ScheduleEntry[]>(() => {
        const entries: ScheduleEntry[] = [];
        const now = new Date();

        workspaces.forEach((ws: any) => {
            if (ws.status !== 'active' || !ws.monthlyAmountCents || ws.monthlyAmountCents <= 0) return;

            const cycle = ws.billingCycle || 'monthly';
            const periods = cycle === 'annual' ? 2 : 12;
            const startDate = ws.nextInvoiceDate ? new Date(ws.nextInvoiceDate) : new Date();

            for (let i = 0; i < periods; i++) {
                const dueDate = new Date(startDate);
                if (cycle === 'annual') {
                    dueDate.setFullYear(dueDate.getFullYear() + i);
                } else {
                    dueDate.setMonth(dueDate.getMonth() + i);
                }

                const dateStr = dueDate.toISOString().split('T')[0];
                const monthKey = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
                const isPast = dueDate < now;

                let status: ScheduleEntry['status'] = 'future';
                if (isPast && ws.paymentStatus === 'paid' && i === 0) {
                    status = 'paid';
                } else if (isPast) {
                    status = 'overdue';
                } else {
                    const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    status = daysUntil <= 15 ? 'pending' : 'future';
                }

                entries.push({
                    wsId: ws.id,
                    wsName: ws.name,
                    ownerName: ws.owner?.name || ws.owner?.email || 'N/A',
                    ownerId: ws.owner?.id || '',
                    amount: cycle === 'annual' ? ws.monthlyAmountCents * 12 : ws.monthlyAmountCents,
                    cycle,
                    dueDate: dateStr,
                    month: monthKey,
                    status,
                });
            }
        });

        entries.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        return entries;
    }, [workspaces]);

    // Filters
    const filtered = useMemo(() => {
        return schedule.filter(e => {
            if (filterOwner !== 'all' && e.ownerId !== filterOwner) return false;
            if (filterStatus !== 'all' && e.status !== filterStatus) return false;
            return true;
        });
    }, [schedule, filterOwner, filterStatus]);

    // Group by month
    const monthGroups = useMemo(() => {
        const groups: Record<string, ScheduleEntry[]> = {};
        filtered.forEach(e => {
            if (!groups[e.month]) groups[e.month] = [];
            groups[e.month].push(e);
        });
        return groups;
    }, [filtered]);

    const months = Object.keys(monthGroups).sort();

    // KPI
    const totalOverdue = filtered.filter(e => e.status === 'overdue').reduce((s, e) => s + e.amount, 0);
    const totalPending = filtered.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
    const totalFuture = filtered.filter(e => e.status === 'future').reduce((s, e) => s + e.amount, 0);
    const totalAll = totalOverdue + totalPending + totalFuture;
    const monthlyRecurring = workspaces
        .filter((w: any) => w.status === 'active')
        .reduce((s: number, w: any) => s + (w.monthlyAmountCents || 0), 0);

    const uniqueOwners = useMemo(() => {
        const m = new Map<string, string>();
        schedule.forEach(e => m.set(e.ownerId, e.ownerName));
        return Array.from(m.entries());
    }, [schedule]);

    const toggleMonth = (m: string) => {
        setExpandedMonths(prev => {
            const next = new Set(prev);
            next.has(m) ? next.delete(m) : next.add(m);
            return next;
        });
    };

    const statusCfg: Record<string, { label: string; bg: string; text: string; icon: string }> = {
        paid: { label: 'Pagato', bg: 'bg-emerald-500/20', text: 'text-emerald-300', icon: '✅' },
        pending: { label: 'In Attesa', bg: 'bg-amber-500/20', text: 'text-amber-300', icon: '⏳' },
        overdue: { label: 'In Ritardo', bg: 'bg-red-500/20', text: 'text-red-300', icon: '🔴' },
        future: { label: 'Futuro', bg: 'bg-blue-500/20', text: 'text-blue-300', icon: '📅' },
    };

    const monthLabel = (m: string) => {
        const [y, mo] = m.split('-');
        const names = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
        return `${names[parseInt(mo) - 1]} ${y}`;
    };

    const handleUpdateAmount = async (entry: ScheduleEntry, newAmountCents: number) => {
        try {
            await fetch('/api/admin/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_seats',
                    workspaceId: entry.wsId,
                    data: { monthly_amount_cents: newAmountCents },
                }),
            });
            setEditingEntry(null);
            loadData();
        } catch { }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Calendar className="w-7 h-7 text-blue-400" /> Cashflow & Piano Scadenze
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Visione completa dei pagamenti futuri, scadenze e proiezioni di incasso
                    </p>
                </div>
                <button onClick={loadData} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                    🔄 Aggiorna
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className={card} style={cardBg}>
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-cyan-400" />
                        <span className="text-[10px] text-slate-500 uppercase font-bold">MRR</span>
                    </div>
                    <p className="text-xl font-bold text-cyan-300">{fmt(monthlyRecurring)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Ricavo mensile ricorrente</p>
                </div>
                {totalOverdue > 0 && (
                    <div className={card} style={{ ...cardBg, borderColor: 'rgba(239,68,68,0.3)' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            <span className="text-[10px] text-red-400 uppercase font-bold">In Ritardo</span>
                        </div>
                        <p className="text-xl font-bold text-red-300">{fmt(totalOverdue)}</p>
                        <p className="text-[10px] text-slate-500 mt-1">Pagamenti scaduti</p>
                    </div>
                )}
                <div className={card} style={cardBg}>
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span className="text-[10px] text-amber-400 uppercase font-bold">In Attesa</span>
                    </div>
                    <p className="text-xl font-bold text-amber-300">{fmt(totalPending)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Scadenze prossime 15gg</p>
                </div>
                <div className={card} style={cardBg}>
                    <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        <span className="text-[10px] text-blue-400 uppercase font-bold">Futuro</span>
                    </div>
                    <p className="text-xl font-bold text-blue-300">{fmt(totalFuture)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Incasso potenziale totale</p>
                </div>
                <div className={card} style={cardBg}>
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] text-emerald-400 uppercase font-bold">Totale Proiezione</span>
                    </div>
                    <p className="text-xl font-bold text-emerald-300">{fmt(totalAll)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Da incassare (tutto)</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs text-white outline-none" style={{ background: '#0f172a' }}>
                        <option value="all">Tutti i clienti</option>
                        {uniqueOwners.map(([id, name]) => (
                            <option key={id} value={id}>{name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs text-white outline-none" style={{ background: '#0f172a' }}>
                        <option value="all">Tutti gli stati</option>
                        <option value="overdue">🔴 In Ritardo</option>
                        <option value="pending">⏳ In Attesa</option>
                        <option value="future">📅 Futuro</option>
                        <option value="paid">✅ Pagato</option>
                    </select>
                </div>
                <span className="text-[10px] text-slate-500">
                    {filtered.length} scadenze • {months.length} mesi
                </span>
            </div>

            {/* Monthly Breakdown */}
            <div className="space-y-3">
                {months.length === 0 ? (
                    <div className={card} style={cardBg}>
                        <p className="text-sm text-slate-500 text-center py-8 italic">Nessun workspace con piano attivo trovato.</p>
                    </div>
                ) : (
                    <>
                        {/* Monthly pills scrollable */}
                        <div className="overflow-x-auto">
                            <div className="flex gap-2 pb-2 min-w-max">
                                {months.map(m => {
                                    const monthTotal = monthGroups[m].reduce((s, e) => s + e.amount, 0);
                                    const hasOverdue = monthGroups[m].some(e => e.status === 'overdue');
                                    const hasPending = monthGroups[m].some(e => e.status === 'pending');
                                    return (
                                        <button key={m} onClick={() => toggleMonth(m)}
                                            className={`shrink-0 px-3 py-2 rounded-xl border text-center transition-all min-w-[120px] ${expandedMonths.has(m)
                                                ? 'bg-cyan-500/10 border-cyan-500/30 ring-1 ring-cyan-500/20'
                                                : hasOverdue ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                                                    : hasPending ? 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
                                                        : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                                                }`}>
                                            <p className="text-[9px] text-slate-500 uppercase font-bold">{monthLabel(m)}</p>
                                            <p className={`text-sm font-bold mt-0.5 ${hasOverdue ? 'text-red-300' : hasPending ? 'text-amber-300' : 'text-white'}`}>
                                                {fmt(monthTotal)}
                                            </p>
                                            <p className="text-[9px] text-slate-600">{monthGroups[m].length} scadenze</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Expanded month detail cards */}
                        {months.filter(m => expandedMonths.has(m)).map(m => {
                            const entries = monthGroups[m];
                            const monthTotal = entries.reduce((s, e) => s + e.amount, 0);

                            return (
                                <div key={m} className={card} style={cardBg}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => toggleMonth(m)} className="text-slate-400 hover:text-white">
                                                <ChevronDown className="w-4 h-4" />
                                            </button>
                                            <h3 className="text-sm font-bold text-white">{monthLabel(m)}</h3>
                                            <span className="text-[10px] text-slate-500">{entries.length} scadenze</span>
                                        </div>
                                        <span className="text-lg font-bold text-white">{fmt(monthTotal)}</span>
                                    </div>

                                    <div className="space-y-1">
                                        {entries.map((entry, i) => {
                                            const sc = statusCfg[entry.status];
                                            const entryKey = `${entry.wsId}-${entry.dueDate}-${i}`;
                                            const isEditing = editingEntry === entryKey;

                                            return (
                                                <div key={entryKey} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-black/20 hover:bg-black/30 transition-colors gap-3">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <span className="text-xs text-slate-500 font-mono w-24 shrink-0">
                                                            {new Date(entry.dueDate).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 w-28 truncate shrink-0" title={entry.ownerName}>
                                                            {entry.ownerName}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <Building2 className="w-3 h-3 text-cyan-500 shrink-0" />
                                                            <span className="text-xs text-white truncate">{entry.wsName}</span>
                                                        </div>
                                                        <span className="text-[9px] text-slate-600 px-1.5 py-0.5 rounded bg-white/5 shrink-0">
                                                            {entry.cycle === 'annual' ? 'Annuale' : 'Mensile'}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-3 shrink-0">
                                                        {isEditing ? (
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs text-slate-500">€</span>
                                                                <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                                                                    className="w-20 px-2 py-1 rounded-lg bg-black/40 border border-cyan-500/30 text-xs text-white outline-none" autoFocus step="0.01" />
                                                                <button onClick={() => handleUpdateAmount(entry, Math.round(parseFloat(editAmount) * 100))}
                                                                    className="p-1 rounded text-emerald-400 hover:bg-emerald-500/20"><Check className="w-3 h-3" /></button>
                                                                <button onClick={() => setEditingEntry(null)}
                                                                    className="p-1 rounded text-slate-400 hover:bg-white/10"><X className="w-3 h-3" /></button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => { setEditingEntry(entryKey); setEditAmount((entry.amount / 100).toFixed(2)); }}
                                                                className="flex items-center gap-1 text-sm font-bold text-white hover:text-cyan-300 transition-colors group"
                                                                title="Clicca per modificare importo">
                                                                {fmt(entry.amount)}
                                                                <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-cyan-400 transition-opacity" />
                                                            </button>
                                                        )}
                                                        <span className={`text-[9px] px-2 py-1 rounded-lg font-bold whitespace-nowrap ${sc.bg} ${sc.text}`}>
                                                            {sc.icon} {sc.label}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Month summary */}
                                    <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                                        <div className="flex gap-4">
                                            {(() => {
                                                const mOverdue = entries.filter(e => e.status === 'overdue').reduce((s, e) => s + e.amount, 0);
                                                const mPending = entries.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
                                                const mFuture = entries.filter(e => e.status === 'future').reduce((s, e) => s + e.amount, 0);
                                                return (
                                                    <>
                                                        {mOverdue > 0 && <span className="text-[10px] text-red-400">🔴 {fmt(mOverdue)} in ritardo</span>}
                                                        {mPending > 0 && <span className="text-[10px] text-amber-400">⏳ {fmt(mPending)} in attesa</span>}
                                                        {mFuture > 0 && <span className="text-[10px] text-blue-400">📅 {fmt(mFuture)} futuro</span>}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                        <span className="text-xs font-bold text-white">Totale: {fmt(monthTotal)}</span>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Cumulative revenue projection */}
                        <div className={card} style={cardBg}>
                            <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Proiezione Incasso Cumulativo
                            </h3>
                            <div className="space-y-1">
                                {(() => {
                                    let cumulative = 0;
                                    return months.map(m => {
                                        const monthTotal = monthGroups[m].reduce((s, e) => s + e.amount, 0);
                                        cumulative += monthTotal;
                                        const barPct = totalAll > 0 ? (cumulative / totalAll) * 100 : 0;
                                        return (
                                            <div key={m} className="flex items-center gap-3">
                                                <span className="text-[10px] text-slate-500 w-28 shrink-0">{monthLabel(m)}</span>
                                                <div className="flex-1 h-5 bg-black/30 rounded-full overflow-hidden relative">
                                                    <div className="h-full rounded-full transition-all bg-gradient-to-r from-cyan-500 to-emerald-500"
                                                        style={{ width: `${barPct}%` }} />
                                                    <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white/80 font-bold">
                                                        {fmt(monthTotal)}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-emerald-300 font-bold w-24 text-right">{fmt(cumulative)}</span>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                            <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center">
                                <span className="text-xs text-slate-400">Totale proiezione {months.length} mesi</span>
                                <span className="text-lg font-bold text-emerald-300">{fmt(totalAll)}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
