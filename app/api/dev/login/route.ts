import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not allowed outside development mode' }, { status: 403 });
  }

  const supabase = await createClient();

  const url = new URL(req.url);
  const asBuyer = url.searchParams.get('as') === 'buyer';

  // Login as one of the two seed users.
  const { error } = await supabase.auth.signInWithPassword({
    email: asBuyer ? 'buyer.alex@dwellingly.ai' : 'seller.sarah@dwellingly.ai',
    password: 'password123',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Redirect to the home page or search page
  return NextResponse.redirect(new URL('/search', url.origin));
}
