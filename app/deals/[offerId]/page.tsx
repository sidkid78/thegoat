import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CollaborationHub } from '@/components/deals/CollaborationHub';

/**
 * The negotiation workspace for a single offer: the message thread between the
 * two parties, the live offer terms, and (for the seller) AI counter guidance.
 *
 * Participation is checked explicitly rather than left to RLS, because the page
 * needs to know *which* side the viewer is on -- the seller gets counter
 * controls, the buyer doesn't.
 */
export default async function DealPage({
  params,
}: {
  params: Promise<{ offerId: string }>;
}) {
  const { offerId } = await params;
  const id = Number(offerId);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: offer } = await supabase
    .from('offers')
    .select(
      'id, property_id, buyer_id, offer_amount, earnest_money, contingencies, proposed_closing_date, financing_type, status, counter_amount, counter_concession, counter_notes, countered_at, created_at, properties (id, address, city, state, zip_code, price, owner_id), profiles:buyer_id (full_name, email)'
    )
    .eq('id', id)
    .single();

  if (!offer) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const property = offer.properties as any;
  const isBuyer = offer.buyer_id === user.id;
  const isSeller = property?.owner_id === user.id;
  if (!isBuyer && !isSeller) notFound();

  const { data: messages } = await supabase
    .from('offer_messages')
    .select('id, body, sender_id, created_at')
    .eq('offer_id', id)
    .order('created_at', { ascending: true });

  // Which number this offer is among the listing's offers, oldest first --
  // the "Offer #3" chip in the header.
  const { data: siblings } = await supabase
    .from('offers')
    .select('id')
    .eq('property_id', offer.property_id)
    .order('created_at', { ascending: true });

  const offerIndex = (siblings ?? []).findIndex((o) => o.id === id) + 1;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  return (
    <CollaborationHub
      offer={offer}
      property={property}
      messages={messages ?? []}
      offerIndex={offerIndex}
      viewerId={user.id}
      viewerName={profile?.full_name ?? 'You'}
      isSeller={isSeller}
    />
  );
}
