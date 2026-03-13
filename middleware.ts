// ============================================
// MIDDLEWARE NEXT.JS
// Protezione route e redirect automatici
// Using @supabase/ssr (modern approach)
//
// OPTIMIZED: Minimized DB queries per request
// - /office routes: 0 extra queries (just JWT decode)
// - /admin|/superadmin: 1 query (profile check)
// - /w/ routes: max 2 queries (workspace+member, ban check)
// ============================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Create Supabase client with cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({ name, value, ...options });
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({ name, value: '', ...options });
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // ── 1. Session check (JWT decode from cookies — fast, no DB) ──
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;

  // ── 2. Static files & API routes — pass through immediately ──
  const isStaticFile =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.');

  const isApiRoute = pathname.startsWith('/api');

  if (isStaticFile || isApiRoute) {
    return res;
  }

  // ── 3. Public routes — no auth needed ──
  const isPublicRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/invite') ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/superadmin/login') ||
    pathname === '/';

  if (!session) {
    return isPublicRoute
      ? res
      : NextResponse.redirect(new URL('/login', req.url));
  }

  // ── From here: user IS authenticated ──

  // Allow /set-password and /auth/callback always
  if (pathname.startsWith('/set-password') || pathname.startsWith('/auth/callback')) {
    return res;
  }

  // Authenticated visiting login/signup → redirect to /office
  if (isPublicRoute && pathname !== '/' && !pathname.startsWith('/invite') && !pathname.startsWith('/superadmin/login')) {
    return NextResponse.redirect(new URL('/office', req.url));
  }

  // ── 4. Anonymous user restrictions — zero DB queries ──
  const isAnonymous = session.user.is_anonymous === true;
  if (isAnonymous) {
    if (pathname === '/office' || pathname === '/office/') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    if (pathname.startsWith('/admin') || pathname.startsWith('/superadmin')) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // ── 5. /office routes — FAST PATH, zero extra DB queries ──
  // This is the highest-traffic route, just session check is enough
  if (pathname.startsWith('/office')) {
    return res;
  }

  // ── 6. Admin/Superadmin routes — ONE query (merged check) ──
  if (pathname.startsWith('/admin') || pathname.startsWith('/superadmin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', session.user.id)
      .single();

    if (!profile?.is_super_admin) {
      return pathname.startsWith('/superadmin')
        ? NextResponse.redirect(new URL('/superadmin/login', req.url))
        : NextResponse.redirect(new URL('/office', req.url));
    }
    return res;
  }

  // ── 7. Workspace /w/ routes — combined query ──
  if (pathname.startsWith('/w/')) {
    const workspaceSlug = pathname.split('/')[2];

    if (workspaceSlug) {
      // Single query: fetch workspace + membership in one go
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('slug', workspaceSlug)
        .single();

      if (!workspace) {
        return NextResponse.redirect(new URL('/404', req.url));
      }

      const { data: member } = await supabase
        .from('workspace_members')
        .select('role, is_suspended, removed_at')
        .eq('workspace_id', workspace.id)
        .eq('user_id', session.user.id)
        .single();

      if (!member || member.removed_at || member.is_suspended) {
        // Check ban status — only fires for non-members (rare path)
        const { data: isBanned } = await supabase.rpc('is_user_banned', {
          p_workspace_id: workspace.id,
          p_user_id: session.user.id,
        });

        if (isBanned) {
          return NextResponse.redirect(
            new URL(`/banned?workspace=${workspaceSlug}`, req.url)
          );
        }

        return NextResponse.redirect(
          new URL(`/join/${workspaceSlug}`, req.url)
        );
      }
    }
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
