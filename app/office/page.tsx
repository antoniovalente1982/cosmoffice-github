'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
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
    Check
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

export default function DashboardPage() {
    const supabase = createClient();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [spaces, setSpaces] = useState<any[]>([]);
    const [isCreatingOrg, setIsCreatingOrg] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingSpace, setEditingSpace] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [spaceMenuOpen, setSpaceMenuOpen] = useState<string | null>(null);

    useEffect(() => {
        const initDashboard = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }
            setUser(user);

            // Fetch organizations from both memberships AND created orgs to be safe
            const [membersRes, createdRes] = await Promise.all([
                supabase.from('organization_members').select('org_id, organizations(*)').eq('user_id', user.id),
                supabase.from('organizations').select('*').eq('created_by', user.id)
            ]);

            const memberOrgs = membersRes.data?.map(m => m.organizations).filter(Boolean) || [];
            const createdOrgs = createdRes.data || [];

            // Merge and deduplicate by ID
            const allOrgsMap = new Map();
            [...memberOrgs, ...createdOrgs].forEach(o => allOrgsMap.set(o.id, o));
            const orgs = Array.from(allOrgsMap.values());

            setOrganizations(orgs);

            // Fetch spaces for these organizations
            if (orgs.length > 0) {
                const orgIds = orgs.map((o: any) => o.id);
                const { data: activeSpaces } = await supabase
                    .from('spaces')
                    .select('*')
                    .in('org_id', orgIds);
                setSpaces(activeSpaces || []);
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

    const handleCreateOrg = async () => {
        if (!newOrgName || !user || isSubmitting) return;

        setIsSubmitting(true);
        setError(null);

        const baseSlug = newOrgName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        let slug = baseSlug || 'org';

        try {
            // STEP 1: Create Organization
            let { data: org, error: orgError } = await supabase
                .from('organizations')
                .insert({
                    name: newOrgName,
                    slug,
                    created_by: user.id
                })
                .select()
                .single();

            // If it's a duplicate slug error, try once more with a random suffix
            if (orgError && orgError.code === '23505') {
                const randomSuffix = Math.random().toString(36).substring(2, 6);
                slug = `${baseSlug}-${randomSuffix}`;

                const { data: retryOrg, error: retryError } = await supabase
                    .from('organizations')
                    .insert({
                        name: newOrgName,
                        slug,
                        created_by: user.id
                    })
                    .select()
                    .single();

                org = retryOrg;
                orgError = retryError;
            }

            if (orgError) throw orgError;
            if (!org) throw new Error('Failed to create organization');

            // STEP 2: Create default space
            const { data: space, error: spaceError } = await supabase
                .from('spaces')
                .insert({
                    org_id: org.id,
                    name: 'General Office'
                })
                .select()
                .single();

            if (spaceError) throw spaceError;
            if (!space) throw new Error('Failed to create default space');

            // STEP 3: Create default rooms for the space
            const defaultRooms = [
                { space_id: space.id, name: 'Lobby', type: 'reception', x: 400, y: 400, width: 250, height: 200 },
                { space_id: space.id, name: 'Coffee Break', type: 'break', x: 700, y: 400, width: 200, height: 200 },
                { space_id: space.id, name: 'Deep Work', type: 'focus', x: 400, y: 700, width: 300, height: 250 },
                { space_id: space.id, name: 'Design Hub', type: 'meeting', x: 750, y: 700, width: 250, height: 250 }
            ];

            const { error: roomsError } = await supabase
                .from('rooms')
                .insert(defaultRooms);

            if (roomsError) console.warn('Failed to create default rooms:', roomsError);

            // Navigate immediately to the new space
            router.push(`/office/${space.id}`);

            setIsCreatingOrg(false);
            setNewOrgName('');
        } catch (err: any) {
            console.error('Error creating organization:', err);
            let message = err.message || 'An unexpected error occurred';
            if (err.code === '23505') {
                message = 'An organization with this slug already exists. Please try a different name.';
            }
            setError(`Creation failed: ${message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    const handleDeleteSpace = async (spaceId: string) => {
        if (!confirm('Sei sicuro di voler cancellare questo ufficio? Questa azione non può essere annullata.')) {
            return;
        }
        
        try {
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
            alert('Errore durante la cancellazione: ' + err.message);
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
            alert('Errore durante l\'aggiornamento: ' + err.message);
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
        <div className="min-h-screen bg-transparent text-slate-100 p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center shadow-lg">
                            <span className="text-white font-bold">C</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gradient">My Workspaces</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="outline" className="gap-2" onClick={() => setIsCreatingOrg(true)}>
                            <Plus className="w-4 h-4" /> New Organization
                        </Button>
                        <div className="w-px h-6 bg-white/10 mx-2"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <p className="text-sm font-medium">{user?.user_metadata?.full_name || 'User'}</p>
                                <p className="text-xs text-slate-500">{user?.email}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-slate-500 hover:text-red-400">
                                <LogOut className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </div>

                {isCreatingOrg && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="glass p-6 rounded-2xl border border-primary-500/20 max-w-md mx-auto">
                        <h2 className="text-lg font-semibold mb-4">Create New Organization</h2>
                        <input
                            type="text"
                            placeholder="Org Name (e.g. Acme Corp)"
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2 mb-4 focus:border-primary-500 outline-none"
                            value={newOrgName}
                            onChange={(e) => setNewOrgName(e.target.value)}
                        />
                        {error && (
                            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Button className="flex-1" onClick={handleCreateOrg} disabled={isSubmitting}>
                                {isSubmitting ? 'Creating...' : 'Create'}
                            </Button>
                            <Button variant="ghost" className="flex-1" onClick={() => setIsCreatingOrg(false)} disabled={isSubmitting}>Cancel</Button>
                        </div>
                    </motion.div>
                )}

                {/* Organizations & Spaces */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {spaces.map((space) => {
                        const org = organizations.find(o => o.id === space.org_id);
                        const isEditing = editingSpace === space.id;
                        const isMenuOpen = spaceMenuOpen === space.id;
                        
                        return (
                            <motion.div key={space.id} whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
                                <Card className="p-6 h-full flex flex-col justify-between group hover:border-primary-500/50 transition-all border-white/5 bg-slate-900/40 backdrop-blur-xl relative">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-400">
                                                <Building2 className="w-6 h-6" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                                                    Active
                                                </div>
                                                {/* Menu pulsante */}
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
                                                        <div className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-white/10 rounded-xl shadow-xl z-20 py-1">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    startEditing(space);
                                                                }}
                                                                className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-white/5 flex items-center gap-2"
                                                            >
                                                                <Edit2 className="w-4 h-4" /> Modifica nome
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteSpace(space.id);
                                                                }}
                                                                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/5 flex items-center gap-2"
                                                            >
                                                                <Trash2 className="w-4 h-4" /> Elimina
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
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
                                                <div onClick={() => router.push(`/office/${space.id}`)} className="cursor-pointer">
                                                    <h3 className="text-xl font-bold text-slate-100 group-hover:text-primary-400 transition-colors">{space.name}</h3>
                                                    <p className="text-slate-400 text-sm flex items-center gap-1 mt-1">
                                                        <Globe className="w-3 h-3" /> {org?.name}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div 
                                        className="mt-8 flex items-center justify-between pt-4 border-t border-white/5 cursor-pointer"
                                        onClick={() => router.push(`/office/${space.id}`)}
                                    >
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Users className="w-4 h-4" /> Team Active
                                        </div>
                                        <div className="text-primary-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                                            <ArrowRight className="w-5 h-5" />
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        );
                    })}

                    <motion.div whileHover={{ scale: 1.02 }}>
                        <Card className="p-6 h-full flex flex-col items-center justify-center border-dashed border-white/10 bg-white/5 hover:bg-white/10 transition-all min-h-[220px] group cursor-pointer" onClick={() => setIsCreatingOrg(true)}>
                            <PlusCircle className="w-12 h-12 text-slate-500 group-hover:text-primary-400 transition-colors mb-4" />
                            <p className="text-slate-400 font-medium group-hover:text-slate-200">New Space</p>
                        </Card>
                    </motion.div>
                </div>

                {organizations.length === 0 && !loading && (
                    <div className="text-center py-20 glass rounded-3xl border-white/5">
                        <Building2 className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-200">No organizations found</h2>
                        <p className="text-slate-500 mb-8">Create your first organization to start your virtual office</p>
                        <Button size="lg" onClick={() => setIsCreatingOrg(true)}>Get Started</Button>
                    </div>
                )}
            </div>
        </div>
    );
}

