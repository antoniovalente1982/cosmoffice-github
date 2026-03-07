'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../../../utils/supabase/client';
import {
    Crown,
    Search,
    Users,
    Building2,
    Calendar,
    Check,
    X,
    ChevronDown,
    Save,
    AlertCircle,
} from 'lucide-react';

interface Workspace {
    id: string;
    name: string;
    slug: string;
    plan: string;
    max_members: number;
    max_spaces: number;
    max_rooms_per_space: number;
    max_guests: number;
    plan_expires_at: string | null;
    plan_notes: string | null;
    created_at: string;
    created_by: string;
    memberCount?: number;
    ownerEmail?: string;
}

const PLAN_OPTIONS = [
    { value: 'free', label: 'Free', maxPeople: 3, maxSpaces: 1, maxRooms: 5 },
    { value: 'team_10', label: 'Team 10', maxPeople: 10, maxSpaces: 3, maxRooms: 15 },
    { value: 'team_25', label: 'Team 25', maxPeople: 25, maxSpaces: 5, maxRooms: 25 },
    { value: 'team_50', label: 'Team 50', maxPeople: 50, maxSpaces: 10, maxRooms: 50 },
    { value: 'team_100', label: 'Team 100', maxPeople: 100, maxSpaces: 20, maxRooms: 100 },
    { value: 'enterprise', label: 'Enterprise', maxPeople: 999, maxSpaces: 999, maxRooms: 999 },
];

const PLAN_COLORS: Record<string, string> = {
    free: '#64748b',
    team_10: '#06b6d4',
    team_25: '#8b5cf6',
    team_50: '#f59e0b',
    team_100: '#f97316',
    enterprise: '#ef4444',
};

export default function SuperAdminPlansPage() {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Workspace>>({});
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        loadWorkspaces();
    }, []);

    const loadWorkspaces = async () => {
        const supabase = createClient();
        const { data: ws } = await supabase
            .from('workspaces')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (ws) {
            // Get member counts
            const enriched = await Promise.all(ws.map(async (w: any) => {
                const { count } = await supabase
                    .from('workspace_members')
                    .select('*', { count: 'exact', head: true })
                    .eq('workspace_id', w.id)
                    .is('removed_at', null);

                // Get owner email
                const { data: owner } = await supabase
                    .from('profiles')
                    .select('email')
                    .eq('id', w.created_by)
                    .single();

                return { ...w, memberCount: count || 0, ownerEmail: owner?.email || '—' };
            }));
            setWorkspaces(enriched);
        }
        setLoading(false);
    };

    const startEdit = (ws: Workspace) => {
        setEditingId(ws.id);
        setEditForm({
            plan: ws.plan,
            max_members: ws.max_members,
            max_spaces: ws.max_spaces,
            max_rooms_per_space: ws.max_rooms_per_space,
            max_guests: ws.max_guests,
            plan_expires_at: ws.plan_expires_at ? ws.plan_expires_at.split('T')[0] : '',
            plan_notes: ws.plan_notes || '',
        });
    };

    const applyPlanDefaults = (planValue: string) => {
        const plan = PLAN_OPTIONS.find(p => p.value === planValue);
        if (plan) {
            setEditForm(prev => ({
                ...prev,
                plan: planValue,
                max_members: plan.maxPeople,
                max_spaces: plan.maxSpaces,
                max_rooms_per_space: plan.maxRooms,
                max_guests: plan.maxPeople, // guests included in total
            }));
        }
    };

    const saveEdit = async () => {
        if (!editingId) return;
        setSaving(true);

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await supabase
            .from('workspaces')
            .update({
                plan: editForm.plan,
                max_members: editForm.max_members,
                max_spaces: editForm.max_spaces,
                max_rooms_per_space: editForm.max_rooms_per_space,
                max_guests: editForm.max_guests,
                plan_expires_at: editForm.plan_expires_at || null,
                plan_notes: editForm.plan_notes || null,
                plan_activated_by: user?.id,
                plan_activated_at: new Date().toISOString(),
            })
            .eq('id', editingId);

        if (error) {
            setMessage('Errore: ' + error.message);
        } else {
            setMessage('Piano aggiornato ✅');
            setEditingId(null);
            loadWorkspaces();
        }
        setSaving(false);
        setTimeout(() => setMessage(''), 3000);
    };

    const filtered = workspaces.filter(w =>
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        w.ownerEmail?.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>
                        Gestione Piani
                    </h1>
                    <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
                        {workspaces.length} workspace totali — Attiva e gestisci i piani manualmente
                    </p>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div style={{
                    padding: '12px 16px', borderRadius: 12, marginBottom: 16,
                    background: message.includes('Errore') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                    border: `1px solid ${message.includes('Errore') ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
                    color: message.includes('Errore') ? '#fca5a5' : '#86efac',
                    fontSize: 14,
                }}>
                    {message}
                </div>
            )}

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 24 }}>
                <Search style={{ position: 'absolute', left: 14, top: 12, width: 18, height: 18, color: '#475569' }} />
                <input
                    type="text"
                    placeholder="Cerca workspace o email owner..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        width: '100%', padding: '12px 12px 12px 44px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                        color: '#e2e8f0', fontSize: 14, outline: 'none',
                    }}
                />
            </div>

            {/* Workspace List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filtered.map(ws => (
                    <div key={ws.id} style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 16, overflow: 'hidden',
                    }}>
                        {/* Row */}
                        <div style={{
                            display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 16,
                            cursor: 'pointer',
                        }}
                            onClick={() => editingId === ws.id ? setEditingId(null) : startEdit(ws)}
                        >
                            {/* Plan badge */}
                            <div style={{
                                padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.05em',
                                background: `${PLAN_COLORS[ws.plan] || '#64748b'}15`,
                                color: PLAN_COLORS[ws.plan] || '#64748b',
                                border: `1px solid ${PLAN_COLORS[ws.plan] || '#64748b'}30`,
                                whiteSpace: 'nowrap',
                            }}>
                                {PLAN_OPTIONS.find(p => p.value === ws.plan)?.label || ws.plan}
                            </div>

                            {/* Name + Owner */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>{ws.name}</div>
                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{ws.ownerEmail}</div>
                            </div>

                            {/* Members */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 13 }}>
                                <Users style={{ width: 14, height: 14 }} />
                                <span>{ws.memberCount}/{ws.max_members}</span>
                            </div>

                            {/* Expiry */}
                            {ws.plan_expires_at && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                                    color: new Date(ws.plan_expires_at) < new Date() ? '#ef4444' : '#94a3b8',
                                }}>
                                    <Calendar style={{ width: 14, height: 14 }} />
                                    {new Date(ws.plan_expires_at).toLocaleDateString('it-IT')}
                                </div>
                            )}

                            <ChevronDown style={{
                                width: 18, height: 18, color: '#475569',
                                transform: editingId === ws.id ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.2s',
                            }} />
                        </div>

                        {/* Edit Panel */}
                        {editingId === ws.id && (
                            <div style={{
                                padding: '20px', borderTop: '1px solid rgba(255,255,255,0.06)',
                                background: 'rgba(0,0,0,0.2)',
                            }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
                                    {/* Plan Select */}
                                    <div>
                                        <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Piano</label>
                                        <select
                                            value={editForm.plan || 'free'}
                                            onChange={e => applyPlanDefaults(e.target.value)}
                                            style={{
                                                width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 6,
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#e2e8f0', fontSize: 14, outline: 'none',
                                            }}
                                        >
                                            {PLAN_OPTIONS.map(p => (
                                                <option key={p.value} value={p.value} style={{ background: '#0f172a' }}>
                                                    {p.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Max People */}
                                    <div>
                                        <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Persone (membri+guest)</label>
                                        <input
                                            type="number"
                                            value={editForm.max_members || 3}
                                            onChange={e => setEditForm(prev => ({ ...prev, max_members: parseInt(e.target.value) }))}
                                            style={{
                                                width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 6,
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#e2e8f0', fontSize: 14, outline: 'none',
                                            }}
                                        />
                                    </div>

                                    {/* Expiry */}
                                    <div>
                                        <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scadenza Piano</label>
                                        <input
                                            type="date"
                                            value={editForm.plan_expires_at || ''}
                                            onChange={e => setEditForm(prev => ({ ...prev, plan_expires_at: e.target.value }))}
                                            style={{
                                                width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 6,
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#e2e8f0', fontSize: 14, outline: 'none',
                                            }}
                                        />
                                    </div>

                                    {/* Max Spaces */}
                                    <div>
                                        <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Uffici</label>
                                        <input
                                            type="number"
                                            value={editForm.max_spaces || 1}
                                            onChange={e => setEditForm(prev => ({ ...prev, max_spaces: parseInt(e.target.value) }))}
                                            style={{
                                                width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 6,
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#e2e8f0', fontSize: 14, outline: 'none',
                                            }}
                                        />
                                    </div>

                                    {/* Max Rooms */}
                                    <div>
                                        <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Stanze per Ufficio</label>
                                        <input
                                            type="number"
                                            value={editForm.max_rooms_per_space || 5}
                                            onChange={e => setEditForm(prev => ({ ...prev, max_rooms_per_space: parseInt(e.target.value) }))}
                                            style={{
                                                width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 6,
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#e2e8f0', fontSize: 14, outline: 'none',
                                            }}
                                        />
                                    </div>

                                    {/* Notes */}
                                    <div>
                                        <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Note (pagamento, accordo...)</label>
                                        <input
                                            type="text"
                                            value={editForm.plan_notes || ''}
                                            onChange={e => setEditForm(prev => ({ ...prev, plan_notes: e.target.value }))}
                                            placeholder="Es: Bonifico ricevuto 07/03..."
                                            style={{
                                                width: '100%', padding: '10px 12px', borderRadius: 10, marginTop: 6,
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#e2e8f0', fontSize: 14, outline: 'none',
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => setEditingId(null)}
                                        style={{
                                            padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                                            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                                            color: '#94a3b8', cursor: 'pointer',
                                        }}
                                    >
                                        Annulla
                                    </button>
                                    <button
                                        onClick={saveEdit}
                                        disabled={saving}
                                        style={{
                                            padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                            border: 'none', color: 'white', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            opacity: saving ? 0.6 : 1,
                                        }}
                                    >
                                        <Save style={{ width: 14, height: 14 }} />
                                        {saving ? 'Salvataggio...' : 'Salva Piano'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
                        <Building2 style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.5 }} />
                        <p>Nessun workspace trovato</p>
                    </div>
                )}
            </div>
        </div>
    );
}
