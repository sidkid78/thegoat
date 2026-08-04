import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { constructStripeEvent } from '@/lib/integrations/stripe';

export const runtime = 'nodejs';

/**
 * Stripe calls this directly (no browser session), so it authenticates via
 * signature verification, not cookies -- and writes with the service-role
 * key, which carries BYPASSRLS, since there is no authenticated user to
 * check offers RLS against.
 */
function getServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  // Signature verification needs the raw, unparsed body -- req.json() would
  // re-serialize it and break the signature check.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = constructStripeEvent(rawBody, signature);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    console.error('Stripe webhook signature verification failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const offerId = session.metadata?.offerId;

    if (offerId && session.metadata?.type === 'earnest_money_deposit') {
      const supabase = getServiceRoleClient();
      const { error } = await supabase
        .from('offers')
        .update({
          stripe_checkout_session_id: session.id,
          earnest_money_paid_at: new Date().toISOString(),
        })
        .eq('id', Number(offerId));

      if (error) {
        console.error('Failed to record earnest money payment:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
