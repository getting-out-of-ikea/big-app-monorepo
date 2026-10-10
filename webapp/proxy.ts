import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const publicPaths = ['/login', '/register'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, { ...options, path: '/' });
          });
        },
      },
    }
  );

  // getUser() valida il JWT contattando il server Supabase,
  // come faceva safeGetSession nel vecchio progetto.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = publicPaths.includes(pathname);

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url), 303);
  }

  if (user && isPublic) {
    return NextResponse.redirect(new URL('/room', request.url), 303);
  }

  return response;
}

export const config = {
  matcher: [
    // Esclude asset statici e immagini, che restano pubblici
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
