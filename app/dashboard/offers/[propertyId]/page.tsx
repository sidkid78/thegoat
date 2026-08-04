import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OfferComparisonMatrix } from '@/components/dashboard/OfferComparisonMatrix';

/**
 * Side-by-side comparison of every offer on one of the seller's listings.
 * The ownership check is explicit here rather than left to RLS: `offers` RLS
 * lets a buyer read their own offer on someone else's listing, so without it a
 * buyer could reach this page and see competing bids.
 */
export default async function OfferMatrixPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const id = Number(propertyId);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: property } = await supabase
    .from('properties')
    .select('id, address, city, state, zip_code, price, status, photos, created_at, owner_id')
    .eq('id', id)
    .single();

  if (!property || property.owner_id !== user.id) notFound();

  const { data: offers } = await supabase
    .from('offers')
    .select(
      'id, offer_amount, earnest_money, contingencies, proposed_closing_date, financing_type, down_payment, status, docusign_envelope_id, earnest_money_paid_at, created_at, profiles:buyer_id (full_name, email)'
    )
    .eq('property_id', id)
    // Oldest first so the A/B/C column letters stay stable as offers arrive.
    .order('created_at', { ascending: true });

  return <OfferComparisonMatrix property={property} offers={offers ?? []} />;
}
