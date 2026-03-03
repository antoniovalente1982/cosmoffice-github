import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createBrowserClient } from '../../../../utils/supabase/server';

// Use service-role client for admin operations (bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getAuthenticatedSuperAdmin(req: NextRequest) {
    const supabase = await createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, is_super_admin, email, full_name, display_name')
        .eq('id', user.id)
        .single();

    if (!profile?.is_super_admin) return null;
    return profile;
}

// GET — List all users (for the transfer picker) + transfer history
export async function GET(req: NextRequest) {
    const admin = await getAuthenticatedSuperAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'history') {
        // Fetch transfer history
        const { data: transfers, error } = await supabaseAdmin
            .from('admin_transfers')
            .select(`
                id,
                transfer_type,
                reason,
                created_at,
                from_user:from_user_id (id, email, full_name, display_name, avatar_url),
                to_user:to_user_id (id, email, full_name, display_name, avatar_url)
            `)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ transfers });
    }

    if (action === 'admins') {
        // List current superadmins
        const { data: admins, error } = await supabaseAdmin
            .from('profiles')
            .select('id, email, full_name, display_name, avatar_url, is_super_admin')
            .eq('is_super_admin', true);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ admins, currentUserId: admin.id });
    }

    // Default: search users for transfer target
    const search = searchParams.get('search') || '';
    let query = supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, display_name, avatar_url, is_super_admin')
        .neq('id', admin.id)
        .order('created_at', { ascending: false })
        .limit(20);

    if (search) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    const { data: users, error } = await query;
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users, currentUserId: admin.id });
}

// POST — Execute a transfer action
export async function POST(req: NextRequest) {
    const admin = await getAuthenticatedSuperAdmin(req);
    if (!admin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action, targetUserId, reason } = body;

    if (!targetUserId) {
        return NextResponse.json({ error: 'Target user required' }, { status: 400 });
    }

    // Verify target user exists
    const { data: targetUser } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, display_name, is_super_admin')
        .eq('id', targetUserId)
        .single();

    if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (action === 'transfer') {
        // Full transfer: grant to target, revoke from self
        // Safety: ensure target is not already the only admin
        const { data: currentAdmins } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('is_super_admin', true);

        // Grant to target
        const { error: grantError } = await supabaseAdmin
            .from('profiles')
            .update({ is_super_admin: true })
            .eq('id', targetUserId);

        if (grantError) {
            return NextResponse.json({ error: grantError.message }, { status: 500 });
        }

        // Revoke from self
        const { error: revokeError } = await supabaseAdmin
            .from('profiles')
            .update({ is_super_admin: false })
            .eq('id', admin.id);

        if (revokeError) {
            // Rollback: remove grant from target
            await supabaseAdmin.from('profiles').update({ is_super_admin: false }).eq('id', targetUserId);
            return NextResponse.json({ error: revokeError.message }, { status: 500 });
        }

        // Log the transfer
        await supabaseAdmin.from('admin_transfers').insert({
            from_user_id: admin.id,
            to_user_id: targetUserId,
            transfer_type: 'transfer',
            reason: reason || 'Ownership transfer',
        });

        return NextResponse.json({ success: true, message: 'Ownership transferred successfully' });

    } else if (action === 'grant') {
        // Add an additional superadmin
        if (targetUser.is_super_admin) {
            return NextResponse.json({ error: 'User is already a super admin' }, { status: 400 });
        }

        const { error: grantError } = await supabaseAdmin
            .from('profiles')
            .update({ is_super_admin: true })
            .eq('id', targetUserId);

        if (grantError) {
            return NextResponse.json({ error: grantError.message }, { status: 500 });
        }

        await supabaseAdmin.from('admin_transfers').insert({
            from_user_id: admin.id,
            to_user_id: targetUserId,
            transfer_type: 'grant',
            reason: reason || 'Granted super admin access',
        });

        return NextResponse.json({ success: true, message: 'Super admin access granted' });

    } else if (action === 'revoke') {
        // Remove superadmin from a user (can't revoke self if last admin)
        if (targetUserId === admin.id) {
            return NextResponse.json({ error: 'Cannot revoke your own admin access from here. Use transfer instead.' }, { status: 400 });
        }

        if (!targetUser.is_super_admin) {
            return NextResponse.json({ error: 'User is not a super admin' }, { status: 400 });
        }

        // Safety: ensure at least one admin remains
        const { data: adminCount } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('is_super_admin', true);

        if ((adminCount?.length || 0) <= 1) {
            return NextResponse.json({ error: 'Cannot revoke the last super admin' }, { status: 400 });
        }

        const { error: revokeError } = await supabaseAdmin
            .from('profiles')
            .update({ is_super_admin: false })
            .eq('id', targetUserId);

        if (revokeError) {
            return NextResponse.json({ error: revokeError.message }, { status: 500 });
        }

        await supabaseAdmin.from('admin_transfers').insert({
            from_user_id: admin.id,
            to_user_id: targetUserId,
            transfer_type: 'revoke',
            reason: reason || 'Revoked super admin access',
        });

        return NextResponse.json({ success: true, message: 'Super admin access revoked' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
