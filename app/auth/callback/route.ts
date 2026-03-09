// ============================================
// AUTH CALLBACK ROUTE
// Handles magic link / email confirmation redirects
// Exchanges token_hash for a session, then redirects
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const token_hash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type') as string;
    const next = url.searchParams.get('next') || '/office';

    if (!token_hash || !type) {
        return NextResponse.redirect(new URL('/login?error=invalid_link', req.url));
    }

    const res = NextResponse.redirect(new URL(next, req.url));

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return req.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    res.cookies.set({ name, value, ...options });
                },
                remove(name: string, options: CookieOptions) {
                    res.cookies.set({ name, value: '', ...options });
                },
            },
        }
    );

    const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as any,
    });

    if (error) {
        console.error('[auth/callback] verifyOtp error:', error.message);
        return NextResponse.redirect(
            new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url)
        );
    }

    return res;
}
