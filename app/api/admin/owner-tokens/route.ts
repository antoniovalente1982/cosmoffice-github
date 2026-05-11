import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../utils/supabase/admin';

export async function POST(req: NextRequest) {
    const supabase = createAdminClient();

    // Verify caller is super admin
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (token) {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .single();
        if (!profile?.is_super_admin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    const body = await req.json();
    const { email, max_workspaces, max_capacity, notes } = body;

    // Create token
    const { data: tokenData, error } = await supabase
        .from('owner_registration_tokens')
        .insert({
            email: email || null,
            max_workspaces: max_workspaces || 1,
            max_capacity: max_capacity || 50,
            notes: notes || null,
        })
        .select('id, token')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const registrationUrl = `${baseUrl}/register/owner?token=${tokenData.token}`;

    return NextResponse.json({
        success: true,
        token: tokenData.token,
        url: registrationUrl,
    });
}

// GET: List all tokens (for SuperAdmin)
export async function GET(req: NextRequest) {
    const supabase = createAdminClient();

    const { data: tokens, error } = await supabase
        .from('owner_registration_tokens')
        .select('id, token, email, max_workspaces, max_capacity, notes, created_at, expires_at, used_at, used_by')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tokens });
}
