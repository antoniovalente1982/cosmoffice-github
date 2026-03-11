'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Headphones, AlertTriangle, MessageSquare } from 'lucide-react';
import { useT } from '../../lib/i18n';
import SupportTicketForm from './SupportTicketForm';
import BugReportForm from './BugReportForm';
import SupportTickets from './SupportTickets';

type SupportTab = 'support' | 'bug' | 'tickets';

interface SupportCenterProps {
    isOpen: boolean;
    onClose: () => void;
    workspaceId: string | null;
    ticketUnread?: number;
    initialTab?: SupportTab;
}

export default function SupportCenter({ isOpen, onClose, workspaceId, ticketUnread = 0, initialTab = 'support' }: SupportCenterProps) {
    const { t } = useT();
    const [activeTab, setActiveTab] = useState<SupportTab>(initialTab);

    const tabs = [
        { id: 'support' as SupportTab, label: t('office.support'), icon: Headphones, color: 'text-emerald-400', borderColor: 'border-emerald-500', bgColor: 'bg-emerald-500/10' },
        { id: 'bug' as SupportTab, label: t('office.bugReport'), icon: AlertTriangle, color: 'text-red-400', borderColor: 'border-red-500', bgColor: 'bg-red-500/10' },
        { id: 'tickets' as SupportTab, label: t('office.myTickets'), icon: MessageSquare, color: 'text-violet-400', borderColor: 'border-violet-500', bgColor: 'bg-violet-500/10', badge: ticketUnread },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.7)' }}
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-lg max-h-[85vh] rounded-3xl overflow-hidden flex flex-col bg-[#0c1222] border border-white/10 shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-violet-500/20 flex items-center justify-center">
                                    <Headphones className="w-4.5 h-4.5 text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white">{t('supportCenter.title')}</h2>
                                    <p className="text-[10px] text-slate-500">{t('supportCenter.subtitle')}</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-white/5 px-2">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium border-b-2 transition-all relative ${
                                            isActive
                                                ? `${tab.borderColor} ${tab.color}`
                                                : 'border-transparent text-slate-500 hover:text-slate-300'
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">{tab.label}</span>
                                        {tab.badge && tab.badge > 0 && (
                                            <span className="min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-1 animate-pulse">
                                                {tab.badge}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Content — render the active tab's component inline */}
                        <div className="flex-1 overflow-hidden">
                            {activeTab === 'support' && (
                                <SupportTicketForm
                                    workspaceId={workspaceId}
                                    isOpen={true}
                                    onClose={() => {}} 
                                    embedded={true}
                                />
                            )}
                            {activeTab === 'bug' && (
                                <BugReportForm
                                    workspaceId={workspaceId}
                                    isOpen={true}
                                    onClose={() => {}}
                                    embedded={true}
                                />
                            )}
                            {activeTab === 'tickets' && (
                                <SupportTickets
                                    isOpen={true}
                                    onClose={() => {}}
                                    workspaceId={workspaceId}
                                    embedded={true}
                                />
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
