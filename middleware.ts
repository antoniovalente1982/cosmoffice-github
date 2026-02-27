// ============================================
// MIDDLEWARE NEXT.JS
// Protezione route e redirect automatici
// Using @supabase/ssr (modern approach)
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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;

  // Public routes
  const isPublicRoute = 
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/invite') ||
    pathname === '/';

  // API routes
  const isApiRoute = pathname.startsWith('/api');

  // Static files
  const isStaticFile = 
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.');

  if (isStaticFile || isApiRoute) {
    return res;
  }

  // Not authenticated
  if (!session) {
    if (isPublicRoute) {
      return res;
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Authenticated
  if (isPublicRoute && pathname !== '/') {
    return NextResponse.redirect(new URL('/office', req.url));
  }

  // Workspace routes - check membership
  if (pathname.startsWith('/w/')) {
    const workspaceSlug = pathname.split('/')[2];
    
    if (workspaceSlug) {
      // Get workspace
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('slug', workspaceSlug)
        .single();

      if (!workspace) {
        return NextResponse.redirect(new URL('/404', req.url));
      }

      // Check if member
      const { data: member } = await supabase
        .from('workspace_members')
        .select('role, is_suspended, removed_at')
        .eq('workspace_id', workspace.id)
        .eq('user_id', session.user.id)
        .single();

      if (!member || member.removed_at || member.is_suspended) {
        // Check if banned
        const { data: isBanned } = await supabase.rpc('is_user_banned', {
          p_workspace_id: workspace.id,
          p_user_id: session.user.id,
        });

        if (isBanned) {
          return NextResponse.redirect(
            new URL(`/banned?workspace=${workspaceSlug}`, req.url)
          );
        }

        // Not a member - redirect to join page
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
