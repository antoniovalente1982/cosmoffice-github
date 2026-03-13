'use client';

import { useState, useEffect } from 'react';

import {
    X,
    Settings,
    Users,
    Building2,
    Save,
    AlertCircle,
    Check,
    Crown,
} from 'lucide-react';
import { Button } from '../ui/button';
import { MemberList } from './MemberList';
import { useWorkspaceMembers } from '../../hooks/useWorkspaceMembers';
import { useWorkspaceRole } from '../../hooks/useWorkspaceRole';
import { createClient } from '../../utils/supabase/client';
import { useT } from '../../lib/i18n';
import { OFFICE_THEMES, OfficeThemeId } from '../../lib/officeThemes';
import { useWorkspaceStore } from '../../stores/workspaceStore';

interface WorkspaceSettingsProps {
    workspaceId: string;
    workspaceName: string;
    currentUserId: string;
    onClose: () => void;
    onWorkspaceUpdated?: () => void;
}

type Tab = 'general' | 'members';

export function WorkspaceSettings({
    workspaceId,
    workspaceName,
    currentUserId,
    onClose,
    onWorkspaceUpdated,
}: WorkspaceSettingsProps) {
    const [activeTab, setActiveTab] = useState<Tab>('members');
    const [wsName, setWsName] = useState(workspaceName);
    const [wsPlan, setWsPlan] = useState('demo');
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [theme, setThemeLocal] = useState<OfficeThemeId>('space');
    const [savingTheme, setSavingTheme] = useState(false);
    const setThemeStore = useWorkspaceStore(s => s.setTheme);
    const { t } = useT();

    const { role, isAdmin, loading: roleLoading } = useWorkspaceRole(workspaceId);
    const {
        members,
        invitations,
        loading: membersLoading,
        inviteMember,
        removeMember,
        changeRole,
        cancelInvitation,
    } = useWorkspaceMembers(workspaceId);

    // Fetch workspace plan from DB
    useEffect(() => {
        const supabase = createClient();
        supabase.from('workspaces').select('plan, settings').eq('id', workspaceId).single()
            .then(({ data }) => {
                if (data?.plan) setWsPlan(data.plan);
                if (data?.settings?.theme) setThemeLocal(data.settings.theme);
            });
    }, [workspaceId]);

    const tabs: { id: Tab; label: string; icon: typeof Settings; count?: number }[] = [
        { id: 'general', label: 'Generale', icon: Building2 },
        { id: 'members', label: 'Membri', icon: Users, count: members.length },
    ];

    const handleSaveGeneral = async () => {
        setSaving(true);
        setSaveError(null);
        setSaveSuccess(false);

        try {
            const supabase = createClient();
            const { error } = await supabase
                .from('workspaces')
                .update({ name: wsName.trim() })
                .eq('id', workspaceId);

            if (error) throw error;

            setSaveSuccess(true);
            onWorkspaceUpdated?.();
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err: any) {
            setSaveError(err.message || 'Errore durante il salvataggio');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
                onClick={onClose}
                style={{ animation: 'fadeIn 0.15s ease-out' }}
            >
                {/* Modal */}
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-2xl max-h-[85vh] bg-[#0c1222] border border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col"
                    style={{ animation: 'fadeIn 0.2s ease-out' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                                <Settings className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-100">Workspace Settings</h2>
                                <p className="text-xs text-slate-500">{workspaceName}</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-slate-100">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-white/5 px-6">
                        {tabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all
                    ${isActive
                                            ? 'border-cyan-500 text-cyan-400'
                                            : 'border-transparent text-slate-500 hover:text-slate-300'
                                        }
                  `}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                    {tab.count !== undefined && tab.count > 0 && (
                                        <span className={`
                      text-[10px] px-1.5 py-0.5 rounded-full font-bold
                      ${isActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700/50 text-slate-500'}
                    `}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        {/* Loading */}
                        {(roleLoading || membersLoading) ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                            </div>
                        ) : (
                            <>
                                {/* General Tab */}
                                {activeTab === 'general' && (
                                    <div className="space-y-6">
                                        {/* Workspace Info */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome Workspace</label>
                                                <input
                                                    type="text"
                                                    value={wsName}
                                                    onChange={(e) => setWsName(e.target.value)}
                                                    disabled={!isAdmin}
                                                    className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25 outline-none transition-all disabled:opacity-50"
                                                />
                                            </div>

                                            {/* Role display */}
                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Il tuo ruolo</label>
                                                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/30 border border-white/5">
                                                    <Crown className="w-4 h-4 text-amber-400" />
                                                    <span className="text-sm text-slate-200 font-medium capitalize">{role || 'N/A'}</span>
                                                </div>
                                            </div>

                                            {/* Stats */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-3 rounded-xl bg-slate-800/30 border border-white/5 text-center">
                                                    <p className="text-lg font-bold text-slate-100">{members.length}</p>
                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Membri</p>
                                                </div>
                                                <div className="p-3 rounded-xl bg-slate-800/30 border border-white/5 text-center">
                                                    <p className={`text-lg font-bold capitalize ${wsPlan === 'premium' ? 'text-amber-400' : 'text-cyan-400'}`}>
                                                        {wsPlan === 'premium' ? '⭐ Premium' : 'Demo'}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Piano</p>
                                                </div>
                                            </div>

                                            {/* Theme Selector */}
                                            <div className="space-y-3">
                                                <label className="block text-xs font-medium text-slate-400 flex items-center gap-1.5">
                                                    <Building2 className="w-3 h-3" /> {t('settings.themeLabel')}
                                                </label>
                                                <div className="grid grid-cols-3 gap-3">
                                                    {(Object.values(OFFICE_THEMES) as any[]).map((thm: any) => {
                                                        const isActive = theme === thm.id;
                                                        const accentColors: Record<string, { border: string; ring: string; dot: string; bg: string }> = {
                                                            space: { border: 'border-indigo-400', ring: 'ring-indigo-400/30', dot: 'bg-indigo-400', bg: 'bg-indigo-500/10' },
                                                            corporate: { border: 'border-blue-400', ring: 'ring-blue-400/30', dot: 'bg-blue-400', bg: 'bg-blue-500/10' },
                                                            medical: { border: 'border-teal-400', ring: 'ring-teal-400/30', dot: 'bg-teal-400', bg: 'bg-teal-500/10' },
                                                        };
                                                        const previewGradients: Record<string, string> = {
                                                            space: 'linear-gradient(135deg, #0f0a2e 0%, #1e1b4b 30%, #312e81 60%, #4338ca 80%, #6366f1 100%)',
                                                            corporate: 'linear-gradient(135deg, #0c1222 0%, #1e293b 30%, #334155 55%, #3b82f6 85%, #60a5fa 100%)',
                                                            medical: 'linear-gradient(135deg, #071a1f 0%, #0d2a2d 30%, #134e4a 55%, #14b8a6 80%, #5eead4 100%)',
                                                        };
                                                        const accent = accentColors[thm.id] || accentColors.space;
                                                        return (
                                                            <button
                                                                key={thm.id}
                                                                disabled={savingTheme || !isAdmin}
                                                                onClick={async () => {
                                                                    if (thm.id === theme) return;
                                                                    setSavingTheme(true);
                                                                    setThemeLocal(thm.id);
                                                                    setThemeStore(thm.id);
                                                                    const supabase = createClient();
                                                                    const { data: ws } = await supabase
                                                                        .from('workspaces')
                                                                        .select('settings')
                                                                        .eq('id', workspaceId)
                                                                        .single();
                                                                    const currentSettings = ws?.settings || {};
                                                                    await supabase
                                                                        .from('workspaces')
                                                                        .update({ settings: { ...currentSettings, theme: thm.id } })
                                                                        .eq('id', workspaceId);
                                                                    setSavingTheme(false);
                                                                }}
                                                                className={`relative rounded-xl border-2 transition-all text-left overflow-hidden ${
                                                                    isActive
                                                                        ? `${accent.border} ${accent.bg} ring-1 ${accent.ring}`
                                                                        : 'border-white/10 bg-slate-800/40 hover:border-white/20 hover:bg-slate-800/60'
                                                                }`}
                                                            >
                                                                {/* Gradient preview stripe at top */}
                                                                <div
                                                                    className="h-14 w-full relative"
                                                                    style={{ background: previewGradients[thm.id] || previewGradients.space }}
                                                                >
                                                                    {/* Mini grid pattern overlay */}
                                                                    <div className="absolute inset-0" style={{
                                                                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
                                                                        backgroundSize: '8px 8px',
                                                                    }} />
                                                                    {/* Floating dots to simulate particles */}
                                                                    <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-40">
                                                                        {[0, 1, 2, 3, 4].map(i => (
                                                                            <div key={i} className={`w-1.5 h-1.5 rounded-full ${accent.dot}`}
                                                                                style={{ transform: `translateY(${Math.sin(i * 1.5) * 8}px)` }}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                    {/* Selected check badge */}
                                                                    {isActive && (
                                                                        <div className={`absolute top-2 right-2 w-5 h-5 rounded-full ${accent.dot} flex items-center justify-center shadow-lg`}>
                                                                            <Check className="w-3 h-3 text-white" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {/* Text area */}
                                                                <div className="p-3">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-lg">{thm.icon}</span>
                                                                        <span className="text-sm font-bold text-slate-100">{t(`settings.theme.${thm.id}` as any)}</span>
                                                                    </div>
                                                                    <div className="text-[9px] text-slate-500 mt-1 leading-tight">{t(`settings.theme.${thm.id}Desc` as any)}</div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <p className="text-[10px] text-slate-600 ml-1">{t('settings.themeHint')}</p>
                                            </div>

                                            {/* Save button */}
                                            {isAdmin && (
                                                <div className="flex items-center gap-3">
                                                    <Button
                                                        onClick={handleSaveGeneral}
                                                        disabled={saving || wsName.trim() === workspaceName}
                                                        className="gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 border-0"
                                                    >
                                                        {saving ? (
                                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        ) : saveSuccess ? (
                                                            <Check className="w-4 h-4" />
                                                        ) : (
                                                            <Save className="w-4 h-4" />
                                                        )}
                                                        {saving ? 'Salvataggio...' : saveSuccess ? 'Salvato!' : 'Salva modifiche'}
                                                    </Button>
                                                    {saveError && (
                                                        <span className="text-xs text-red-400 flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3" />
                                                            {saveError}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Members Tab */}
                                {activeTab === 'members' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                                                {members.length} {members.length === 1 ? 'membro' : 'membri'}
                                            </p>
                                        </div>
                                        <MemberList
                                            members={members}
                                            currentUserId={currentUserId}
                                            currentUserRole={role}
                                            onRemoveMember={removeMember}
                                            onChangeRole={changeRole}
                                        />
                                    </div>
                                )}


                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
