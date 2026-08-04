import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not allowed outside development mode' }, { status: 403 });
  }

  const supabase = await createClient();

  const url = new URL(req.url);
  const asBuyer = url.searchParams.get('as') === 'buyer';

  // Drop any existing session first. `npx supabase db reset` wipes auth.users
  // while the browser keeps its cookies, leaving a refresh token that no longer
  // resolves -- every later request then fails with "Invalid Refresh Token" and
  // the new sign-in never takes hold. Switching roles has the same problem in
  // miniature, so clear before signing in rather than layering on top.
  await supabase.auth.signOut();

  // Login as one of the two seed users.
  const { error } = await supabase.auth.signInWithPassword({
    email: asBuyer ? 'buyer.alex@dwellingly.ai' : 'seller.sarah@dwellingly.ai',
    password: 'password123',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // `next` lets the navbar's account switcher drop you back where you were
  // instead of bouncing to /search. Relative paths only -- an absolute URL here
  // would turn this into an open redirect.
  const next = url.searchParams.get('next');
  const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/search';

  return NextResponse.redirect(new URL(destination, url.origin));
}
