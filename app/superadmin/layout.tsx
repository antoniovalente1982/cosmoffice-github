'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
    LayoutDashboard,
    Users,
    Shield,
    Bug,
    Video,
    Receipt,
    CreditCard,
    ScrollText,
    ArrowLeft,
    Crown,
    Server,
    Mail,
    LogOut,
    BookUser,
    Database,
    Globe,
    Wifi,
    ExternalLink,
    ArrowUpCircle,
    Headphones,
    Bell,
    X,
    BarChart3,
    Calculator,
    Zap,
    ArrowRightLeft,
    ShieldCheck,
} from 'lucide-react';
import { createClient } from '../../utils/supabase/client';
import CurrencySelector from '../../components/CurrencySelector';

interface NavItem { href: string; label: string; icon: any; external?: boolean; badgeKey?: string; }
interface NavSection { label?: string; items: NavItem[]; }

const navSections: NavSection[] = [
    {
        items: [
            { href: '/superadmin', label: 'Overview', icon: LayoutDashboard },
        ],
    },
    {
        label: 'Gestione Clienti',
        items: [
            { href: '/superadmin/customers', label: 'Clienti & Spazi', icon: BookUser },
            { href: '/superadmin/transfer', label: 'Trasferimento Owner', icon: ArrowRightLeft },
            { href: '/superadmin/email', label: 'Email Clienti', icon: Mail },
        ],
    },
    {
        label: 'Finanze',
        items: [
            { href: '/superadmin/revenue', label: 'Revenue & Pagamenti', icon: Receipt },
            { href: '/superadmin/infrastructure', label: 'Simulatore Costi', icon: Calculator },
            { href: '/superadmin/livekit', label: 'Monitor LiveKit', icon: Zap },
        ],
    },
    {
        label: 'Piattaforma',
        items: [
            { href: '/superadmin/analytics', label: 'Statistiche & Sistema', icon: Server },
            { href: '/superadmin/audit', label: 'Audit Log', icon: ScrollText },
            { href: '/superadmin/security', label: 'Sicurezza RLS', icon: ShieldCheck },
        ],
    },
    {
        label: 'Supporto',
        items: [
            { href: '/superadmin/support', label: 'Assistenza', icon: Headphones, badgeKey: 'support' },
        ],
    },
];

interface PendingCounts {
    support: number;
    upgrades: number;
    total: number;
}

interface PendingNotification {
    id: string;
    type: 'support' | 'upgrade';
    title: string;
    message: string;
    createdAt: string;
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [adminEmail, setAdminEmail] = useState('');
    const [isSupportStaff, setIsSupportStaff] = useState(false);
    const [pendingCounts, setPendingCounts] = useState<PendingCounts>({ support: 0, upgrades: 0, total: 0 });
    const [notifications, setNotifications] = useState<PendingNotification[]>([]);
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    // Login page: skip auth checks, render directly without sidebar
    const isLoginPage = pathname === '/superadmin/login';

    const fetchPendingCounts = useCallback(async () => {
        try {
            const supabase = createClient();

            // Count open support tickets (non-upgrade)
            const { count: supportCount } = await supabase
                .from('support_tickets')
                .select('id', { count: 'exact', head: true })
                .in('status', ['open', 'pending', 'new'])
                .neq('category', 'upgrade');

            // Count open upgrade tickets
            const { count: upgradeCount } = await supabase
                .from('support_tickets')
                .select('id', { count: 'exact', head: true })
                .in('status', ['open', 'pending', 'new'])
                .eq('category', 'upgrade');

            // Fetch unread reply count from API
            let unreadReplies = 0;
            try {
                const res = await fetch('/api/admin/support-tickets?limit=1');
                const apiData = await res.json();
                unreadReplies = apiData.unreadByStatus?.total || 0;
            } catch { /* silent */ }

            const supportBadge = Math.max(supportCount || 0, unreadReplies);

            setPendingCounts({
                support: supportBadge,
                upgrades: upgradeCount || 0,
                total: supportBadge + (upgradeCount || 0),
            });

            // Fetch recent pending items for the notification panel
            const notifs: PendingNotification[] = [];

            const { data: openTickets } = await supabase
                .from('support_tickets')
                .select('id, subject, category, requester_name, created_at')
                .in('status', ['open', 'pending', 'new'])
                .order('created_at', { ascending: false })
                .limit(10);

            (openTickets || []).forEach((t: any) => {
                const isUpgrade = t.category === 'upgrade';
                notifs.push({
                    id: `${isUpgrade ? 'upgrade' : 'support'}-${t.id}`,
                    type: isUpgrade ? 'upgrade' : 'support',
                    title: isUpgrade
                        ? `⬆️ Upgrade: ${t.subject || 'Richiesta Upgrade'}`
                        : `🎧 Assistenza: ${t.subject || 'Nuovo ticket'}`,
                    message: `Da ${t.requester_name || 'Utente'}`,
                    createdAt: t.created_at,
                });
            });

            // Sort by date descending
            notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setNotifications(notifs);
        } catch (err) {
            console.error('[SuperAdmin] Error fetching pending counts:', err);
        }
    }, []);

    useEffect(() => {
        if (isLoginPage) { setLoading(false); return; }

        const checkAuth = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/superadmin/login'); return; }

            const { data: profile } = await supabase
                .from('profiles')
                .select('is_super_admin, is_support_staff')
                .eq('id', user.id)
                .single();

            if (!profile?.is_super_admin && !profile?.is_support_staff) {
                router.push('/office');
                return;
            }

            // Support staff only has access to /superadmin/support
            if (profile.is_support_staff && !profile.is_super_admin) {
                setIsSupportStaff(true);
                if (pathname !== '/superadmin/support' && pathname !== '/superadmin') {
                    router.push('/superadmin/support');
                }
            }

            setAdminEmail(user.email || '');
            setAuthorized(true);
            setLoading(false);
        };
        checkAuth();
    }, [router, isLoginPage, pathname]);

    // Fetch pending counts on mount and every 30 seconds
    useEffect(() => {
        if (!authorized || isLoginPage) return;
        fetchPendingCounts();
        const interval = setInterval(fetchPendingCounts, 30000);
        return () => clearInterval(interval);
    }, [authorized, isLoginPage, fetchPendingCounts]);

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/superadmin/login');
    };

    const totalPending = pendingCounts.support + pendingCounts.upgrades;
    const visibleNotifs = notifications.filter(n => !dismissedIds.has(n.id));

    const dismissNotif = (id: string) => {
        setDismissedIds(prev => { const next = new Set(Array.from(prev)); next.add(id); return next; });
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'ora';
        if (mins < 60) return `${mins}m fa`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h fa`;
        const days = Math.floor(hrs / 24);
        return `${days}g fa`;
    };

    // Login page — render without sidebar
    if (isLoginPage) return <>{children}</>;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!authorized) return null;

    return (
        <div className="flex h-screen bg-[#0a0e1a] text-slate-100">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/5 flex flex-col"
                style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(20px)' }}>
                <div className="p-5 border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                            <Crown className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-sm font-bold text-white tracking-wide">Cosmoffice</h1>
                            <p className="text-[10px] text-amber-300/60 font-medium uppercase tracking-widest">
                                {isSupportStaff ? 'Supporto' : 'Super Admin'}
                            </p>
                        </div>
                        {/* Notification bell */}
                        <button
                            onClick={() => setShowNotifPanel(!showNotifPanel)}
                            className="relative p-2 rounded-xl hover:bg-white/5 transition-all"
                        >
                            <Bell className={`w-4.5 h-4.5 ${totalPending > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
                            {totalPending > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                                    {totalPending}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                    {(isSupportStaff
                        ? [{
                            items: [
                                { href: '/superadmin/support', label: 'Assistenza', icon: Headphones, badgeKey: 'support' },
                            ]
                        }]
                        : navSections
                    ).map((section, si) => (
                        <div key={si}>
                            {section.label && (
                                <>
                                    {si > 0 && <div className="my-2 mx-2 border-t border-white/5" />}
                                    <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                                        {section.label}
                                    </p>
                                </>
                            )}
                            {section.items.map((item) => {
                                const isActive = !item.external && (pathname === item.href || (item.href !== '/superadmin' && pathname.startsWith(item.href)));
                                const badgeCount = item.badgeKey ? pendingCounts[item.badgeKey as keyof PendingCounts] : 0;

                                if (item.external) {
                                    return (
                                        <a
                                            key={item.href}
                                            href={item.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent"
                                        >
                                            <item.icon className="w-4 h-4" />
                                            <span className="flex-1">{item.label}</span>
                                            <ExternalLink className="w-3 h-3 text-slate-600" />
                                        </a>
                                    );
                                }
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${isActive
                                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                                            }`}
                                    >
                                        <item.icon className="w-4 h-4" />
                                        <span className="flex-1">{item.label}</span>
                                        {badgeCount > 0 && (
                                            <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1.5 shadow-[0_0_8px_rgba(239,68,68,0.4)] animate-pulse">
                                                {badgeCount}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <div className="p-3 border-t border-white/5 space-y-2">
                    {/* Admin info */}
                    <div className="px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/10">
                        <p className="text-[10px] text-amber-300/50 font-bold uppercase tracking-widest">Loggato come</p>
                        <p className="text-xs text-amber-200/80 font-medium truncate mt-0.5">{adminEmail}</p>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-red-400 transition-all"
                    >
                        <LogOut className="w-4 h-4" />
                        Esci
                    </button>
                    <CurrencySelector />
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 overflow-y-auto relative">
                {/* Top notification banner — shows when there are pending items */}
                {totalPending > 0 && (
                    <div className="sticky top-0 z-50 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border-b border-amber-500/20 backdrop-blur-xl">
                        <div className="flex items-center gap-3 px-6 py-2.5">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                                </span>
                                <span className="text-sm font-bold text-amber-300">
                                    {totalPending} {totalPending === 1 ? 'richiesta in attesa' : 'richieste in attesa'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                                {pendingCounts.support > 0 && (
                                    <Link href="/superadmin/support"
                                        className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/20 hover:bg-blue-500/30 transition-all flex items-center gap-1.5">
                                        <Headphones className="w-3 h-3" />
                                        {pendingCounts.support} assistenza
                                    </Link>
                                )}
                                {pendingCounts.upgrades > 0 && (
                                    <Link href="/superadmin/support"
                                        className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/20 hover:bg-purple-500/30 transition-all flex items-center gap-1.5">
                                        <ArrowUpCircle className="w-3 h-3" />
                                        {pendingCounts.upgrades} upgrade
                                    </Link>
                                )}
                            </div>
                            <div className="flex-1" />
                            <span className="text-[10px] text-slate-500">aggiornamento ogni 30s</span>
                        </div>
                    </div>
                )}

                {/* Notification dropdown panel */}
                {showNotifPanel && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowNotifPanel(false)} />
                        <div className="fixed left-64 top-16 z-50 w-96 max-h-[70vh] overflow-y-auto bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl shadow-black/50 backdrop-blur-xl">
                            <div className="p-4 border-b border-white/5 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Bell className="w-4 h-4 text-amber-400" />
                                    Notifiche ({visibleNotifs.length})
                                </h3>
                                <button onClick={() => setShowNotifPanel(false)} className="p-1 rounded-lg hover:bg-white/5 text-slate-500">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            {visibleNotifs.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Bell className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                                    <p className="text-sm text-slate-500">Nessuna notifica pendente</p>
                                </div>
                            ) : (
                                <div className="p-2 space-y-1">
                                    {visibleNotifs.map((notif) => (
                                        <div key={notif.id}
                                            className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-all group cursor-pointer"
                                            onClick={() => {
                                                setShowNotifPanel(false);
                                                router.push('/superadmin/support');
                                            }}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${notif.type === 'support'
                                                ? 'bg-blue-500/20 text-blue-400'
                                                : 'bg-purple-500/20 text-purple-400'
                                                }`}>
                                                {notif.type === 'support'
                                                    ? <Headphones className="w-4 h-4" />
                                                    : <ArrowUpCircle className="w-4 h-4" />
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-white truncate">{notif.title}</p>
                                                <p className="text-[11px] text-slate-400 truncate mt-0.5">{notif.message}</p>
                                                <p className="text-[10px] text-slate-600 mt-1">{timeAgo(notif.createdAt)}</p>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); dismissNotif(notif.id); }}
                                                className="p-1 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {children}
            </main>
        </div>
    );
}
