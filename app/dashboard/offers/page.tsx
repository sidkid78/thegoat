import { createClient } from '@/lib/supabase/server';
import { SellerOffersInbox } from '@/components/dashboard/SellerOffersInbox';

/**
 * Offers submitted on properties the signed-in user owns -- the seller-side
 * counterpart to the buyer's offer list on /dashboard. RLS already scopes
 * "offers" to buyer-or-owner, but the `!inner` join filter here narrows this
 * page specifically to the owner side.
 *
 * Rows are grouped per listing so each one links into the comparison matrix at
 * /dashboard/offers/[propertyId]; a flat list can't show competing bids against
 * each other, which is the whole point of the seller view.
 */
export default async function SellerOffersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let offers: any[] = [];

  if (user) {
    const { data } = await supabase
      .from('offers')
      .select(
        'id, offer_amount, earnest_money, contingencies, proposed_closing_date, financing_type, down_payment, status, docusign_envelope_id, created_at, properties!inner (id, address, city, state, price, owner_id), profiles:buyer_id (full_name, email)'
      )
      .eq('properties.owner_id', user.id)
      .order('created_at', { ascending: false });

    offers = data ?? [];
  }

  return <SellerOffersInbox offers={offers} isSignedIn={!!user} />;
}
