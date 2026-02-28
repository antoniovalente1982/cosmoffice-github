'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Crown,
    Shield,
    User,
    UserMinus,
    ChevronDown,
    MoreVertical,
    Ban,
} from 'lucide-react';
import { Button } from '../ui/button';
import type { WorkspaceMemberWithProfile } from '../../hooks/useWorkspaceMembers';

type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest';

interface MemberListProps {
    members: WorkspaceMemberWithProfile[];
    currentUserId: string | null;
    currentUserRole: WorkspaceRole | null;
    onRemoveMember: (userId: string) => Promise<{ success: boolean; error?: string }>;
    onChangeRole: (userId: string, newRole: WorkspaceRole) => Promise<{ success: boolean; error?: string }>;
}

const ROLE_CONFIG: Record<WorkspaceRole, { icon: typeof Crown; label: string; color: string; bgColor: string; borderColor: string }> = {
    owner: { icon: Crown, label: 'Owner', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' },
    admin: { icon: Shield, label: 'Admin', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/20' },
    member: { icon: User, label: 'Membro', color: 'text-slate-300', bgColor: 'bg-slate-500/10', borderColor: 'border-slate-500/20' },
    guest: { icon: User, label: 'Ospite', color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/20' },
};

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
    owner: 3, admin: 2, member: 1, guest: 0,
};

const ASSIGNABLE_ROLES: WorkspaceRole[] = ['admin', 'member', 'guest'];

export function MemberList({ members, currentUserId, currentUserRole, onRemoveMember, onChangeRole }: MemberListProps) {
    const [menuOpen, setMenuOpen] = useState<string | null>(null);
    const [roleMenuOpen, setRoleMenuOpen] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const currentLevel = currentUserRole ? ROLE_HIERARCHY[currentUserRole] : -1;

    const canManage = (targetRole: WorkspaceRole, targetUserId: string) => {
        if (!currentUserRole || targetUserId === currentUserId) return false;
        return currentLevel > ROLE_HIERARCHY[targetRole];
    };

    const handleRemove = async (userId: string) => {
        setActionLoading(userId);
        await onRemoveMember(userId);
        setActionLoading(null);
        setMenuOpen(null);
    };

    const handleChangeRole = async (userId: string, newRole: WorkspaceRole) => {
        setActionLoading(userId);
        await onChangeRole(userId, newRole);
        setActionLoading(null);
        setRoleMenuOpen(null);
        setMenuOpen(null);
    };

    const getInitials = (name: string | null, email: string | null) => {
        if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        if (email) return email[0].toUpperCase();
        return '?';
    };

    return (
        <div className="space-y-1.5">
            {members.map((member, idx) => {
                const config = ROLE_CONFIG[member.role] || ROLE_CONFIG.member;
                const RoleIcon = config.icon;
                const isCurrentUser = member.user_id === currentUserId;
                const canManageThis = canManage(member.role, member.user_id);
                const isMenuVisible = menuOpen === member.user_id;
                const isRoleMenuVisible = roleMenuOpen === member.user_id;
                const isLoading = actionLoading === member.user_id;

                return (
                    <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`
              flex items-center justify-between p-3 rounded-xl group transition-all
              ${isCurrentUser
                                ? 'bg-cyan-500/5 border border-cyan-500/10'
                                : 'bg-slate-800/20 border border-transparent hover:border-white/5 hover:bg-slate-800/40'
                            }
            `}
                    >
                        {/* Avatar + Info */}
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="relative flex-shrink-0">
                                {member.profile?.avatar_url ? (
                                    <img
                                        src={member.profile.avatar_url}
                                        alt={member.profile.full_name || ''}
                                        className="w-10 h-10 rounded-full object-cover border-2 border-white/10"
                                    />
                                ) : (
                                    <div className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center text-sm font-bold ${config.color}`}>
                                        {getInitials(member.profile?.full_name || null, member.profile?.email || null)}
                                    </div>
                                )}
                                {/* Online indicator */}
                                {member.profile?.status === 'online' && (
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
                                )}
                            </div>

                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-slate-100 truncate">
                                        {member.profile?.full_name || member.profile?.email || 'Unknown'}
                                    </p>
                                    {isCurrentUser && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-medium flex-shrink-0">
                                            Tu
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 truncate">{member.profile?.email}</p>
                            </div>
                        </div>

                        {/* Role Badge + Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Role Badge */}
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
                                <RoleIcon className={`w-3.5 h-3.5 ${config.color}`} />
                                <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                            </div>

                            {/* Actions Menu - only for managers */}
                            {canManageThis && (
                                <div className="relative">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-500 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMenuOpen(isMenuVisible ? null : member.user_id);
                                            setRoleMenuOpen(null);
                                        }}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <div className="w-4 h-4 border-2 border-slate-500/30 border-t-slate-400 rounded-full animate-spin" />
                                        ) : (
                                            <MoreVertical className="w-4 h-4" />
                                        )}
                                    </Button>

                                    <AnimatePresence>
                                        {isMenuVisible && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                                transition={{ duration: 0.15 }}
                                                className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-30 py-1 overflow-hidden"
                                            >
                                                {/* Change Role */}
                                                <div className="relative">
                                                    <button
                                                        className="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center justify-between"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setRoleMenuOpen(isRoleMenuVisible ? null : member.user_id);
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Shield className="w-4 h-4" />
                                                            Cambia ruolo
                                                        </div>
                                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isRoleMenuVisible ? 'rotate-180' : ''}`} />
                                                    </button>

                                                    <AnimatePresence>
                                                        {isRoleMenuVisible && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                className="overflow-hidden bg-slate-900/50"
                                                            >
                                                                {ASSIGNABLE_ROLES.filter(r => ROLE_HIERARCHY[r] < currentLevel).map(r => {
                                                                    const rc = ROLE_CONFIG[r];
                                                                    return (
                                                                        <button
                                                                            key={r}
                                                                            className={`w-full px-6 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2
                                        ${member.role === r ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (member.role !== r) handleChangeRole(member.user_id, r);
                                                                            }}
                                                                            disabled={member.role === r}
                                                                        >
                                                                            <rc.icon className={`w-3.5 h-3.5 ${rc.color}`} />
                                                                            <span className={rc.color}>{rc.label}</span>
                                                                            {member.role === r && <span className="text-xs text-slate-600 ml-auto">Attuale</span>}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>

                                                <div className="h-px bg-white/5 mx-2" />

                                                {/* Remove */}
                                                <button
                                                    className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRemove(member.user_id);
                                                    }}
                                                >
                                                    <UserMinus className="w-4 h-4" />
                                                    Rimuovi dal workspace
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </motion.div>
                );
            })}

            {members.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-sm">
                    Nessun membro trovato
                </div>
            )}
        </div>
    );
}
