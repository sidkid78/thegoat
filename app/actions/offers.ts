'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendOfferContractForSignature } from '@/lib/integrations/docusign';
import { createEarnestMoneyCheckoutSession } from '@/lib/integrations/stripe';
import { analyzeOffers, type OfferAnalysisResult } from '@/lib/ai/offer-analysis';

export async function submitOfferAction(payload: {
  propertyId: number;
  offerAmount: number;
  earnestMoney: number;
  contingencies: string[];
  proposedClosingDate: string;
  financingType: string;
  downPayment: number | null;
}) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  const { data, error } = await supabase
    .from('offers')
    .insert({
      property_id: payload.propertyId,
      buyer_id: user.id,
      offer_amount: payload.offerAmount,
      earnest_money: payload.earnestMoney,
      contingencies: payload.contingencies,
      proposed_closing_date: payload.proposedClosingDate,
      financing_type: payload.financingType,
      // All-cash offers have no down payment to record.
      down_payment: payload.financingType === 'cash' ? null : payload.downPayment,
      status: 'submitted',
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/offers');
  revalidatePath('/dashboard/offers/[propertyId]', 'page');
  return { success: true, offer: data };
}

/**
 * Seller-only (RLS enforces this on the update). Accepts an offer and sends
 * the purchase agreement for e-signature. DocuSign failure doesn't roll back
 * the acceptance -- a seller shouldn't be blocked by an integration hiccup --
 * it's surfaced back to the caller via `docusignError` instead.
 */
export async function acceptOfferAction(offerId: number) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  const { data: offer, error: fetchError } = await supabase
    .from('offers')
    .select(
      'id, offer_amount, contingencies, proposed_closing_date, properties (address), profiles:buyer_id (full_name, email)'
    )
    .eq('id', offerId)
    .single();

  if (fetchError || !offer) {
    return { success: false, error: fetchError?.message || 'Offer not found' };
  }

  const { error: updateError } = await supabase
    .from('offers')
    .update({ status: 'accepted' })
    .eq('id', offerId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  let docusignError: string | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const property = offer.properties as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buyer = offer.profiles as any;

    const result = await sendOfferContractForSignature({
      offerId: offer.id,
      propertyAddress: property?.address ?? '',
      buyerName: buyer?.full_name ?? 'Buyer',
      buyerEmail: buyer?.email ?? '',
      offerAmount: Number(offer.offer_amount),
      closingDate: offer.proposed_closing_date ?? '',
      contingencies: offer.contingencies ?? [],
    });

    if (result.success) {
      await supabase.from('offers').update({ docusign_envelope_id: result.envelopeId }).eq('id', offerId);
    } else {
      docusignError = result.error;
    }
  } catch (err: unknown) {
    docusignError = err instanceof Error ? err.message : String(err);
  }

  revalidatePath('/dashboard/offers');
  revalidatePath('/dashboard/offers/[propertyId]', 'page');
  revalidatePath('/dashboard');
  return { success: true, docusignError };
}

/** Seller-only (RLS enforces this on the update). */
export async function rejectOfferAction(offerId: number) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  const { error } = await supabase.from('offers').update({ status: 'rejected' }).eq('id', offerId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard/offers');
  revalidatePath('/dashboard/offers/[propertyId]', 'page');
  return { success: true };
}

/**
 * Buyer-only. Creates a fresh Stripe Checkout session on demand rather than
 * reusing a stored URL -- Checkout Sessions expire, so a "Pay Now" button
 * always needs a new one.
 */
export async function createEarnestMoneyCheckoutAction(offerId: number) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  const { data: offer, error: fetchError } = await supabase
    .from('offers')
    .select('id, buyer_id, earnest_money, status, properties (address)')
    .eq('id', offerId)
    .single();

  if (fetchError || !offer) {
    return { success: false, error: fetchError?.message || 'Offer not found' };
  }
  if (offer.buyer_id !== user.id) {
    return { success: false, error: 'Not your offer' };
  }
  if (offer.status !== 'accepted') {
    return { success: false, error: 'Offer must be accepted before paying earnest money' };
  }
  if (!offer.earnest_money) {
    return { success: false, error: 'No earnest money amount set on this offer' };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const property = offer.properties as any;
    const session = await createEarnestMoneyCheckoutSession({
      offerId: offer.id,
      propertyAddress: property?.address ?? '',
      amount: Number(offer.earnest_money),
      userEmail: user.email ?? '',
    });

    return { success: true, url: session.url };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Seller-only. Ranks the live offers on one of the caller's listings with a real
 * Gemini reasoning call. Triggered by a button rather than on page load -- it's
 * a paid call and the offer set changes far less often than the page is viewed.
 */
export async function analyzeOffersAction(
  propertyId: number
): Promise<{ success: true; analysis: OfferAnalysisResult } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id, address, city, state, price, owner_id')
    .eq('id', propertyId)
    .single();

  if (propError || !property) {
    return { success: false, error: propError?.message || 'Listing not found' };
  }
  if (property.owner_id !== user.id) {
    return { success: false, error: 'Not your listing' };
  }

  const { data: offers, error: offersError } = await supabase
    .from('offers')
    .select(
      'id, offer_amount, earnest_money, contingencies, proposed_closing_date, financing_type, down_payment, created_at'
    )
    .eq('property_id', propertyId)
    .in('status', ['submitted', 'countered'])
    .order('created_at', { ascending: true });

  if (offersError) {
    return { success: false, error: offersError.message };
  }
  if (!offers || offers.length < 2) {
    return { success: false, error: 'Need at least two open offers to compare.' };
  }

  try {
    const analysis = await analyzeOffers({
      listPrice: Number(property.price),
      propertyAddress: `${property.address}, ${property.city}, ${property.state}`,
      offers: offers.map((o, i) => ({
        id: o.id,
        // Column letters are assigned by submission order, matching the matrix.
        label: `Offer ${String.fromCharCode(65 + i)}`,
        offerAmount: Number(o.offer_amount),
        earnestMoney: o.earnest_money === null ? null : Number(o.earnest_money),
        financingType: o.financing_type,
        downPayment: o.down_payment === null ? null : Number(o.down_payment),
        proposedClosingDate: o.proposed_closing_date,
        contingencies: Array.isArray(o.contingencies) ? o.contingencies : [],
      })),
    });

    return { success: true, analysis };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
