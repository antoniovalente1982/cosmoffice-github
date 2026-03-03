'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    LayoutDashboard,
    Users,
    Shield,
    Bug,
    Video,
    DollarSign,
    ScrollText,
    ArrowLeft,
    Rocket,
    Crown,
} from 'lucide-react';
import { createClient } from '../../utils/supabase/client';

const navItems = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/customers', label: 'Clienti', icon: Users },
    { href: '/admin/security', label: 'Sicurezza', icon: Shield },
    { href: '/admin/bugs', label: 'Bug Reports', icon: Bug },
    { href: '/admin/daily', label: 'Daily.co', icon: Video },
    { href: '/admin/revenue', label: 'Revenue', icon: DollarSign },
    { href: '/admin/audit', label: 'Audit Log', icon: ScrollText },
    { href: '/admin/transfer', label: 'Gestione Super Admin', icon: Crown },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/login'); return; }

            const { data: profile } = await supabase
                .from('profiles')
                .select('is_super_admin')
                .eq('id', user.id)
                .single();

            if (!profile?.is_super_admin) {
                router.push('/office');
                return;
            }

            setAuthorized(true);
            setLoading(false);
        };
        checkAuth();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
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
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                            <Rocket className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-white tracking-wide">Cosmoffice</h1>
                            <p className="text-[10px] text-cyan-300/60 font-medium uppercase tracking-widest">Admin Panel</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-3 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.1)]'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                                    }`}
                            >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-3 border-t border-white/5">
                    <Link
                        href="/office"
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Torna all'Office
                    </Link>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
