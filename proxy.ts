import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Session refresh on every request.
 *
 * Next 16 renamed the `middleware` file convention to `proxy` -- same job, and
 * it now defaults to the Node.js runtime (setting `runtime` here throws).
 *
 * Access tokens expire after `jwt_expiry` (an hour, per supabase/config.toml).
 * Server Components can read cookies but cannot write them, so a token that
 * expires mid-session can never be refreshed from a page render: the user is
 * silently signed out until something else writes a cookie. Refreshing here --
 * before anything renders -- is the only place in the App Router that can both
 * detect the expiry and persist the new token.
 *
 * `getUser()` rather than `getSession()`: it revalidates the token against the
 * auth server instead of trusting whatever the cookie claims, and it triggers
 * the same refresh as a side effect.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Written to the request as well as the response: without the first
          // half, Server Components rendering later in *this* request still
          // read the stale token and see a signed-out user for one page load.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  /**
   * Without a matcher this runs on every request including static assets. The
   * negative lookahead skips Next's own asset routes and anything with a file
   * extension, so images and fonts don't each pay for an auth round-trip.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)'],
};
