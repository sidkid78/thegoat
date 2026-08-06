/**
 * Keeps a `?next=` destination from becoming an open redirect. Only same-site
 * absolute paths survive; `//evil.com` is protocol-relative and would leave the
 * site, so it's rejected alongside fully-qualified URLs.
 *
 * Lives here rather than in `app/actions/auth.ts` because everything exported
 * from a `'use server'` module becomes a callable server-action endpoint, and a
 * pure string helper has no business being reachable over the network.
 */
export function safeRedirectPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/search';
  return next;
}
