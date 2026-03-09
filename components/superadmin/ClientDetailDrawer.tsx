'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Users, Building2, DollarSign, ClipboardList, ChevronDown,
    CreditCard, Calendar, Save, Loader2, History, Receipt, Crown,
    UserMinus, ShieldCheck, Shield, User, Check, AlertTriangle,
    Mail, Link2, Copy, TrendingUp, Edit3, KeyRound, Plus,
} from 'lucide-react';
import { createClient } from '../../utils/supabase/client';
import { useCurrency } from '../../hooks/useCurrency';

type Tab = 'overview' | 'workspaces' | 'members' | 'payments';

interface Props {
    ownerId: string;
    onClose: () => void;
    onRefresh: () => void;
}

// Single per-user pricing model: max_members × price_per_seat = monthly cost

const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Panoramica', icon: TrendingUp },
    { id: 'workspaces', label: 'Workspace', icon: Building2 },
    { id: 'members', label: 'Utenti & Admin', icon: Users },
    { id: 'payments', label: 'Pagamenti', icon: CreditCard },
];

// formatCents is now replaced by useCurrency().fmt()

export default function ClientDetailDrawer({ ownerId, onClose, onRefresh }: Props) {
    const [tab, setTab] = useState<Tab>('overview');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);



    // Payment registration
    const [payWsId, setPayWsId] = useState<string | null>(null);
    const [payAmount, setPayAmount] = useState('');
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

    const { symbol: cs, fmt, currency: currCode } = useCurrency();
    const [payRef, setPayRef] = useState('');
    const [payType, setPayType] = useState<'payment' | 'refund'>('payment');
    const [payNotes, setPayNotes] = useState('');
    const [savingPay, setSavingPay] = useState(false);

    // Role change
    const [changingRole, setChangingRole] = useState<string | null>(null);

    // Quick price edit
    const [editPriceWsId, setEditPriceWsId] = useState<string | null>(null);
    const [editPriceValue, setEditPriceValue] = useState('');

    // Seat + price per seat edit
    const [editSeatsWsId, setEditSeatsWsId] = useState<string | null>(null);
    const [editSeatsValue, setEditSeatsValue] = useState('');
    const [editPricePerSeat, setEditPricePerSeat] = useState('');
    const [savingSeats, setSavingSeats] = useState(false);

    // Owner max_workspaces edit
    const [editingMaxWs, setEditingMaxWs] = useState(false);
    const [editMaxWsValue, setEditMaxWsValue] = useState('1');
    const [savingMaxWs, setSavingMaxWs] = useState(false);

    // Add workspace
    const [showAddWs, setShowAddWs] = useState(false);
    const [addWsName, setAddWsName] = useState('');
    const [addWsSeats, setAddWsSeats] = useState('10');
    const [addWsPPS, setAddWsPPS] = useState('30');
    const [addingWs, setAddingWs] = useState(false);

    // Billing info
    const [billingOpen, setBillingOpen] = useState(false);
    const [bilCompany, setBilCompany] = useState('');
    const [bilVat, setBilVat] = useState('');
    const [bilFiscal, setBilFiscal] = useState('');
    const [bilAddress, setBilAddress] = useState('');
    const [bilCity, setBilCity] = useState('');
    const [bilZip, setBilZip] = useState('');
    const [bilCountry, setBilCountry] = useState('IT');
    const [bilSdi, setBilSdi] = useState('');
    const [bilPec, setBilPec] = useState('');
    const [bilPhone, setBilPhone] = useState('');
    const [savingBilling, setSavingBilling] = useState(false);

    const saveMaxWorkspaces = async () => {
        setSavingMaxWs(true);
        const val = parseInt(editMaxWsValue) || 1;
        try {
            const res = await fetch('/api/admin/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_max_workspaces', workspaceId: '', data: { owner_id: ownerId, max_workspaces: val } }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Errore'); }
            showFb('success', `Max workspace aggiornato a ${val} ✅`);
            setEditingMaxWs(false);
            loadDetail();
            onRefresh();
        } catch (e: any) { showFb('error', e.message); }
        setSavingMaxWs(false);
    };

    const showFb = (type: 'success' | 'error', msg: string) => {
        setFeedback({ type, msg });
        setTimeout(() => setFeedback(null), 3000);
    };

    const loadDetail = async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/admin/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_owner_detail', workspaceId: '', data: { ownerId } }),
            });
            if (!r.ok) {
                const errBody = await r.json().catch(() => ({}));
                throw new Error(errBody?.error || `HTTP ${r.status}`);
            }
            setData(await r.json());
        } catch (e: any) { showFb('error', e.message); }
        setLoading(false);
    };

    useEffect(() => { loadDetail(); }, [ownerId]);



    const savePayment = async () => {
        if (!payWsId || !payAmount) return;
        setSavingPay(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const amtCents = Math.round(parseFloat(payAmount) * 100);
        const ws = data?.workspaces?.find((w: any) => w.id === payWsId);
        const { error } = await supabase.from('payments').insert({
            workspace_id: payWsId,
            workspace_name: ws?.name || '',
            owner_email: data?.owner?.email || '',
            owner_name: data?.owner?.name || '',
            type: payType,
            amount_cents: payType === 'refund' ? -amtCents : amtCents,
            plan_at_time: ws?.plan || 'demo',
            description: `${payType === 'refund' ? 'Rimborso' : 'Pagamento'} ${ws?.name || ''}`,
            payment_method: 'bank_transfer',
            reference: payRef || null,
            recorded_by: user?.id,
            payment_date: payDate,
            notes: payNotes || null,
        });
        if (!error) {
            await supabase.from('workspaces').update({
                payment_status: payType === 'refund' ? 'pending' : 'paid',
                last_payment_at: payType === 'refund' ? undefined : new Date().toISOString(),
            }).eq('id', payWsId);
            showFb('success', payType === 'refund' ? 'Rimborso registrato ✅' : 'Pagamento registrato ✅');
            setPayWsId(null);
            loadDetail(); onRefresh();
        } else showFb('error', error.message);
        setSavingPay(false);
    };

    const changeRole = async (memberId: string, newRole: string) => {
        setChangingRole(memberId);
        try {
            const r = await fetch('/api/admin/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'change_member_role', workspaceId: '', data: { memberId, newRole } }),
            });
            if (!r.ok) throw new Error('Failed');
            showFb('success', 'Ruolo aggiornato ✅');
            loadDetail();
        } catch { showFb('error', 'Errore nel cambio ruolo'); }
        setChangingRole(null);
    };

    const removeMember = async (memberId: string, memberName: string) => {
        if (!confirm(`Rimuovere ${memberName} dal workspace?`)) return;
        try {
            const r = await fetch('/api/admin/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'remove_member', workspaceId: '', data: { memberId } }),
            });
            if (!r.ok) throw new Error('Failed');
            showFb('success', 'Membro rimosso ✅');
            loadDetail(); onRefresh();
        } catch { showFb('error', 'Errore nella rimozione'); }
    };

    const saveQuickPrice = async (wsId: string) => {
        const amtCents = editPriceValue ? Math.round(parseFloat(editPriceValue) * 100) : 0;
        const supabase = createClient();
        const { error } = await supabase.from('workspaces').update({
            monthly_amount_cents: amtCents,
            payment_status: amtCents > 0 ? 'pending' : 'none',
        }).eq('id', wsId);
        if (error) showFb('error', error.message);
        else { showFb('success', 'Prezzo aggiornato ✅'); setEditPriceWsId(null); loadDetail(); onRefresh(); }
    };

    const owner = data?.owner;
    const workspaces = data?.workspaces || [];
    const payments = data?.payments || [];
    const kpi = data?.kpi;

    // Styles
    const card = 'rounded-xl border border-white/5 p-4';
    const cardBg = { background: 'rgba(15,23,42,0.6)' };
    const inputCls = 'w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white outline-none';
    const labelCls = 'text-[10px] text-slate-500 uppercase font-semibold tracking-wider';

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-3xl h-full overflow-y-auto border-l border-white/10"
                style={{ background: '#0a0e1a' }}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 p-5 border-b border-white/5 flex items-center gap-4" style={{ background: 'rgba(10,14,26,0.95)', backdropFilter: 'blur(20px)' }}>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                    {owner && (
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            {owner.avatarUrl ? (
                                <img src={owner.avatarUrl} alt="" className="w-10 h-10 rounded-full ring-2 ring-white/10" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-white font-bold ring-2 ring-white/10">
                                    {owner.name?.[0]?.toUpperCase() || '?'}
                                </div>
                            )}
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold text-white truncate">{owner.name}</h2>
                                    {owner.isSuperAdmin && <Crown className="w-4 h-4 text-amber-400" />}
                                </div>
                                <p className="text-xs text-slate-500 truncate">{owner.email}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Feedback */}
                <AnimatePresence>
                    {feedback && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className={`mx-5 mt-3 p-3 rounded-xl border text-sm ${feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
                            {feedback.msg}
                        </motion.div>
                    )}
                </AnimatePresence>

                {loading ? (
                    <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-cyan-400 animate-spin" /></div>
                ) : (
                    <>
                        {/* Tabs */}
                        <div className="flex gap-1 px-5 pt-4 pb-2 overflow-x-auto">
                            {TABS.map(t => (
                                <button key={t.id} onClick={() => setTab(t.id)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${tab === t.id
                                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                        : 'text-slate-400 border-transparent hover:bg-white/5'}`}>
                                    <t.icon className="w-3.5 h-3.5" />{t.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-5 space-y-4">
                            {/* ─── TAB: PANORAMICA ─── */}
                            {tab === 'overview' && kpi && (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className={card} style={cardBg}>
                                            <div className="flex items-center gap-2 mb-1"><Receipt className="w-4 h-4 text-emerald-400" /><span className={labelCls}>Revenue Totale</span></div>
                                            <p className="text-xl font-bold text-white">{fmt(kpi.totalRevenueCents)}</p>
                                        </div>
                                        <div className={card} style={cardBg}>
                                            <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-cyan-400" /><span className={labelCls}>MRR</span></div>
                                            <p className="text-xl font-bold text-white">{fmt(kpi.mrrCents)}</p>
                                        </div>
                                        <div className={card} style={cardBg}>
                                            <div className="flex items-center gap-2 mb-1"><Building2 className="w-4 h-4 text-purple-400" /><span className={labelCls}>Workspace</span></div>
                                            <p className="text-xl font-bold text-white">{kpi.activeWorkspaces}<span className="text-sm text-slate-500">/{kpi.maxWorkspaces || kpi.totalWorkspaces}</span></p>
                                        </div>
                                        <div className={card} style={cardBg}>
                                            <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-amber-400" /><span className={labelCls}>Membri Totali</span></div>
                                            <p className="text-xl font-bold text-white">{kpi.totalMembers}</p>
                                        </div>
                                        <div className={card} style={cardBg}>
                                            <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-sky-400" /><span className={labelCls}>Ultimo Pagamento</span></div>
                                            <p className="text-sm font-bold text-white">{kpi.lastPaymentAt ? new Date(kpi.lastPaymentAt).toLocaleDateString('it-IT') : '—'}</p>
                                        </div>
                                        <div className={card} style={cardBg}>
                                            <div className="flex items-center gap-2 mb-1"><Mail className="w-4 h-4 text-slate-400" /><span className={labelCls}>Registrato</span></div>
                                            <p className="text-sm font-bold text-white">{owner?.createdAt ? new Date(owner.createdAt).toLocaleDateString('it-IT') : '—'}</p>
                                        </div>
                                    </div>
                                    {/* Recent payments preview */}
                                    {payments.length > 0 && (
                                        <div className={card} style={cardBg}>
                                            <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><Receipt className="w-3.5 h-3.5" /> Ultimi Pagamenti</h3>
                                            <div className="space-y-1">
                                                {payments.slice(0, 5).map((p: any) => (
                                                    <div key={p.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-black/20">
                                                        <div className="flex items-center gap-2">
                                                            <span className={p.type === 'refund' ? 'text-red-400' : 'text-emerald-400'}>
                                                                {p.type === 'refund' ? '−' : '+'}{fmt(Math.abs(p.amount_cents))}
                                                            </span>
                                                            <span className="text-slate-500">{new Date(p.payment_date).toLocaleDateString('it-IT')}</span>
                                                            <span className="text-slate-600">{p.workspace_name}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ─── TAB: WORKSPACE ─── */}
                            {tab === 'workspaces' && (
                                <div className="space-y-3">
                                    {/* Max workspace limit header */}
                                    <div className="flex items-center justify-between mb-1 px-1">
                                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Workspace attivi: {kpi?.activeWorkspaces || 0} su {kpi?.maxWorkspaces || 1} max</span>
                                        {!editingMaxWs ? (
                                            <button onClick={() => { setEditingMaxWs(true); setEditMaxWsValue((owner?.maxWorkspaces || 1).toString()); }}
                                                className="flex items-center gap-1.5 text-xs text-cyan-400/70 hover:text-cyan-300 transition-colors" title="Modifica limite workspace">
                                                <Edit3 className="w-3 h-3" /> <span className="text-[10px]">Modifica limite</span>
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-1.5">
                                                <input type="number" min="1" max="50" value={editMaxWsValue} onChange={e => setEditMaxWsValue(e.target.value)}
                                                    className="w-14 px-2 py-1 rounded-lg bg-black/30 border border-white/10 text-xs text-white outline-none focus:border-cyan-500/50" autoFocus />
                                                <button onClick={saveMaxWorkspaces} disabled={savingMaxWs}
                                                    className="p-1 rounded-lg text-emerald-300 bg-emerald-500/15 border border-emerald-500/20 hover:bg-emerald-500/25">
                                                    {savingMaxWs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                </button>
                                                <button onClick={() => setEditingMaxWs(false)} className="p-1 rounded-lg text-slate-400 hover:bg-white/5">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {workspaces.map((ws: any) => (
                                        <div key={ws.id} className={card} style={cardBg}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                                                    <Building2 className="w-4 h-4 text-cyan-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-white truncate">{ws.name}</p>
                                                    <p className="text-[10px] text-slate-500">/{ws.slug}</p>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${ws.status === 'active' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : ws.status === 'suspended' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-red-500/10 text-red-300 border-red-500/20'}`}>
                                                    {ws.status === 'active' ? 'Attivo' : ws.status === 'suspended' ? 'Sospeso' : 'Eliminato'}
                                                </span>
                                            </div>
                                            {/* Info row */}
                                            <div className="mt-2 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                                                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{ws.totalSeats}/{ws.maxMembers} accessi</span>
                                                {ws.price_per_seat > 0 && <span className="text-emerald-400">{fmt(ws.price_per_seat)}/utente</span>}
                                                <span>{ws.activeSpaces} uffici</span>
                                                {ws.monthly_amount_cents > 0 && (
                                                    <span className="ml-auto text-emerald-400 font-semibold">{fmt(ws.monthly_amount_cents)}/mese</span>
                                                )}
                                                {ws.payment_status && ws.payment_status !== 'none' && (
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${ws.payment_status === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : ws.payment_status === 'overdue' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                                        {ws.payment_status === 'paid' ? 'Pagato' : ws.payment_status === 'overdue' ? 'Scaduto' : 'In attesa'}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Subscription info row */}
                                            <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-500">
                                                <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 font-bold uppercase">
                                                    {ws.billingCycle === 'annual' ? '📅 Annuale' : '📅 Mensile'}
                                                </span>
                                                {ws.nextInvoiceDate && (
                                                    <span className="flex items-center gap-1">
                                                        Prossimo rinnovo: <span className="text-white font-semibold">{new Date(ws.nextInvoiceDate).toLocaleDateString('it-IT')}</span>
                                                    </span>
                                                )}
                                            </div>
                                            {/* Seat usage bar */}
                                            {(() => {
                                                const used = ws.totalSeats || 0;
                                                const max = ws.maxMembers || 3;
                                                const pct = Math.min((used / max) * 100, 100);
                                                const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e';
                                                return (
                                                    <div className="mt-2">
                                                        <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                            {/* Gestisci Piano – single unified button */}
                                            {editSeatsWsId === ws.id ? (
                                                <div className="mt-3 space-y-3 p-3 rounded-xl bg-black/20 border border-white/5">
                                                    <h4 className="text-[10px] uppercase text-cyan-300 font-bold tracking-wider">Gestisci Piano</h4>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className={labelCls}>Accessi</label>
                                                            <input type="number" value={editSeatsValue} onChange={e => setEditSeatsValue(e.target.value)}
                                                                className={inputCls + ' mt-1'} autoFocus min="1" />
                                                        </div>
                                                        <div>
                                                            <label className={labelCls}>{cs}/utente/mese</label>
                                                            <input type="number" value={editPricePerSeat} onChange={e => setEditPricePerSeat(e.target.value)}
                                                                placeholder="0.00" step="0.01" className={inputCls + ' mt-1'} />
                                                        </div>
                                                    </div>
                                                    {editSeatsValue && editPricePerSeat && (
                                                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                                            <p className="text-xs text-emerald-300 font-bold">
                                                                💰 {editSeatsValue} accessi × {cs}{parseFloat(editPricePerSeat).toFixed(2)} = {cs}{(parseFloat(editSeatsValue) * parseFloat(editPricePerSeat)).toFixed(2)}/mese
                                                            </p>
                                                        </div>
                                                    )}
                                                    <div className="flex gap-2">
                                                        <button onClick={async () => {
                                                            setSavingSeats(true);
                                                            const seats = parseInt(editSeatsValue) || ws.max_members;
                                                            const pricePerSeat = Math.round((parseFloat(editPricePerSeat) || 0) * 100);
                                                            const totalCents = seats * pricePerSeat;
                                                            try {
                                                                await fetch('/api/admin/workspaces', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({
                                                                        action: 'update_seats',
                                                                        workspaceId: ws.id,
                                                                        data: { max_members: seats, price_per_seat: pricePerSeat, monthly_amount_cents: totalCents },
                                                                    }),
                                                                });
                                                                showFb('success', `Piano aggiornato ✅`);
                                                                setEditSeatsWsId(null);
                                                                loadDetail();
                                                                onRefresh();
                                                            } catch { showFb('error', 'Errore salvataggio'); }
                                                            setSavingSeats(false);
                                                        }} disabled={savingSeats}
                                                            className="flex-1 px-3 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-emerald-500 hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-1.5">
                                                            {savingSeats ? <><Loader2 className="w-3 h-3 animate-spin" /> Salvo...</> : <><Save className="w-3 h-3" /> Salva Piano</>}
                                                        </button>
                                                        <button onClick={() => setEditSeatsWsId(null)}
                                                            className="px-3 py-2 rounded-lg text-xs text-slate-400 border border-white/10 hover:bg-white/5">
                                                            Annulla
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button onClick={() => {
                                                    setEditSeatsWsId(ws.id);
                                                    setEditSeatsValue((ws.max_members || 3).toString());
                                                    setEditPricePerSeat(ws.price_per_seat ? (ws.price_per_seat / 100).toFixed(2) : '');
                                                }}
                                                    className="mt-3 w-full py-2 rounded-lg text-xs font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all flex items-center justify-center gap-1.5">
                                                    <Edit3 className="w-3.5 h-3.5" /> Gestisci Piano
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {workspaces.length === 0 && <p className="text-center text-slate-500 py-8">Nessun workspace</p>}

                                    {/* Add Workspace */}
                                    {!showAddWs ? (
                                        <button onClick={() => setShowAddWs(true)}
                                            className="w-full py-3 rounded-xl border border-dashed border-cyan-500/30 text-sm font-semibold text-cyan-400 hover:bg-cyan-500/5 hover:border-cyan-500/50 transition-all flex items-center justify-center gap-2">
                                            <Plus className="w-4 h-4" /> Aggiungi Workspace
                                        </button>
                                    ) : (
                                        <div className={card + ' space-y-3'} style={cardBg}>
                                            <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                                                <Plus className="w-3.5 h-3.5" /> Nuovo Workspace
                                            </h4>
                                            <div>
                                                <label className={labelCls}>Nome Workspace</label>
                                                <input type="text" value={addWsName} onChange={e => setAddWsName(e.target.value)}
                                                    placeholder="Es: Ufficio Marketing" autoFocus
                                                    className={inputCls + ' mt-1'} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className={labelCls}>Accessi</label>
                                                    <input type="number" min="1" value={addWsSeats} onChange={e => setAddWsSeats(e.target.value)}
                                                        className={inputCls + ' mt-1'} />
                                                </div>
                                                <div>
                                                    <label className={labelCls}>{cs}/utente/mese</label>
                                                    <input type="number" step="0.01" value={addWsPPS} onChange={e => setAddWsPPS(e.target.value)}
                                                        className={inputCls + ' mt-1'} />
                                                </div>
                                            </div>
                                            {addWsSeats && addWsPPS && (
                                                <p className="text-[10px] text-emerald-300 font-bold">
                                                    💰 Totale: {addWsSeats} × {cs}{parseFloat(addWsPPS).toFixed(2)} = {cs}{(parseInt(addWsSeats) * parseFloat(addWsPPS)).toFixed(2)}/mese
                                                </p>
                                            )}
                                            <div className="flex gap-2">
                                                <button onClick={async () => {
                                                    if (!addWsName.trim()) { showFb('error', 'Inserisci un nome'); return; }
                                                    setAddingWs(true);
                                                    try {
                                                        const res = await fetch('/api/admin/workspaces', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                action: 'add_workspace_to_owner',
                                                                workspaceId: '',
                                                                data: {
                                                                    ownerId,
                                                                    workspaceName: addWsName.trim(),
                                                                    maxMembers: parseInt(addWsSeats) || 10,
                                                                    pricePerSeatCents: Math.round((parseFloat(addWsPPS) || 0) * 100),
                                                                },
                                                            }),
                                                        });
                                                        if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Errore'); }
                                                        showFb('success', `Workspace "${addWsName}" creato ✅`);
                                                        setShowAddWs(false);
                                                        setAddWsName(''); setAddWsSeats('10'); setAddWsPPS('30');
                                                        loadDetail();
                                                        onRefresh();
                                                    } catch (e: any) { showFb('error', e.message); }
                                                    setAddingWs(false);
                                                }} disabled={addingWs}
                                                    className="flex-1 px-3 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-emerald-500 hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-1.5">
                                                    {addingWs ? <><Loader2 className="w-3 h-3 animate-spin" /> Creo...</> : <><Plus className="w-3 h-3" /> Crea Workspace</>}
                                                </button>
                                                <button onClick={() => setShowAddWs(false)}
                                                    className="px-3 py-2 rounded-lg text-xs text-slate-400 border border-white/10 hover:bg-white/5">
                                                    Annulla
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ─── TAB: MEMBERS ─── */}
                            {tab === 'members' && (
                                <div className="space-y-4">
                                    {workspaces.map((ws: any) => (
                                        <div key={ws.id} className={card} style={cardBg}>
                                            <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                                                <Building2 className="w-3.5 h-3.5 text-cyan-400" />{ws.name}
                                                <span className="text-slate-600 font-normal">({ws.members?.length || 0} membri)</span>
                                            </h3>
                                            <div className="space-y-1">
                                                {(ws.members || []).map((m: any) => (
                                                    <div key={m.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/[0.02]">
                                                        {m.avatarUrl ? (
                                                            <img src={m.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
                                                        ) : (
                                                            <div className="w-7 h-7 rounded-full bg-slate-700/50 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                                                                {m.name?.[0]?.toUpperCase() || '?'}
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium text-white truncate">{m.name}</p>
                                                            <p className="text-[10px] text-slate-500 truncate">{m.email}</p>
                                                        </div>
                                                        {/* Role selector */}
                                                        <select
                                                            value={m.role}
                                                            onChange={e => changeRole(m.id, e.target.value)}
                                                            disabled={changingRole === m.id}
                                                            className="px-2 py-1 rounded-lg bg-black/30 border border-white/10 text-[11px] text-white outline-none"
                                                        >
                                                            <option value="owner" style={{ background: '#0f172a' }}>👑 Owner</option>
                                                            <option value="admin" style={{ background: '#0f172a' }}>🛡️ Admin</option>
                                                            <option value="member" style={{ background: '#0f172a' }}>👤 Membro</option>
                                                        </select>
                                                        {m.role !== 'owner' && (
                                                            <button onClick={() => removeMember(m.id, m.name)}
                                                                className="p-1 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                                                <UserMinus className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {(!ws.members || ws.members.length === 0) && <p className="text-xs text-slate-600 italic">Nessun membro</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ─── TAB: PAYMENTS ─── */}
                            {tab === 'payments' && (
                                <div className="space-y-4">
                                    {/* Dati di Fatturazione */}
                                    <div className={card} style={cardBg}>
                                        <button onClick={() => {
                                            if (!billingOpen && owner) {
                                                setBilCompany(owner.companyName || '');
                                                setBilVat(owner.vatNumber || '');
                                                setBilFiscal(owner.fiscalCode || '');
                                                setBilAddress(owner.billingAddress || '');
                                                setBilCity(owner.billingCity || '');
                                                setBilZip(owner.billingZip || '');
                                                setBilCountry(owner.billingCountry || 'IT');
                                                setBilSdi(owner.sdiCode || '');
                                                setBilPec(owner.pec || '');
                                                setBilPhone(owner.phone || '');
                                            }
                                            setBillingOpen(!billingOpen);
                                        }} className="w-full flex items-center justify-between text-xs font-bold text-slate-300">
                                            <span className="flex items-center gap-2"><Receipt className="w-3.5 h-3.5 text-amber-400" /> Dati di Fatturazione</span>
                                            <span className="text-slate-500 text-[10px]">{billingOpen ? '▲ Chiudi' : '▼ Espandi'}</span>
                                        </button>
                                        {billingOpen && (
                                            <div className="mt-3 space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="col-span-2">
                                                        <label className={labelCls}>Ragione Sociale / Nome</label>
                                                        <input type="text" value={bilCompany} onChange={e => setBilCompany(e.target.value)} placeholder="Acme S.r.l." className={inputCls + ' mt-1'} />
                                                    </div>
                                                    <div>
                                                        <label className={labelCls}>P.IVA</label>
                                                        <input type="text" value={bilVat} onChange={e => setBilVat(e.target.value)} placeholder="IT12345678901" className={inputCls + ' mt-1'} />
                                                    </div>
                                                    <div>
                                                        <label className={labelCls}>Codice Fiscale</label>
                                                        <input type="text" value={bilFiscal} onChange={e => setBilFiscal(e.target.value)} placeholder="RSSMRA80A01H501Z" className={inputCls + ' mt-1'} />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className={labelCls}>Indirizzo</label>
                                                        <input type="text" value={bilAddress} onChange={e => setBilAddress(e.target.value)} placeholder="Via Roma 1" className={inputCls + ' mt-1'} />
                                                    </div>
                                                    <div>
                                                        <label className={labelCls}>Città</label>
                                                        <input type="text" value={bilCity} onChange={e => setBilCity(e.target.value)} placeholder="Milano" className={inputCls + ' mt-1'} />
                                                    </div>
                                                    <div>
                                                        <label className={labelCls}>CAP</label>
                                                        <input type="text" value={bilZip} onChange={e => setBilZip(e.target.value)} placeholder="20100" className={inputCls + ' mt-1'} />
                                                    </div>
                                                    <div>
                                                        <label className={labelCls}>Paese</label>
                                                        <input type="text" value={bilCountry} onChange={e => setBilCountry(e.target.value)} placeholder="IT" className={inputCls + ' mt-1'} />
                                                    </div>
                                                    <div>
                                                        <label className={labelCls}>Telefono</label>
                                                        <input type="text" value={bilPhone} onChange={e => setBilPhone(e.target.value)} placeholder="+39 02..." className={inputCls + ' mt-1'} />
                                                    </div>
                                                    <div>
                                                        <label className={labelCls}>Codice SDI</label>
                                                        <input type="text" value={bilSdi} onChange={e => setBilSdi(e.target.value)} placeholder="0000000" className={inputCls + ' mt-1'} />
                                                    </div>
                                                    <div>
                                                        <label className={labelCls}>PEC</label>
                                                        <input type="text" value={bilPec} onChange={e => setBilPec(e.target.value)} placeholder="pec@azienda.it" className={inputCls + ' mt-1'} />
                                                    </div>
                                                </div>
                                                <button onClick={async () => {
                                                    setSavingBilling(true);
                                                    try {
                                                        const res = await fetch('/api/admin/workspaces', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                action: 'update_billing',
                                                                workspaceId: '',
                                                                data: {
                                                                    owner_id: ownerId,
                                                                    company_name: bilCompany,
                                                                    vat_number: bilVat,
                                                                    fiscal_code: bilFiscal,
                                                                    billing_address: bilAddress,
                                                                    billing_city: bilCity,
                                                                    billing_zip: bilZip,
                                                                    billing_country: bilCountry,
                                                                    sdi_code: bilSdi,
                                                                    pec: bilPec,
                                                                    phone: bilPhone,
                                                                },
                                                            }),
                                                        });
                                                        if (!res.ok) throw new Error('Errore');
                                                        showFb('success', 'Dati di fatturazione salvati ✅');
                                                        loadDetail();
                                                    } catch { showFb('error', 'Errore salvataggio'); }
                                                    setSavingBilling(false);
                                                }} disabled={savingBilling}
                                                    className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 disabled:opacity-30 flex items-center justify-center gap-2 transition-all">
                                                    {savingBilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Salva Dati Fatturazione</>}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {/* Quick register */}
                                    <div className={card} style={cardBg}>
                                        <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><CreditCard className="w-3.5 h-3.5 text-emerald-400" /> Registra Pagamento</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className={labelCls}>Workspace</label>
                                                <select value={payWsId || ''} onChange={e => setPayWsId(e.target.value || null)} className={inputCls + ' mt-1'}>
                                                    <option value="" style={{ background: '#0f172a' }}>Seleziona...</option>
                                                    {workspaces.filter((w: any) => w.status === 'active').map((w: any) => (
                                                        <option key={w.id} value={w.id} style={{ background: '#0f172a' }}>{w.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className={labelCls}>Importo ({cs})</label>
                                                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="49.00" className={inputCls + ' mt-1'} />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Data</label>
                                                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={inputCls + ' mt-1'} />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Rif / CRO</label>
                                                <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="CRO..." className={inputCls + ' mt-1 placeholder:text-slate-600'} />
                                            </div>
                                            <div className="col-span-2 flex gap-2">
                                                <button onClick={() => setPayType('payment')} className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${payType === 'payment' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-black/20 text-slate-400 border-white/5'}`}>Pagamento</button>
                                                <button onClick={() => setPayType('refund')} className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${payType === 'refund' ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-black/20 text-slate-400 border-white/5'}`}>Rimborso</button>
                                            </div>
                                            <div className="col-span-2">
                                                <label className={labelCls}>Note</label>
                                                <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Note..." className={inputCls + ' mt-1 placeholder:text-slate-600'} />
                                            </div>
                                        </div>
                                        <button onClick={savePayment} disabled={savingPay || !payAmount || !payWsId}
                                            className="mt-3 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 flex items-center justify-center gap-2 transition-all">
                                            {savingPay ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4" /> Registra</>}
                                        </button>
                                    </div>
                                    {/* History */}
                                    <div className={card} style={cardBg}>
                                        <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><History className="w-3.5 h-3.5 text-purple-400" /> Storico Completo</h3>
                                        {payments.length === 0 ? <p className="text-xs text-slate-600 italic">Nessun pagamento registrato</p> : (
                                            <div className="space-y-1 max-h-96 overflow-y-auto">
                                                {payments.map((p: any) => (
                                                    <div key={p.id} className="flex items-center justify-between text-xs py-2 px-2 rounded-lg bg-black/20">
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <span className={`font-bold ${p.type === 'refund' ? 'text-red-400' : 'text-emerald-400'}`}>
                                                                {p.type === 'refund' ? '−' : '+'}{fmt(Math.abs(p.amount_cents))}
                                                            </span>
                                                            <span className="text-slate-500">{new Date(p.payment_date).toLocaleDateString('it-IT')}</span>
                                                            <span className="text-slate-600 truncate">{p.workspace_name}</span>
                                                            {p.reference && <span className="text-slate-600">CRO: {p.reference}</span>}
                                                        </div>
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold shrink-0 ${p.type === 'refund' ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                                            {p.type === 'refund' ? 'Rimborso' : 'Pagamento'}
                                                        </span>
                                                    </div>
                                                ))}
                                                <div className="pt-2 border-t border-white/5 flex justify-between text-xs">
                                                    <span className="text-slate-400 font-semibold">Totale netto:</span>
                                                    <span className="text-white font-bold">{fmt(payments.reduce((s: number, p: any) => s + p.amount_cents, 0))}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {/* ─── CASHFLOW / PIANO SCADENZE ─── */}
                                    <div className={card} style={cardBg}>
                                        <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-blue-400" /> Piano Scadenze (Cashflow)</h3>
                                        {(() => {
                                            // Build schedule from all active workspaces
                                            const activeWs = workspaces.filter((w: any) => w.status === 'active' && w.monthly_amount_cents > 0);
                                            if (activeWs.length === 0) {
                                                return <p className="text-xs text-slate-600 italic">Nessun workspace attivo con piano di pagamento.</p>;
                                            }

                                            // Collect all existing invoices for matching
                                            const allInvoices = payments.filter((p: any) => p.type === 'payment');

                                            // Build schedule entries (next 6 months for monthly, next 2 for annual)
                                            const schedule: Array<{ date: string; wsName: string; wsId: string; amount: number; cycle: string; status: string; invoiceId?: string }> = [];
                                            const now = new Date();

                                            activeWs.forEach((ws: any) => {
                                                const cycle = ws.billingCycle || 'monthly';
                                                const periods = cycle === 'annual' ? 2 : 6;
                                                let nextDate = ws.nextInvoiceDate ? new Date(ws.nextInvoiceDate) : new Date();

                                                // If nextDate is in the past, start from there
                                                for (let i = 0; i < periods; i++) {
                                                    const dueDate = new Date(nextDate);
                                                    if (i > 0) {
                                                        if (cycle === 'annual') {
                                                            dueDate.setFullYear(dueDate.getFullYear() + i);
                                                        } else {
                                                            dueDate.setMonth(dueDate.getMonth() + i);
                                                        }
                                                    }

                                                    const dateStr = dueDate.toISOString().split('T')[0];
                                                    const isPast = dueDate < now;

                                                    // Check if there's a matching paid invoice
                                                    const matchingInv = allInvoices.find((p: any) =>
                                                        p.workspace_id === ws.id &&
                                                        p.amount_cents === ws.monthly_amount_cents
                                                    );

                                                    let status = 'future'; // default
                                                    if (isPast && ws.payment_status === 'paid' && i === 0) {
                                                        status = 'paid';
                                                    } else if (isPast) {
                                                        status = 'overdue';
                                                    } else {
                                                        const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                                        if (daysUntil <= 15) {
                                                            status = 'pending';
                                                        } else {
                                                            status = 'future';
                                                        }
                                                    }

                                                    schedule.push({
                                                        date: dateStr,
                                                        wsName: ws.name,
                                                        wsId: ws.id,
                                                        amount: cycle === 'annual' ? ws.monthly_amount_cents * 12 : ws.monthly_amount_cents,
                                                        cycle,
                                                        status,
                                                    });
                                                }
                                            });

                                            // Sort by date
                                            schedule.sort((a, b) => a.date.localeCompare(b.date));

                                            const statusConfig: Record<string, { label: string; bg: string; text: string; icon: string }> = {
                                                paid: { label: 'Pagato', bg: 'bg-emerald-500/20', text: 'text-emerald-300', icon: '✅' },
                                                pending: { label: 'In Attesa', bg: 'bg-amber-500/20', text: 'text-amber-300', icon: '⏳' },
                                                overdue: { label: 'In Ritardo', bg: 'bg-red-500/20', text: 'text-red-300', icon: '🔴' },
                                                future: { label: 'Futuro', bg: 'bg-blue-500/20', text: 'text-blue-300', icon: '📅' },
                                            };

                                            // Summary
                                            const totalPending = schedule.filter(s => s.status === 'pending').reduce((a, s) => a + s.amount, 0);
                                            const totalOverdue = schedule.filter(s => s.status === 'overdue').reduce((a, s) => a + s.amount, 0);
                                            const totalFuture = schedule.filter(s => s.status === 'future').reduce((a, s) => a + s.amount, 0);

                                            return (
                                                <div className="space-y-2">
                                                    {/* Summary cards */}
                                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                                        {totalOverdue > 0 && (
                                                            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                                                                <p className="text-[9px] text-red-400 uppercase font-bold">In Ritardo</p>
                                                                <p className="text-xs text-red-300 font-bold">{fmt(totalOverdue)}</p>
                                                            </div>
                                                        )}
                                                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                                                            <p className="text-[9px] text-amber-400 uppercase font-bold">In Attesa</p>
                                                            <p className="text-xs text-amber-300 font-bold">{fmt(totalPending)}</p>
                                                        </div>
                                                        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                                                            <p className="text-[9px] text-blue-400 uppercase font-bold">Futuro</p>
                                                            <p className="text-xs text-blue-300 font-bold">{fmt(totalFuture)}</p>
                                                        </div>
                                                    </div>

                                                    {/* Schedule list */}
                                                    <div className="space-y-1 max-h-64 overflow-y-auto">
                                                        {schedule.map((entry, i) => {
                                                            const sc = statusConfig[entry.status];
                                                            return (
                                                                <div key={`${entry.wsId}-${entry.date}-${i}`} className="flex items-center justify-between py-2 px-2.5 rounded-lg bg-black/20 gap-2">
                                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                        <span className="text-[10px] text-slate-500 font-mono w-20 shrink-0">
                                                                            {new Date(entry.date).toLocaleDateString('it-IT')}
                                                                        </span>
                                                                        <span className="text-xs text-white truncate">{entry.wsName}</span>
                                                                        <span className="text-[9px] text-slate-500 px-1 py-0.5 rounded bg-white/5 shrink-0">
                                                                            {entry.cycle === 'annual' ? 'Annuale' : 'Mensile'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <span className="text-xs font-bold text-white">{fmt(entry.amount)}</span>
                                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${sc.bg} ${sc.text}`}>
                                                                            {sc.icon} {sc.label}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                        </div>
                    </>
                )}
            </motion.div>
        </motion.div >
    );
}
