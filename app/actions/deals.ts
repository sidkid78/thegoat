'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  generateNegotiationStrategy,
  type NegotiationStrategy,
} from '@/lib/ai/negotiation';
import { sendOfferStatusSMS } from '@/lib/integrations/twilio';

/**
 * Every participant check funnels through here so the three actions agree.
 * The `ok` discriminant is explicit rather than relying on `'error' in ctx`:
 * the success branch carries no `error` key, so TypeScript widens `ctx.error`
 * to `string | undefined` at each call site without it.
 */
type DealContext =
  | { ok: false; error: string }
  | {
      ok: true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      offer: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      property: any;
      isBuyer: boolean;
      isSeller: boolean;
    };

async function loadDealContext(offerId: number): Promise<DealContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Authentication required' };

  const { data: offer, error } = await supabase
    .from('offers')
    .select(
      'id, property_id, buyer_id, offer_amount, earnest_money, contingencies, proposed_closing_date, financing_type, status, counter_amount, counter_concession, counter_notes, countered_at, properties (id, address, city, state, zip_code, price, owner_id)'
    )
    .eq('id', offerId)
    .single();

  if (error || !offer) return { ok: false, error: error?.message || 'Offer not found' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const property = offer.properties as any;
  const isBuyer = offer.buyer_id === user.id;
  const isSeller = property?.owner_id === user.id;

  // RLS would already block the read, but the checks below depend on knowing
  // *which* side the caller is, so resolve it explicitly.
  if (!isBuyer && !isSeller) return { ok: false, error: 'Not a participant in this deal' };

  return { ok: true, supabase, user, offer, property, isBuyer, isSeller };
}

export async function sendDealMessageAction(offerId: number, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return { success: false as const, error: 'Message cannot be empty' };

  const ctx = await loadDealContext(offerId);
  if (!ctx.ok) return { success: false as const, error: ctx.error };

  // Returns the row so the sender can append it immediately. Relying on the
  // Realtime echo for your own message means staring at an empty thread until
  // the socket round-trips -- and at nothing at all if the socket is down.
  const { data, error } = await ctx.supabase
    .from('offer_messages')
    .insert({
      offer_id: offerId,
      sender_id: ctx.user.id,
      body: trimmed,
    })
    .select('id, body, sender_id, created_at')
    .single();

  if (error) return { success: false as const, error: error.message };

  // The thread itself updates over Realtime; this is for anything server-rendered
  // on the page around it.
  revalidatePath(`/deals/${offerId}`);
  return { success: true as const, message: data };
}

/**
 * Seller-only. Records counter terms and moves the offer to `countered`.
 *
 * The buyer isn't allowed to counter here: in this app countering is the
 * seller's response to a submitted offer, and letting either side write these
 * columns would make `counter_amount` ambiguous about who proposed it.
 */
export async function counterOfferAction(
  offerId: number,
  terms: { counterAmount: number; concession: number; notes: string }
) {
  const ctx = await loadDealContext(offerId);
  if (!ctx.ok) return { success: false as const, error: ctx.error };
  if (!ctx.isSeller) return { success: false as const, error: 'Only the seller can counter an offer' };
  if (ctx.offer.status !== 'submitted' && ctx.offer.status !== 'countered') {
    return { success: false as const, error: `Cannot counter an offer that is ${ctx.offer.status}` };
  }
  if (!(terms.counterAmount > 0)) {
    return { success: false as const, error: 'Counter amount must be greater than zero' };
  }
  if (terms.concession < 0) {
    return { success: false as const, error: 'Concession cannot be negative' };
  }

  const { error } = await ctx.supabase
    .from('offers')
    .update({
      status: 'countered',
      counter_amount: terms.counterAmount,
      counter_concession: terms.concession,
      counter_notes: terms.notes || null,
      countered_at: new Date().toISOString(),
    })
    .eq('id', offerId);

  if (error) return { success: false as const, error: error.message };

  // Posted as a message too, so the counter shows up in the negotiation record
  // rather than silently changing a panel the other party may not be looking at.
  const concessionNote = terms.concession > 0
    ? ` with a $${terms.concession.toLocaleString()} credit`
    : '';
  await ctx.supabase.from('offer_messages').insert({
    offer_id: offerId,
    sender_id: ctx.user.id,
    body: `Counter-offer sent: $${terms.counterAmount.toLocaleString()}${concessionNote}.${terms.notes ? ` ${terms.notes}` : ''}`,
  });

  // Notify the buyer their offer was countered. The thread updates over
  // Realtime, but only for a buyer who happens to have the page open.
  const { data: buyer } = await ctx.supabase
    .from('profiles')
    .select('phone')
    .eq('id', ctx.offer.buyer_id)
    .single();

  await sendOfferStatusSMS(
    buyer?.phone,
    ctx.property?.address ?? '',
    'countered',
    Number(ctx.offer.offer_amount)
  );

  revalidatePath(`/deals/${offerId}`);
  revalidatePath('/dashboard/offers');
  revalidatePath('/dashboard/offers/[propertyId]', 'page');
  revalidatePath('/dashboard');
  return { success: true as const };
}

/**
 * Seller-only. On demand rather than on page load -- it's a paid reasoning call
 * and the seller reloads this page far more often than the terms change.
 */
export async function negotiationStrategyAction(
  offerId: number
): Promise<{ success: true; strategy: NegotiationStrategy } | { success: false; error: string }> {
  const ctx = await loadDealContext(offerId);
  if (!ctx.ok) return { success: false, error: ctx.error };
  if (!ctx.isSeller) {
    return { success: false, error: 'Strategy guidance is for the listing owner' };
  }

  const { data: cma } = await ctx.supabase
    .from('cma_reports')
    .select('estimated_valuation')
    .eq('property_id', ctx.offer.property_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: competing } = await ctx.supabase
    .from('offers')
    .select('offer_amount')
    .eq('property_id', ctx.offer.property_id)
    .neq('id', offerId)
    .in('status', ['submitted', 'countered']);

  const { data: messages } = await ctx.supabase
    .from('offer_messages')
    .select('body, sender_id')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: true })
    .limit(20);

  try {
    const strategy = await generateNegotiationStrategy({
      propertyAddress: `${ctx.property.address}, ${ctx.property.city}, ${ctx.property.state}`,
      zipCode: ctx.property.zip_code,
      listPrice: Number(ctx.property.price),
      offerAmount: Number(ctx.offer.offer_amount),
      earnestMoney: ctx.offer.earnest_money === null ? null : Number(ctx.offer.earnest_money),
      financingType: ctx.offer.financing_type,
      proposedClosingDate: ctx.offer.proposed_closing_date,
      contingencies: Array.isArray(ctx.offer.contingencies) ? ctx.offer.contingencies : [],
      estimatedValuation: cma ? Number(cma.estimated_valuation) : null,
      recentMessages: (messages ?? []).map(
        (m: { sender_id: string; body: string }) =>
          `${m.sender_id === ctx.offer.buyer_id ? 'Buyer' : 'Seller'}: ${m.body}`
      ),
      competingOfferAmounts: (competing ?? []).map((o: { offer_amount: number }) =>
        Number(o.offer_amount)
      ),
    });

    return { success: true, strategy };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
