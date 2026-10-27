import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { isCategory } from '@/lib/packs/categories';

export async function proxy(request: NextRequest) {
  // Links from before categories had their own address: /gallery?category=games
  // -> /gallery/games, keeping the rest of the query. Done here, not in the
  // page: on Vercel a `category` query parameter collides with the route's own
  // [[...category]] parameter and never reaches the page.
  const { pathname, searchParams } = request.nextUrl;
  const legacy = searchParams.get('category');
  if (pathname === '/gallery' && isCategory(legacy)) {
    const url = request.nextUrl.clone();
    url.pathname = `/gallery/${legacy}`;
    url.searchParams.delete('category');
    return NextResponse.redirect(url, 308);
  }
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
