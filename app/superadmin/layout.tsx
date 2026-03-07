'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
    LayoutDashboard,
    Users,
    Shield,
    Bug,
    Video,
    DollarSign,
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
} from 'lucide-react';
import { createClient } from '../../utils/supabase/client';

interface NavItem { href: string; label: string; icon: any; external?: boolean; }
interface NavSection { label?: string; items: NavItem[]; }

const navSections: NavSection[] = [
    {
        items: [
            { href: '/superadmin', label: 'Overview', icon: LayoutDashboard },
        ],
    },
    {
        label: 'Gestione',
        items: [
            { href: '/superadmin/customers', label: 'Gestionale Clienti', icon: BookUser },
            { href: '/superadmin/upgrade-requests', label: 'Richieste Upgrade', icon: ArrowUpCircle },
        ],
    },
    {
        label: 'Monetizzazione',
        items: [
            { href: '/superadmin/revenue', label: 'Revenue', icon: DollarSign },
            { href: '/superadmin/infrastructure', label: 'Infrastruttura & Costi', icon: Server },
            { href: '/superadmin/payments', label: 'Setup Pagamenti', icon: CreditCard },
        ],
    },
    {
        label: 'Monitoraggio',
        items: [
            { href: '/superadmin/security', label: 'Sicurezza', icon: Shield },
            { href: '/superadmin/bugs', label: 'Bug Reports', icon: Bug },
            { href: '/superadmin/audit', label: 'Audit Log', icon: ScrollText },
        ],
    },
    {
        label: 'Integrazioni',
        items: [
            { href: '/superadmin/daily', label: 'LiveKit', icon: Video },
            { href: 'https://supabase.com/dashboard', label: 'Supabase', icon: Database, external: true },
            { href: 'https://vercel.com/dashboard', label: 'Vercel', icon: Globe, external: true },
            { href: 'https://partykit.io/dashboard', label: 'PartyKit', icon: Wifi, external: true },
            { href: '/superadmin/email', label: 'Email (Resend)', icon: Mail },
        ],
    },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [adminEmail, setAdminEmail] = useState('');

    // Login page: skip auth checks, render directly without sidebar
    const isLoginPage = pathname === '/superadmin/login';

    useEffect(() => {
        if (isLoginPage) { setLoading(false); return; }

        const checkAuth = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/superadmin/login'); return; }

            const { data: profile } = await supabase
                .from('profiles')
                .select('is_super_admin')
                .eq('id', user.id)
                .single();

            if (!profile?.is_super_admin) {
                router.push('/office');
                return;
            }

            setAdminEmail(user.email || '');
            setAuthorized(true);
            setLoading(false);
        };
        checkAuth();
    }, [router, isLoginPage]);

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/superadmin/login');
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
                        <div>
                            <h1 className="text-sm font-bold text-white tracking-wide">Cosmoffice</h1>
                            <p className="text-[10px] text-amber-300/60 font-medium uppercase tracking-widest">Super Admin</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                    {navSections.map((section, si) => (
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
                                        {item.label}
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
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
