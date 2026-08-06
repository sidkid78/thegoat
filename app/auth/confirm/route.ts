import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeRedirectPath } from '@/lib/safe-redirect';

/**
 * Where email links land: signup confirmation, password recovery, email change.
 *
 * Two shapes arrive here and both are handled, because which one you get
 * depends on the email template rather than on anything in this codebase:
 *
 * - `?token_hash=...&type=signup` — what `supabase/templates/confirmation.html`
 *   sends. Verified with `verifyOtp`.
 * - `?code=...` — what Supabase's *default* template produces, since
 *   `@supabase/ssr` forces `flowType: 'pkce'` and its hosted verify endpoint
 *   redirects back with a PKCE code. Exchanged with `exchangeCodeForSession`.
 *
 * Handling only one of them means a template change silently breaks signup, and
 * the failure surfaces as a dead link in a real user's inbox rather than
 * anywhere a developer would notice.
 *
 * Either way the session cookie is written by the server client here, so the
 * user lands already signed in.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const next = resolveNext(searchParams.get('next'), origin);

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
    return NextResponse.redirect(new URL(loginWithError(error.message, next), origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    return NextResponse.redirect(new URL(loginWithError(error.message, next), origin));
  }

  return NextResponse.redirect(
    new URL(loginWithError('That confirmation link is missing its token.', next), origin)
  );
}

/**
 * `emailRedirectTo` must be an absolute URL, so `{{ .RedirectTo }}` arrives here
 * fully qualified while `safeRedirectPath` only accepts paths. Same-origin URLs
 * are reduced to their path; anything else falls through to the default, which
 * is what stops a crafted link from bouncing a freshly-confirmed user offsite.
 */
function resolveNext(raw: string | null, origin: string): string {
  if (!raw) return safeRedirectPath(null);
  try {
    const url = new URL(raw, origin);
    if (url.origin === origin) return safeRedirectPath(url.pathname + url.search);
  } catch {
    // Not a URL; fall through and let safeRedirectPath judge it as a path.
  }
  return safeRedirectPath(raw);
}

/**
 * Failures land on the sign-in form carrying the reason. An expired or
 * already-used link is the common case and the user needs to be told which,
 * not dropped on a generic page.
 */
function loginWithError(message: string, next: string): string {
  const params = new URLSearchParams({ error: message });
  if (next !== '/search') params.set('next', next);
  return `/login?${params.toString()}`;
}
