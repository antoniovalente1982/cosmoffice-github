'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useT } from '../../lib/i18n';
import { LanguageSelector } from '../../components/ui/LanguageSelector';
import {
    Plus,
    Settings,
    LogOut,
    Globe,
    PlusCircle,
    ArrowRight,
    Search,
    Building2,
    Users,
    MoreVertical,
    Trash2,
    Edit2,
    X,
    Check,
    DoorOpen,
    AlertTriangle,
    ArrowUpCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Logo } from '../../components/ui/logo';
import { WorkspaceSettings } from '../../components/workspace/WorkspaceSettings';
import { OFFICE_PRESETS } from '../../lib/officePresets';

// max_workspaces is now dynamic, fetched from profiles table

export default function DashboardPage() {
    const { t } = useT();
    const supabase = createClient();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [spaces, setSpaces] = useState<any[]>([]);
    const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingSpace, setEditingSpace] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [spaceMenuOpen, setSpaceMenuOpen] = useState<string | null>(null);
    const [settingsWorkspace, setSettingsWorkspace] = useState<{ id: string; name: string } | null>(null);
    const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
    const [userRoles, setUserRoles] = useState<Record<string, string>>({});
    const [ownedWorkspaceCount, setOwnedWorkspaceCount] = useState(0);
    const [maxOwnedWorkspaces, setMaxOwnedWorkspaces] = useState(1);
    const [upgradeSending, setUpgradeSending] = useState(false);
    const [upgradeSuccess, setUpgradeSuccess] = useState<string | null>(null);
    // SuperAdmin access is now separate at /superadmin/login

    useEffect(() => {
        const initDashboard = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }
            setUser(user);

            // Fetch max_workspaces from profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('max_workspaces')
                .eq('id', user.id)
                .single();
            if (profile?.max_workspaces) setMaxOwnedWorkspaces(profile.max_workspaces);

            // Fetch workspaces from both memberships AND created workspaces to be safe
            const [membersRes, createdRes] = await Promise.all([
                supabase.from('workspace_members').select('workspace_id, role, workspaces(*)').eq('user_id', user.id).is('removed_at', null),
                supabase.from('workspaces').select('*').eq('created_by', user.id)
            ]);

            // Build role map from membership data
            const roles: Record<string, string> = {};
            membersRes.data?.forEach((m: any) => {
                if (m.workspace_id && m.role) roles[m.workspace_id] = m.role;
            });
            // Creator is always owner
            createdRes.data?.forEach((w: any) => {
                if (!roles[w.id]) roles[w.id] = 'owner';
            });
            setUserRoles(roles);

            // SuperAdmin access is now at /superadmin/login — no longer checked here

            // ACCESS CONTROL: Only owners can see My Workspaces
            const isOwnerOfAny = Object.values(roles).includes('owner');
            if (!isOwnerOfAny) {
                // Redirect non-owners to their first available space
                const allWsIds = Object.keys(roles);
                if (allWsIds.length > 0) {
                    const { data: firstSpace } = await supabase
                        .from('spaces')
                        .select('id')
                        .in('workspace_id', allWsIds)
                        .is('deleted_at', null)
                        .is('archived_at', null)
                        .limit(1)
                        .single();
                    if (firstSpace) {
                        router.push(`/office/${firstSpace.id}`);
                        return;
                    }
                }
                // No spaces found — show empty state
            }

            const memberWorkspaces = membersRes.data?.map(m => m.workspaces).filter(Boolean) || [];
            const createdWorkspaces = createdRes.data || [];

            // Merge and deduplicate by ID
            const allWorkspacesMap = new Map();
            [...memberWorkspaces, ...createdWorkspaces].forEach(w => allWorkspacesMap.set(w.id, w));
            const wsList = Array.from(allWorkspacesMap.values());

            // Count workspaces OWNED by user (created_by)
            const ownedCount = createdRes.data?.filter((w: any) => !w.deleted_at).length || 0;

            setWorkspaces(wsList);
            setOwnedWorkspaceCount(ownedCount);

            // Fetch spaces for these workspaces
            if (wsList.length > 0) {
                const workspaceIds = wsList.map((w: any) => w.id);
                const { data: activeSpaces } = await supabase
                    .from('spaces')
                    .select('*')
                    .in('workspace_id', workspaceIds)
                    .is('deleted_at', null)
                    .is('archived_at', null);
                setSpaces(activeSpaces || []);

                // Fetch member counts per workspace
                const { data: membersData } = await supabase
                    .from('workspace_members')
                    .select('workspace_id')
                    .in('workspace_id', workspaceIds)
                    .is('removed_at', null);

                if (membersData) {
                    const counts: Record<string, number> = {};
                    membersData.forEach((m: any) => {
                        counts[m.workspace_id] = (counts[m.workspace_id] || 0) + 1;
                    });
                    setMemberCounts(counts);
                }
            }

            setLoading(false);
        };
        initDashboard();
    }, [supabase, router]);

    // Chiudi il menu quando si clicca fuori
    useEffect(() => {
        const handleClickOutside = () => setSpaceMenuOpen(null);
        if (spaceMenuOpen) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [spaceMenuOpen]);

    const [selectedPreset, setSelectedPreset] = useState('team');

    const handleCreateWorkspace = async () => {
        if (!newWorkspaceName || !user || isSubmitting) return;

        setIsSubmitting(true);
        setError(null);

        const preset = OFFICE_PRESETS.find(p => p.id === selectedPreset) || OFFICE_PRESETS[1];
        const baseSlug = newWorkspaceName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        let slug = baseSlug || 'workspace';

        try {
            // STEP 1: Create Workspace
            let { data: workspace, error: wsError } = await supabase
                .from('workspaces')
                .insert({
                    name: newWorkspaceName,
                    slug,
                    created_by: user.id
                })
                .select()
                .single();

            // If it's a duplicate slug error, try once more with a random suffix
            if (wsError && wsError.code === '23505') {
                const randomSuffix = Math.random().toString(36).substring(2, 6);
                slug = `${baseSlug}-${randomSuffix}`;

                const { data: retryWs, error: retryError } = await supabase
                    .from('workspaces')
                    .insert({
                        name: newWorkspaceName,
                        slug,
                        created_by: user.id
                    })
                    .select()
                    .single();

                workspace = retryWs;
                wsError = retryError;
            }

            if (wsError) throw wsError;
            if (!workspace) throw new Error('Failed to create workspace');

            // STEP 2: Create space with layout_data from the selected preset
            const layout_data = {
                officeWidth: preset.width,
                officeHeight: preset.height,
                bgOpacity: 0.8,
                preset: preset.id,
            };

            const { data: space, error: spaceError } = await supabase
                .from('spaces')
                .insert({
                    workspace_id: workspace.id,
                    name: 'General Office',
                    slug: 'general-office',
                    created_by: user.id,
                    layout_data,
                })
                .select()
                .single();

            if (spaceError) throw spaceError;
            if (!space) throw new Error('Failed to create default space');

            // STEP 3: Create default rooms scaled to office size
            const scaleX = preset.width / 4000;
            const scaleY = preset.height / 3000;
            const defaultRooms = [
                { space_id: space.id, name: 'Lobby', type: 'reception', x: Math.round(400 * scaleX), y: Math.round(400 * scaleY), width: Math.round(250 * scaleX), height: Math.round(200 * scaleY), created_by: user.id },
                { space_id: space.id, name: 'Coffee Break', type: 'break', x: Math.round(700 * scaleX), y: Math.round(400 * scaleY), width: Math.round(200 * scaleX), height: Math.round(200 * scaleY), created_by: user.id },
                { space_id: space.id, name: 'Deep Work', type: 'focus', x: Math.round(400 * scaleX), y: Math.round(700 * scaleY), width: Math.round(300 * scaleX), height: Math.round(250 * scaleY), created_by: user.id },
                { space_id: space.id, name: 'Design Hub', type: 'meeting', x: Math.round(750 * scaleX), y: Math.round(700 * scaleY), width: Math.round(250 * scaleX), height: Math.round(250 * scaleY), created_by: user.id }
            ];

            const { error: roomsError } = await supabase
                .from('rooms')
                .insert(defaultRooms);

            if (roomsError) console.warn('Failed to create default rooms:', roomsError);

            // Navigate immediately to the new space
            router.push(`/office/${space.id}`);

            setIsCreatingWorkspace(false);
            setNewWorkspaceName('');
        } catch (err: any) {
            console.error('Error creating workspace:', err);
            let message = err.message || t('common.error');
            if (err.code === '23505') {
                message = 'A workspace with this slug already exists. Please try a different name.';
            }
            setError(`${t('common.error')}: ${message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    const handleDeleteSpace = async (spaceId: string) => {
        if (!confirm(t('dashboard.deleteConfirm'))) {
            return;
        }

        try {
            // Hard delete — rimuovi definitivamente dal DB
            const { error } = await supabase
                .from('spaces')
                .delete()
                .eq('id', spaceId);

            if (error) throw error;

            // Aggiorna la lista locale
            setSpaces(spaces.filter(s => s.id !== spaceId));
            setSpaceMenuOpen(null);
        } catch (err: any) {
            console.error('Error deleting space:', err);
            alert(t('dashboard.deleteError') + err.message);
        }
    };

    const handleUpdateSpace = async (spaceId: string) => {
        if (!editName.trim()) return;

        try {
            const { error } = await supabase
                .from('spaces')
                .update({ name: editName.trim() })
                .eq('id', spaceId);

            if (error) throw error;

            // Aggiorna la lista locale
            setSpaces(spaces.map(s => s.id === spaceId ? { ...s, name: editName.trim() } : s));
            setEditingSpace(null);
            setEditName('');
        } catch (err: any) {
            console.error('Error updating space:', err);
            alert(t('dashboard.updateError') + err.message);
        }
    };

    const startEditing = (space: any) => {
        setEditingSpace(space.id);
        setEditName(space.name);
        setSpaceMenuOpen(null);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dark-bg">
                <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-transparent text-slate-100 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Logo size="md" showText={false} variant="glow" />
                        <h1 className="text-xl sm:text-2xl font-bold text-gradient">{t('dashboard.title')}</h1>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                        <LanguageSelector compact className="mr-1 sm:mr-2" />
                        <Button variant="outline" className="gap-2" onClick={() => {
                            if (ownedWorkspaceCount >= maxOwnedWorkspaces) {
                                setError(t('dashboard.limitReachedError', { max: String(maxOwnedWorkspaces) }));
                                return;
                            }
                            setIsCreatingWorkspace(true);
                        }}>
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('dashboard.newWorkspace')}</span>
                        </Button>
                        {/* SuperAdmin access is now at /superadmin/login */}
                        <div className="hidden sm:block w-px h-6 bg-white/10 mx-2"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium">{user?.user_metadata?.full_name || 'User'}</p>
                                <p className="text-xs text-slate-500">{user?.email}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-slate-500 hover:text-red-400">
                                <LogOut className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </div>

                {isCreatingWorkspace && (
                    <div className="glass p-6 rounded-2xl border border-primary-500/20 max-w-lg mx-auto" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                        <h2 className="text-lg font-semibold mb-4">{t('dashboard.createOffice')}</h2>
                        <input
                            type="text"
                            placeholder={t('dashboard.officeName')}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2 mb-4 focus:border-primary-500 outline-none"
                            value={newWorkspaceName}
                            onChange={(e) => setNewWorkspaceName(e.target.value)}
                        />

                        {/* Office Size Preset Selection */}
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 block">{t('dashboard.officeSize')}</label>
                        <div className="grid grid-cols-2 gap-3 mb-5">
                            {OFFICE_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => setSelectedPreset(preset.id)}
                                    className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all ${selectedPreset === preset.id
                                        ? 'bg-primary-500/15 border-primary-500/50 shadow-[0_0_20px_rgba(99,102,241,0.25)]'
                                        : 'bg-slate-800/50 border-white/5 hover:bg-slate-700/50 hover:border-white/15'
                                        }`}
                                >
                                    <span className="text-3xl">{preset.icon}</span>
                                    <span className={`text-sm font-bold uppercase tracking-wider ${selectedPreset === preset.id ? 'text-primary-400' : 'text-slate-200'}`}>
                                        {preset.label}
                                    </span>
                                    <span className={`text-xs font-medium ${selectedPreset === preset.id ? 'text-primary-300/70' : 'text-slate-400'}`}>{preset.capacity} {t('dashboard.users')}</span>
                                </button>
                            ))}
                        </div>

                        {error && (
                            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Button className="flex-1" onClick={handleCreateWorkspace} disabled={isSubmitting}>
                                {isSubmitting ? t('dashboard.creating') : t('dashboard.createButton')}
                            </Button>
                            <Button variant="ghost" className="flex-1" onClick={() => setIsCreatingWorkspace(false)} disabled={isSubmitting}>{t('common.cancel')}</Button>
                        </div>
                    </div>
                )}

                {/* Workspaces & Spaces */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {spaces.map((space) => {
                        const workspace = workspaces.find(w => w.id === space.workspace_id);
                        const isEditing = editingSpace === space.id;
                        const isMenuOpen = spaceMenuOpen === space.id;
                        const isOwnerOfWs = userRoles[space.workspace_id] === 'owner';

                        return (
                            <div
                                key={space.id}
                                className="transition-transform duration-150 hover:-translate-y-1 active:scale-[0.98]"
                            >
                                <Card className="p-6 h-full flex flex-col justify-between group hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/10 transition-all duration-200 border-white/5 bg-[#0c1222] relative overflow-hidden">
                                    {/* Glow effect on hover */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                                    <div className="space-y-4 relative z-10">
                                        <div className="flex items-center justify-between">
                                            <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-400 group-hover:scale-110 transition-transform duration-200">
                                                <Building2 className="w-6 h-6" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {/* Member count */}
                                                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-700/30 text-slate-400 text-xs font-medium">
                                                    <Users className="w-3 h-3" />
                                                    {memberCounts[space.workspace_id] || 1}
                                                </div>
                                                {/* Settings button — owner only */}
                                                {isOwnerOfWs && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-cyan-400 transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSettingsWorkspace(workspace ? { id: workspace.id, name: workspace.name } : null);
                                                        }}
                                                    >
                                                        <Settings className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                {/* Menu pulsante — owner only */}
                                                {isOwnerOfWs && (
                                                    <div className="relative">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-400 hover:text-slate-100"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSpaceMenuOpen(isMenuOpen ? null : space.id);
                                                            }}
                                                        >
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                        {/* Dropdown menu */}
                                                        {isMenuOpen && (
                                                            <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-white/10 rounded-xl shadow-xl z-20 py-1">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        startEditing(space);
                                                                    }}
                                                                    className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center gap-2"
                                                                >
                                                                    <Edit2 className="w-4 h-4" /> {t('dashboard.editName')}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteSpace(space.id);
                                                                    }}
                                                                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/5 flex items-center gap-2"
                                                                >
                                                                    <Trash2 className="w-4 h-4" /> {t('dashboard.deleteOffice')}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            {isEditing ? (
                                                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-primary-500 outline-none"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleUpdateSpace(space.id);
                                                            if (e.key === 'Escape') {
                                                                setEditingSpace(null);
                                                                setEditName('');
                                                            }
                                                        }}
                                                    />
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            className="h-7 px-2 text-xs"
                                                            onClick={() => handleUpdateSpace(space.id)}
                                                        >
                                                            <Check className="w-3 h-3" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 px-2 text-xs"
                                                            onClick={() => {
                                                                setEditingSpace(null);
                                                                setEditName('');
                                                            }}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <h3 className="text-xl font-bold text-slate-100 group-hover:text-primary-400 transition-colors">{workspace?.name || 'Workspace'}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className="text-slate-400 text-sm flex items-center gap-1">
                                                            <Globe className="w-3 h-3" /> {space.name}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Seat Bar — only for owned workspaces */}
                                    {isOwnerOfWs && workspace && (
                                        <div className="mt-4 pt-3 border-t border-white/5">
                                            {(() => {
                                                const used = memberCounts[workspace.id] || 0;
                                                const max = workspace.max_capacity || 50;
                                                const pct = Math.min((used / max) * 100, 100);
                                                const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e';
                                                const textColor = pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-amber-400' : 'text-emerald-400';
                                                const atLimit = used >= max;
                                                return (
                                                    <>
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <span className={`text-xs font-bold ${textColor} flex items-center gap-1.5`}>
                                                                <Users className="w-3.5 h-3.5" />
                                                                {used}/{max} {t('dashboard.seats')}
                                                            </span>
                                                            {atLimit && (
                                                                <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                                                                    {t('dashboard.limit')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full transition-all duration-500"
                                                                style={{ width: `${pct}%`, background: barColor }}
                                                            />
                                                        </div>
                                                        {atLimit && (
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    setUpgradeSending(true);
                                                                    try {
                                                                        const res = await fetch('/api/upgrade-request', {
                                                                            method: 'POST',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({
                                                                                workspace_id: workspace.id,
                                                                                request_type: 'seats',
                                                                                message: `Request more seats for "${workspace.name}" (current: ${max})`,
                                                                            }),
                                                                        });
                                                                        const data = await res.json();
                                                                        if (data.alreadyPending) {
                                                                            setUpgradeSuccess(t('dashboard.requestPending'));
                                                                        } else if (data.success) {
                                                                            setUpgradeSuccess(t('dashboard.requestSent'));
                                                                        }
                                                                    } catch { /* ignore */ }
                                                                    setUpgradeSending(false);
                                                                    setTimeout(() => setUpgradeSuccess(null), 5000);
                                                                }}
                                                                disabled={upgradeSending}
                                                                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                                                            >
                                                                <ArrowUpCircle className="w-3.5 h-3.5" />
                                                                {upgradeSending ? t('dashboard.sending') : t('dashboard.requestMoreSeats')}
                                                            </button>
                                                        )}
                                                        {upgradeSuccess && (
                                                            <p className="text-[11px] text-emerald-400 mt-2 text-center">{upgradeSuccess}</p>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {/* Pulsante Entra - PIU EVIDENTE */}
                                    {!isEditing && (
                                        <div className="mt-4 pt-3 border-t border-white/5">
                                            <Button
                                                className="w-full gap-2 font-semibold shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 active:scale-95 transition-all duration-150 bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-400 hover:to-purple-400 border-0"
                                                onClick={() => router.push(`/office/${space.id}`)}
                                            >
                                                <DoorOpen className="w-4 h-4" />
                                                {t('dashboard.enter')}
                                                <ArrowRight className="w-4 h-4 ml-auto" />
                                            </Button>
                                        </div>
                                    )}
                                </Card>
                            </div>
                        );
                    })}

                    {ownedWorkspaceCount >= maxOwnedWorkspaces ? (
                        <div className="transition-transform duration-150 hover:scale-[1.02]">
                            <Card className="p-6 h-full flex flex-col items-center justify-center border-dashed border-amber-500/20 bg-amber-500/5 transition-all min-h-[220px] group">
                                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                                </div>
                                <p className="text-sm font-semibold text-amber-300 text-center mb-2">{t('dashboard.limitReached')}</p>
                                <p className="text-xs text-slate-400 text-center mb-4">{t('dashboard.limitReachedDesc', { max: String(maxOwnedWorkspaces) })}</p>
                                <button
                                    onClick={async () => {
                                        setUpgradeSending(true);
                                        try {
                                            const res = await fetch('/api/upgrade-request', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ request_type: 'workspace', message: 'Request additional workspace' }),
                                            });
                                            const data = await res.json();
                                            if (data.alreadyPending) {
                                                setUpgradeSuccess(t('dashboard.requestPending'));
                                            } else if (data.success) {
                                                setUpgradeSuccess(t('dashboard.requestSent'));
                                            }
                                        } catch { /* ignore */ }
                                        setUpgradeSending(false);
                                        setTimeout(() => setUpgradeSuccess(null), 5000);
                                    }}
                                    disabled={upgradeSending}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                                >
                                    <ArrowUpCircle className="w-4 h-4" />
                                    {upgradeSending ? t('dashboard.sending') : t('dashboard.requestUpgrade')}
                                </button>
                                {upgradeSuccess && (
                                    <p className="text-[11px] text-emerald-400 mt-3 text-center">{upgradeSuccess}</p>
                                )}
                            </Card>
                        </div>
                    ) : (
                        <div className="transition-transform duration-150 hover:scale-[1.02]">
                            <Card className="p-6 h-full flex flex-col items-center justify-center border-dashed border-white/10 bg-white/5 hover:bg-white/10 transition-all min-h-[220px] group cursor-pointer" onClick={() => setIsCreatingWorkspace(true)}>
                                <PlusCircle className="w-12 h-12 text-slate-500 group-hover:text-primary-400 transition-colors mb-4" />
                                <p className="text-slate-400 font-medium group-hover:text-slate-200">{t('dashboard.newSpace')}</p>
                            </Card>
                        </div>
                    )}
                </div>

                {workspaces.length === 0 && !loading && (
                    <div className="text-center py-20 glass rounded-3xl border-white/5">
                        <Building2 className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-200">{t('dashboard.noWorkspaces')}</h2>
                        <p className="text-slate-500 mb-8">{t('dashboard.noWorkspacesDesc')}</p>
                        <Button size="lg" onClick={() => setIsCreatingWorkspace(true)}>{t('dashboard.getStarted')}</Button>
                    </div>
                )}
            </div>

            {/* Workspace Settings Modal */}
            {settingsWorkspace && user && (
                <WorkspaceSettings
                    workspaceId={settingsWorkspace.id}
                    workspaceName={settingsWorkspace.name}
                    currentUserId={user.id}
                    onClose={() => setSettingsWorkspace(null)}
                    onWorkspaceUpdated={() => {
                        // Refresh workspace data
                        window.location.reload();
                    }}
                />
            )}
        </div>
    );
}
