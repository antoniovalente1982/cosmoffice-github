'use client';

import { useState, useEffect, useMemo } from 'react';
import { DollarSign, TrendingUp, Receipt, Filter, ArrowUp, ArrowDown, Loader2, Users, Calendar } from 'lucide-react';
import { createClient } from '../../../utils/supabase/client';

interface Payment {
    id: string;
    workspace_id: string | null;
    workspace_name: string;
    owner_email: string;
    owner_name: string | null;
    type: 'payment' | 'refund' | 'credit_note' | 'adjustment';
    amount_cents: number;
    currency: string;
    plan_at_time: string | null;
    description: string | null;
    payment_method: string;
    reference: string | null;
    invoice_number: string | null;
    payment_date: string;
    period_start: string | null;
    period_end: string | null;
    notes: string | null;
    created_at: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    payment: { label: 'Pagamento', color: 'text-emerald-400' },
    refund: { label: 'Rimborso', color: 'text-red-400' },
    credit_note: { label: 'Nota Credito', color: 'text-amber-400' },
    adjustment: { label: 'Rettifica', color: 'text-purple-400' },
};

export default function RevenuePage() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [mrrData, setMrrData] = useState({ mrr: 0, payingCount: 0 });

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        const supabase = createClient();

        // Load all payments
        const { data: pays } = await supabase.from('payments')
            .select('*').order('payment_date', { ascending: false }).limit(200);
        setPayments(pays || []);

        // MRR from active paid workspaces
        const { data: wsData } = await supabase.from('workspaces')
            .select('monthly_amount_cents, payment_status')
            .eq('payment_status', 'paid').is('deleted_at', null);
        const mrr = (wsData || []).reduce((s, w) => s + (w.monthly_amount_cents || 0), 0);
        setMrrData({ mrr, payingCount: (wsData || []).length });

        setLoading(false);
    };

    const filteredPayments = useMemo(() => {
        return payments.filter(p => {
            if (filterType && p.type !== filterType) return false;
            if (filterMonth && !p.payment_date.startsWith(filterMonth)) return false;
            return true;
        });
    }, [payments, filterType, filterMonth]);

    const totals = useMemo(() => {
        const incassato = payments.filter(p => p.type === 'payment').reduce((s, p) => s + p.amount_cents, 0);
        const rimborsato = payments.filter(p => p.type === 'refund').reduce((s, p) => s + Math.abs(p.amount_cents), 0);
        return { incassato, rimborsato, netto: incassato - rimborsato };
    }, [payments]);

    const months = useMemo(() => {
        const m = new Set<string>();
        payments.forEach(p => m.add(p.payment_date.substring(0, 7)));
        return Array.from(m).sort().reverse();
    }, [payments]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
    );

    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Revenue</h1>
                <p className="text-sm text-slate-400 mt-1">Pagamenti, rimborsi e andamento finanziario</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Incassato Totale</p>
                    <p className="text-3xl font-bold text-white mt-1">€{(totals.incassato / 100).toFixed(2)}</p>
                    <div className="flex items-center gap-1 mt-2">
                        <ArrowUp className="w-3 h-3 text-emerald-400" />
                        <span className="text-xs text-emerald-400">{payments.filter(p => p.type === 'payment').length} pagamenti</span>
                    </div>
                </div>
                <div className="rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-red-500/20 to-red-500/5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Rimborsato</p>
                    <p className="text-3xl font-bold text-white mt-1">€{(totals.rimborsato / 100).toFixed(2)}</p>
                    <div className="flex items-center gap-1 mt-2">
                        <ArrowDown className="w-3 h-3 text-red-400" />
                        <span className="text-xs text-red-400">{payments.filter(p => p.type === 'refund').length} rimborsi</span>
                    </div>
                </div>
                <div className="rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Netto</p>
                    <p className="text-3xl font-bold text-white mt-1">€{(totals.netto / 100).toFixed(2)}</p>
                    <p className="text-xs text-slate-500 mt-2">Incassato − Rimborsato</p>
                </div>
                <div className="rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">MRR Stimato</p>
                    <p className="text-3xl font-bold text-white mt-1">€{(mrrData.mrr / 100).toFixed(2)}</p>
                    <div className="flex items-center gap-1 mt-2">
                        <Users className="w-3 h-3 text-cyan-400" />
                        <span className="text-xs text-cyan-400">{mrrData.payingCount} clienti paganti</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-slate-400"><Filter className="w-3.5 h-3.5" /> Filtra:</div>
                {['', 'payment', 'refund', 'credit_note', 'adjustment'].map(t => (
                    <button key={t} onClick={() => setFilterType(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filterType === t
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-black/20 text-slate-400 border-white/5 hover:bg-white/5'}`}>
                        {TYPE_LABELS[t]?.label || 'Tutti'}
                    </button>
                ))}
                <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-black/20 border border-white/5 text-slate-300 outline-none">
                    <option value="" style={{ background: '#0f172a' }}>Tutti i mesi</option>
                    {months.map(m => <option key={m} value={m} style={{ background: '#0f172a' }}>{m}</option>)}
                </select>
            </div>

            {/* Transactions List */}
            <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                <div className="grid grid-cols-[1fr_1fr_100px_100px_80px] gap-2 px-4 py-3 border-b border-white/5 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                    <span>Workspace / Owner</span>
                    <span>Dettagli</span>
                    <span className="text-right">Importo</span>
                    <span className="text-right">Data</span>
                    <span className="text-right">Tipo</span>
                </div>
                {filteredPayments.length === 0 ? (
                    <div className="text-center py-12">
                        <Receipt className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                        <p className="text-sm text-slate-400">Nessuna transazione trovata</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {filteredPayments.map(p => (
                            <div key={p.id} className="grid grid-cols-[1fr_1fr_100px_100px_80px] gap-2 px-4 py-3 hover:bg-white/[0.02] transition-colors items-center">
                                <div>
                                    <p className="text-sm text-white font-medium truncate">{p.workspace_name}</p>
                                    <p className="text-[11px] text-slate-500 truncate">{p.owner_email}</p>
                                </div>
                                <div className="text-xs text-slate-400 space-y-0.5">
                                    {p.reference && <span className="block">CRO: {p.reference}</span>}
                                    {p.invoice_number && <span className="block">Fatt: {p.invoice_number}</span>}
                                    {p.notes && <span className="block text-slate-600 truncate">{p.notes}</span>}
                                </div>
                                <p className={`text-sm font-bold text-right ${p.type === 'refund' ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {p.type === 'refund' ? '−' : '+'}€{(Math.abs(p.amount_cents) / 100).toFixed(2)}
                                </p>
                                <p className="text-xs text-slate-400 text-right">{new Date(p.payment_date).toLocaleDateString('it-IT')}</p>
                                <span className={`text-right text-[10px] font-bold uppercase ${TYPE_LABELS[p.type]?.color || 'text-slate-400'}`}>
                                    {TYPE_LABELS[p.type]?.label || p.type}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
