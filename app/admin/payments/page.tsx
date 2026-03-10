'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Calendar, DollarSign, TrendingUp, AlertTriangle, CheckCircle2,
    Clock, Edit3, Check, X, Loader2, ChevronDown, ChevronRight,
    Building2, Filter, ArrowUpDown, RefreshCw, Users, CreditCard,
    ArrowUpCircle, ArrowDownCircle, BarChart3, Eye, EyeOff,
} from 'lucide-react';

// ============================================
// Full-Page Cashflow & Payment Schedule
// Super-detailed, like a real cashflow manager
// ============================================

const cs = '€';
const card = 'rounded-2xl border border-white/5 p-5';
const cardBg: React.CSSProperties = { background: 'rgba(15, 23, 42, 0.6)' };
const fmt = (cents: number) => `${cs}${(cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtCompact = (cents: number) => `${cs}${(cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const cycleConfig: Record<string, { label: string; labelShort: string; months: number; icon: string }> = {
    monthly: { label: 'Mensile', labelShort: 'Mens.', months: 1, icon: '📅' },
    quarterly: { label: 'Trimestrale', labelShort: 'Trim.', months: 3, icon: '📆' },
    semiannual: { label: 'Semestrale', labelShort: 'Sem.', months: 6, icon: '🗓️' },
    annual: { label: 'Annuale', labelShort: 'Ann.', months: 12, icon: '📋' },
};

interface ScheduleEntry {
    id: string;
    wsId: string;
    wsName: string;
    ownerName: string;
    ownerId: string;
    ownerEmail: string;
    seats: number;
    pricePerSeat: number;
    amount: number;
    cycle: string;
    cycleMonths: number;
    dueDate: string;
    month: string;
    status: 'paid' | 'pending' | 'overdue' | 'future';
    plan: string;
}

interface ClientSummary {
    ownerId: string;
    ownerName: string;
    ownerEmail: string;
    workspaces: {
        id: string;
        name: string;
        seats: number;
        pricePerSeat: number;
        monthlyAmount: number;
        cycle: string;
        plan: string;
        nextInvoice: string;
    }[];
    totalMonthly: number;
}

export default function CashflowPage() {
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
    const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
    const [editingEntry, setEditingEntry] = useState<string | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [filterOwner, setFilterOwner] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [viewMode, setViewMode] = useState<'timeline' | 'clients'>('timeline');
    const [saving, setSaving] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/workspaces?limit=200');
            const data = await res.json();
            setWorkspaces(data.workspaces || []);
            // Auto-expand current and next month
            const now = new Date();
            const cm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const next = new Date(now);
            next.setMonth(next.getMonth() + 1);
            const nm = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
            setExpandedMonths(new Set([cm, nm]));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    // ─── Build schedule from all active workspaces ────────────
    const schedule = useMemo<ScheduleEntry[]>(() => {
        const entries: ScheduleEntry[] = [];
        const now = new Date();

        workspaces.forEach((ws: any) => {
            if (ws.status !== 'active' || !ws.monthlyAmountCents || ws.monthlyAmountCents <= 0) return;

            const cycle = ws.billingCycle || 'monthly';
            const cfg = cycleConfig[cycle] || cycleConfig.monthly;
            const cycleMonths = cfg.months;

            // Generate entries for the next 12 months of payments
            // For monthly: 12 entries, quarterly: 4, semiannual: 2, annual: 1
            const totalEntries = Math.max(1, Math.ceil(12 / cycleMonths));
            const startDate = ws.nextInvoiceDate ? new Date(ws.nextInvoiceDate) : new Date();

            // If start date is in the past, backtrack to find last due date
            while (startDate > now) {
                const prev = new Date(startDate);
                prev.setMonth(prev.getMonth() - cycleMonths);
                if (prev < now) break;
                startDate.setTime(prev.getTime());
            }

            for (let i = 0; i < totalEntries + 2; i++) {
                const dueDate = new Date(startDate);
                dueDate.setMonth(dueDate.getMonth() + (i * cycleMonths));

                const dateStr = dueDate.toISOString().split('T')[0];
                const monthKey = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
                const isPast = dueDate < now;
                const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                let status: ScheduleEntry['status'] = 'future';
                if (isPast) {
                    status = 'overdue';
                } else if (daysUntil <= 15) {
                    status = 'pending';
                }

                // Amount = monthly * cycle months (billed per cycle)
                const periodAmount = ws.monthlyAmountCents * cycleMonths;

                entries.push({
                    id: `${ws.id}-${dateStr}`,
                    wsId: ws.id,
                    wsName: ws.name,
                    ownerName: ws.owner?.name || ws.owner?.email || 'N/A',
                    ownerId: ws.owner?.id || '',
                    ownerEmail: ws.owner?.email || '',
                    seats: ws.max_members || 0,
                    pricePerSeat: ws.price_per_seat || 0,
                    amount: periodAmount,
                    cycle,
                    cycleMonths,
                    dueDate: dateStr,
                    month: monthKey,
                    status,
                    plan: ws.plan || 'demo',
                });
            }
        });

        entries.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        return entries;
    }, [workspaces]);

    // ─── Client summaries ─────────────────────────────────────
    const clientSummaries = useMemo<ClientSummary[]>(() => {
        const map = new Map<string, ClientSummary>();

        workspaces.forEach((ws: any) => {
            if (ws.status !== 'active' || !ws.monthlyAmountCents || ws.monthlyAmountCents <= 0) return;
            const ownerId = ws.owner?.id || 'unknown';

            if (!map.has(ownerId)) {
                map.set(ownerId, {
                    ownerId,
                    ownerName: ws.owner?.name || ws.owner?.email || 'N/A',
                    ownerEmail: ws.owner?.email || '',
                    workspaces: [],
                    totalMonthly: 0,
                });
            }

            const client = map.get(ownerId)!;
            const cycle = ws.billingCycle || 'monthly';
            client.workspaces.push({
                id: ws.id,
                name: ws.name,
                seats: ws.max_members || 0,
                pricePerSeat: ws.price_per_seat || 0,
                monthlyAmount: ws.monthlyAmountCents,
                cycle,
                plan: ws.plan || 'demo',
                nextInvoice: ws.nextInvoiceDate || '',
            });
            client.totalMonthly += ws.monthlyAmountCents;
        });

        return Array.from(map.values()).sort((a, b) => b.totalMonthly - a.totalMonthly);
    }, [workspaces]);

    // ─── Filters ──────────────────────────────────────────────
    const filtered = useMemo(() => {
        return schedule.filter(e => {
            if (filterOwner !== 'all' && e.ownerId !== filterOwner) return false;
            if (filterStatus !== 'all' && e.status !== filterStatus) return false;
            return true;
        });
    }, [schedule, filterOwner, filterStatus]);

    // ─── Group by month ───────────────────────────────────────
    const monthGroups = useMemo(() => {
        const groups: Record<string, ScheduleEntry[]> = {};
        filtered.forEach(e => {
            if (!groups[e.month]) groups[e.month] = [];
            groups[e.month].push(e);
        });
        return groups;
    }, [filtered]);

    const months = Object.keys(monthGroups).sort();

    // ─── KPIs ─────────────────────────────────────────────────
    const totalOverdue = filtered.filter(e => e.status === 'overdue').reduce((s, e) => s + e.amount, 0);
    const totalPending = filtered.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
    const totalFuture = filtered.filter(e => e.status === 'future').reduce((s, e) => s + e.amount, 0);
    const totalAll = totalOverdue + totalPending + totalFuture;
    const monthlyRecurring = workspaces
        .filter((w: any) => w.status === 'active' && w.monthlyAmountCents > 0)
        .reduce((s: number, w: any) => s + (w.monthlyAmountCents || 0), 0);
    const activeClients = clientSummaries.length;
    const activeWorkspaces = workspaces.filter((w: any) => w.status === 'active' && w.monthlyAmountCents > 0).length;
    const totalActiveWorkspaces = workspaces.filter((w: any) => w.status === 'active').length;
    const totalUniqueOwners = new Set(workspaces.filter((w: any) => w.status === 'active').map((w: any) => w.owner?.id)).size;

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

    const toggleClient = (id: string) => {
        setExpandedClients(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const statusCfg: Record<string, { label: string; bg: string; text: string; icon: string; border: string }> = {
        paid: { label: 'Pagato', bg: 'bg-emerald-500/15', text: 'text-emerald-300', icon: '✅', border: 'border-emerald-500/20' },
        pending: { label: 'In Attesa', bg: 'bg-amber-500/15', text: 'text-amber-300', icon: '⏳', border: 'border-amber-500/20' },
        overdue: { label: 'In Ritardo', bg: 'bg-red-500/15', text: 'text-red-300', icon: '🔴', border: 'border-red-500/20' },
        future: { label: 'Futuro', bg: 'bg-blue-500/15', text: 'text-blue-300', icon: '📅', border: 'border-blue-500/20' },
    };

    const monthLabel = (m: string) => {
        const [y, mo] = m.split('-');
        const names = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
        return `${names[parseInt(mo) - 1]} ${y}`;
    };

    const monthLabelShort = (m: string) => {
        const [y, mo] = m.split('-');
        const names = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        return `${names[parseInt(mo) - 1]} '${y.slice(2)}`;
    };

    const handleUpdateAmount = async (entry: ScheduleEntry, newAmountCents: number) => {
        setSaving(true);
        try {
            // Calculate new monthly from the period amount
            const newMonthly = Math.round(newAmountCents / entry.cycleMonths);
            await fetch('/api/admin/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_seats',
                    workspaceId: entry.wsId,
                    data: { monthly_amount_cents: newMonthly },
                }),
            });
            setEditingEntry(null);
            loadData();
        } catch { }
        setSaving(false);
    };

    const handleMarkPaid = async (entry: ScheduleEntry) => {
        // TODO: integrate with actual payment tracking table
        alert(`Pagamento ${fmt(entry.amount)} per ${entry.wsName} (${entry.dueDate}) segnato come pagato.\n\nNota: questa funzione verrà integrata con il sistema di registrazione pagamenti.`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen" style={{ background: 'linear-gradient(135deg, #0a0f1c 0%, #0f172a 50%, #0a0f1c 100%)' }}>
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mx-auto" />
                    <p className="text-sm text-slate-400">Caricamento cashflow...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0a0f1c 0%, #0f172a 50%, #0a0f1c 100%)' }}>
            <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
                {/* ─── Header ─────────────────────────────────── */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                                <BarChart3 className="w-5 h-5 text-white" />
                            </div>
                            Cashflow & Piano Scadenze
                        </h1>
                        <p className="text-sm text-slate-400 mt-2 ml-[52px]">
                            Proiezioni dettagliate, pagamenti futuri, scadenze per mese e per cliente
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* View mode toggle */}
                        <div className="flex rounded-xl overflow-hidden border border-white/10">
                            <button onClick={() => setViewMode('timeline')}
                                className={`px-3 py-2 text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'timeline' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/[0.02] text-slate-500 hover:text-slate-300'}`}>
                                <Calendar className="w-3.5 h-3.5" /> Timeline
                            </button>
                            <button onClick={() => setViewMode('clients')}
                                className={`px-3 py-2 text-xs font-bold flex items-center gap-1.5 transition-all ${viewMode === 'clients' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/[0.02] text-slate-500 hover:text-slate-300'}`}>
                                <Users className="w-3.5 h-3.5" /> Per Cliente
                            </button>
                        </div>
                        <button onClick={loadData} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5" /> Aggiorna
                        </button>
                    </div>
                </div>

                {/* ─── KPI Cards ──────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    <div className={card + ' col-span-1'} style={cardBg}>
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-cyan-400" />
                            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">MRR</span>
                        </div>
                        <p className="text-xl font-black text-cyan-300">{fmt(monthlyRecurring)}</p>
                        <p className="text-[10px] text-slate-600 mt-1">Ricavo mensile ricorrente</p>
                    </div>
                    <div className={card + ' col-span-1'} style={cardBg}>
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-4 h-4 text-emerald-400" />
                            <span className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider">ARR</span>
                        </div>
                        <p className="text-xl font-black text-emerald-300">{fmt(monthlyRecurring * 12)}</p>
                        <p className="text-[10px] text-slate-600 mt-1">Ricavo annuale stimato</p>
                    </div>
                    {totalOverdue > 0 && (
                        <div className={card + ' col-span-1'} style={{ ...cardBg, borderColor: 'rgba(239,68,68,0.3)' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
                                <span className="text-[9px] text-red-400 uppercase font-bold tracking-wider">Scaduto</span>
                            </div>
                            <p className="text-xl font-black text-red-300">{fmt(totalOverdue)}</p>
                            <p className="text-[10px] text-red-400/60 mt-1">Da incassare urgente</p>
                        </div>
                    )}
                    <div className={card + ' col-span-1'} style={cardBg}>
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-amber-400" />
                            <span className="text-[9px] text-amber-500 uppercase font-bold tracking-wider">In Attesa</span>
                        </div>
                        <p className="text-xl font-black text-amber-300">{fmt(totalPending)}</p>
                        <p className="text-[10px] text-slate-600 mt-1">Prossimi 15 giorni</p>
                    </div>
                    <div className={card + ' col-span-1'} style={cardBg}>
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-purple-400" />
                            <span className="text-[9px] text-purple-400 uppercase font-bold tracking-wider">Clienti</span>
                        </div>
                        <p className="text-xl font-black text-purple-300">{totalUniqueOwners}</p>
                        <p className="text-[10px] text-slate-600 mt-1">{totalActiveWorkspaces} workspace attivi</p>
                    </div>
                    <div className={card + ' col-span-1'} style={cardBg}>
                        <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            <span className="text-[9px] text-blue-400 uppercase font-bold tracking-wider">Proiezione 12M</span>
                        </div>
                        <p className="text-xl font-black text-blue-300">{fmt(totalAll)}</p>
                        <p className="text-[10px] text-slate-600 mt-1">Incasso totale atteso</p>
                    </div>
                </div>

                {/* ─── Filters ───────────────────────────────── */}
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-slate-500" />
                        <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)}
                            className="px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs text-white outline-none cursor-pointer" style={{ background: '#0f172a' }}>
                            <option value="all">Tutti i clienti</option>
                            {uniqueOwners.map(([id, name]) => (
                                <option key={id} value={id}>{name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                            className="px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-xs text-white outline-none cursor-pointer" style={{ background: '#0f172a' }}>
                            <option value="all">Tutti gli stati</option>
                            <option value="overdue">🔴 In Ritardo</option>
                            <option value="pending">⏳ In Attesa</option>
                            <option value="future">📅 Futuro</option>
                            <option value="paid">✅ Pagato</option>
                        </select>
                    </div>
                    <span className="text-[10px] text-slate-500 ml-auto">
                        {filtered.length} scadenze • {months.length} mesi • {activeClients} clienti
                    </span>
                </div>

                {/* ─── TIMELINE VIEW ─────────────────────────── */}
                {viewMode === 'timeline' && (
                    <div className="space-y-4">
                        {months.length === 0 ? (
                            <div className={card} style={cardBg}>
                                <p className="text-sm text-slate-500 text-center py-12 italic">Nessun workspace con piano attivo trovato.</p>
                            </div>
                        ) : (
                            <>
                                {/* ─── Monthly pills ──────────────────── */}
                                <div className="overflow-x-auto -mx-6 lg:-mx-8 px-6 lg:px-8">
                                    <div className="flex gap-2 pb-2 min-w-max">
                                        {months.map(m => {
                                            const monthTotal = monthGroups[m].reduce((s, e) => s + e.amount, 0);
                                            const hasOverdue = monthGroups[m].some(e => e.status === 'overdue');
                                            const hasPending = monthGroups[m].some(e => e.status === 'pending');
                                            const isExpanded = expandedMonths.has(m);
                                            return (
                                                <button key={m} onClick={() => toggleMonth(m)}
                                                    className={`shrink-0 px-4 py-3 rounded-xl border text-center transition-all min-w-[130px] ${isExpanded
                                                        ? 'bg-cyan-500/10 border-cyan-500/30 ring-1 ring-cyan-500/20 shadow-lg shadow-cyan-500/5'
                                                        : hasOverdue ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                                                            : hasPending ? 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
                                                                : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                                                        }`}>
                                                    <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">{monthLabelShort(m)}</p>
                                                    <p className={`text-base font-black mt-0.5 ${hasOverdue ? 'text-red-300' : hasPending ? 'text-amber-300' : 'text-white'}`}>
                                                        {fmtCompact(monthTotal)}
                                                    </p>
                                                    <p className="text-[9px] text-slate-600">{monthGroups[m].length} scadenze</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* ─── Expanded months detail ─────────── */}
                                {months.filter(m => expandedMonths.has(m)).map(m => {
                                    const entries = monthGroups[m];
                                    const monthTotal = entries.reduce((s, e) => s + e.amount, 0);
                                    const mOverdue = entries.filter(e => e.status === 'overdue').reduce((s, e) => s + e.amount, 0);
                                    const mPending = entries.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
                                    const mFuture = entries.filter(e => e.status === 'future').reduce((s, e) => s + e.amount, 0);

                                    return (
                                        <div key={m} className={card} style={cardBg}>
                                            {/* Month header */}
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => toggleMonth(m)} className="text-slate-400 hover:text-white transition-colors">
                                                        <ChevronDown className="w-5 h-5" />
                                                    </button>
                                                    <div>
                                                        <h3 className="text-base font-bold text-white">{monthLabel(m)}</h3>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="text-[10px] text-slate-500">{entries.length} scadenze</span>
                                                            {mOverdue > 0 && <span className="text-[10px] text-red-400">🔴 {fmt(mOverdue)}</span>}
                                                            {mPending > 0 && <span className="text-[10px] text-amber-400">⏳ {fmt(mPending)}</span>}
                                                            {mFuture > 0 && <span className="text-[10px] text-blue-400">📅 {fmt(mFuture)}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] text-slate-500 uppercase font-bold">Totale Mese</p>
                                                    <p className="text-xl font-black text-white">{fmt(monthTotal)}</p>
                                                </div>
                                            </div>

                                            {/* Table header */}
                                            <div className="grid grid-cols-[100px_1fr_140px_100px_80px_120px_100px] gap-2 px-3 py-2 text-[9px] text-slate-500 uppercase font-bold tracking-wider border-b border-white/5">
                                                <span>Scadenza</span>
                                                <span>Workspace</span>
                                                <span>Cliente</span>
                                                <span>Piano</span>
                                                <span>Ciclo</span>
                                                <span className="text-right">Importo</span>
                                                <span className="text-right">Stato</span>
                                            </div>

                                            {/* Entries */}
                                            <div className="divide-y divide-white/[0.03]">
                                                {entries.map((entry, i) => {
                                                    const sc = statusCfg[entry.status];
                                                    const entryKey = `${entry.wsId}-${entry.dueDate}-${i}`;
                                                    const isEditing = editingEntry === entryKey;
                                                    const cc = cycleConfig[entry.cycle] || cycleConfig.monthly;

                                                    return (
                                                        <div key={entryKey} className="grid grid-cols-[100px_1fr_140px_100px_80px_120px_100px] gap-2 items-center py-3 px-3 hover:bg-white/[0.02] transition-colors rounded-lg group">
                                                            {/* Date */}
                                                            <span className="text-xs text-slate-400 font-mono">
                                                                {new Date(entry.dueDate).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                                                            </span>

                                                            {/* Workspace */}
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <Building2 className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                                                                <span className="text-sm text-white truncate font-medium">{entry.wsName}</span>
                                                                <span className="text-[9px] text-slate-600 shrink-0">({entry.seats} posti)</span>
                                                            </div>

                                                            {/* Client */}
                                                            <span className="text-xs text-slate-400 truncate" title={entry.ownerName}>{entry.ownerName}</span>

                                                            {/* Plan */}
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${entry.plan === 'premium'
                                                                ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-500/20'
                                                                : 'bg-white/5 text-slate-500'
                                                                }`}>
                                                                {entry.plan === 'premium' ? '⭐ Premium' : 'Demo'}
                                                            </span>

                                                            {/* Cycle */}
                                                            <span className="text-[10px] text-slate-500">
                                                                {cc.icon} {cc.labelShort}
                                                            </span>

                                                            {/* Amount */}
                                                            <div className="text-right">
                                                                {isEditing ? (
                                                                    <div className="flex items-center gap-1 justify-end">
                                                                        <span className="text-xs text-slate-500">{cs}</span>
                                                                        <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                                                                            className="w-20 px-2 py-1 rounded-lg bg-black/40 border border-cyan-500/30 text-xs text-white outline-none" autoFocus step="0.01" />
                                                                        <button onClick={() => handleUpdateAmount(entry, Math.round(parseFloat(editAmount) * 100))}
                                                                            disabled={saving}
                                                                            className="p-1 rounded text-emerald-400 hover:bg-emerald-500/20"><Check className="w-3 h-3" /></button>
                                                                        <button onClick={() => setEditingEntry(null)}
                                                                            className="p-1 rounded text-slate-400 hover:bg-white/10"><X className="w-3 h-3" /></button>
                                                                    </div>
                                                                ) : (
                                                                    <button onClick={() => { setEditingEntry(entryKey); setEditAmount((entry.amount / 100).toFixed(2)); }}
                                                                        className="text-sm font-bold text-white hover:text-cyan-300 transition-colors group/amt inline-flex items-center gap-1"
                                                                        title="Clicca per modificare">
                                                                        {fmt(entry.amount)}
                                                                        <Edit3 className="w-3 h-3 opacity-0 group-hover/amt:opacity-100 text-cyan-400 transition-opacity" />
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {/* Status + Actions */}
                                                            <div className="flex items-center gap-1.5 justify-end">
                                                                <span className={`text-[9px] px-2 py-1 rounded-lg font-bold whitespace-nowrap ${sc.bg} ${sc.text}`}>
                                                                    {sc.icon} {sc.label}
                                                                </span>
                                                                {(entry.status === 'pending' || entry.status === 'overdue') && (
                                                                    <button onClick={() => handleMarkPaid(entry)}
                                                                        disabled={saving}
                                                                        className="p-1 rounded-lg text-emerald-400/50 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all opacity-0 group-hover:opacity-100"
                                                                        title="Segna come pagato">
                                                                        <CheckCircle2 className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Month footer summary */}
                                            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                                                <div className="flex gap-4 text-[10px]">
                                                    {(() => {
                                                        // Group by client in this month
                                                        const clientTotals = new Map<string, number>();
                                                        entries.forEach(e => {
                                                            clientTotals.set(e.ownerName, (clientTotals.get(e.ownerName) || 0) + e.amount);
                                                        });
                                                        return Array.from(clientTotals.entries()).map(([name, total]) => (
                                                            <span key={name} className="text-slate-500">
                                                                {name}: <strong className="text-slate-300">{fmt(total)}</strong>
                                                            </span>
                                                        ));
                                                    })()}
                                                </div>
                                                <span className="text-sm font-black text-white">Totale: {fmt(monthTotal)}</span>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* ─── Cumulative Projection ─────────── */}
                                <div className={card} style={cardBg}>
                                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-400" /> Proiezione Incasso Cumulativo
                                    </h3>
                                    <div className="space-y-2">
                                        {(() => {
                                            let cumulative = 0;
                                            return months.map(m => {
                                                const monthTotal = monthGroups[m].reduce((s, e) => s + e.amount, 0);
                                                cumulative += monthTotal;
                                                const barPct = totalAll > 0 ? (cumulative / totalAll) * 100 : 0;
                                                return (
                                                    <div key={m} className="flex items-center gap-3">
                                                        <span className="text-[10px] text-slate-500 w-20 shrink-0 font-medium">{monthLabelShort(m)}</span>
                                                        <span className="text-xs text-slate-400 w-20 shrink-0 text-right">{fmt(monthTotal)}</span>
                                                        <div className="flex-1 h-6 bg-black/30 rounded-full overflow-hidden relative">
                                                            <div className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-cyan-500 to-emerald-500"
                                                                style={{ width: `${barPct}%` }} />
                                                        </div>
                                                        <span className="text-xs text-emerald-300 font-bold w-24 text-right">{fmt(cumulative)}</span>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
                                        <span className="text-xs text-slate-400">Totale proiezione {months.length} mesi</span>
                                        <span className="text-xl font-black text-emerald-300">{fmt(totalAll)}</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ─── CLIENTS VIEW ──────────────────────────── */}
                {viewMode === 'clients' && (
                    <div className="space-y-4">
                        {clientSummaries.length === 0 ? (
                            <div className={card} style={cardBg}>
                                <p className="text-sm text-slate-500 text-center py-12 italic">Nessun cliente con piano attivo.</p>
                            </div>
                        ) : (
                            clientSummaries.map(client => {
                                const isExpanded = expandedClients.has(client.ownerId);
                                const clientEntries = schedule.filter(e => e.ownerId === client.ownerId);
                                const clientMonthGroups: Record<string, ScheduleEntry[]> = {};
                                clientEntries.forEach(e => {
                                    if (!clientMonthGroups[e.month]) clientMonthGroups[e.month] = [];
                                    clientMonthGroups[e.month].push(e);
                                });
                                const clientMonths = Object.keys(clientMonthGroups).sort();

                                return (
                                    <div key={client.ownerId} className={card + ' overflow-hidden'} style={cardBg}>
                                        {/* Client header */}
                                        <button onClick={() => toggleClient(client.ownerId)} className="w-full flex items-center justify-between py-1 group">
                                            <div className="flex items-center gap-3">
                                                {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
                                                    {client.ownerName.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="text-left">
                                                    <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">{client.ownerName}</h3>
                                                    <p className="text-[10px] text-slate-500">{client.ownerEmail} • {client.workspaces.length} workspace</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-black text-white">{fmt(client.totalMonthly)}<span className="text-xs text-slate-500 font-normal">/mese</span></p>
                                                <p className="text-[10px] text-slate-500">{fmt(client.totalMonthly * 12)}/anno</p>
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="mt-4 space-y-4 pt-4 border-t border-white/5">
                                                {/* Workspace cards */}
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                                    {client.workspaces.map(ws => {
                                                        const cc = cycleConfig[ws.cycle] || cycleConfig.monthly;
                                                        return (
                                                            <div key={ws.id} className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <Building2 className="w-4 h-4 text-cyan-400" />
                                                                        <h4 className="text-sm font-bold text-white">{ws.name}</h4>
                                                                    </div>
                                                                    <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold ${ws.plan === 'premium'
                                                                        ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-slate-500'}`}>
                                                                        {ws.plan === 'premium' ? '⭐ Premium' : 'Demo'}
                                                                    </span>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-2 text-[10px]">
                                                                    <div>
                                                                        <span className="text-slate-500">Posti</span>
                                                                        <p className="text-white font-bold">{ws.seats}</p>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-slate-500">{cs}/utente/mese</span>
                                                                        <p className="text-white font-bold">{ws.pricePerSeat ? fmt(ws.pricePerSeat) : '—'}</p>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-slate-500">Ciclo</span>
                                                                        <p className="text-white font-bold">{cc.icon} {cc.label}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                                                    <span className="text-[10px] text-slate-500">Totale {cc.label.toLowerCase()}</span>
                                                                    <span className="text-sm font-bold text-emerald-300">{fmt(ws.monthlyAmount * cc.months)}</span>
                                                                </div>
                                                                {ws.nextInvoice && (
                                                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                                                        <Calendar className="w-3 h-3" />
                                                                        Prossima scadenza: <strong className="text-slate-300">{new Date(ws.nextInvoice).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Client payment timeline */}
                                                <div>
                                                    <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                                                        <CreditCard className="w-3.5 h-3.5 text-cyan-400" /> Piano Pagamenti Dettagliato
                                                    </h4>
                                                    <div className="space-y-1">
                                                        {clientMonths.map(m => {
                                                            const mEntries = clientMonthGroups[m];
                                                            const mTotal = mEntries.reduce((s, e) => s + e.amount, 0);
                                                            return (
                                                                <div key={m} className="rounded-lg bg-black/20 overflow-hidden">
                                                                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.03]">
                                                                        <span className="text-xs text-slate-400 font-medium">{monthLabel(m)}</span>
                                                                        <span className="text-xs font-bold text-white">{fmt(mTotal)}</span>
                                                                    </div>
                                                                    {mEntries.map((entry, i) => {
                                                                        const sc = statusCfg[entry.status];
                                                                        const cc = cycleConfig[entry.cycle] || cycleConfig.monthly;
                                                                        return (
                                                                            <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-white/[0.02] transition-colors">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-[10px] text-slate-500 font-mono w-16">
                                                                                        {new Date(entry.dueDate).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                                                                                    </span>
                                                                                    <Building2 className="w-3 h-3 text-cyan-500" />
                                                                                    <span className="text-xs text-white">{entry.wsName}</span>
                                                                                    <span className="text-[9px] text-slate-600">{cc.labelShort}</span>
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-sm font-bold text-white">{fmt(entry.amount)}</span>
                                                                                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${sc.bg} ${sc.text}`}>{sc.icon} {sc.label}</span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Client cumulative */}
                                                <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                                                    <span className="text-xs text-slate-400">Totale proiezione • {clientEntries.length} scadenze • {clientMonths.length} mesi</span>
                                                    <span className="text-lg font-black text-emerald-300">{fmt(clientEntries.reduce((s, e) => s + e.amount, 0))}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
