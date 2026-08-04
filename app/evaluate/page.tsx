import { createClient } from '@/lib/supabase/server';
import { scoreShortlistAction } from '@/app/actions/evaluation';
import type { BuyerPreferences } from '@/lib/buyer-preferences';
import { PropertyEvaluationHub } from '@/components/evaluate/PropertyEvaluationHub';

/**
 * Side-by-side comparison of the properties a buyer has saved.
 *
 * Match % comes from the buyer's stated priorities embedded and compared
 * against each listing's stored vector -- the same machinery as search, with
 * the relationship inverted (fixed property set, one preference query). ROI is
 * a real gross rental yield off the most recent CMA for each property, so it's
 * absent until a valuation has been generated rather than estimated.
 */
export default async function EvaluatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <PropertyEvaluationHub favorites={[]} scores={{}} cmaByProperty={{}} preferences={null} isSignedIn={false} />;
  }

  const { data: favorites } = await supabase
    .from('favorites')
    .select(
      'created_at, properties (id, address, city, state, zip_code, price, bedrooms, bathrooms, square_feet, property_type, status, photos)'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const rows = (favorites ?? []).filter((f) => f.properties);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const propertyIds = rows.map((f: any) => f.properties.id);

  // Most recent CMA per property, for the real ROI figure.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cmaByProperty: Record<number, any> = {};
  if (propertyIds.length > 0) {
    const { data: cmas } = await supabase
      .from('cma_reports')
      .select('property_id, estimated_valuation, report_data, created_at')
      .in('property_id', propertyIds)
      .order('created_at', { ascending: false });

    for (const cma of cmas ?? []) {
      // Ordered newest first, so the first one seen per property wins.
      if (!(cma.property_id in cmaByProperty)) cmaByProperty[cma.property_id] = cma;
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', user.id)
    .single();

  const preferences = (profile?.metadata?.buyerPreferences as BuyerPreferences | undefined) ?? null;
  const scores = preferences ? await scoreShortlistAction() : {};

  return (
    <PropertyEvaluationHub
      favorites={rows}
      scores={scores}
      cmaByProperty={cmaByProperty}
      preferences={preferences}
      isSignedIn
    />
  );
}
